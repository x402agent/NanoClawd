/**
 * Access control.
 *
 * Privilege is user-level, not group-level. A user holds zero or more roles
 * (owner | admin) via `user_roles`, and is optionally "known" in specific
 * agent groups via `agent_group_members`. Admins are implicitly members of
 * the groups they administer.
 *
 * In addition to DB-backed roles, NanoClawd accepts Solana signed
 * delegations as an alternative authorization path — see
 * `src/solana/auth.ts`. The DB path remains the default; Solana
 * delegations supplement it when an identity claim binds a user to a
 * pubkey (`canAccessAgentGroupViaSolana`).
 *
 * Approver-picking (`pickApprover`, `pickApprovalDelivery`) lives in the
 * approvals module — see `src/modules/approvals/primitive.ts`.
 */
import { isMember } from './db/agent-group-members.js';
import { isAdminOfAgentGroup, isGlobalAdmin, isOwner } from './db/user-roles.js';
import { getUser } from './db/users.js';
import { resolveAuthScope } from '../../solana/auth.js';
import type { SignedDelegation, SolanaAddress } from '../../solana/types.js';

export type AccessDecision =
  | {
      allowed: true;
      reason:
        | 'owner'
        | 'global_admin'
        | 'admin_of_group'
        | 'member'
        | 'solana_owner_delegation'
        | 'solana_admin_delegation';
    }
  | { allowed: false; reason: 'unknown_user' | 'not_member' };

/** Can this user interact with this agent group? */
export function canAccessAgentGroup(userId: string, agentGroupId: string): AccessDecision {
  if (!getUser(userId)) return { allowed: false, reason: 'unknown_user' };
  if (isOwner(userId)) return { allowed: true, reason: 'owner' };
  if (isGlobalAdmin(userId)) return { allowed: true, reason: 'global_admin' };
  if (isAdminOfAgentGroup(userId, agentGroupId)) return { allowed: true, reason: 'admin_of_group' };
  if (isMember(userId, agentGroupId)) return { allowed: true, reason: 'member' };
  return { allowed: false, reason: 'not_member' };
}

/**
 * Solana-native access check. Given a pubkey and a set of candidate signed
 * delegations (fetched by the caller from DB or chain), determine whether
 * the pubkey is authorized for the agent group. Composes with
 * `canAccessAgentGroup` — callers try the DB path first, then fall through
 * to this for pubkey-bearing users.
 */
export function canAccessAgentGroupViaSolana(
  pubkey: SolanaAddress,
  agentGroupId: string,
  delegations: readonly SignedDelegation[],
): AccessDecision {
  const scope = resolveAuthScope(pubkey, agentGroupId, delegations);
  if (scope === 'owner') return { allowed: true, reason: 'solana_owner_delegation' };
  if (scope === 'admin') return { allowed: true, reason: 'solana_admin_delegation' };
  return { allowed: false, reason: 'not_member' };
}
