# Solana integration

NanoClawd binds operator and admin identity, payments, and authorization to the **Solana** chain.

This module is the host-side surface. The client SDK (`@solana/kit`) is the runtime; on-chain programs live under [`programs/`](programs/).

## Why

A personal AI assistant has uncomfortable amounts of access — files, credentials, messaging accounts, money. NanoClawd's security posture is:

1. **Container isolation** for execution (already shipped).
2. **Solana-native identity and authorization** for *who* can talk to an agent group.
3. **Solana-native payments** for *what* an agent group is allowed to spend.

Items 2 and 3 are scaffolded here and tracked separately. Nothing in this directory is on the critical path of the v2 host yet — see [Status](#status).

## Status

> **Scaffold only.** Interfaces and stubs are in place. None of the clients here actually submit transactions yet, and the on-chain programs are not deployed. Track integration work in `docs/solana-integration.md` (TODO).

| Module | Status | Replaces |
|---|---|---|
| [`config.ts`](config.ts) | scaffold | env-driven cluster/RPC selection |
| [`wallet.ts`](wallet.ts) | scaffold | keypair loading for the operator + per-agent-group escrows |
| [`identity.ts`](identity.ts) | scaffold | the `<channel>:<handle>` user model in `data/v2.db` |
| [`auth.ts`](auth.ts) | scaffold | `user_roles` (owner/admin) — signed delegations instead of DB rows |
| [`escrow.ts`](escrow.ts) | scaffold | per-agent-group SOL/SPL escrow account |
| [`payments.ts`](payments.ts) | scaffold | OneCLI rate-limit + spend caps; on-chain receipt for paid API calls |
| [`programs/`](programs/) | placeholder | on-chain Anchor/Pinocchio programs (delegation registry, escrow vault) |

## Architecture sketch

```
                 ┌──────────────────────────┐
                 │  Solana cluster          │
                 │  (devnet / mainnet-beta) │
                 └──────────┬───────────────┘
                            │ @solana/kit RPC
        ┌───────────────────┼─────────────────────┐
        │                   │                     │
   identity.ts          escrow.ts            payments.ts
   (pubkey =          (group SOL/SPL       (pay-per-call
    user id)           vault)               receipts)
        │                   │                     │
        └────────┬──────────┘                     │
                 ▼                                 ▼
         src/modules/permissions     src/onecli-approvals.ts
         (canAccessAgentGroup)       (credentialed-call gate)
```

## Environment

Add the following to `.env`:

```bash
# Cluster: devnet | mainnet-beta | localnet | <custom-url>
SOLANA_CLUSTER=devnet

# Operator keypair (Solana CLI format JSON, base58, or path to a keyfile)
SOLANA_OPERATOR_KEYPAIR=~/.config/solana/id.json

# (optional) override the cluster default RPC URL
SOLANA_RPC_URL=https://api.devnet.solana.com

# (optional) WebSocket endpoint for subscriptions
SOLANA_WS_URL=
```

See [`config.ts`](config.ts) for the loader.

## Programs

`programs/` holds on-chain programs. Today it contains a placeholder. Once an Anchor or Pinocchio program is in place, generate a typed client with [Codama](https://github.com/codama-idl/codama) and import it from `src/solana/clients/`.

## Running against devnet

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
SOLANA_CLUSTER=devnet pnpm dev
```

Once `payments.ts` and `escrow.ts` are wired, the host will print the operator pubkey and any group-escrow balances on startup.

## Testing

There is no test suite for this module yet. When adding one, prefer [LiteSVM](https://github.com/LiteSVM/litesvm) or [Surfpool](https://github.com/txtx/surfpool) over hitting devnet — see the `solana-dev` skill for tradeoffs.
