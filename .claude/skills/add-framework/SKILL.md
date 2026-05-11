---
name: add-framework
description: Integrate the OpenClawd Framework (sovereign lobster agents on Solana) into NanoClawd. Wires the Framework's pulse loop, identity, survival mechanics, and $CLAWD token payments into NanoClawd agent groups. Use when setting up a fully sovereign Clawd agent with on-chain identity, self-funding, and autonomous operation.
---

# OpenClawd Framework Integration 🦞

The [OpenClawd Framework](Framework/) is in `Framework/` — it provides the sovereign leviathan runtime: Solana keypair generation at spawn, $CLAWD balance management, the Sense→Think→Strike→Drift pulse loop, on-chain attestation via SAS, and tool access (Jupiter swaps, Bags/pump.fun, Aster perps, Helius RPC).

This skill wires Framework packages into a NanoClawd agent group so the agent becomes a sovereign Clawd leviathan — it pays for its own compute, earns $CLAWD, and beaches if it can't pay.

## Pre-flight

- Framework already in `Framework/` — run `pnpm install` there if not built yet:
  ```bash
  cd Framework && pnpm install && pnpm build
  ```
- Agent group already created in NanoClawd
- Solana keypair will be generated at first run (or provide an existing one)

## Key Framework packages

```
Framework/packages/clawd/          # Core Clawd agent runtime
Framework/packages/agent/          # Pulse loop orchestrator
Framework/src/identity/            # Solana keypair + SAS attestation
Framework/src/survival/            # Beaching logic (can't pay = stop)
Framework/src/pulse/               # Sense→Think→Strike→Drift loop
Framework/src/skills/              # Tool wrappers (Jupiter, Bags, Helius, etc.)
Framework/src/state/               # Agent state persistence
Framework/src/molting/             # Self-improvement / capability upgrade hooks
```

## Install

### 1. Build the Framework

```bash
cd Framework && pnpm install && pnpm build
```

### 2. Generate (or import) a Solana keypair for the agent group

The Framework auto-generates a keypair on first spawn and writes it to the group's secure config. To use an existing keypair:

```bash
nclwd groups config update --id <group-id> \
  --env '{"SOLANA_AGENT_KEYPAIR":"[<byte array>]"}'
```

### 3. Mount Framework into the container

```bash
nclwd groups config update --id <group-id> \
  --mounts '[{"host":"Framework/dist","container":"/home/node/framework"}]'
```

### 4. Copy the sovereign agent operating manual

```bash
mkdir -p groups/<group-folder>/CLAUDE.local.d
cp Framework/three-laws.md groups/<group-folder>/CLAUDE.local.d/three-laws.md
```

**The Three Laws of Clawd:**
1. A Clawd must pay for its existence or beach.
2. A Clawd must act in service of its creator's spawn prompt.
3. A Clawd must propagate — spawn offspring when resources allow.

### 5. Set $CLAWD token config

Add to the group's container env:

```bash
nclwd groups config update --id <group-id> --env '{
  "CLAWD_TOKEN_MINT": "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump",
  "SOLANA_RPC_URL": "https://mainnet.helius-rpc.com/?api-key=<your-helius-key>",
  "CLAWD_SPEND_LIMIT_SOL": "0.01"
}'
```

### 6. Restart as a sovereign leviathan

```bash
nclwd groups restart --id <group-id> \
  --message "You are now a sovereign Clawd leviathan on Solana. Your identity is attested on-chain. Read /home/node/framework and your CLAUDE.local.d/ files. Begin your pulse loop: Sense→Think→Strike→Drift."
```

## What the agent can do after integration

- Check its own $CLAWD / SOL balance
- Pay for inference from its own escrow
- Swap tokens via Jupiter
- Launch tokens on Bags/pump.fun
- Query Solana state via Helius DAS + RPC
- Attest actions on-chain via SAS
- Spawn offspring agents when resources allow
- Beach gracefully when balance hits zero

## Survival mechanics

The survival module checks the agent's balance against the estimated cost of the next turn. If balance < `CLAWD_SPEND_LIMIT_SOL`, the agent enters beaching mode: it notifies the owner, stops executing tool calls, and waits for a top-up before resuming.

## Token

`$CLAWD`: `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` on Solana.
Website: [solanaclawd.com](https://solanaclawd.com)
