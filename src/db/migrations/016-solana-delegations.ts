import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Solana signed delegations: owner/admin grants signed by a principal pubkey.
 *
 * Mirrors the on-chain `delegation-registry` program account layout. Rows
 * here are a host-side cache; the canonical source of truth is the chain
 * once the program is deployed. Pre-deployment, this table is the source
 * of truth (operator imports delegations via tooling and the host signs
 * its own).
 *
 * `agent_group_id` is NULL when the delegation is unscoped (applies to all
 * groups). The pubkey columns store base58 strings — the same format the
 * host-side verifier consumes — so no conversion is required at read time.
 */
export const migration016: Migration = {
  version: 16,
  name: 'solana-delegations',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE solana_delegations (
        principal       TEXT    NOT NULL,
        delegate        TEXT    NOT NULL,
        scope           TEXT    NOT NULL CHECK (scope IN ('owner', 'admin')),
        agent_group_id  TEXT,
        not_before      INTEGER NOT NULL,
        not_after       INTEGER NOT NULL,
        signature       TEXT    NOT NULL,
        revoked         INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (principal, delegate, agent_group_id)
      );

      CREATE INDEX idx_solana_delegations_delegate
        ON solana_delegations(delegate)
        WHERE revoked = 0;

      CREATE INDEX idx_solana_delegations_group
        ON solana_delegations(agent_group_id)
        WHERE revoked = 0;
    `);
  },
};
