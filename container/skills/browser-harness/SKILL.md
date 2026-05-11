---
name: browser-harness
description: Drive a persistent Browser Use Cloud (or local Chromium) browser session. Navigate pages, extract data, fill forms, handle logins/2FA/CAPTCHA via live URL handoff to the user. The browser has persistent cookies and localStorage via a bound profile.
allowed-tools: Bash(browser-harness-js:*), Bash(agent-browser:*)
---

# Browser Use Cloud Harness

Drive a long-lived browser session for web automation. The session persists across agent turns — cookies, localStorage, and login state survive via a bound profile.

## Session Management

The browser session is managed by a keeper service that auto-refreshes before expiry. Connection details are in `~/.claude/browser.env`:

```bash
BU_PROFILE_ID=<uuid>
BU_BROWSER_ID=<id>
BU_CDP_WS=wss://connect.browser-use.com/...
BU_BROWSER_LIVE_URL=https://live.browser-use.com/...
BU_BROWSER_EXPIRES_AT=<unix epoch>
```

Always source these before driving the browser:

```bash
source ~/.claude/browser.env
```

## How to Drive the Browser

### Option A: CDP via browser-harness-js (Browser Use Cloud)

The **browser-harness-js** CLI gives you typed CDP access. It keeps a persistent Session object alive between calls — every invocation shares the same connection:

```bash
source ~/.claude/browser.env

# Connect
browser-harness-js "await session.connect({wsUrl: process.env.BU_CDP_WS})"

# Navigate
browser-harness-js "await session.Page.navigate({url: 'https://example.com'})"

# Get page info
browser-harness-js "await session.Runtime.evaluate({expression: 'document.title'})"

# Click an element
browser-harness-js "await session.Runtime.evaluate({expression: 'document.querySelector(\"button\").click()'})"
```

Or in one line:
```bash
source ~/.claude/browser.env && browser-harness-js 'await session.connect({wsUrl: process.env.BU_CDP_WS}); await session.Page.navigate({url: "https://example.com"})'
```

### Option B: agent-browser (local Chromium)

If running without Browser Use Cloud, use the built-in `agent-browser` CLI with local Chromium:

```bash
agent-browser open <url>
agent-browser snapshot -i     # Get interactive elements with refs
agent-browser click @e1        # Click by ref
agent-browser fill @e2 "text"  # Fill input
```

## Login Walls, 2FA, and CAPTCHA Handoff

**Stop. Don't guess, don't credential-stuff, don't give up.** Hand the browser to the user via the live view URL.

1. Read the live URL:
   ```bash
   source ~/.claude/browser.env
   echo "$BU_BROWSER_LIVE_URL"
   ```

2. Tell the user exactly what's blocking you and share the URL:
   ```
   I can't continue — [site] needs you to sign in / complete 2FA / solve a CAPTCHA.
   Open this and complete the auth, then tell me "done":
   [live view URL](https://live.browser-use.com?...)
   ```

3. **Wait for the user to reply** before resuming. Don't poll, don't retry.

4. Once they say "done", continue. Session cookies are now persisted.

This works for: login pages, SMS/email/authenticator 2FA, CAPTCHAs, cookie-consent dialogs, session-expired re-auth, Cloudflare/anti-bot challenges.

## Live View (Debugging / Watch-Along)

Share the live URL any time the user asks "what is the browser doing?":

```bash
source ~/.claude/browser.env && echo "$BU_BROWSER_LIVE_URL"
```

## Cookies & Profile Persistence

Cookies + localStorage persist via the bound profile. A fresh/empty profile starts with no logins — the user logs in once per site, and the profile remembers it.

To check current state:
```bash
browser-harness-js "await session.Runtime.evaluate({expression: 'document.cookie'})"
agent-browser cookies   # if using local Chromium
```

## Working Without Browser Use Cloud

If Browser Use Cloud is not configured, fall back to the local Chromium installed in the container via `agent-browser`. Session state won't persist across container restarts, and there's no live URL for handoff. Use the same interaction patterns but without live-view sharing.

## Configuration

Browser Use Cloud requires:
- `BROWSER_USE_API_KEY` env var
- A valid profile (created on cloud.browser-use.com)
- The keeper service managing session rotation

If neither Browser Use Cloud nor `agent-browser` is available, decline browser tasks with a clear explanation of what's needed.
