#!/bin/sh
set -eu
# Migrations run in an approved, separate release job with a distinct privileged identity.
if [ "${FILE_SCANNER_EMBEDDED:-false}" = "true" ]; then
  if ! command -v clamd >/dev/null 2>&1 || ! command -v freshclam >/dev/null 2>&1; then
    echo "Embedded document scanner binaries are missing." >&2
    exit 1
  fi
  # The operator enables this only on an instance sized for ClamAV. Until its
  # initial signatures are ready, upload scanning continues to fail closed.
  (
    until freshclam --config-file=/app/config/freshclam.conf; do
      echo "Document scanner signatures unavailable; retrying in 5 minutes." >&2
      sleep 300
    done
    clamd --config-file=/app/config/clamd.conf &
    exec freshclam --config-file=/app/config/freshclam.conf --daemon --foreground=true
  ) &
fi
exec node dist/main.js
