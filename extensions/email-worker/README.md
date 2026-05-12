# mawdbot Email Worker

Cloudflare Email Worker that provides mawdbot AI assistant via email.

## Features

- **AI Art Generation** - `!art <prompt>` generates images via xAI
- **X Search** - `!search <query>` searches X/Twitter
- **Web Search** - `!web <query>` searches the web
- **Chat** - `!ask <question>` or just send a message
- **Sender Whitelist** - Optional restriction to allowed senders
- **Auto-reply** - Responds to all emails with results

## Setup

### 1. Install dependencies

```bash
cd extensions/email-worker
pnpm install
```

### 2. Configure secrets

```bash
# Required: xAI API key
wrangler secret put XAI_API_KEY

# Optional: Birdeye API for crypto data
wrangler secret put BIRDEYE_API_KEY

# Optional: Forward unknown emails to admin
wrangler secret put FORWARD_TO
```

### 3. Deploy

```bash
pnpm deploy
```

### 4. Configure Email Routing

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Email Routing
2. Add your domain if not already added
3. Set up DNS records as prompted
4. Create a routing rule:
   - **Custom address**: `*@mawdbot.yourdomain.com` (or any pattern)
   - **Action**: Send to Worker
   - **Destination**: `mawdbot-email`

## Usage

Send an email to your configured address with commands in the subject line:

| Command | Description |
|---------|-------------|
| `!art <prompt>` | Generate AI art with xAI |
| `!search <query>` | Search X/Twitter |
| `!web <query>` | Search the web |
| `!ask <question>` | Ask mawdbot anything |
| `!help` | Show available commands |

Or just send a plain email - mawdbot will treat it as a chat message.

## Configuration

### Environment Variables

Set in `wrangler.toml` or via `wrangler secret put`:

| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key for AI features |
| `BIRDEYE_API_KEY` | No | Birdeye API for Solana token data |
| `ALLOWED_SENDERS` | No | Comma-separated whitelist of email addresses |
| `FORWARD_TO` | No | Email to forward non-whitelisted messages |

### Sender Whitelist

To restrict who can use the bot, set `ALLOWED_SENDERS`:

```bash
wrangler secret put ALLOWED_SENDERS
# Enter: user1@gmail.com,user2@gmail.com
```

## Development

```bash
# Run locally (note: email triggers don't work in dev mode)
pnpm dev

# View logs
pnpm tail

# Deploy to dev environment
wrangler deploy --env dev
```

## Architecture

```
Email → Cloudflare Email Routing → Worker → xAI API → Reply Email
```

The worker:
1. Receives incoming email via Cloudflare Email Routing
2. Parses command from subject or body
3. Executes command using xAI API
4. Sends reply email with results

## Extending

Add new commands in `src/index.ts` in the `executeCommand` function:

```typescript
case 'mycommand':
  return {
    success: true,
    message: 'Command result',
  };
```
