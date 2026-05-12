/**
 * Utility functions for detecting Solana addresses in text
 */

// Solana addresses are base58 encoded, typically 32-44 characters
// Valid base58 characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
const SOLANA_ADDRESS_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

/**
 * Detect if a string looks like a Solana address
 */
export function isSolanaAddress(text: string): boolean {
  // Must be 32-44 characters
  if (text.length < 32 || text.length > 44) {
    return false;
  }

  // Must only contain valid base58 characters
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(text);
}

/**
 * Extract all potential Solana addresses from text
 */
export function extractSolanaAddresses(text: string): string[] {
  const matches = text.match(SOLANA_ADDRESS_REGEX);
  if (!matches) {
    return [];
  }

  // Filter to only valid addresses
  return matches.filter(isSolanaAddress);
}

/**
 * Check if text contains a Solana address
 */
export function containsSolanaAddress(text: string): boolean {
  return extractSolanaAddresses(text).length > 0;
}

/**
 * Extract the first Solana address from text
 */
export function getFirstSolanaAddress(text: string): string | null {
  const addresses = extractSolanaAddresses(text);
  return addresses.length > 0 ? addresses[0] : null;
}
