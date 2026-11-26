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
case $# in
    0)
        [[ -f "$source_db" && -s "$source_db" && -r "$source_db" ]] ||
            fail 'Production database is missing, empty, or unreadable.'
        ;;
    4)
        [[ $1 == --verify && $2 =~ ^pr-105/[0-9]{8}T[0-9]{6}Z-[a-f0-9]{32}\.sqlite3\.enc$ &&
           $3 =~ ^[a-f0-9]{64}$ && $4 =~ ^[a-f0-9]{64}$ ]] ||
            fail 'Usage: backup-pr105.sh --verify OBJECT_KEY CIPHERTEXT_SHA256 SQLITE_SHA256'
        ;;
    *) fail 'Usage: backup-pr105.sh [--verify OBJECT_KEY CIPHERTEXT_SHA256 SQLITE_SHA256]' ;;
esac
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
    local method=$1 output=$2 status code=UnrecognizedOrAbsent curl_exit=0
    local code_pattern='<Code>([A-Za-z0-9]+)</Code>'
    shift 2
    # Send credentials in curl's config stream so they stay out of process arguments.
    status=$(printf 'user = "%s:%s"\n' "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY" |
        curl -q --config - --silent --proto '=https' --output "$output" \
            --write-out '%{http_code}' --connect-timeout 15 --max-time 900 \
            --aws-sigv4 'aws:amz:auto:s3' "$@" "$endpoint_origin/$R2_BUCKET/$key") || curl_exit=$?
    [[ $status =~ ^[0-9]{3}$ ]] || status=000
    if [[ $curl_exit == 0 && $status == 200 ]]; then
        return 0
    fi
    # Never print the response body, server message, or curl trace.
    if [[ -s $output && $status =~ ^[45] ]]; then
        local sample=''
        IFS= read -r -n 8192 -d '' sample < "$output" || true
        if [[ $sample =~ $code_pattern ]]; then
            case ${BASH_REMATCH[1]} in
                AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|AuthorizationHeaderMalformed|\
                RequestTimeTooSkewed|NoSuchBucket|NoSuchKey|PreconditionFailed|ObjectLockedByBucketPolicy|\
                InvalidArgument|InvalidRequest|NotImplemented|MissingContentLength|EntityTooLarge|\
                BadDigest|XAmzContentSHA256Mismatch|InternalError|ServiceUnavailable|SlowDown)
                    code=${BASH_REMATCH[1]} ;;
            esac
        fi
    fi
    printf 'R2 %s failed (HTTP %s, curl exit %s, R2 code %s).\n' \
        "$method" "$status" "$curl_exit" "$code" >&2
    return 1
}

cipher=(-aes-256-cbc -pbkdf2 -iter 600000 -md sha256)
if [[ $# == 0 ]]; then
    timestamp=$(date -u +%Y%m%dT%H%M%SZ)
    nonce=$(openssl rand -hex 16)
    key="pr-105/$timestamp-$nonce.sqlite3.enc"
    timeout 300 sqlite3 -batch -bail -readonly -init /dev/null "$source_db" \
        '.timeout 5000' ".backup $work/snapshot.db" || fail 'SQLite snapshot failed or timed out.'
    integrity "$work/snapshot.db"
    plain_hash=$(digest "$work/snapshot.db")
    openssl enc "${cipher[@]}" -salt -in "$work/snapshot.db" -out "$work/upload.enc" \
        -pass fd:3 3<<<"$backup_password"
    cipher_hash=$(digest "$work/upload.enc")
    rm -- "$work/snapshot.db"
    printf 'Candidate object %s\n' "$key" >&2
    r2 PUT "$work/put-response" --header 'If-None-Match: *' \
        --header "x-amz-content-sha256: $cipher_hash" --upload-file "$work/upload.enc" ||
        fail 'Upload did not return success. Keep the PRs on hold.'
    rm -- "$work/upload.enc"
else
    key=$2
    cipher_hash=$3
    plain_hash=$4
fi
r2 GET "$work/download.enc" || fail 'Could not retrieve the encrypted backup.'
[[ $(digest "$work/download.enc") == "$cipher_hash" ]] ||
    fail 'Downloaded ciphertext SHA-256 mismatch.'

openssl enc -d "${cipher[@]}" -in "$work/download.enc" -out "$work/restored.db" \
    -pass fd:3 3<<<"$backup_password"
unset backup_password
[[ $(digest "$work/restored.db") == "$plain_hash" ]] || fail 'Restored SQLite SHA-256 mismatch.'
integrity "$work/restored.db"

printf 'VERIFIED s3://%s/%s\nCiphertext SHA-256 %s\nSQLite SHA-256 %s\nSQLite integrity_check ok\n' \
    "$expected_bucket" "$key" "$cipher_hash" "$plain_hash"
printf 'Independent verification arguments: --verify %s %s %s\n' "$key" "$cipher_hash" "$plain_hash"
