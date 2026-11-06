const fs = require("fs"),
  path = require("path"),
  cp = require("child_process"),
  assert = require("assert/strict");
const root = ".cache/scanner-startup-fixtures";
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(
  path.join(root, "node"),
  '#!/bin/sh\nprintf "backend\\n" >> "$SCANNER_TEST_LOG"\n',
);
fs.writeFileSync(
  path.join(root, "clamd"),
  '#!/bin/sh\nprintf "scanner\\n" >> "$SCANNER_TEST_LOG"\n',
);
fs.writeFileSync(
  path.join(root, "sleep"),
  '#!/bin/sh\nprintf "retry-delay\\n" >> "$SCANNER_TEST_LOG"\n',
);
fs.writeFileSync(
  path.join(root, "freshclam"),
  '#!/bin/sh\ncase "$*" in *--daemon*) printf "updater\\n" >> "$SCANNER_TEST_LOG"; exit 0;; esac\nif [ ! -f "$SCANNER_TEST_MARKER" ]; then touch "$SCANNER_TEST_MARKER"; exit 1; fi\nprintf "signatures-ready\\n" >> "$SCANNER_TEST_LOG"\n',
);
const bash =
  process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
cp.execFileSync(bash, ["-n", "start.sh"], { windowsHide: true, stdio: "pipe" });
for (const enabled of ["false", "true"]) {
  const log = root + "/" + enabled + ".log",
    marker = root + "/" + enabled + ".marker";
  for (const f of [log, marker]) if (fs.existsSync(f)) fs.unlinkSync(f);
  const command =
    "chmod +x " +
    root +
    '/*; PATH="$PWD/' +
    root +
    ':$PATH" FILE_SCANNER_EMBEDDED=' +
    enabled +
    " SCANNER_TEST_LOG=" +
    log +
    " SCANNER_TEST_MARKER=" +
    marker +
    " sh ./start.sh";
  cp.execFileSync(bash, ["-c", command], {
    windowsHide: true,
    timeout: 15000,
    stdio: "pipe",
  });
  const lines = fs.readFileSync(log, "utf8").trim().split("\n");
  assert.ok(lines.includes("backend"));
  if (enabled === "false") assert.deepEqual(lines, ["backend"]);
  else
    for (const required of [
      "retry-delay",
      "signatures-ready",
      "scanner",
      "updater",
    ])
      assert.ok(lines.includes(required));
  console.log(
    "PASS scanner " +
      enabled +
      ": isolated startup/retry lifecycle; no real server or database started",
  );
}
