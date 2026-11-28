# Password recovery

Password redemption is disabled unless `PASSWORD_RECOVERY_ENABLED=true`.
Public email requests additionally require `PASSWORD_RECOVERY_EMAIL_ENABLED=true`,
a trusted `PASSWORD_RECOVERY_ORIGIN` (the HTTPS game origin), and the existing
Gmail SMTP configuration. Leave the public switch unset until after receipt
and redemption have been verified with an authorized test inbox.

## Gmail SMTP

The owner configured a dedicated Gmail account in Render. The application uses
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` (implicit TLS) or `587` (required
STARTTLS), `SMTP_USER` and `SMTP_PASS`. Keep the app password exclusively in
the managed secret environment. The sender and TLS certificate are verified
through the authenticated SMTP connection. No Cloudflare mail or R2 changes
are required.

The login page shows “Forgot password?” only when the server can accept
requests. Responses are generic for known, unknown and rate-limited addresses.
Each account can have only one active link. The database reserves at most
two send attempts per account and 40 total in a rolling 24 hours, including
failed sends. Limits persist across restarts. An active link from a failed
or interrupted attempt can delay retry by up to 30 minutes. The request API
also limits peer and global request rates and bounds concurrent SMTP sends.
Render's ingress can cause users to share a peer limit.

## Controlled delivery check before public activation

1. Obtain approval for the test inbox. Use this PR checkout, an isolated
   server and a fresh SQLite database with a single synthetic account
   registered to that inbox. Keep the server private or loopback-only.
   Provision the SMTP settings through an approved secret environment.
2. Set both recovery switches only on that isolated instance. Request reset
   from the login page. Verify the message arrives in the authorized inbox,
   that it is from the dedicated sender, and that the link targets the
   expected HTTPS origin. For loopback-only tests, redeem the fragment token
   on the same isolated server.
3. Verify the new password works, the old session and password are rejected,
   and the original player data is intact. Record delivery and redemption
   results without the password, link, token or recipient address.
4. Render's production service deploys automatically from main. Wait for
   review and owner approval before merging, deploying or changing production
   switches. Verify that production SQLite uses its existing disk mount.

The automated integration test replaces the SMTP transport and exercises
request, message generation, and redemption with synthetic accounts.
It does not establish inbox delivery.

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
