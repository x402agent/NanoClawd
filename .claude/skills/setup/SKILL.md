---
name: setup
description: Run initial NanoClawd setup. Use when user wants to install NanoClawd, configure it, or go through first-time setup. Triggers on "setup", "install", "configure nanoclawd", or first-time setup requests.
---

# NanoClawd Setup

Tell the user to run `bash nanoclawd.sh` in their terminal. That script handles the full end-to-end setup — dependencies, container image, OneCLI vault, Anthropic credential, service, first agent, and optional channel wiring.

If they hit an error partway through, it will offer Claude-assisted recovery inline — no need to come back here.
