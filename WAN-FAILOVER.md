# WAN Failover Watchdog — Operations Guide

Self-contained instructions to (re)deploy, test, tune, and roll back the WAN
failover watchdog on the home router. Everything needed lives in this one file.

> This configures the **router**, not this repo. The scripts below live on the
> router's overlay filesystem (`/usr/bin/...`, `/etc/init.d/...`), not in this
> project. This file is just the source-of-truth documentation/backup.

---

## 1. Target device

| Item | Value |
|---|---|
| Model | MERCUSYS MR70X v1 (`mercusys,mr70x-v1`) |
| SoC | MediaTek MT7621 — 4× MIPS 1004Kc @ ~880 MHz |
| RAM | 118 MB total (~28 MB free) |
| Flash | overlay ~7.6 MB, **~7.2 MB free** (main constraint — avoid heavy packages) |
| OS | OpenWrt 25.12.2 (`r32802`), kernel 6.12 |
| Firewall backend | nftables (`nft`, `iptables-nft`) |
| LAN | `192.168.1.1/24` on `br-lan` |

### Uplinks (already configured in `/etc/config/network`)
| Interface | Device | Role | Gateway | Metric |
|---|---|---|---|---|
| `wan` | `wan` (DHCP) | **Primary** | `192.168.88.1` | 10 |
| `wwan` | `phy0-sta0` (DHCP, upstream Wi-Fi / hotspot) | **Backup** | `172.20.10.1` | 20 |

Failover mechanism: both default routes coexist; the kernel prefers the lower
metric. The watchdog **demotes `wan` (metric 10 → 1000)** when the internet is
unreachable, so the backup (metric 20) wins; it restores metric 10 once `wan`
is stable again.

---

## 2. Connection

```bash
ssh root@192.168.1.1     # password: root
```

> SECURITY: default `root/root` credentials. Change the router password and,
> ideally, switch to SSH keys. Do **not** commit real credentials to a shared
> repo. (Historically automated with `sshpass -p 'root' ssh ...` for
> non-interactive runs.)

---

## 3. Requirements met by this design

- Switch to backup within **~1–2 s** of the primary losing internet.
- Only fail over when **all** health-check targets are unreachable (no false
  trips from a single provider hiccup).
- After the primary recovers, verify **~5 s of stability** before switching back.
- Tiny footprint (pure shell + BusyBox `ip`/`ping`) — no extra packages, which
  matters given the ~7 MB free flash. mwan3 was rejected: heavier, needs
  `ip-full`, and its reload-based switching isn't built for ~1 s failover.

---

## 4. Scripts

### 4a. `/usr/bin/wan-watchdog.sh`

