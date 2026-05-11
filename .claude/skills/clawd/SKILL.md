---
name: clawd
description: Install the clawd CLI tool — run NanoClawd agent containers from the command line without opening a chat app.
---

# clawd — NanoClawd CLI

`clawd` is a Python CLI that sends prompts directly to a NanoClawd agent container from the terminal. It reads registered groups from the NanoClawd database, picks up secrets from `.env`, and pipes a JSON payload into a container run — no chat app required.

## What it does

- Send a prompt to any registered group by name, folder, or JID
- Default target is the main group (no `-g` needed for most use)
- Resume a previous session with `-s <session-id>`
- Read prompts from stdin (`--pipe`) for scripting and piping
- List all registered groups with `--list-groups`
- Auto-detects `container` or `docker` runtime (or override with `--runtime`)
- Prints the agent's response to stdout; session ID to stderr
- Verbose mode (`-v`) shows the command, redacted payload, and exit code

## Prerequisites

- Python 3.8 or later
- NanoClawd installed with a built and tagged container image (`nanoclawd-agent:latest`)
- Either `container` (Apple Container, macOS 15+) or `docker` available in `PATH`

## Install

Run this skill from within the NanoClawd directory. The script auto-detects its location, so the symlink always points to the right place.

### 1. Copy the script

```bash
mkdir -p scripts
cp "${CLAUDE_SKILL_DIR}/scripts/clawd" scripts/clawd
chmod +x scripts/clawd
```

### 2. Symlink into PATH

```bash
mkdir -p ~/bin
ln -sf "$(pwd)/scripts/clawd" ~/bin/clawd
```

Make sure `~/bin` is in `PATH`. Add this to `~/.zshrc` or `~/.bashrc` if needed:

```bash
export PATH="$HOME/bin:$PATH"
```

Then reload the shell:

```bash
source ~/.zshrc   # or ~/.bashrc
```

### 3. Verify

```bash
clawd --list-groups
```

You should see registered groups. If NanoClawd isn't running or the database doesn't exist yet, the list will be empty — that's fine.

## Usage Examples

```bash
# Send a prompt to the main group
clawd "What's on my calendar today?"

# Send to a specific group by name (fuzzy match)
clawd -g "family" "Remind everyone about dinner at 7"

# Send to a group by exact JID
clawd -j "120363336345536173@g.us" "Hello"

# Resume a previous session
clawd -s abc123 "Continue where we left off"

# Read prompt from stdin
echo "Summarize this" | clawd --pipe -g dev

# Pipe a file
cat report.txt | clawd --pipe "Summarize this report"

# List all registered groups
clawd --list-groups

# Force a specific runtime
clawd --runtime docker "Hello"

# Use a custom image tag (e.g. after rebuilding with a new tag)
clawd --image nanoclawd-agent:dev "Hello"

# Verbose mode (debug info, secrets redacted)
clawd -v "Hello"

# Custom timeout for long-running tasks
clawd --timeout 600 "Run the full analysis"
```

## Troubleshooting

### "neither 'container' nor 'docker' found"

Install Docker Desktop or Apple Container (macOS 15+), or pass `--runtime` explicitly.

### "no secrets found in .env"

The script auto-detects your NanoClawd directory and reads `.env` from it. Check that the file exists and contains at least one of: `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`.

### Container times out

The default timeout is 300 seconds. For longer tasks, pass `--timeout 600` (or higher). If the container consistently hangs, check that your `nanoclawd-agent:latest` image is up to date by running `./container/build.sh`.

### "group not found"

Run `clawd --list-groups` to see what's registered. Group lookup does a fuzzy partial match on name and folder — if your query matches multiple groups, you'll get an error listing the ambiguous matches.

### Container crashes mid-stream

Containers run with `--rm` so they are automatically removed. If the agent crashes before emitting the output sentinel, `clawd` falls back to printing raw stdout. Use `-v` to see what the container produced. Rebuild the image with `./container/build.sh` if crashes are consistent.

### Override the NanoClawd directory

If `clawd` can't find your database or `.env`, set the `NANOCLAWD_DIR` environment variable:

```bash
export NANOCLAWD_DIR=/path/to/your/nanoclawd
```
