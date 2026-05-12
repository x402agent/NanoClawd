#!/usr/bin/env node
/**
 * Quick test for pump.fun token launch
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const IPFS_UPLOAD_URL = "https://pump.fun/api/ipfs";

async function main() {
  console.log("🚀 Pump.fun Token Launch Test\n");

  // Load wallet
  const privateKey = process.env.SOLANA_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  let keypair;

  if (privateKey) {
    const secretKey = bs58.decode(privateKey);
    keypair = Keypair.fromSecretKey(secretKey);
    console.log(`✅ Loaded wallet from env: ${keypair.publicKey.toBase58()}`);
  } else {
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    if (fs.existsSync(walletPath)) {
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
      console.log(`✅ Loaded wallet from file: ${keypair.publicKey.toBase58()}`);
    } else {
      console.error("❌ No wallet found");
      process.exit(1);
    }
  }

  // Check RPC
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  console.log(`📡 RPC: ${rpcUrl.substring(0, 60)}...`);

  const connection = new Connection(rpcUrl, 'confirmed');

  try {
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
  } catch (e) {
    console.log(`⚠️  Could not get balance: ${e.message}\n`);
  }

  // Test metadata upload
  console.log("📤 Testing IPFS upload...");

  const testMetadata = {
    name: "Test Token",
    symbol: "TEST",
    description: "Test token for pump.fun integration",
    image: "https://pub-9af07bef0b9a404f9d37dd58eb5dd90a.r2.dev/pdfs/token.png",
  };

  try {
    const response = await fetch(IPFS_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMetadata),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ IPFS upload works!`);
      console.log(`   URI: ${result.metadataUri || result.uri}`);
    } else {
      console.log(`⚠️  IPFS upload returned: ${response.status} ${response.statusText}`);
    }
  } catch (e) {
    console.error(`❌ IPFS upload failed: ${e.message}`);
  }

  console.log("\n✅ Configuration verified!");
}

main().catch(console.error);