```sh
#!/bin/sh
# /usr/bin/wan-watchdog.sh  -- fast WAN failover with debounced failback
# Health check: 3 targets, 2 pings each, probed in PARALLEL.
# WAN is "down" only if ALL targets fail (~1-2s detection). Failback after STABLE_OK good cycles.

CHECK_IPS="1.1.1.1 9.9.9.9 8.8.8.8"   # independent anycast networks; any reply = WAN up
WAN_IF="wan"                          # primary uplink (lower metric)
LOSS_LIMIT=1                          # failed cycles (all targets down) before switching (~1-2s)
STABLE_OK=5                           # good cycles before returning to WAN (~5s)
GOOD_METRIC=10                        # normal primary metric (matches /etc/config/network)
BAD_METRIC=1000                       # demoted metric so backup (metric 20) takes over
PROBE_FLAG="/tmp/.wan_probe_ok"

fail=0; ok=0; wan_bad=0; wan_gw=""

log() { logger -t wan-watchdog "$1"; }

read_wan_gw() {  # busybox: dev filter works, default filter does NOT
    ip route show dev "$WAN_IF" 2>/dev/null | awk '/^default/{print $3; exit}'
}
demote()  { [ -n "$wan_gw" ] || return; ip route del default via "$wan_gw" dev "$WAN_IF" metric "$GOOD_METRIC" 2>/dev/null; ip route add default via "$wan_gw" dev "$WAN_IF" metric "$BAD_METRIC" 2>/dev/null; }
promote() { [ -n "$wan_gw" ] || return; ip route del default via "$wan_gw" dev "$WAN_IF" metric "$BAD_METRIC" 2>/dev/null; ip route add default via "$wan_gw" dev "$WAN_IF" metric "$GOOD_METRIC" 2>/dev/null; }

# ping all targets in parallel (2 pings each, 1s cap); success if ANY target replies
wan_ok() {
    rm -f "$PROBE_FLAG" 2>/dev/null
    for ip in $CHECK_IPS; do
        ( ping -I "$WAN_IF" -A -c 2 -w 1 -W 1 "$ip" >/dev/null 2>&1 && echo 1 > "$PROBE_FLAG" ) &
    done
    wait
    [ -s "$PROBE_FLAG" ] && { rm -f "$PROBE_FLAG"; return 0; }
    return 1
}

while true; do
    gw=$(read_wan_gw); [ -n "$gw" ] && wan_gw="$gw"

    if wan_ok; then
        ok=$((ok+1)); fail=0
    else
        fail=$((fail+1)); ok=0
    fi

    if [ "$wan_bad" -eq 0 ] && [ "$fail" -ge "$LOSS_LIMIT" ]; then
        log "WAN down (all targets failed) -> switching to backup"; demote; wan_bad=1
    elif [ "$wan_bad" -eq 1 ]; then
        demote
        if [ "$ok" -ge "$STABLE_OK" ]; then
            log "WAN stable ${ok}s -> restoring primary"; promote; wan_bad=0
        fi
    fi

    [ "$fail" -eq 0 ] && sleep 1
done
```

### 4b. `/etc/init.d/wan-watchdog` (procd service — unchanged from stock)

```sh
#!/bin/sh /etc/rc.common

START=99
USE_PROCD=1

start_service() {
    procd_open_instance
    procd_set_param command /usr/bin/wan-watchdog.sh
    procd_set_param respawn
    procd_close_instance
}
```

---

## 5. Deployment

Run from a workstation (writes the script over SSH via a quoted heredoc so
nothing expands locally). Adjust the here-doc body if you change tunables.

```bash
ssh root@192.168.1.1 '
# 1) Back up whatever is there now
cp -a /usr/bin/wan-watchdog.sh /usr/bin/wan-watchdog.sh.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null

# 2) Write the new script  (paste the full 4a body between the EOF markers)
cat > /usr/bin/wan-watchdog.sh <<"EOF"
... contents of section 4a ...
EOF
chmod +x /usr/bin/wan-watchdog.sh

# 3) Ensure the init script exists (section 4b) and is enabled
[ -f /etc/init.d/wan-watchdog ] || cat > /etc/init.d/wan-watchdog <<"EOF"
... contents of section 4b ...
EOF
chmod +x /etc/init.d/wan-watchdog
/etc/init.d/wan-watchdog enable

# 4) Syntax check + (re)start
sh -n /usr/bin/wan-watchdog.sh && echo "syntax OK"
/etc/init.d/wan-watchdog restart
'
```

### Verify it is healthy
```bash
ssh root@192.168.1.1 '
ps w | grep wan-watchdog | grep -v grep          # main proc (+ transient ping workers)
top -bn1 | grep wan-watchdog | grep -v grep      # CPU should idle ~0%
ip route show | grep "^default"                  # wan metric 10 preferred, backup metric 20
'
```

---

## 6. Controlled failover test (non-destructive to normal traffic)

Blackholes only the probe IPs to simulate a full internet outage; self-cleans.

