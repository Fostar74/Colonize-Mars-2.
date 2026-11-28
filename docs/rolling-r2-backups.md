# Rolling SQLite backups

The existing Render web service can maintain separate daily and pre-deploy
backups in the existing private `colonize-mars-2-backups` bucket. This code
leaves every `pr-105/` key untouched. Those older archives still require
their original passphrases and their existing verification procedure.

## Startup and prerequisites

The current Render command is `npm run start:server`. Render does not mount
the persistent disk for build commands, pre-deploy commands or one-off jobs.
The start script therefore takes and verifies the pre-deploy snapshot after
Render mounts the disk and **before** importing the app or initializing SQLite.
With automation active, a failed backup stops startup before migrations.
The existing single disk-backed service supplies the one-writer guarantee.
Do not run a second writer against the rolling keys.

Activation is separate from deployment. Retain the current
`DATABASE_PATH`, mounted disk, and existing `R2_BUCKET`, `R2_ENDPOINT`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and Gmail SMTP settings.
The scoped R2 credential needs Get and Put access for the rolling prefix.
Set `R2_BACKUP_PASSPHRASE` as a Render secret, using a random vault-managed
value of at least 32 URL-safe characters. Keep a recoverable copy outside
Render. Set `R2_BACKUP_ALERT_EMAIL` to an approved inbox for failures, then
set `R2_BACKUP_AUTOMATION_ENABLED=true` only after reviewing the startup
behavior. Keep the automation off if these prerequisites are unavailable.
Never paste the secret into GitHub, chat, or a terminal command.

## Operation and verification

Each slot has a separate pointer and two alternating data objects.
The worker uses the read-only SQLite backup API, a local integrity check,
AES-256-GCM with a randomly salted scrypt key, and a private upload. The
inactive object is downloaded, authenticated, decrypted and compared
against both SHA-256 hashes, and SQLite integrity is checked again. The
pointer changes conditionally only after those checks. The previous pointer
and active object are preserved on pre-publication failure. The other slot
remains untouched. No R2 deletions or lifecycle changes are used.

The scheduler attempts a daily refresh after 24 hours. It checks every
15 minutes, with at least six hours between attempts and a persisted state
file to bound retries across restarts. Startup and daily work do not overlap.
An enabled worker logs failures, and the existing Gmail sender attempts
one failure or stale-backup notification per 24 hours. A failed send is
also logged. Candidate files are capped at 64 MiB each, so the two rolling
slots use at most about 256 MiB plus their pointers. The script uses the
existing account and bucket. Review overall R2 usage if those resources are
also used by other workloads.

After approved activation, confirm both verified slot messages and successful
Render health. The existing Render Shell can independently download and check
each published slot. This writes only to a temporary directory and never
replaces the live database.

```sh
node scripts/rolling-backup.js --verify predeploy
node scripts/rolling-backup.js --verify daily
```

A successful line includes the slot timestamp and `SQLite integrity_check ok`.
