/**
 * mawdbot Email Worker
 *
 * Cloudflare Email Worker that processes commands via email:
 * - Subject line commands: !art <prompt>, !search <query>, etc.
 * - Same command set as Twitter mawdbot
 * - Replies via email with results
 *
 * Deploy: wrangler deploy
 * Route: *@mawdbot.yourdomain.com
 */

// Cloudflare Email Message type (runtime API)
interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(to: string, headers?: Headers): Promise<void>;
  reply(message: EmailMessage): Promise<void>;
}

// Constructor for creating outbound email messages
declare const EmailMessage: {
  new (from: string, to: string, raw: ReadableStream<Uint8Array>): EmailMessage;
};

export interface Env {
  XAI_API_KEY: string;
  BIRDEYE_API_KEY?: string;
  ALLOWED_SENDERS?: string; // Comma-separated list of allowed email addresses
  FORWARD_TO?: string; // Email to forward unrecognized messages to
}

export interface Command {
  name: string;
  args: string[];
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  imageUrl?: string;
}

// XAI API helpers
const XAI_API_BASE = 'https://api.x.ai/v1';

async function xaiGenerateImage(
  apiKey: string,
  prompt: string
): Promise<{ url?: string; revised_prompt?: string }> {
  const response = await fetch(`${XAI_API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image',
      prompt,
      n: 1,
      aspect_ratio: '1:1',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI image generation failed: ${error}`);
  }

  const data = (await response.json()) as { data?: { url?: string; revised_prompt?: string }[] };
  return data.data?.[0] || {};
}

async function xaiSearch(
  apiKey: string,
  query: string,
  type: 'x_search' | 'web_search'
): Promise<{ content: string; citations: string[] }> {
  const tools = [{ type, [type]: {} }];

  const response = await fetch(`${XAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast',
      input: query,
      tools,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI search failed: ${error}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };

  return {
    content: data.output_text || data.choices?.[0]?.message?.content || '',
    citations: data.citations || [],
  };
}

async function xaiChat(apiKey: string, message: string): Promise<string> {
  const response = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast',
      messages: [
        {
          role: 'system',
          content:
            'You are mawdbot, a helpful AI assistant. Keep responses concise and friendly. Use the crab emoji occasionally.',
        },
        { role: 'user', content: message },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI chat failed: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content || 'No response generated';
}

// Parse command from email subject or body
function parseCommand(text: string): Command | null {
  const cleaned = text.trim();

  if (!cleaned.startsWith('!')) {
    return null;
  }

  const parts = cleaned.slice(1).split(/\s+/);
  const name = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!name) return null;

  return {
    name,
    args,
    raw: cleaned.slice(1 + name.length).trim(),
  };
}

// Execute command
async function executeCommand(command: Command, env: Env): Promise<CommandResult> {
  console.log(`[email-worker] Executing: !${command.name}`);

  switch (command.name) {
    case 'help':
      return {
        success: true,
        message: `mawdbot Email Commands:

!art <prompt> - Generate AI art
!search <query> - Search X
!web <query> - Search web
!ask <question> - Ask mawdbot anything
!help - Show this help

Reply to this email with a command to get started!

🦀`,
      };

    case 'art':
    case 'generate':
    case 'draw':
      if (!command.raw) {
        return {
          success: false,
          message: 'Please provide a prompt: !art <description>',
        };
      }
      try {
        const result = await xaiGenerateImage(env.XAI_API_KEY, command.raw);
        return {
          success: true,
          message: `🎨 Art generated!\n\n${result.revised_prompt || command.raw}`,
          imageUrl: result.url,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Art error: ${message}` };
      }

    case 'search':
    case 'x':
      if (!command.raw) {
        return {
          success: false,
          message: 'Please provide a search query: !search <query>',
        };
      }
      try {
        const result = await xaiSearch(env.XAI_API_KEY, command.raw, 'x_search');
        return {
          success: true,
          message: `🔍 X Search: "${command.raw}"\n\n${result.content}`,
          data: { citations: result.citations },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Search error: ${message}` };
      }

    case 'web':
    case 'websearch':
      if (!command.raw) {
        return {
          success: false,
          message: 'Please provide a search query: !web <query>',
        };
      }
      try {
        const result = await xaiSearch(env.XAI_API_KEY, command.raw, 'web_search');
        return {
          success: true,
          message: `🌐 Web Search: "${command.raw}"\n\n${result.content}`,
          data: { citations: result.citations },
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Search error: ${message}` };
      }

    case 'ask':
    case 'chat':
    case 'question':
      if (!command.raw) {
        return {
          success: false,
          message: 'Please provide a question: !ask <question>',
        };
      }
      try {
        const response = await xaiChat(env.XAI_API_KEY, command.raw);
        return {
          success: true,
          message: response,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `Chat error: ${message}` };
      }

    default:
      return {
        success: false,
        message: `Unknown command: !${command.name}\n\nTry !help for available commands.`,
      };
  }
}

// Parse email headers to get sender and subject
function parseEmailHeaders(raw: string): { from: string; subject: string; messageId: string } {
  const headers: Record<string, string> = {};
  const headerSection = raw.split('\r\n\r\n')[0] || raw.split('\n\n')[0];

  let currentHeader = '';
  let currentValue = '';

  for (const line of headerSection.split(/\r?\n/)) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // Continuation of previous header
      currentValue += ' ' + line.trim();
    } else {
      // Save previous header
      if (currentHeader) {
        headers[currentHeader.toLowerCase()] = currentValue;
      }
      // Start new header
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        currentHeader = line.slice(0, colonIndex);
        currentValue = line.slice(colonIndex + 1).trim();
      }
    }
  }
  // Save last header
  if (currentHeader) {
    headers[currentHeader.toLowerCase()] = currentValue;
  }

  return {
    from: headers['from'] || '',
    subject: headers['subject'] || '',
    messageId: headers['message-id'] || '',
  };
}

