## EIP-7951 P256 Precompile Demo (Frontend Only)

This repo now focuses exclusively on the Bun + Vite React application living in `frontend/`. The app:

- Generates an ephemeral P-256 keypair with the Web Crypto API (no wallet pop-ups).
- Hashes and signs arbitrary messages, surfacing the raw hash/`r`/`s`/`pub_x`/`pub_y`.
- Calls the `0x0100` P-256 precompile introduced by the Fusaka upgrade (EIP-7951) via `viem`.
- Visualizes gas usage, latency, block numbers, and offers a ready-to-share X post.

### Requirements
- [Bun](https://bun.sh) ≥ 1.1
- Node.js ≥ 22.12 (see `.nvmrc`)
- Modern browser with secure-context Web Crypto (HTTPS or `http://localhost`)

### Quickstart
```bash
git clone https://github.com/espejelomar/eip-7951-demo
cd eip-7951-demo/frontend
bun install
bun run dev
```

> **RPCs:** The app auto-configures public RPCs for mainnet, Sepolia, and Holesky. Override them with `.env` entries if needed:
> ```
> VITE_RPC_MAINNET=https://your-mainnet-rpc
> VITE_RPC_SEPOLIA=https://your-sepolia-rpc
> VITE_RPC_HOLESKY=https://your-holesky-rpc
> ```

### Build / Deploy
```bash
bun run build
```

The generated `frontend/dist/` bundle can be deployed directly to Vercel, Netlify, or any static host.

### Notes
- Web Crypto requires HTTPS (or localhost); insecure origins automatically disable the signature button.
- The repo still exposes the `verifyOnChain` helper inside `src/p256.ts`, so you can reuse the calldata builder or on-chain verifier elsewhere.

Feel free to open issues or PRs if you’d like to extend the UI, add tests, or bring back a CLI/uv workflow in a separate directory.

