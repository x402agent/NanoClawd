# NanoClawd on-chain programs

[![Anchor](https://img.shields.io/badge/Anchor-0.30.1-blueviolet)](https://www.anchor-lang.com/)

This is a standalone Anchor workspace. From this directory:

```bash
anchor build
anchor test --skip-local-validator     # against a running validator
anchor deploy --provider.cluster devnet
```

## Programs

| Program | Status | Purpose |
|---|---|---|
| [`delegation-registry`](delegation-registry/) | scaffold (compiles, untested) | On-chain owner/admin signed delegations. Mirrors the host-side `src/solana/auth.ts` canonical message format byte-for-byte. |
| `identity-registry` | not yet | Bind `<channel>:<handle>` user IDs to Solana pubkeys. |
| `escrow-vault` | not yet | Per-agent-group SOL/SPL escrow with program-enforced spend caps. |

## Program ID

The placeholder ID (`DeLnAcLwDaeLgEgAtIoNrEgIsTrYpRgRaMaDdReSsZz`) is **not** a real on-chain address — it is a literal "vanity" string used only so the source compiles. Generate a real keypair before deploying:

```bash
anchor keys list
solana-keygen new -o target/deploy/delegation_registry-keypair.json
anchor keys sync     # writes the new pubkey into Anchor.toml + lib.rs
```

## Generating a TypeScript client

After `anchor build` produces an IDL at `target/idl/delegation_registry.json`, generate the client with [Codama](https://github.com/codama-idl/codama):

```bash
npx codama run --input target/idl/delegation_registry.json --output ../clients/delegation-registry/
```

The generated client should be imported from `src/solana/clients/delegation-registry/`.
