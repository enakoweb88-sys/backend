#!/bin/sh
set -eu
# Migrations run in an approved, separate release job with a distinct privileged identity.
exec node dist/main.js
