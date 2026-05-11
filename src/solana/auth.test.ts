import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { base58Encode } from './base58.js';
import { canonicalDelegationMessage, resolveAuthScope, signDelegation, verifyDelegationSignature } from './auth.js';
import type { SignedDelegation, SolanaAddress } from './types.js';

function generateKeypair(): { keypair: Uint8Array; pubkey: SolanaAddress } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawSecret = privateKey.export({ format: 'jwk' }).d as string;
  const seed = Buffer.from(rawSecret, 'base64url');
  const rawPub = Buffer.from(publicKey.export({ format: 'jwk' }).x as string, 'base64url');
  const keypair = new Uint8Array(64);
  keypair.set(seed, 0);
  keypair.set(rawPub, 32);
  return { keypair, pubkey: base58Encode(rawPub) as SolanaAddress };
}

const NOW = 1_700_000_000;

function unsigned(opts: Partial<Omit<SignedDelegation, 'signature'>> = {}) {
  return {
    principal: 'PrIncIpAlPrIncIpAlPrIncIpAlPrIncIpAlPrIncI' as SolanaAddress,
    delegate: 'DeLeGaTeDeLeGaTeDeLeGaTeDeLeGaTeDeLeGaTeDe' as SolanaAddress,
    scope: 'admin' as const,
    agentGroupId: null,
    notBefore: NOW - 60,
    notAfter: NOW + 3600,
    ...opts,
  };
}

describe('canonicalDelegationMessage', () => {
  it('is deterministic and includes every field on its own line', () => {
    const msg = new TextDecoder().decode(canonicalDelegationMessage(unsigned({ agentGroupId: 'group-7' })));
    expect(msg).toBe(
      [
        'nanoclawd-delegation:v1',
        'principal=PrIncIpAlPrIncIpAlPrIncIpAlPrIncIpAlPrIncI',
        'delegate=DeLeGaTeDeLeGaTeDeLeGaTeDeLeGaTeDeLeGaTeDe',
        'scope=admin',
        'agent_group_id=group-7',
        'not_before=1699999940',
        'not_after=1700003600',
        '',
      ].join('\n'),
    );
  });

  it('uses "*" as the agent_group_id sentinel when unbound', () => {
    const msg = new TextDecoder().decode(canonicalDelegationMessage(unsigned()));
    expect(msg).toContain('agent_group_id=*\n');
  });
});

describe('signDelegation / verifyDelegationSignature', () => {
  it('round-trips a signed delegation', () => {
    const { keypair, pubkey } = generateKeypair();
    const signed = signDelegation(unsigned({ principal: pubkey }), keypair);
    expect(verifyDelegationSignature(signed)).toBe(true);
  });

  it('rejects a delegation whose principal does not match the signer', () => {
    const { keypair: kpA } = generateKeypair();
    const { pubkey: pubB } = generateKeypair();
    const signed = signDelegation(unsigned({ principal: pubB }), kpA);
    expect(verifyDelegationSignature(signed)).toBe(false);
  });

  it('rejects a tampered scope', () => {
    const { keypair, pubkey } = generateKeypair();
    const signed = signDelegation(unsigned({ principal: pubkey, scope: 'admin' }), keypair);
    const tampered = { ...signed, scope: 'owner' as const };
    expect(verifyDelegationSignature(tampered)).toBe(false);
  });

  it('rejects malformed signature data without throwing', () => {
    expect(
      verifyDelegationSignature({
        ...unsigned(),
        signature: 'not-base58-***' as never,
      }),
    ).toBe(false);
  });
});

describe('resolveAuthScope', () => {
  it('returns "owner" if any matching valid owner delegation exists', () => {
    const { keypair: kpPrincipal, pubkey: principal } = generateKeypair();
    const { pubkey: delegate } = generateKeypair();

    const adminDel = signDelegation(unsigned({ principal, delegate, scope: 'admin' }), kpPrincipal);
    const ownerDel = signDelegation(unsigned({ principal, delegate, scope: 'owner' }), kpPrincipal);

    expect(resolveAuthScope(delegate, 'g1', [adminDel, ownerDel], NOW)).toBe('owner');
  });

  it('honors agent-group binding', () => {
    const { keypair: kp, pubkey: principal } = generateKeypair();
    const { pubkey: delegate } = generateKeypair();

    const onlyG2 = signDelegation(unsigned({ principal, delegate, scope: 'admin', agentGroupId: 'g2' }), kp);

    expect(resolveAuthScope(delegate, 'g1', [onlyG2], NOW)).toBe('none');
    expect(resolveAuthScope(delegate, 'g2', [onlyG2], NOW)).toBe('admin');
  });

  it('ignores expired and not-yet-valid delegations', () => {
    const { keypair: kp, pubkey: principal } = generateKeypair();
    const { pubkey: delegate } = generateKeypair();

    const expired = signDelegation(
      unsigned({ principal, delegate, scope: 'admin', notBefore: NOW - 7200, notAfter: NOW - 60 }),
      kp,
    );
    const future = signDelegation(
      unsigned({ principal, delegate, scope: 'admin', notBefore: NOW + 60, notAfter: NOW + 3600 }),
      kp,
    );

    expect(resolveAuthScope(delegate, 'g1', [expired, future], NOW)).toBe('none');
  });
});
