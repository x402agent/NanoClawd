#!/usr/bin/env node
/**
 * Launch a token on pump.fun
 * Usage: node launch-token.mjs --name "Token Name" --symbol "TKN" --description "Description" --image-url "https://..."
 */

import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction, VersionedTransaction, SystemProgram, TransactionInstruction, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse args
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const tokenName = getArg('name') || 'Test Token';
const tokenSymbol = getArg('symbol') || 'TEST';
const tokenDescription = getArg('description') || 'A test token on pump.fun';
const imageUrl = getArg('image-url') || 'https://pub-9af07bef0b9a404f9d37dd58eb5dd90a.r2.dev/pdfs/token.png';
const initialBuySol = parseFloat(getArg('initial-buy') || '0');

// Load .env
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

// Constants
const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const PUMP_FEE_RECIPIENT = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");
const PUMP_EVENT_AUTHORITY = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const MPL_TOKEN_METADATA = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const IPFS_UPLOAD_URL = "https://pump.fun/api/ipfs";

function getMintAuthority() {
  return PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], PUMP_PROGRAM_ID);
}

function getBondingCurvePDA(mint) {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM_ID);
}

function getMetadataPDA(mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_TOKEN_METADATA.toBuffer(), mint.toBuffer()],
    MPL_TOKEN_METADATA
  );
}

async function uploadImageFromUrl(url) {
  console.log(`📤 Fetching image from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || '.png';

  const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };
  const mimeType = mimeTypes[ext.toLowerCase()] || 'image/png';

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, `token${ext}`);

  console.log(`📤 Uploading image to IPFS...`);
  const uploadResponse = await fetch(IPFS_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Image upload failed: ${uploadResponse.status} - ${text}`);
  }

  const result = await uploadResponse.json();
  return result.metadataUri || result.uri;
}

async function uploadMetadata(metadata, imageUri) {
  console.log(`📤 Uploading metadata to IPFS...`);

  // Try creating a Blob with metadata.json
  const metadataJson = JSON.stringify({
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    image: imageUri,
    showName: true,
    createdOn: "https://pump.fun",
  });

  const formData = new FormData();
  const blob = new Blob([metadataJson], { type: 'application/json' });
  formData.append('file', blob, 'metadata.json');
  formData.append('name', metadata.name);
  formData.append('symbol', metadata.symbol);
  formData.append('description', metadata.description);
  formData.append('showName', 'true');

  const response = await fetch(IPFS_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    // Try alternative: just use the image URI as metadata
    console.log(`⚠️  Metadata form upload failed, using image URI directly`);
    return imageUri;
  }

  const result = await response.json();
  return result.metadataUri || result.uri || imageUri;
}

async function main() {
  console.log("\n🚀 Pump.fun Token Launch");
  console.log("═".repeat(50));
  console.log(`  Name: ${tokenName}`);
  console.log(`  Symbol: ${tokenSymbol}`);
  console.log(`  Description: ${tokenDescription.substring(0, 50)}${tokenDescription.length > 50 ? '...' : ''}`);
  console.log(`  Image URL: ${imageUrl}`);
  if (initialBuySol > 0) console.log(`  Initial Buy: ${initialBuySol} SOL`);
  console.log("═".repeat(50));

  // Load wallet
  const privateKey = process.env.SOLANA_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  let keypair;

  if (privateKey) {
    keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  } else {
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    keypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
  }
  console.log(`\n👛 Wallet: ${keypair.publicKey.toBase58()}`);

  // Check RPC and balance
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, 'confirmed');

  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    console.error("❌ Insufficient balance (need at least 0.05 SOL)");
    process.exit(1);
  }

  // Step 1: Upload image
  let imageUri;
  try {
    imageUri = await uploadImageFromUrl(imageUrl);
    console.log(`✅ Image uploaded: ${imageUri}`);
  } catch (e) {
    console.log(`⚠️  Image upload failed: ${e.message}`);
    console.log(`   Using direct URL instead`);
    imageUri = imageUrl;
  }

  // Step 2: Upload metadata
  const metadata = {
    name: tokenName,
    symbol: tokenSymbol,
    description: tokenDescription,
  };

  let metadataUri;
  try {
    metadataUri = await uploadMetadata(metadata, imageUri);
    console.log(`✅ Metadata URI: ${metadataUri}`);
  } catch (e) {
    console.log(`⚠️  Metadata upload failed, using image URI: ${e.message}`);
    metadataUri = imageUri;
  }

  // Step 3: Generate mint keypair
  const mintKeypair = Keypair.generate();

  console.log(`\n🪙 Mint: ${mintKeypair.publicKey.toBase58()}`);

  // Step 4: Use pump.fun trade API to get the transaction
  console.log(`\n📡 Fetching transaction from pump.fun API...`);

  const createResponse = await fetch(`https://pumpportal.fun/api/trade-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: keypair.publicKey.toBase58(),
      action: 'create',
      tokenMetadata: {
        name: tokenName,
        symbol: tokenSymbol,
        uri: metadataUri,
      },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: 'true',
      amount: initialBuySol,
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(`❌ API error: ${createResponse.status} - ${errorText}`);
    process.exit(1);
  }

  const txData = await createResponse.arrayBuffer();
  const txBuffer = Buffer.from(txData);

  // Try versioned transaction first, fall back to legacy
  let tx;
  let isVersioned = false;
  try {
    tx = VersionedTransaction.deserialize(txBuffer);
    isVersioned = true;
    console.log(`✅ Versioned transaction received from API`);
  } catch {
    tx = Transaction.from(txBuffer);
    console.log(`✅ Legacy transaction received from API`);
  }

  console.log(`\n✍️  Signing and sending transaction...`);

  try {
    let signature;

    if (isVersioned) {
      // Sign versioned transaction
      tx.sign([keypair, mintKeypair]);
      signature = await connection.sendTransaction(tx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.partialSign(keypair);
      tx.partialSign(mintKeypair);
      const rawTx = tx.serialize();
      signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    }

    console.log(`⏳ Confirming transaction: ${signature}`);
    await connection.confirmTransaction(signature, 'confirmed');

    console.log("\n" + "═".repeat(50));
    console.log("✅ TOKEN LAUNCHED SUCCESSFULLY!");
    console.log("═".repeat(50));
    console.log(`  Mint: ${mintKeypair.publicKey.toBase58()}`);
    console.log(`  Signature: ${signature}`);
    console.log(`\n  🔗 pump.fun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
    console.log(`  🔗 Solscan: https://solscan.io/tx/${signature}`);
    console.log("═".repeat(50));
  } catch (e) {
    console.error(`\n❌ Transaction failed: ${e.message}`);
    if (e.logs) {
      console.log("\nLogs:");
      e.logs.forEach(log => console.log(`  ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
