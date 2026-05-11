import { getDb } from './connection.js';
import type { SignatureBase58, SignedDelegation, SolanaAddress } from '../solana/types.js';

type Row = {
  principal: string;
  delegate: string;
  scope: 'owner' | 'admin';
  agent_group_id: string | null;
  not_before: number;
  not_after: number;
  signature: string;
  revoked: number;
};

function rowToDelegation(r: Row): SignedDelegation {
  return {
    principal: r.principal as SolanaAddress,
    delegate: r.delegate as SolanaAddress,
    scope: r.scope,
    agentGroupId: r.agent_group_id,
    notBefore: r.not_before,
    notAfter: r.not_after,
    signature: r.signature as SignatureBase58,
  };
}

export function insertDelegation(d: SignedDelegation): void {
  getDb()
    .prepare(
      `INSERT INTO solana_delegations
         (principal, delegate, scope, agent_group_id, not_before, not_after, signature)
       VALUES (@principal, @delegate, @scope, @agentGroupId, @notBefore, @notAfter, @signature)
       ON CONFLICT(principal, delegate, agent_group_id) DO UPDATE SET
         scope      = excluded.scope,
         not_before = excluded.not_before,
         not_after  = excluded.not_after,
         signature  = excluded.signature,
         revoked    = 0`,
    )
    .run(d);
}

export function revokeDelegation(principal: SolanaAddress, delegate: SolanaAddress, agentGroupId: string | null): void {
  getDb()
    .prepare(
      `UPDATE solana_delegations
       SET revoked = 1
       WHERE principal = ? AND delegate = ? AND agent_group_id IS ?`,
    )
    .run(principal, delegate, agentGroupId);
}

/**
 * Return non-revoked delegations applicable to the given agent group:
 * those scoped to this group, plus globally-scoped (NULL) ones.
 */
export function getDelegationsForGroup(agentGroupId: string): SignedDelegation[] {
  const rows = getDb()
    .prepare(
      `SELECT principal, delegate, scope, agent_group_id, not_before, not_after, signature, revoked
       FROM solana_delegations
       WHERE revoked = 0
         AND (agent_group_id IS NULL OR agent_group_id = ?)`,
    )
    .all(agentGroupId) as Row[];
  return rows.map(rowToDelegation);
}

export function getDelegationsForDelegate(delegate: SolanaAddress): SignedDelegation[] {
  const rows = getDb()
    .prepare(
      `SELECT principal, delegate, scope, agent_group_id, not_before, not_after, signature, revoked
       FROM solana_delegations
       WHERE revoked = 0 AND delegate = ?`,
    )
    .all(delegate) as Row[];
  return rows.map(rowToDelegation);
}
