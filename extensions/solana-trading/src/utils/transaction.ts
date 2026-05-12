/**
 * Transaction Signing and Sending Utilities
 * Handles signing and sending Solana transactions with retry logic
 */

import {
  type Connection,
  type Keypair,
  type SendOptions,
  VersionedTransaction,
} from '@solana/web3.js';

interface SendTransactionOptions {
  maxRetries?: number;
  skipPreflight?: boolean;
}

const DEFAULT_SEND_OPTIONS: SendTransactionOptions = {
  maxRetries: 2,
  skipPreflight: true,
};

/**
 * Sign and send a single versioned transaction
 * @param connection - Solana RPC connection
 * @param transaction - Transaction to sign and send
 * @param signer - Keypair to sign the transaction
 * @param options - Optional send options (maxRetries, skipPreflight)
 * @returns Transaction signature
 */
export async function signAndSendTransaction(
  connection: Connection,
  transaction: VersionedTransaction,
  signer: Keypair,
  options: SendTransactionOptions = DEFAULT_SEND_OPTIONS,
): Promise<string> {
  transaction.sign([signer]);
  const transactionBinary = transaction.serialize();

  return await connection.sendRawTransaction(transactionBinary, {
    maxRetries: options.maxRetries,
    skipPreflight: options.skipPreflight,
  } as SendOptions);
}

/**
 * Sign and send multiple versioned transactions sequentially
 * @param connection - Solana RPC connection
 * @param transactions - Array of transactions to sign and send
 * @param signer - Keypair to sign the transactions
 * @param options - Optional send options (maxRetries, skipPreflight)
 * @returns Array of transaction signatures
 */
export async function signAndSendTransactions(
  connection: Connection,
  transactions: VersionedTransaction[],
  signer: Keypair,
  options: SendTransactionOptions = DEFAULT_SEND_OPTIONS,
): Promise<string[]> {
  const signatures: string[] = [];

  for (const transaction of transactions) {
    const signature = await signAndSendTransaction(
      connection,
      transaction,
      signer,
      options,
    );
    signatures.push(signature);
  }

  return signatures;
}

/**
 * Deserialize a base64-encoded transaction
 * @param txBase64 - Base64-encoded transaction
 * @returns Deserialized VersionedTransaction
 */
export function deserializeTransaction(txBase64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));
}
