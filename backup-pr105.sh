#!/usr/bin/env bash
# Run on the live Render instance. Prompt for the vault-held passphrase over SSH.
set +x
set -euo pipefail
umask 077
export LC_ALL=C

fail() { printf '%s\n' "$1" >&2; exit 1; }

for tool in sqlite3 openssl curl timeout sha256sum mktemp date rm grep; do
    command -v "$tool" >/dev/null || fail "Missing required tool: $tool"
done

source_db=/var/data/colonize_mars.db
expected_bucket=colonize-mars-2-backups
[[ -f "$source_db" && -s "$source_db" && -r "$source_db" ]] ||
    fail 'Production database is missing, empty, or unreadable.'
[[ ${R2_BUCKET:-} == "$expected_bucket" ]] || fail 'Unexpected R2 bucket.'
[[ ${R2_ENDPOINT:-} =~ ^(https://[[:xdigit:]]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com)/*$ ]] ||
    fail 'R2_ENDPOINT must be a Cloudflare R2 S3 HTTPS endpoint.'
endpoint_origin=${BASH_REMATCH[1]}
[[ ${R2_ACCESS_KEY_ID:-} =~ ^[[:alnum:]]+$ &&
   ${R2_SECRET_ACCESS_KEY:-} =~ ^[[:alnum:]]+$ ]] || fail 'Invalid R2 credentials.'
curl -q --help all | grep -- '--aws-sigv4' >/dev/null ||
    fail 'curl with AWS Signature Version 4 support is required.'

if [[ -t 0 ]]; then
    IFS= read -r -s -p 'Vault passphrase (input hidden): ' backup_password ||
        fail 'Could not read the backup passphrase.'
    printf '\n' >&2
else
    IFS= read -r backup_password || fail 'Missing backup passphrase on stdin.'
fi
[[ $backup_password =~ ^[A-Za-z0-9_-]{32,}$ ]] ||
    fail 'Supply a vault-generated passphrase of at least 32 letters, digits, hyphens, or underscores.'
exec </dev/null

work=$(mktemp -d /tmp/colonize-pr105.XXXXXXXX)
trap 'rm -rf -- "$work"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
nonce=$(openssl rand -hex 16)
key="pr-105/$timestamp-$nonce.sqlite3.enc"
url="$endpoint_origin/$R2_BUCKET/$key"

digest() {
    local result
    result=$(sha256sum -- "$1") || return
    printf '%s\n' "${result%% *}"
}

integrity() {
    local result
    result=$(sqlite3 -batch -bail -readonly -init /dev/null "$1" 'PRAGMA integrity_check;') ||
        fail 'SQLite integrity check could not run.'
    [[ "$result" == ok ]] || fail 'SQLite integrity check did not return ok.'
}

r2() {
    # Send credentials in curl's config stream so they stay out of process arguments.
    printf 'user = "%s:%s"\n' "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" |
        curl -q --config - --silent --fail --proto '=https' \
            --connect-timeout 15 --max-time 900 --aws-sigv4 'aws:amz:auto:s3' "$@" "$url"
}

timeout 300 sqlite3 -batch -bail -readonly -init /dev/null "$source_db" \
    '.timeout 5000' ".backup $work/snapshot.db" || fail 'SQLite snapshot failed or timed out.'
integrity "$work/snapshot.db"
plain_hash=$(digest "$work/snapshot.db")

cipher=(-aes-256-cbc -pbkdf2 -iter 600000 -md sha256)
openssl enc "${cipher[@]}" -salt -in "$work/snapshot.db" -out "$work/upload.enc" \
    -pass fd:3 3<<<"$backup_password"
cipher_hash=$(digest "$work/upload.enc")
rm -- "$work/snapshot.db"

printf 'Candidate object %s\n' "$key" >&2
r2 --header "If-None-Match: *" --upload-file "$work/upload.enc" --output /dev/null ||
    fail 'R2 upload failed or its result is unknown.'
r2 --output "$work/download.enc" || fail 'R2 download failed.'
[[ $(digest "$work/download.enc") == "$cipher_hash" ]] ||
    fail 'Downloaded ciphertext SHA-256 mismatch.'
rm -- "$work/upload.enc"

openssl enc -d "${cipher[@]}" -in "$work/download.enc" -out "$work/restored.db" \
    -pass fd:3 3<<<"$backup_password"
unset backup_password
[[ $(digest "$work/restored.db") == "$plain_hash" ]] || fail 'Restored SQLite SHA-256 mismatch.'
integrity "$work/restored.db"

printf 'VERIFIED s3://%s/%s\nCiphertext SHA-256 %s\nSQLite SHA-256 %s\nSQLite integrity_check ok\n' \
    "$expected_bucket" "$key" "$cipher_hash" "$plain_hash"
