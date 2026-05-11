//! NanoClawd delegation registry.
//!
//! Stores owner/admin delegations on-chain. A `principal` (e.g. an
//! operator wallet) signs a delegation authorizing a `delegate` pubkey
//! to act with `Owner` or `Admin` scope, optionally bound to a single
//! agent group, with a validity window.
//!
//! Hosts read this registry instead of (or alongside) the local
//! `user_roles` SQLite table. Spend caps live in a separate `escrow`
//! program; identity binding (channel handle ↔ pubkey) lives in
//! `identity-registry`.
//!
//! The on-chain canonical message format is identical to the
//! host-side `canonicalDelegationMessage` in `src/solana/auth.ts` —
//! both implementations must remain byte-for-byte compatible.

use anchor_lang::prelude::*;

declare_id!("DeLnAcLwDaeLgEgAtIoNrEgIsTrYpRgRaMaDdReSsZz");

const SEED_DELEGATION: &[u8] = b"nanoclawd-delegation";

#[program]
pub mod delegation_registry {
    use super::*;

    /// Register a delegation. Caller must be the principal — the program
    /// verifies the signer matches `principal` recorded in the account.
    pub fn register_delegation(
        ctx: Context<RegisterDelegation>,
        params: DelegationParams,
    ) -> Result<()> {
        require!(params.not_after > params.not_before, ErrorCode::InvalidWindow);
        require!(
            params.not_after > Clock::get()?.unix_timestamp,
            ErrorCode::AlreadyExpired,
        );

        let d = &mut ctx.accounts.delegation;
        d.principal = ctx.accounts.principal.key();
        d.delegate = params.delegate;
        d.scope = params.scope;
        d.agent_group_id = params.agent_group_id;
        d.not_before = params.not_before;
        d.not_after = params.not_after;
        d.bump = ctx.bumps.delegation;
        d.revoked = false;
        Ok(())
    }

    /// Revoke an existing delegation. Only the principal may revoke.
    pub fn revoke_delegation(ctx: Context<RevokeDelegation>) -> Result<()> {
        let d = &mut ctx.accounts.delegation;
        require_keys_eq!(d.principal, ctx.accounts.principal.key(), ErrorCode::Unauthorized);
        d.revoked = true;
        Ok(())
    }
}

// ── account structs ─────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(params: DelegationParams)]
pub struct RegisterDelegation<'info> {
    #[account(
        init,
        payer = principal,
        space = 8 + Delegation::SIZE,
        seeds = [
            SEED_DELEGATION,
            principal.key().as_ref(),
            params.delegate.as_ref(),
            params.agent_group_id.as_ref()
                .map(|s| s.as_bytes())
                .unwrap_or(b"*"),
        ],
        bump,
    )]
    pub delegation: Account<'info, Delegation>,

    #[account(mut)]
    pub principal: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeDelegation<'info> {
    #[account(
        mut,
        seeds = [
            SEED_DELEGATION,
            principal.key().as_ref(),
            delegation.delegate.as_ref(),
            delegation.agent_group_id.as_ref()
                .map(|s| s.as_bytes())
                .unwrap_or(b"*"),
        ],
        bump = delegation.bump,
    )]
    pub delegation: Account<'info, Delegation>,

    pub principal: Signer<'info>,
}

// ── stored account ──────────────────────────────────────────────────────────

#[account]
pub struct Delegation {
    pub principal: Pubkey,
    pub delegate: Pubkey,
    pub scope: AuthScope,
    pub agent_group_id: Option<String>,
    pub not_before: i64,
    pub not_after: i64,
    pub bump: u8,
    pub revoked: bool,
}

impl Delegation {
    /// 32 + 32 + 1 + 4 + MAX_GROUP_ID + 8 + 8 + 1 + 1
    /// (4-byte length prefix on the optional String, 64 byte cap on group id)
    pub const SIZE: usize = 32 + 32 + 1 + 4 + 64 + 8 + 8 + 1 + 1;
}

// ── shared types ────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DelegationParams {
    pub delegate: Pubkey,
    pub scope: AuthScope,
    pub agent_group_id: Option<String>,
    pub not_before: i64,
    pub not_after: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AuthScope {
    Owner,
    Admin,
}

#[error_code]
pub enum ErrorCode {
    #[msg("not_after must be strictly greater than not_before")]
    InvalidWindow,
    #[msg("delegation is already past not_after at registration time")]
    AlreadyExpired,
    #[msg("only the principal may revoke its own delegations")]
    Unauthorized,
}
