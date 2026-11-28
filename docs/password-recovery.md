# Password recovery

Issue #149 adds an owner-issued recovery link. Recovery is disabled unless
`PASSWORD_RECOVERY_ENABLED=true`. There is no public issuance endpoint or email
sender in this change.

## Service prerequisites

Render reports one existing paid game instance with a disk mounted at
`/var/data`. Confirm the deployed SQLite path resolves to that disk before
activation. Main deploys automatically, so review this change on its feature
branch and wait for owner approval before merging or enabling recovery.

Cloudflare Email Service on Workers Free can send to verified destinations using
HTTPS once an eligible existing domain and sender are configured. That restriction
prevents general player delivery on the free tier. The Cloudflare dashboard
required sign-in during verification. Account role, sender onboarding, the
disabled Add control and delivery to an authorized test address remain unverified.
R2 is used for backups and provides no email permissions.

- [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Cloudflare sending setup](https://developers.cloudflare.com/email-service/get-started/send-emails/)
- [Cloudflare destination verification](https://developers.cloudflare.com/email-service/configuration/destination-addresses/)

## Private issuance after owner approval

1. Verify the player's identity through an existing trusted private channel.
   Confirm the immutable numeric user ID against that verified account.
2. In an authorized private shell on the running instance, use the exact
   SQLite path and trusted HTTPS game origin. The application must already be
   running with recovery enabled so the additive token table exists.
3. Run `node scripts/issue-password-reset.js USER_ID` with `DATABASE_PATH`,
   `PASSWORD_RECOVERY_ORIGIN` and `PASSWORD_RECOVERY_ENABLED=true` available
   in the shell. Use a shell whose output is private. The command prints the
   recovery link once. Deliver it directly to the verified player and keep it
   out of logs, tickets, public channels and automated link tracking.
4. The recipient opens the link and sets a password within 30 minutes. Issuing
   a new link invalidates the previous link for that account. A successful
   reset clears existing sessions and leaves game data in place.

Redemption limits apply per token, peer address and server process. Players
behind a common ingress may share a peer-address limit. Following any database
restore, keep recovery disabled until outstanding rows in `password_resets`
have been cleared on the restored copy. This prevents revival of old links.

## Login lookup

Login trims input and uses SQLite ASCII case-insensitive lookup. It checks both
username and email and keeps username precedence when both passwords match.
New registrations lowercase email, and an exact email spelling is preferred
when legacy rows differ only by case. SQLite's default collation does not fold
non-ASCII variants. There is no production account evidence to identify a
specific lookup failure. Issuance uses account ID to avoid ambiguity and leaves
stored identifiers intact.
