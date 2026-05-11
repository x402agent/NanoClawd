import { describe, expect, it } from 'vitest';
import { base58Decode, base58Encode } from './base58.js';

describe('base58Encode', () => {
  it('returns the empty string for an empty input', () => {
    expect(base58Encode(new Uint8Array(0))).toBe('');
  });

  it('preserves leading zero bytes as leading "1"s', () => {
    expect(base58Encode(new Uint8Array([0, 0, 0, 1]))).toBe('1112');
    expect(base58Encode(new Uint8Array([0]))).toBe('1');
  });

  it('encodes a known Solana system program address (32 zero bytes → 11…1)', () => {
    expect(base58Encode(new Uint8Array(32))).toBe('1'.repeat(32));
  });

  it('round-trips arbitrary 32-byte buffers', () => {
    const samples = [
      Uint8Array.from({ length: 32 }, (_, i) => i),
      Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
      Uint8Array.from({ length: 64 }, (_, i) => (i * 31 + 7) & 0xff),
    ];
    for (const s of samples) {
      expect(base58Decode(base58Encode(s))).toEqual(s);
    }
  });

  it('throws on invalid characters', () => {
    expect(() => base58Decode('hello-world')).toThrow(/invalid character/);
  });
});
