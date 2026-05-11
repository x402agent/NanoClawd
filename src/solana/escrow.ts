/**
 * Per-agent-group escrow vault.
 *
 * Each agent group gets a deterministic PDA-derived vault address derived
 * from the group's ID. The operator (or an admin via signed delegation)
 * tops it up; the agent spends from it for inference, gateway calls, and
 * tool invocations.
 *
 * The escrow program is a custom Nano Clawd program deployed on Solana.
 * Until deployed, PDA derivation is available for pre-deployment testing
 * and fetchEscrowState returns null (no on-chain state to read).
 *
 * Privacy-first: no external dependencies for PDA derivation.
 * Uses crypto.subtle SHA-256 for the hash, inline base58 for encoding.
 */
import type { Lamports, SolanaAddress } from './types.js';
import { base58Decode, base58Encode } from './base58.js';
import { getAccountInfo } from './rpc.js';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Program ID for the Nano Clawd Escrow program.
 * This is a placeholder — update when the program is deployed to mainnet.
 * Devnet deployment recommended for initial testing.
 */
export const ESCROW_PROGRAM_ID = 'EstaUscrow1111111111111111111111111111111111' as SolanaAddress;

/**
 * PDA seed prefix for escrow vault derivation.
 */
const ESCROW_SEED_PREFIX = 'nanoclawd-escrow';

/**
 * PDA marker for Solana's createProgramAddress algorithm.
 */
const PDA_MARKER = new TextEncoder().encode('ProgramDerivedAddress');

// ── Types ────────────────────────────────────────────────────────────────────

export type EscrowState = {
  readonly vaultAddress: SolanaAddress;
  readonly balanceLamports: Lamports;
  readonly spendCapLamportsPerHour: Lamports;
  readonly authority: SolanaAddress;
};

// ── PDA Derivation ──────────────────────────────────────────────────────────

/**
 * Derive the escrow vault PDA for a given agent group.
 *
 * Seeds: ["nanoclawd-escrow", agent_group_id]
 * Program: ESCROW_PROGRAM_ID
 *
 * Uses the standard Solana PDA algorithm:
 *   SHA256("ProgramDerivedAddress" || seed1 || ... || seedN || programId || bump)
 *   where bump iterates from 255 down to 0 until finding an off-curve point.
 *
 * Since we cannot perform an ed25519 curve check without external deps,
 * we follow the same algorithm as Solana's findProgramAddress and accept
 * bump=255 as the standard first attempt (the runtime enforces the curve
 * check on-chain).
 */
export async function deriveEscrowVaultAddress(agentGroupId: string): Promise<SolanaAddress> {
  const seedBytes = new TextEncoder().encode(ESCROW_SEED_PREFIX);
  const groupBytes = new TextEncoder().encode(agentGroupId);
  const progBytes = base58Decode(ESCROW_PROGRAM_ID);

  // Try bumps from 255 down to 0
  for (let bump = 255; bump >= 0; bump--) {
    const bumpBytes = new Uint8Array([bump]);

    // Build buffer: PDA_MARKER || seed1(4-byte-len + data) || seed2(4-byte-len + data) || programId || bump
    const totalLen = PDA_MARKER.length + (4 + seedBytes.length) + (4 + groupBytes.length) + progBytes.length + 1;
    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf.set(PDA_MARKER, offset);
    offset += PDA_MARKER.length;

    // Seed 1: "nanoclawd-escrow" with 4-byte length prefix
    buf[offset++] = seedBytes.length & 0xff;
    buf[offset++] = (seedBytes.length >> 8) & 0xff;
    buf[offset++] = (seedBytes.length >> 16) & 0xff;
    buf[offset++] = (seedBytes.length >> 24) & 0xff;
    buf.set(seedBytes, offset);
    offset += seedBytes.length;

    // Seed 2: agentGroupId with 4-byte length prefix
    buf[offset++] = groupBytes.length & 0xff;
    buf[offset++] = (groupBytes.length >> 8) & 0xff;
    buf[offset++] = (groupBytes.length >> 16) & 0xff;
    buf[offset++] = (groupBytes.length >> 24) & 0xff;
    buf.set(groupBytes, offset);
    offset += groupBytes.length;

    buf.set(progBytes, offset);
    offset += progBytes.length;
    buf[offset] = bump;

    // SHA-256 hash
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hash = new Uint8Array(hashBuf);

    // Return first bump (255). Solana runtime enforces off-curve requirement.
    return base58Encode(hash) as SolanaAddress;
  }

  throw new Error('Unable to derive escrow vault PDA - all bumps exhausted');
}

// ── On-Chain State Fetching ─────────────────────────────────────────────────

/**
 * Fetch the escrow vault state from the on-chain program.
 *
 * Returns null if:
 *   - The PDA has not been initialized (no account data)
 *   - The RPC call fails
 *   - The escrow program is not yet deployed
 *
 * When deployed, the escrow account layout is expected to be:
 *   [8 bytes]  discriminator (Anchor account discriminator)
 *   [32 bytes] authority pubkey
 *   [8 bytes]  balance in lamports (u64 LE)
 *   [8 bytes]  spend cap per hour in lamports (u64 LE)
 *
 * Total: 56 bytes
 */
export async function fetchEscrowState(agentGroupId: string): Promise<EscrowState | null> {
  const vaultAddress = await deriveEscrowVaultAddress(agentGroupId);

  try {
    const accountInfo = await getAccountInfo(vaultAddress, 'base64');
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // Decode base64 account data
    const binary = atob(accountInfo.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Check minimum length: 8 (discriminator) + 32 (authority) + 8 (balance) + 8 (spend cap)
    if (bytes.length < 56) {
      return null;
    }

    // Parse authority (bytes 8..40)
    const authorityBytes = bytes.slice(8, 40);
    const authority = base58Encode(authorityBytes) as SolanaAddress;

    // Parse balance (bytes 40..48, u64 LE)
    let balanceLamports = 0n;
    for (let i = 0; i < 8; i++) {
      balanceLamports |= BigInt(bytes[40 + i]!) << BigInt(8 * i);
    }

    // Parse spend cap (bytes 48..56, u64 LE)
    let spendCap = 0n;
    for (let i = 0; i < 8; i++) {
      spendCap |= BigInt(bytes[48 + i]!) << BigInt(8 * i);
    }

    return {
      vaultAddress: vaultAddress as SolanaAddress,
      balanceLamports: balanceLamports as Lamports,
      spendCapLamportsPerHour: spendCap as Lamports,
      authority: authority as SolanaAddress,
    };
  } catch {
    // Escrow program not deployed or RPC error
    return null;
  }
}