// Extract email address from "Name <email@domain.com>" format
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

// Get plain text body from email
async function getEmailBody(message: EmailMessage): Promise<string> {
  const raw = await new Response(message.raw).text();
  const parts = raw.split(/\r?\n\r?\n/);

  if (parts.length < 2) return '';

  // Simple extraction - in production, use a proper MIME parser
  let body = parts.slice(1).join('\n\n');

  // Remove quoted content (replies)
  body = body.split(/^>|^On .* wrote:/m)[0] || body;

  // Remove HTML tags if present
  body = body.replace(/<[^>]*>/g, '');

  // Decode quoted-printable if needed
  body = body.replace(/=\r?\n/g, '');
  body = body.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return body.trim();
}

// Generate a random boundary for multipart MIME
function generateBoundary(): string {
  return '----=_Part_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Create reply email (manual MIME builder - no external deps)
function createReplyEmail(
  to: string,
  subject: string,
  body: string,
  inReplyTo: string,
  imageUrl?: string
): string {
  const boundary = generateBoundary();
  const replySubject = subject.startsWith('Re: ') ? subject : `Re: ${subject}`;
  const date = new Date().toUTCString();

  // Plain text version
  const plainText = body + (imageUrl ? `\n\nImage: ${imageUrl}` : '');

  // HTML version
  let htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">`;
  htmlBody += `<pre style="white-space: pre-wrap;">${escapeHtml(body)}</pre>`;
  if (imageUrl) {
    htmlBody += `<br/><img src="${escapeHtml(imageUrl)}" alt="Generated image" style="max-width: 100%; border-radius: 8px;"/>`;
  }
  htmlBody += `<br/><hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;"/>`;
  htmlBody += `<p style="color: #666; font-size: 12px;">mawdbot email assistant - reply with !help for commands</p>`;
  htmlBody += `</div>`;

  // Build headers
  let email = '';
  email += `From: mawdbot <mawdbot@mawdbot.ai>\r\n`;
  email += `To: ${to}\r\n`;
  email += `Subject: ${replySubject}\r\n`;
  email += `Date: ${date}\r\n`;
  email += `MIME-Version: 1.0\r\n`;

  if (inReplyTo) {
    email += `In-Reply-To: ${inReplyTo}\r\n`;
    email += `References: ${inReplyTo}\r\n`;
  }

  email += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  email += `\r\n`;

  // Plain text part
  email += `--${boundary}\r\n`;
  email += `Content-Type: text/plain; charset=utf-8\r\n`;
  email += `Content-Transfer-Encoding: 7bit\r\n`;
  email += `\r\n`;
  email += `${plainText}\r\n`;

  // HTML part
  email += `--${boundary}\r\n`;
  email += `Content-Type: text/html; charset=utf-8\r\n`;
  email += `Content-Transfer-Encoding: 7bit\r\n`;
  email += `\r\n`;
  email += `${htmlBody}\r\n`;

  // End boundary
  email += `--${boundary}--\r\n`;

  return email;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[email-worker] Received email from: ${message.from}`);

    const senderEmail = extractEmail(message.from);

    // Check if sender is allowed (if whitelist is configured)
    if (env.ALLOWED_SENDERS) {
      const allowed = env.ALLOWED_SENDERS.split(',').map((e) => e.trim().toLowerCase());
      if (!allowed.includes(senderEmail.toLowerCase())) {
        console.log(`[email-worker] Sender not in allowed list: ${senderEmail}`);

        // Forward to admin if configured
        if (env.FORWARD_TO) {
          await message.forward(env.FORWARD_TO);
        }
        return;
      }
    }

    // Parse email
    const raw = await new Response(message.raw).text();
    const { subject, messageId } = parseEmailHeaders(raw);
    const body = await getEmailBody(message);

    console.log(`[email-worker] Subject: ${subject}`);
    console.log(`[email-worker] Body preview: ${body.slice(0, 100)}...`);

    // Try to parse command from subject first, then body
    let command = parseCommand(subject);
    if (!command) {
      command = parseCommand(body);
    }

    let result: CommandResult;

    if (command) {
      // Execute the command
      result = await executeCommand(command, env);
    } else {
      // No command found - treat as a chat message
      if (body.length > 0) {
        try {
          const response = await xaiChat(env.XAI_API_KEY, body);
          result = { success: true, message: response };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result = {
            success: false,
            message: `I had trouble understanding that. Try starting your subject with a command like !help\n\nError: ${errorMessage}`,
          };
        }
      } else {
        result = {
          success: true,
          message: `Hi! I'm mawdbot. Send me an email with a command in the subject line.\n\nAvailable commands:\n!art <prompt> - Generate AI art\n!search <query> - Search X\n!web <query> - Search web\n!ask <question> - Ask me anything\n!help - Show all commands\n\n🦀`,
        };
      }
    }

    // Send reply
    const replyContent = createReplyEmail(
      senderEmail,
      subject || 'mawdbot response',
      result.message,
      messageId,
      result.imageUrl
    );

    const replyMessage = new EmailMessage(
      'mawdbot@mawdbot.ai', // from
      senderEmail, // to
      new Blob([replyContent]).stream()
    );

    ctx.waitUntil(message.reply(replyMessage));

    console.log(`[email-worker] Reply sent to ${senderEmail}`);
  },
};
