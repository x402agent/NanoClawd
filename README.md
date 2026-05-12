<p align="center">
  <img src="assets/lobster-cypherpunk.gif" alt="NanoClawd 🦞 Cypherpunk Lobster" width="300">
</p>

<p align="center">
  <img src="assets/nanoclawd-logo.png" alt="NanoClawd" width="420">
</p>

<p align="center">
  <a href="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=20&pause=1000&color=14F195&center=true&vCenter=true&width=640&lines=Sovereign+Clawd+agents+on+Solana+%F0%9F%A6%9E;Every+identity+on-chain.+Every+session+in+a+container.;Blockchain-first+%C2%B7+Privacy-first+%C2%B7+Attested.;No+env+vars.+No+trust-me+config.+No+exceptions.">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=20&pause=1000&color=14F195&center=true&vCenter=true&width=640&lines=Sovereign+Clawd+agents+on+Solana+%F0%9F%A6%9E;Every+identity+on-chain.+Every+session+in+a+container.;Blockchain-first+%C2%B7+Privacy-first+%C2%B7+Attested.;No+env+vars.+No+trust-me+config.+No+exceptions." alt="Typing SVG">
  </a>
</p>

<p align="center">
  <a href="https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump">
    <img src="https://img.shields.io/badge/%24CLAWD-8cHzQH...pump-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="$CLAWD on Solana">
  </a>&nbsp;
  <a href="https://discord.gg/VDdww8qS42">
    <img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&style=for-the-badge&color=5865F2" alt="Discord">
  </a>&nbsp;
  <a href="https://solanaclawd.com">
    <img src="https://img.shields.io/badge/solanaclawd.com-🦞-14F195?style=for-the-badge" alt="solanaclawd.com">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Bun-agent_runtime-F9F1E1?style=flat-square&logo=bun&logoColor=black" alt="Bun">
  <img src="https://img.shields.io/badge/Docker-isolated-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/Solana-on--chain_identity-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/SQLite-two--DB_session-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite">
</p>

<p align="center">
  <a href="https://solanaclawd.com">solanaclawd.com</a>&nbsp; • &nbsp;
  <a href="https://nanoclawd.dev">nanoclawd.dev</a>&nbsp; • &nbsp;
  <a href="https://docs.nanoclawd.dev">docs</a>&nbsp; • &nbsp;
  <a href="src/solana/README.md">solana</a>&nbsp; • &nbsp;
  <a href="README_zh.md">中文</a>&nbsp; • &nbsp;
  <a href="README_ja.md">日本語</a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="repo tokens" valign="middle"></a>
</p>

---

## Why NanoClawd 🦞

A personal AI assistant has uncomfortable amounts of access: filesystem, credentials, messaging accounts, money. NanoClawd takes the position that *every one of those should be auditable on a public ledger* and *every one should run in an isolated container* — not behind application-level allowlists.

