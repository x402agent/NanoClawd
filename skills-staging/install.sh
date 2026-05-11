#!/usr/bin/env bash
# Move staged skills into .claude/skills/
# Run from the NanoClawd root: bash skills-staging/install.sh
set -euo pipefail

STAGING_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$(cd "$STAGING_DIR/.." && pwd)/.claude/skills"

for skill_dir in "$STAGING_DIR"/*/; do
  skill_name="$(basename "$skill_dir")"
  if [ "$skill_name" = "install.sh" ]; then continue; fi
  target="$SKILLS_DIR/$skill_name"
  mkdir -p "$target"
  cp -r "$skill_dir"* "$target/"
  echo "✓ installed $skill_name"
done

echo "🦞 All staged skills installed to .claude/skills/"
