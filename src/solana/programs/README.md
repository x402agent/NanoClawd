# On-chain programs

Placeholder. The Anchor / Pinocchio source for the NanoClawd programs lives here.

Planned:

- **`identity-registry`** — binds `<channel>:<handle>` claims to Solana pubkeys.
- **`delegation-registry`** — owner/admin signed delegations with optional agent-group scope and validity windows.
- **`escrow-vault`** — per-agent-group SOL/SPL escrow with program-enforced spend caps.

When the first program is added, generate a typed client with [Codama](https://github.com/codama-idl/codama) and place the generated client at `src/solana/clients/<program-name>/`. Keep the program ID in a single constants file, exported from `src/solana/index.ts`.
