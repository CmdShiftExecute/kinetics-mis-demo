#!/usr/bin/env bash
# Installs or re-installs the Ask the MIS service on node-ss. Idempotent: run it after any change
# to server/, deploy/kinetics-ask.service or deploy/nginx-ask.conf, or after regenerating the data.
#
#   bash /home/sharmas0910/code/kinetics-mis-demo/deploy/install-ask.sh
#
# What it does, every time:
#   1. run/ exists, owned by the user with group www-data and the setgid bit, so the socket the
#      service creates is reachable by nginx and by nobody else.
#   2. The unit file is copied into ~/.config/systemd/user/ when it differs, then the service is
#      reloaded, enabled and restarted so the running code matches the tree.
#   3. The nginx location block is written between its BEGIN and END markers in the site file
#      (inserted before "location / {" on first install, replaced on later runs), nginx -t must pass,
#      then nginx reloads.
#   4. The socket answers /health and the service environment carries no metered key unless the
#      provider is set to api.
set -euo pipefail

REPO=/home/sharmas0910/code/kinetics-mis-demo
SITE=/etc/nginx/sites-enabled/kinetics-mis-demo
UNIT=kinetics-ask.service
UNIT_SRC="$REPO/deploy/$UNIT"
UNIT_DST="$HOME/.config/systemd/user/$UNIT"
SNIPPET="$REPO/deploy/nginx-ask.conf"
SOCK="$REPO/run/ask.sock"

say() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }

# 1. the run directory
mkdir -p "$REPO/run"
# Both through sudo: a user outside the www-data group cannot set the group, and the kernel silently
# drops the setgid bit from a chmod made by a user who is not in the directory's group.
if [ "$(stat -c '%G' "$REPO/run")" != "www-data" ]; then sudo chgrp www-data "$REPO/run"; fi
if [ "$(stat -c '%a' "$REPO/run")" != "2770" ]; then sudo chmod 2770 "$REPO/run"; fi
say "run/ is $(stat -c '%A %U:%G' "$REPO/run")"

# 2. the unit
mkdir -p "$(dirname "$UNIT_DST")"
if ! cmp -s "$UNIT_SRC" "$UNIT_DST"; then
  cp "$UNIT_SRC" "$UNIT_DST"
  say "unit written to $UNIT_DST"
else
  say "unit unchanged"
fi
systemctl --user daemon-reload
systemctl --user enable "$UNIT" >/dev/null 2>&1 || true
systemctl --user restart "$UNIT"
say "service restarted"

# 3. the nginx block, between markers
sudo python3 - "$SITE" "$SNIPPET" <<'PY'
import re, sys
site, snippet = sys.argv[1], sys.argv[2]
text = open(site).read()
block = open(snippet).read().rstrip('\n') + '\n'
pattern = re.compile(r'[ \t]*# BEGIN kinetics-ask.*?# END kinetics-ask[ \t]*\n', re.S)
if pattern.search(text):
    new = pattern.sub(lambda _: block, text, count=1)
    action = 'replaced'
else:
    anchor = re.search(r'^[ \t]*location / \{', text, re.M)
    if not anchor:
        sys.exit('no "location / {" anchor found in ' + site)
    new = text[:anchor.start()] + block + '\n' + text[anchor.start():]
    action = 'inserted'
if new != text:
    open(site, 'w').write(new)
    print('nginx block ' + action)
else:
    print('nginx block unchanged')
PY
sudo nginx -t
sudo systemctl reload nginx
say "nginx reloaded"

# 4. proof
for _ in $(seq 1 40); do [ -S "$SOCK" ] && break; sleep 0.25; done
[ -S "$SOCK" ] || { say "socket did not appear at $SOCK"; systemctl --user status "$UNIT" --no-pager | tail -20; exit 1; }
say "socket $(stat -c '%A %U:%G' "$SOCK")"
HEALTH=$(curl -s --unix-socket "$SOCK" http://ask/health)
say "health: $HEALTH"
PID=$(systemctl --user show "$UNIT" -p MainPID --value)
if tr '\0' '\n' < "/proc/$PID/environ" | grep -q '^ANTHROPIC_API_KEY='; then KEY=yes; else KEY=no; fi
PROVIDER=$(tr '\0' '\n' < "/proc/$PID/environ" | grep '^ASK_PROVIDER=' | cut -d= -f2)
say "provider=$PROVIDER metered key in service environment: $KEY"
if [ "$PROVIDER" = "subscription" ] && [ "$KEY" = "yes" ]; then say "WARNING: a metered key is present while the provider is subscription; remove it from the EnvironmentFile"; fi
systemctl --user is-active "$UNIT" >/dev/null && say "$UNIT is active" || { say "$UNIT is NOT active"; exit 1; }