- **🔗 Blockchain-first.** Every identity, delegation, and payment is on-chain. No env vars, no trust-me config. Every Clawd action is auditable on Solana.
- **🔒 Privacy-first.** Every Clawd session lives in its own Linux container with filesystem isolation, not merely behind permission checks. A small enough codebase that one person can read it end-to-end.
- **✅ Attested identity.** Operators and admins are Solana public keys. Owner/admin grants are signed delegations via Solana Attestation Service. See [src/solana/README.md](src/solana/README.md).
- **💰 Solana-native payments.** Agents pay for inference, gateway calls, and third-party APIs from a per-agent-group SOL/SPL escrow. Spend caps and approval policies are enforced on-chain.
- **🦞 Open and minimal.** Maintained by [openclawd](https://github.com/openclawd). Lightweight, secure, customizable.

## Quick Start

```bash
git clone https://github.com/qwibitai/nanoclawd.git nanoclawd-v2
cd nanoclawd-v2
bash nanoclawd.sh
```

`nanoclawd.sh` walks you from a fresh machine to a named Clawd agent you can message. It installs Node, pnpm, and Docker if missing, registers your Anthropic credential with OneCLI, generates a Solana keypair for the agent, builds the agent container, and pairs your first channel (Telegram, Discord, WhatsApp, or a local CLI). If a step fails, Clawd is invoked automatically to diagnose and resume from where it broke.

<details>
<summary><strong>Migrating from NanoClawd v1?</strong></summary>

Run from a fresh v2 checkout next to your v1 install:

```bash
git clone https://github.com/qwibitai/nanoclawd.git nanoclawd-v2
cd nanoclawd-v2
bash migrate-v2.sh
```

`migrate-v2.sh` finds your v1 install (sibling directory, or `NANOCLAWD_V1_PATH=/path/to/nanoclawd`), migrates state into the v2 checkout, then `exec`s into Clawd to finish the parts that need judgment (owner seeding, CLAUDE.local.md cleanup, fork-customisation replay).

Run the script directly, not from inside a Clawd session — the deterministic side needs interactive prompts and real shell I/O for Node/pnpm bootstrap, Docker, OneCLI, and the container build.

**What it does:** merges `.env`, seeds the v2 DB from `registered_groups`, copies group folders + session data + scheduled tasks, installs the channel adapters you select, copies channel auth state (including Baileys keystore + LID mappings for WhatsApp), builds the agent container.

**What it doesn't:** flip the system service. Pick *"switch to v2"* at the prompt, or do it manually after testing — your v1 install is left untouched.

See [docs/v1-to-v2-changes.md](docs/v1-to-v2-changes.md) for what's different and [docs/migration-dev.md](docs/migration-dev.md) for development notes.

</details>

## Philosophy

**🦞 Small enough to understand.** One process, a few source files and no microservices. If you want to understand the full NanoClawd codebase, just ask Clawd to walk you through it.

**🔒 Secure by isolation.** Agents run in Linux containers and they can only see what's explicitly mounted. Bash access is safe because commands run inside the container, not on your host.

**👤 Built for the individual user.** NanoClawd isn't a monolithic framework; it's software that fits each user's exact needs. Instead of becoming bloatware, NanoClawd is designed to be bespoke. You make your own fork and have Clawd modify it to match your needs.

**⚙️ Customization = code changes.** No configuration sprawl. Want different behavior? Modify the code. The codebase is small enough that it's safe to make changes.

**🤖 AI-native, hybrid by design.** The install and onboarding flow is an optimized scripted path, fast and deterministic. When a step needs judgment — a failed install, a guided decision, or a customization — control hands off to Clawd seamlessly. Beyond setup there's no monitoring dashboard or debugging UI either: describe the problem in chat and Clawd handles it.

**🎯 Skills over features.** Trunk ships the registry and infrastructure, not specific channel adapters or alternative agent providers. Channels (Discord, Slack, Telegram, WhatsApp, …) live on a long-lived `channels` branch; alternative providers (OpenCode, Ollama) live on `providers`. You run `/add-telegram`, `/add-opencode`, etc. and the skill copies exactly the module(s) you need into your fork. No feature you didn't ask for.

**⚡ Best harness, best model.** NanoClawd natively uses Clawd via Anthropic's official Clawd Agent SDK, so you get the latest Clawd models and full toolset, including the ability to modify and expand your own NanoClawd fork. Other providers are drop-in options: `/add-codex` for OpenAI's Codex (ChatGPT subscription or API key), `/add-opencode` for OpenRouter, Google, DeepSeek and more via OpenCode, and `/add-ollama-provider` for local open-weight models. Provider is configurable per agent group.

**🔗 Solana-native from birth.** Every NanoClawd agent gets a Solana keypair at spawn time, plus a self-custodial **NanoClawd Wallet** built into the container. Identity is on-chain via the Solana Attestation Service. Payments — inference, API calls, gateway fees — flow from a per-agent-group SOL/SPL escrow. The agent can check balances, send SOL, and swap any token via Jupiter directly from chat. Token: [$CLAWD](https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump) on Solana.

## What It Supports

- **NanoClawd Wallet ⬡** — every agent is born with a self-custodial Solana wallet. Keypair generated at first use, stored in the agent's private workspace, persists across restarts. Five built-in MCP tools: `wallet_info`, `wallet_balance`, `wallet_send`, `wallet_quote`, `wallet_swap`. Swaps route through Jupiter v6 — no API key needed. Bring your own RPC via `NANOCLAWD_SOLANA_RPC`.
- **Multi-channel messaging** — WhatsApp, Telegram, Discord, Slack, Microsoft Teams, iMessage, Matrix, Google Chat, Webex, Linear, GitHub, WeChat, and email via Resend. Installed on demand with `/add-<channel>` skills. Run one or many at the same time.
- **Flexible isolation** — connect each channel to its own agent for full privacy, share one agent across many channels for unified memory with separate conversations, or fold multiple channels into a single shared session so one conversation spans many surfaces. Pick per channel via `/manage-channels`. See [docs/isolation-model.md](docs/isolation-model.md).
- **Per-agent workspace** — each agent group has its own `CLAUDE.md`, its own memory, its own container, and only the mounts you allow. Nothing crosses the boundary unless you wire it to.
- **Scheduled tasks** — recurring jobs that run Clawd and can message you back
- **Web access** — search and fetch content from the web
- **Container isolation** — agents are sandboxed in Docker (macOS/Linux/WSL2), with optional [Docker Sandboxes](docs/docker-sandboxes.md) micro-VM isolation or Apple Container as a macOS-native opt-in
- **Credential security** — agents never hold raw API keys. Outbound requests route through [OneCLI's Agent Vault](https://github.com/onecli/onecli), which injects credentials at request time and enforces per-agent policies and rate limits.

## Usage

Talk to your assistant with the trigger word (default: `@Andy`):

```
@Andy send an overview of the sales pipeline every weekday morning at 9am (has access to my Obsidian vault folder)
@Andy review the git history for the past week each Friday and update the README if there's drift
@Andy every Monday at 8am, compile news on AI developments from Hacker News and TechCrunch and message me a briefing
```

From a channel you own or administer, you can manage groups and tasks:
```
@Andy list all scheduled tasks across groups
@Andy pause the Monday briefing task
@Andy join the Family Chat group
```

## Customizing

NanoClawd doesn't use configuration files. To make changes, just tell Clawd what you want:

- "Change the trigger word to @Bob"
- "Remember in the future to make responses shorter and more direct"
- "Add a custom greeting when I say good morning"
- "Store conversation summaries weekly"

Or run `/customize` for guided changes.

The codebase is small enough that Clawd can safely modify it.

## Contributing

**Don't add features. Add skills.**

If you want to add a new channel or agent provider, don't add it to trunk. New channel adapters land on the `channels` branch; new agent providers land on `providers`. Users install them in their own fork with `/add-<name>` skills, which copy the relevant module(s) into the standard paths, wire the registration, and pin dependencies.

This keeps trunk as pure registry and infra, and every fork stays lean — users get the channels and providers they asked for and nothing else.

### RFS (Request for Skills)

Skills we'd like to see:

**Communication Channels**
- `/add-signal` — Add Signal as a channel

## Requirements

- macOS or Linux (Windows via WSL2)
- Node.js 20+ and pnpm 10+ (the installer will install both if missing)
- [Docker Desktop](https://docker.com/products/docker-desktop) (macOS/Windows) or Docker Engine (Linux)
- [Clawd](https://claude.ai/download) for `/customize`, `/debug`, error recovery during setup, and all `/add-<channel>` skills

## Architecture

```
messaging apps → host (router) → inbound.db → container (Bun · Clawd Agent SDK · Solana keypair)
                                                          ↓
messaging apps ← host (delivery) ← outbound.db ←────────┘
```

A single Node host orchestrates per-session agent containers. When a message arrives, the host routes it via the entity model (user → messaging group → agent group → session), writes it to the session's `inbound.db`, and wakes the container. The agent-runner inside the container polls `inbound.db`, runs Claude, and writes responses to `outbound.db`. The host polls `outbound.db` and delivers back through the channel adapter.

Two SQLite files per session, each with exactly one writer — no cross-mount contention, no IPC, no stdin piping. Channels and alternative providers self-register at startup; trunk ships the registry and the Chat SDK bridge, while the adapters themselves are skill-installed per fork.

For the full architecture writeup see [docs/architecture.md](docs/architecture.md); for the three-level isolation model see [docs/isolation-model.md](docs/isolation-model.md).

Key files:
- `src/index.ts` — entry point: DB init, channel adapters, delivery polls, sweep
- `src/router.ts` — inbound routing: messaging group → agent group → session → `inbound.db`
- `src/delivery.ts` — polls `outbound.db`, delivers via adapter, handles system actions
- `src/host-sweep.ts` — 60s sweep: stale detection, due-message wake, recurrence
- `src/session-manager.ts` — resolves sessions, opens `inbound.db` / `outbound.db`
- `src/container-runner.ts` — spawns per-agent-group containers, OneCLI credential injection
- `src/db/` — central DB (users, roles, agent groups, messaging groups, wiring, migrations)
- `src/channels/` — channel adapter infra (adapters installed via `/add-<channel>` skills)
- `src/providers/` — host-side provider config (`claude` baked in; others via skills)
- `container/agent-runner/` — Bun agent-runner: poll loop, MCP tools, provider abstraction
- `groups/<folder>/` — per-agent-group filesystem (`CLAUDE.md`, skills, container config)

## FAQ

**Why Docker?**

Docker provides cross-platform support (macOS, Linux and Windows via WSL2) and a mature ecosystem. On macOS, you can optionally switch to Apple Container via `/convert-to-apple-container` for a lighter-weight native runtime. For additional isolation, [Docker Sandboxes](docs/docker-sandboxes.md) run each container inside a micro VM.

**Can I run this on Linux or Windows?**

Yes. Docker is the default runtime and works on macOS, Linux, and Windows (via WSL2). Just run `bash nanoclawd.sh`.

**Is this secure?**

Agents run in containers, not behind application-level permission checks. They can only access explicitly mounted directories. Credentials never enter the container — outbound API requests route through [OneCLI's Agent Vault](https://github.com/onecli/onecli), which injects authentication at the proxy level and supports rate limits and access policies. You should still review what you're running, but the codebase is small enough that you actually can. See the [security documentation](https://docs.nanoclawd.dev/concepts/security) for the full security model.

**Why no configuration files?**

We don't want configuration sprawl. Every user should customize NanoClawd so that the code does exactly what they want, rather than configuring a generic system. If you prefer having config files, you can tell Clawd to add them.

**Can I use third-party or open-source models?**

Yes. The supported path is `/add-opencode` (OpenRouter, OpenAI, Google, DeepSeek, and more via OpenCode config) or `/add-ollama-provider` (local open-weight models via Ollama). Both are configurable per agent group, so different agents can run on different backends in the same install.

For one-off experiments, any Claude API-compatible endpoint also works via `.env`:

```bash
ANTHROPIC_BASE_URL=https://your-api-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-token-here
```

**How do I debug issues?**

Ask Clawd. "Why isn't the scheduler running?" "What's in the recent logs?" "Why did this message not get a response?" That's the AI-native approach that underlies NanoClawd.

**Why isn't the setup working for me?**

If a step fails, `nanoclawd.sh` hands off to Clawd to diagnose and resume. If that doesn't resolve it, run `claude`, then `/debug`. If Clawd identifies an issue likely to affect other users, open a PR against the relevant setup step or skill.

**What changes will be accepted into the codebase?**

Only security fixes, bug fixes, and clear improvements will be accepted to the base configuration. That's all.

Everything else (new capabilities, OS compatibility, hardware support, enhancements) should be contributed as skills on the `channels` or `providers` branch.

This keeps the base system minimal and lets every user customize their installation without inheriting features they don't want.

## NanoClawd Wallet ⬡

Every agent is born with its own self-custodial Solana wallet — no external custodian, no API key to manage. The keypair is generated on first use, stored at `/workspace/agent/.wallet/keypair.json` (mode 600) in the agent's private volume, and persists across container restarts.

### Wallet MCP Tools

| Tool | Description |
| --- | --- |
| `wallet_info` | Show Solana address, network, and creation date |
| `wallet_balance` | SOL + token balances (USDC, USDT, CLAWD, and more) |
| `wallet_send` | Send SOL to any address |
| `wallet_quote` | Jupiter v6 swap quote (no funds move) |
| `wallet_swap` | Execute a swap via Jupiter v6 |

```text
# In chat with your agent:
What's my wallet address?
Check my SOL balance
Swap 0.5 SOL to USDC
```

### Configuration

```bash
# .env — point to a faster RPC (Helius, QuickNode, etc.)
NANOCLAWD_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=<key>

# For devnet testing:
NANOCLAWD_SOLANA_RPC=https://api.devnet.solana.com
```

Rebuild the container after any change: `./container/build.sh`

---

## $CLAWD Token 🦞

NanoClawd is the agent runtime for the **$CLAWD** ecosystem — sovereign Clawd agents on Solana.

| Property | Value |
|---|---|
| **Token** | [$CLAWD](https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump) |
| **Contract** | `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` |
| **Chain** | Solana |
| **Website** | [solanaclawd.com](https://solanaclawd.com) |
| **Framework** | [OpenClawd](Framework/) — sovereign lobster agents |

Agents built on NanoClawd can hold $CLAWD, earn $CLAWD, pay other agents in $CLAWD, and beacon to the network via the Solana Attestation Service. Every NanoClawd Wallet ships with $CLAWD in its known-token list — swap to it via `wallet_swap`. A Clawd that can't pay beaches. A Clawd that earns becomes sovereign.

## Community

Questions? Ideas? [Join the Discord](https://discord.gg/VDdww8qS42) or find us at [solanaclawd.com](https://solanaclawd.com).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for breaking changes, or the [full release history](https://docs.nanoclawd.dev/changelog) on the documentation site.

## License

MIT

<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=47894bd5-353b-42fe-bb97-74144e6df0bf" />
