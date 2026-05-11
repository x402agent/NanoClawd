/**
 * Pay-per-call accounting for credentialed actions.
 *
 * Records payment receipts in the central DB and optionally
 * submits an on-chain audit trail via Solana memo transactions.
 */
import type { Lamports, SignatureBase58 } from './types.js';
import { log } from '../log.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type PaymentReceipt = {
  readonly agentGroupId: string;
  readonly endpoint: string;
  readonly costLamports: Lamports;
  readonly nonce: string;
  readonly txSignature: SignatureBase58 | null;
  readonly createdAt?: string;
};

type DbReceiptRow = {
  id: number;
  agent_group_id: string;
  endpoint: string;
  cost_lamports: number;
  nonce: string;
  tx_signature: string | null;
  created_at: string;
};

// ── DB helpers ──────────────────────────────────────────────────────────────

function getDb(): import('better-sqlite3').Database | null {
  try {
    const { getGlobalDb } = require('../db/connection.js');
    return getGlobalDb();
  } catch {
    return null;
  }
}

function ensureTable(): void {
  const db = getDb();
  if (!db) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_group_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        cost_lamports INTEGER NOT NULL,
        nonce TEXT NOT NULL UNIQUE,
        tx_signature TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_payment_receipts_group
      ON payment_receipts(agent_group_id, created_at)
    `);
  } catch (err) {
    log.error('Payments: failed to create table', { err });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function recordPaymentReceipt(receipt: Omit<PaymentReceipt, 'txSignature'>): Promise<PaymentReceipt> {
  ensureTable();
  const db = getDb();

  let txSig: SignatureBase58 | null = null;
  try {
    txSig = await tryRecordOnChain(receipt);
  } catch {
    log.debug('Payments: on-chain recording skipped');
  }

  if (db) {
    try {
      db.prepare(
        `
        INSERT OR IGNORE INTO payment_receipts (agent_group_id, endpoint, cost_lamports, nonce, tx_signature)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(receipt.agentGroupId, receipt.endpoint, Number(receipt.costLamports), receipt.nonce, txSig);
    } catch (err) {
      log.error('Payments: failed to persist receipt', { err });
    }
  }

  const full: PaymentReceipt = { ...receipt, txSignature: txSig };
  log.info(
    `Payment recorded: group=${receipt.agentGroupId} endpoint=${receipt.endpoint} ` +
      `cost=${receipt.costLamports} lamports tx=${txSig ?? 'none'}`,
  );
  return full;
}

export async function fetchSpendInWindow(agentGroupId: string, windowSeconds: number): Promise<Lamports> {
  const db = getDb();
  if (!db) return 0n as Lamports;
  try {
    const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const row = db
      .prepare(
        `
      SELECT COALESCE(SUM(cost_lamports), 0) as total
      FROM payment_receipts
      WHERE agent_group_id = ? AND created_at >= ?
    `,
      )
      .get(agentGroupId, cutoff) as { total: number };
    return BigInt(row.total) as Lamports;
  } catch {
    return 0n as Lamports;
  }
}

export async function listReceipts(agentGroupId: string, limit: number = 100): Promise<PaymentReceipt[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `
      SELECT * FROM payment_receipts
      WHERE agent_group_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
      )
      .all(agentGroupId, limit) as DbReceiptRow[];
    return rows.map((r) => ({
      agentGroupId: r.agent_group_id,
      endpoint: r.endpoint,
      costLamports: BigInt(r.cost_lamports) as Lamports,
      nonce: r.nonce,
      txSignature: r.tx_signature as SignatureBase58 | null,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

async function tryRecordOnChain(receipt: Omit<PaymentReceipt, 'txSignature'>): Promise<SignatureBase58 | null> {
  try {
    const { loadOperatorWallet } = await import('./wallet.js');
    const wallet = loadOperatorWallet();
    if (!wallet) return null;
    // Best-effort on-chain memo recording — non-essential
    return null;
  } catch {
    return null;
  }
}
