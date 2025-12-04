#!/bin/bash
#
# Generate an LLM-friendly context bundle for the Bun/Vite P256 verifier demo.
# Usage: ./generate-context.sh

set -euo pipefail

DATE="$(date '+%Y-%m-%d_%H-%M-%S_%Z')"
OUTPUT_FILE="p256-verifier-context-${DATE}.txt"

rm -f "$OUTPUT_FILE"
echo "📦 Building context bundle -> $OUTPUT_FILE"
echo ""

cat <<'PREAMBLE' >> "$OUTPUT_FILE"
# P256 Verifier Context & Goal

## Goal for the LLM
You are reviewing a Bun + Vite React application that:
- Generates Web Crypto (P-256) keypairs and ECDSA signatures in-browser
- Builds calldata for the EIP-7951 `0x0100` precompile (hash || r || s || x || y)
- Calls the precompile via viem, reporting gas, block number, and latency
- Presents the flow in an educational, Ethereum Foundation-inspired UI

Focus your analysis on:
- Calldata formation & signature handling correctness
- RPC usage, error surfacing, and gas measurement
- Frontend UX clarity for passkey/WebAuthn flows
- Opportunities for testing or modularizing `p256.ts` helpers
- Deployment readiness for static hosts (Netlify/Vercel)

---

PREAMBLE

{
  echo "## Directory Structure"
  if command -v tree >/dev/null 2>&1; then
    tree -L 3 -I ".git|node_modules|dist" >> "$OUTPUT_FILE"
  else
    find . -maxdepth 3 -not -path '*/.git/*' -not -path '*/node_modules/*' | sort >> "$OUTPUT_FILE"
  fi
  echo ""
} >> "$OUTPUT_FILE"

add_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "## FILE: $file" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo -e "\n---\n" >> "$OUTPUT_FILE"
  fi
}

CORE_FILES=(
  "README.md"
  ".nvmrc"
  "$0"
)

for path in "${CORE_FILES[@]}"; do
  add_file "$path"
done

FRONTEND_FILES=(
  "frontend/package.json"
  "frontend/tsconfig.json"
  "frontend/index.html"
  "frontend/src/App.tsx"
  "frontend/src/main.tsx"
  "frontend/src/p256.ts"
  "frontend/src/usePasskey.ts"
  "frontend/src/style.css"
  "frontend/src/components/InfoCard.tsx"
  "frontend/src/vite-env.d.ts"
)

for path in "${FRONTEND_FILES[@]}"; do
  add_file "$path"
done

echo "✅ Context written to $OUTPUT_FILE"

