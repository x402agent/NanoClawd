/**
 * Branded base58 Solana public key. Validated at the boundary
 * (parseAddress / signing) and treated as opaque elsewhere.
 */
export type SolanaAddress = string & { readonly __brand: 'SolanaAddress' };

export type Lamports = bigint & { readonly __brand: 'Lamports' };

export type SignatureBase58 = string & { readonly __brand: 'SignatureBase58' };

export type SignedDelegation = {
  readonly principal: SolanaAddress;
  readonly delegate: SolanaAddress;
  readonly scope: 'owner' | 'admin';
  readonly agentGroupId: string | null;
  readonly notBefore: number;
  readonly notAfter: number;
  readonly signature: SignatureBase58;
};