```bash
ssh root@192.168.1.1
# on the router:
for t in 1.1.1.1 9.9.9.9 8.8.8.8; do ip route add blackhole $t; done   # simulate full outage
sleep 3;  ip route | grep '^default'      # EXPECT: wan metric 1000 (backup/metric 20 active)
for t in 1.1.1.1 9.9.9.9 8.8.8.8; do ip route del blackhole $t; done   # restore
sleep 7;  ip route | grep '^default'      # EXPECT: wan back to metric 10
logread | grep wan-watchdog | tail
```

Expected log:
```
wan-watchdog: WAN down (all targets failed) -> switching to backup
wan-watchdog: WAN stable 5s -> restoring primary      # ~5s after blackholes removed
```

Confirmed timings: switch in ~1–2 s (parallel probes), failback ~5 s after
recovery.

---

## 7. Tunables (top of `/usr/bin/wan-watchdog.sh`)

| Variable | Default | Meaning / how to change behavior |
|---|---|---|
| `CHECK_IPS` | `1.1.1.1 9.9.9.9 8.8.8.8` | Probe targets (independent networks). Fewer = faster full-outage detection; more = more robust. Use raw IPs (no DNS). |
| `WAN_IF` | `wan` | Primary uplink logical name. |
| `LOSS_LIMIT` | `1` | Consecutive failed cycles (all targets down) before failover. Raise to `2` for extra debounce (~+1–2 s). |
| `STABLE_OK` | `5` | Consecutive good cycles (~seconds) required before failback. |
| `GOOD_METRIC` | `10` | Must match `option metric` for `wan` in `/etc/config/network`. |
| `BAD_METRIC` | `1000` | Any value `>` backup metric (20). |

After editing: `/etc/init.d/wan-watchdog restart`.

---

## 8. Rollback

```bash
ssh root@192.168.1.1 '
ls -1 /usr/bin/wan-watchdog.sh.bak.*                       # list backups
cp -a /usr/bin/wan-watchdog.sh.bak.<TIMESTAMP> /usr/bin/wan-watchdog.sh
/etc/init.d/wan-watchdog restart
'
```
Known-good backups created during setup: `...bak.20260715195709`,
`...bak.20260715201623`.

To disable failover entirely: `/etc/init.d/wan-watchdog disable && /etc/init.d/wan-watchdog stop`
(then manually ensure `wan` default route is at metric 10).

---

## 9. Gotchas discovered on this BusyBox/OpenWrt build (important)

- **`sleep` is integer-only.** `sleep 0.3` errors (`invalid number`) and returns
  instantly → the original script busy-looped and flapped. Use whole seconds.
- **`ip route show` ignores the `default` filter** (returns the whole table) but
  **does** honor `dev <if>`. Hence `read_wan_gw` filters by `dev` and matches
  `^default` with awk, instead of `ip route show default`.
- **No fractional `sleep`, no `usleep`.** Sub-second pacing/detection is achieved
  via `ping -A -c 2 -w 1 -W 1` and parallel probes, not sleeps.
- **`ip route change <metric>` is fragile** (metric is part of the route key).
  Use explicit `del` (by full spec) + `add` — as `demote()`/`promote()` do.
- **DHCP conflict.** `wan` is `proto dhcp` with `option metric 10`; a DHCP renew
  reinstalls the metric-10 default and would undo a demotion. The watchdog
  re-asserts `demote()` every cycle while `wan_bad=1` to counter this.
- **`ping -I wan`** binds probes to the primary interface, so recovery is
  detected even while traffic is flowing over the backup.

---

## 10. Persistence note

`/usr/bin/wan-watchdog.sh` and `/etc/init.d/wan-watchdog` live on the overlay and
survive reboots, but **not** a sysupgrade-without-settings or a factory reset.
To include them in the OpenWrt backup, add to `/etc/sysupgrade.conf`:
```
/usr/bin/wan-watchdog.sh
/etc/init.d/wan-watchdog
```
This file (in the repo) is the off-device source of truth — re-deploy from
sections 4–5 if the router is reflashed.
