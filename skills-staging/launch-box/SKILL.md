---
name: launch-box
description: Launch an Upstash Box pre-packaged with NanoClawd and a Solana wallet at birth. Provisions a cloud box, clones NanoClawd, generates a Solana keypair, configures credentials, and starts the agent — wallet-at-birth, ready to be sovereign. Use when the user wants a one-command cloud NanoClawd deploy with on-chain identity from spawn.
---

# Launch NanoClawd Box — Wallet at Birth 🦞

Provisions an [Upstash Box](https://upstash.com/docs/box) with NanoClawd pre-installed and a Solana keypair generated at spawn time. The agent is sovereign from its first breath: it has an identity, it has a wallet, and it can pay for its own compute.

## Pre-flight

- `UPSTASH_BOX_API_KEY` — from [console.upstash.com](https://console.upstash.com)
- `ANTHROPIC_API_KEY` — for Clawd inference inside the box
- `NANOCLAWD_GITHUB_URL` — your NanoClawd fork URL (or use the main repo)
- Optional: `TG_BOT_TOKEN`, `SOLANA_RPC_URL`, `CLAWD_SPEND_LIMIT_SOL`

## Quick deploy

```bash
# Set env vars, then:
node scripts/launch-box.ts
```

Or use the TypeScript SDK directly (see below).

## What it does

1. Creates an Upstash Box (Node runtime, keep-alive)
2. Clones your NanoClawd fork into `/work/nanoclawd`
3. Generates a fresh Solana keypair — public key logged, private key stored in the box's secure env
4. Runs `bash nanoclawd.sh` inside the box to bootstrap the agent
5. Wires the Clawd Agent SDK with the Anthropic key
6. Reports back: box ID, SSH URL, Solana public key, agent status

## SDK snippet

```typescript
import { Agent, Box } from "@upstash/box"

const NANOCLAWD_REPO = process.env.NANOCLAWD_GITHUB_URL ?? "https://github.com/qwibitai/nanoclawd.git"

const box = await Box.create({
  runtime: "node",
  name: "nanoclawd-leviathan",
  keepAlive: true,
  agent: {
    harness: Agent.ClaudeCode,
    model: "anthropic/claude-sonnet-4-6",
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  git: { token: process.env.GITHUB_TOKEN },
})

// Clone NanoClawd
await box.git.clone({ repo: NANOCLAWD_REPO })
await box.exec.command("cd nanoclawd && npm install -g @solana/web3.js")

// Generate wallet at birth
const walletResult = await box.exec.code({
  lang: "js",
  code: `
    const { Keypair } = require("@solana/web3.js");
    const kp = Keypair.generate();
    const pub = kp.publicKey.toBase58();
    const priv = JSON.stringify(Array.from(kp.secretKey));
    console.log(JSON.stringify({ publicKey: pub, secretKey: priv }));
  `,
})

const wallet = JSON.parse(walletResult.output)
console.log("🦞 Solana public key:", wallet.publicKey)
console.log("   Token: $CLAWD (8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump)")
console.log("   Fund this address to make the agent sovereign.")

// Write wallet + credentials into NanoClawd env
await box.files.write({
  path: "/work/nanoclawd/.env",
  content: [
    `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,
    `SOLANA_AGENT_PUBKEY=${wallet.publicKey}`,
    `SOLANA_AGENT_KEYPAIR=${wallet.secretKey}`,
    `CLAWD_TOKEN_MINT=8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`,
    `SOLANA_RPC_URL=${process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"}`,
    process.env.TG_BOT_TOKEN ? `TG_BOT_TOKEN=${process.env.TG_BOT_TOKEN}` : "",
  ].filter(Boolean).join("\n"),
})

// Bootstrap NanoClawd
const stream = await box.agent.stream({
  prompt: `
You are inside a fresh NanoClawd repo at /work/nanoclawd.
Run: bash nanoclawd.sh

This will set up the agent runtime. Your Solana public key is ${wallet.publicKey}.
The $CLAWD token mint is 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump.
After setup completes, confirm the agent is running and report the box status.
  `,
})

for await (const chunk of stream) {
  if (chunk.type === "text-delta") process.stdout.write(chunk.text)
}

console.log("\n🦞 NanoClawd box launched!")
console.log(`   Box ID: ${box.id}`)
console.log(`   SSH: ssh ${box.id}@us-east-1.box.upstash.com`)
console.log(`   Solana pubkey: ${wallet.publicKey}`)
console.log(`   Fund the wallet to make it sovereign: https://solanaclawd.com`)
```

## Save this script

```bash
cp skills-staging/launch-box/SKILL.md .claude/skills/launch-box/SKILL.md
# Save the SDK snippet to scripts/launch-box.ts
```

## Snapshot for reuse

After the box is set up, snapshot it so future agents spawn instantly:

```typescript
const snapshot = await box.snapshot({ name: "nanoclawd-wallet-at-birth" })
// Future agents:
const newBox = await Box.fromSnapshot(snapshot.id)
```

## Notes

- The private key is written to `.env` inside the box. For production, pipe it through OneCLI's Agent Vault instead.
- Fund the generated address with SOL to enable on-chain payments.
- The box costs ~$5/mo keep-alive on Upstash small tier — the agent pays for itself once it has $CLAWD.
- Token: `$CLAWD` — `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` — [solanaclawd.com](https://solanaclawd.com)
