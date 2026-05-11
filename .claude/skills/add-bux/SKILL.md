---
name: add-bux
description: Add Bux browser agent to NanoClawd — gives a Clawd agent a real persistent Chromium session via Browser Use Cloud, plus agency Telegram action cards. Use when the user wants their agent to browse the web with a real browser (cookies persist, logins stick) or handle 2FA/CAPTCHA hand-off.
---

# Bux Browser Agent for NanoClawd 🦞

Bux gives a NanoClawd Clawd agent a real, persistent Chromium browser via [Browser Use Cloud](https://cloud.browser-use.com). Sessions survive reboots. Logins stick. On CAPTCHA/2FA walls the agent surfaces a live view URL and waits rather than stuffing credentials.

Source: `bux-main/` (already in this repo).

## Pre-flight

- `BROWSER_USE_API_KEY` — [cloud.browser-use.com](https://cloud.browser-use.com/new-api-key) (free tier: 3 concurrent browsers)
- `TG_BOT_TOKEN` — optional, from [@BotFather](https://t.me/BotFather)
- A target NanoClawd agent group

## Install

### 1. Add to `.env`

```bash
BROWSER_USE_API_KEY=bu_xxx
TG_BOT_TOKEN=xxx    # optional
```

### 2. Install Python deps

```bash
cd bux-main/agent && pip install -r requirements.txt
```

### 3. Copy operating manual into the agent group

```bash
mkdir -p groups/<group-folder>/CLAUDE.local.d
cp bux-main/agent/CLAUDE.md groups/<group-folder>/CLAUDE.local.d/bux.md
```

### 4. Mount bux scripts into the container

```bash
nclwd groups config update --id <group-id> \
  --mounts '[{"host":"bux-main/agent","container":"/home/node/bux"}]'
```

### 5. (Linux VPS) Install systemd services

```bash
sudo cp bux-main/agent/bux-browser-keeper.service /etc/systemd/system/
sudo cp bux-main/agent/bux-tg.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now bux-browser-keeper bux-tg
```

### 6. Restart agent group

```bash
nclwd groups restart --id <group-id> \
  --message "Bux browser agent now available. Read /home/node/bux/CLAUDE.md."
```

## Verification

Send the agent: `visit https://browser-use.com and tell me the page title`

## How it works

The agent builds browser-harness skills per-domain in `~/.claude/skills/cdp/domain-skills/<site>/`. It drives through the BU Cloud CDP session — no direct Chrome access. On login walls it emits a live view URL and pauses.

## Agency cards

`agency_db.py` + `tg-approve.py` surface irreversible steps as Telegram cards with one-tap buttons (Approve / Dismiss / Refine / Custom). The user taps; the bot dispatches back. No typing required.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "no browser session" | Check `BROWSER_USE_API_KEY`; verify `bux.md` was copied |
| Browser keeper crashes | `pip install -r bux-main/agent/requirements.txt` |
| TG bot silent | Check `TG_BOT_TOKEN`; check `bux-tg` service status |
| 2FA stuck | Agent should have sent a live view URL — check Telegram |
