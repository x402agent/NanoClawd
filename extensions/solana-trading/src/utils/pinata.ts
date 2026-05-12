/**
 * Pinata IPFS Integration
 * Handles uploading JSON metadata to IPFS via Pinata
 */

import { PinataSDK } from 'pinata';

export interface UploadResponse {
  id: string;
  name: string;
  cid: string;
  size: number;
  created_at: string;
  number_of_files: number;
  mime_type: string;
  group_id: string | null;
  keyvalues: {
    [key: string]: string;
  };
  vectorized: boolean;
  network: string;
}

/**
 * Upload a JSON object to Pinata IPFS
 * @param pinataJwt - Pinata JWT token for authentication
 * @param pinataGateway - Optional Pinata gateway URL
 * @param json - The JSON object to upload
 * @returns The IPFS link to the uploaded content
 */
export async function uploadJsonToPinata(
  pinataJwt: string,
  pinataGateway: string | undefined,
  json: Record<string, any>,
): Promise<string> {
  const pinata = new PinataSDK({
    pinataJwt,
    pinataGateway: pinataGateway || 'example-gateway.mypinata.cloud',
  });

  try {
    const upload = await pinata.upload.json(json);
    // Return the IPFS link using the returned cid
    return `https://ipfs.io/ipfs/${upload.cid}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw error;
  }
}

/**
 * Create token metadata JSON for Pump.fun
 * @param name - Token name
 * @param symbol - Token symbol
 * @param description - Token description
 * @param imageUrl - URL to token image
 * @param twitter - Optional Twitter handle
 * @param telegram - Optional Telegram link
 * @param website - Optional website URL
 * @returns Token metadata object
 */
export function createTokenMetadata(
  name: string,
  symbol: string,
  description: string,
  imageUrl: string,
  twitter?: string,
  telegram?: string,
  website?: string,
): Record<string, any> {
  return {
    name,
    symbol,
    description,
    image: imageUrl,
    showName: true,
    createdOn: 'https://www.clawdbot.ai',
    twitter,
    telegram,
    website,
  };
}
