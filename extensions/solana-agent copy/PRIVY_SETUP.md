# Privy Agentic Wallet Setup

This guide explains how to configure the Solana Agent extension to use Privy's agentic wallets instead of hardcoded private keys.

## Overview

Privy agentic wallets provide:
- **Policy-based controls** - Define boundaries for agent behavior
- **Secure autonomous execution** - No private keys stored locally
- **Multi-party approval** - Optional key quorums for critical actions
- **Transaction monitoring** - Webhooks for tracking agent actions

## Setup Steps

### 1. Create Authorization Keys

1. Go to your [Privy Dashboard](https://dashboard.privy.io)
2. Navigate to **Authorization Keys**
3. Create a new authorization key
4. Securely store the private key (for server-side authentication)

**Optional:** Set up a key quorum for enhanced security (requires multiple approvals for critical actions).

### 2. Define Agent Policies

Policies constrain what your agent can do. Common constraints include:

- **Transfer limits** - Maximum amounts per transaction
- **Allowlisted contracts** - Only interact with approved protocols
- **Recipient restrictions** - Limit where funds can be sent
- **Time-based controls** - Define when agents can operate

1. In Privy Dashboard, go to **Policies**
2. Create a new policy with your desired constraints
3. Save the policy ID (you'll need it when creating the wallet)

### 3. Create the Agent Wallet

1. In Privy Dashboard, go to **Wallets**
2. Create a new wallet with:
   - `owner_id`: Set to your authorization key ID
   - `policy_ids`: Array containing your policy ID
3. Save the wallet ID

### 4. Configure Clawdbot

Add Privy configuration to your `~/.clawdbot/clawdbot.json`:

```json5
{
  plugins: {
    entries: {
      "solana-agent": {
        enabled: true,
        network: "devnet",  // or "mainnet-beta"
        privy: {
          walletId: "g10iolak851bv03yaghi2g02",
          appId: "cme37hhd800b1jl0c8ux40z1h",
          authorizationKey: "wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgS/sbgDvD8dJrI120tc4JHnsCp9Ld70P7zBLtbjleP1ChRANCAAStYVbBlIoy7GotmirbFvefomuIPR8sQIqDZGxE1m/Fw2fZs45QQosJIvIgbV1ZO525TfPfn8Ct0d8q7AEOATb6",  // Optional, for server-side auth
          apiUrl: "https://api.privy.io"  // Optional, defaults to production
        },
        plugins: ["token", "defi", "nft", "misc"]
      }
    }
  }
}
```

### 5. Environment Variables (Alternative)

Instead of storing the authorization key in config, you can use environment variables:

```bash
export PRIVY_AUTHORIZATION_KEY="your-authorization-key"
```

Then omit `authorizationKey` from the config.

## Configuration Options

| Field | Required | Description |
|-------|----------|-------------|
| `walletId` | Yes | Privy wallet ID from dashboard |
| `appId` | Yes | Privy app ID |
| `authorizationKey` | No | Authorization key for server-side auth (or use env var) |
| `apiUrl` | No | Privy API URL (defaults to `https://api.privy.io`) |

## How It Works

1. **Transaction Creation**: The Solana Agent Kit creates transactions as usual
2. **Privy Signing**: Transactions are sent to Privy's API for signing
3. **Policy Enforcement**: Privy checks the transaction against your policies
4. **Execution**: If approved, Privy signs and broadcasts the transaction
5. **Monitoring**: Webhooks notify you of transaction status

## Security Best Practices

1. **Use Key Quorums**: Require multiple approvals for critical actions
2. **Restrictive Policies**: Start with tight constraints and relax as needed
3. **Monitor Activity**: Set up webhooks to track all agent transactions
4. **Environment Variables**: Store sensitive keys in environment variables, not config files
5. **Test on Devnet**: Always test policies on devnet before mainnet

## Troubleshooting

### Wallet Not Initializing

- Verify `walletId` and `appId` are correct
- Check that the authorization key has permission to access the wallet
- Ensure the wallet's `owner_id` matches your authorization key ID

### Transactions Failing

- Check that transactions comply with your policy constraints
- Verify the wallet has sufficient balance
- Review Privy dashboard logs for policy violations

### API Errors

- Verify your `authorizationKey` is correct
- Check that your Privy app is active
- Ensure you're using the correct `apiUrl` for your environment

## Example Policy

Here's an example policy that allows token swaps but limits transfer amounts:

```json
{
  "rules": [
    {
      "type": "transfer",
      "maxAmount": "10 SOL",
      "timeWindow": "1h"
    },
    {
      "type": "contract",
      "allowed": ["Jupiter", "Raydium"],
      "action": "swap"
    }
  ]
}
```

## Next Steps

- [Privy Policies Documentation](https://docs.privy.io/policies)
- [Privy Wallets API](https://docs.privy.io/wallets)
- [Transaction Webhooks](https://docs.privy.io/webhooks)
