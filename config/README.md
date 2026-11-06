# Runtime configuration files

`supabase-ca.crt` is Supabase's **public** root CA, not a private key or application credential. It was downloaded over HTTPS from the certificate URL used by Supabase's official Studio configuration:

- https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
- https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- SHA-256 certificate fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
- Certificate expiration: 2031-04-26.

The Prisma service requires encrypted connections and strict certificate verification for Supabase hosts, resolving the certificate path from the installed application rather than relying on an operator-specific absolute path.

`clamd.conf` binds the scanner only to `127.0.0.1:3310`. `freshclam.conf` maintains the signature database. The Docker image contains these binaries and a process-group-aware init. Set `FILE_SCANNER_EMBEDDED=true` to start them **only after sizing the instance appropriately**. ClamAV's documentation recommends at least 3 GiB for the scanner, plus memory for other applications: https://docs.clamav.net/manual/Installing/Docker.html . No hosting plan or billing setting is changed by the application.

The embedded scanner is disabled by default to avoid silently starting a memory-heavy daemon on a small instance. Until a configured loopback scanner has loaded its signatures, uploads fail closed with 503; the application does not pretend a scan succeeded. The database health endpoint is not a certification that antivirus or all third-party services are ready.
