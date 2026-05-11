/**
 * Bitcoin/Solana base58 codec.
 *
 * No external dep. Big-int arithmetic on small fixed-size byte arrays
 * (32-byte pubkeys, 64-byte signatures) is fast enough that an inline
 * implementation is preferable to pulling in `bs58` or `@solana/kit`
 * just for encode/decode.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const ALPHABET_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]!] = i;
  return map;
})();

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;

  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);

  let out = '';
  while (n > 0n) {
    const rem = Number(n % 58n);
    n = n / 58n;
    out = ALPHABET[rem]! + out;
  }

  return '1'.repeat(leadingZeros) + out;
}

export function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  let leadingOnes = 0;
  while (leadingOnes < str.length && str[leadingOnes] === '1') leadingOnes++;

  let n = 0n;
  for (let i = leadingOnes; i < str.length; i++) {
    const c = str[i]!;
    const v = ALPHABET_INDEX[c];
    if (v === undefined) throw new Error(`base58Decode: invalid character "${c}"`);
    n = n * 58n + BigInt(v);
  }

  const tail: number[] = [];
  while (n > 0n) {
    tail.push(Number(n & 0xffn));
    n >>= 8n;
  }
  tail.reverse();

  const out = new Uint8Array(leadingOnes + tail.length);
  for (let i = 0; i < tail.length; i++) out[leadingOnes + i] = tail[i]!;
  return out;
}
