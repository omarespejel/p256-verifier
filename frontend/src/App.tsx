import { useEffect, useMemo, useState } from 'react'
import { createPublicClient, http } from 'viem'
import {
  buildCalldata,
  formatBytes,
  verifyOnChain,
  type VerifyResult
} from './p256'
import { usePasskey, type PasskeyPayload } from './usePasskey'
import { InfoCard } from './components/InfoCard'
import { mainnet } from 'wagmi/chains'
import './style.css'

const SOLIDITY_GAS = 200000n

const EthereumLogo = () => (
  <svg width="28" height="28" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#343434"
      d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"
    />
    <path
      fill="#8C8C8C"
      d="M127.962 0L0 212.32l127.962 75.639V154.158z"
    />
    <path
      fill="#3C3C3B"
      d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"
    />
    <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
    <path
      fill="#141414"
      d="M127.961 287.958l127.96-75.637-127.96-58.162z"
    />
    <path fill="#393939" d="M0 212.32l127.96 75.638v-133.8z" />
  </svg>
)

export default function App() {
  const passkey = usePasskey()
  const [message, setMessage] = useState('Authorize transaction #12345')
  const [signature, setSignature] = useState<PasskeyPayload | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState('')
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [latestBlock, setLatestBlock] = useState<bigint | null>(null)

  useEffect(() => {
    const rpc = import.meta.env.VITE_RPC_MAINNET ?? 'https://eth.llamarpc.com'
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpc)
    })

    const refresh = async () => {
      try {
        const block = await client.getBlockNumber({ cacheTime: 0 })
        setLatestBlock(block)
      } catch {
        // best effort; ignore errors
      }
    }

    refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [])

  const handleSign = async () => {
    setLoading('Generating P-256 keypair & signing...')
    try {
      const payload = await passkey.signMessage(message)
      setSignature(payload)
      setVerifyResult(null)
    } finally {
      setLoading('')
    }
  }

  const handleVerify = async () => {
    if (!signature) {
      return
    }
    setLoading('Verifying on Ethereum mainnet...')
    try {
      const result = await verifyOnChain({
        messageHash: signature.messageHash,
        r: signature.signature.r,
        s: signature.signature.s,
        pubX: signature.publicKey.x,
        pubY: signature.publicKey.y
      })
      setVerifyResult(result)
      if (result.blockNumber) {
        setLatestBlock(result.blockNumber)
      }
    } finally {
      setLoading('')
    }
  }

  const calldata = useMemo(() => {
    if (!signature) {
      return null
    }
    return buildCalldata({
      messageHash: signature.messageHash,
      r: signature.signature.r,
      s: signature.signature.s,
      pubX: signature.publicKey.x,
      pubY: signature.publicKey.y
    })
  }, [signature])

  const gasSavings = useMemo(() => {
    if (!verifyResult?.gasUsed) {
      return null
    }
    const saved = Number(SOLIDITY_GAS - verifyResult.gasUsed)
    return ((saved / Number(SOLIDITY_GAS)) * 100).toFixed(1)
  }, [verifyResult])

  const gasBarWidth = verifyResult?.gasUsed
    ? Math.max(
        10,
        Math.min(
          100,
          (Number(verifyResult.gasUsed) / Number(SOLIDITY_GAS)) * 100
        )
      )
    : 20

  const shareUrl = useMemo(() => {
    if (!verifyResult?.valid) {
      return null
    }
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.href
        : 'https://github.com/espejelomar/eip-7951-demo'
    const text = `🔐 Just verified a P-256 signature on Ethereum mainnet!

⚡ Gas: ${verifyResult.gasUsed} (vs 200k in Solidity)
📦 Block: ${verifyResult.blockNumber}

Fusaka is LIVE. Passkeys on Ethereum are here.

Try the demo:`
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(baseUrl)}`
  }, [verifyResult])

  const blockToShow = latestBlock ?? verifyResult?.blockNumber ?? null

  return (
    <div className="app">
      <header className="header">
        <div className="logo-row">
          <EthereumLogo />
        </div>
        <h1>EIP-7212 Verifier</h1>
        <p className="tagline">Native P-256 signature verification on Ethereum</p>
        <p className="hero-credit">
          Built by{' '}
          <a href="https://x.com/espejelomar" target="_blank" rel="noreferrer">
            @espejelomar
          </a>{' '}
          /{' '}
          <a href="https://github.com/omarespejel" target="_blank" rel="noreferrer">
            omarespejel
          </a>
          . Star{' '}
          <a href="https://github.com/omarespejel/p256-verifier" target="_blank" rel="noreferrer">
            github.com/omarespejel/p256-verifier
          </a>{' '}
          or follow on X if this helps you.
        </p>
        <p className="hero-explainer">
          This demo verifies a <strong>P-256 signature</strong>—the same curve used by Face ID and
          YubiKeys—directly on Ethereum via the <code>0x0100</code> precompile.
        </p>
        {blockToShow && (
          <div className="network-badge">
            <span className="live-dot" />
            Ethereum Mainnet • Block #{blockToShow.toString()}
          </div>
        )}
      </header>

      <section className="explainer">
        <h2>What does this prove?</h2>
        <p>
          A plain browser can mint a P-256 key, sign your text, and ask Ethereum&apos;s{' '}
          <code>0x0100</code> precompile if the signature checks out.
        </p>

        <div className="why-matters">
          <div className="why-item">
            <span className="why-icon">🔐</span>
            <div>
              <strong>Passkeys & WebAuthn</strong>
              <p>P-256 powers Face ID, Touch ID, YubiKeys, and every FIDO2 device.</p>
            </div>
          </div>
          <div className="why-item">
            <span className="why-icon">⚡</span>
            <div>
              <strong>60x Gas Reduction</strong>
              <p>Solidity burns ~200k gas. The precompile needs ~3.5k.</p>
            </div>
          </div>
          <div className="why-item">
            <span className="why-icon">🌐</span>
            <div>
              <strong>Account Abstraction</strong>
              <p>Seedless wallets become practical when the chain can read passkeys.</p>
            </div>
          </div>
        </div>

        <button
          className="link-btn"
          type="button"
          onClick={() => setShowLearnMore((prev) => !prev)}
        >
          {showLearnMore ? 'Hide the details ↑' : 'See how the math flows ↓'}
        </button>

        {showLearnMore && (
          <div className="learn-more">
            <h3>The flow</h3>
            <ol className="flow-steps">
              <li>
                <strong>Key Generation</strong> — A P-256 keypair appears. The private key stays
                tucked away; the public key (x, y) can travel.
              </li>
              <li>
                <strong>Hashing</strong> — SHA-256 turns your text into 32 bytes. That digest gets
                signed.
              </li>
              <li>
                <strong>Signing</strong> — ECDSA spits out two 32-byte numbers: <code>r</code> and{' '}
                <code>s</code>.
              </li>
              <li>
                <strong>Verification</strong> — The precompile eats 160 bytes (
                <code>hash || r || s || x || y</code>) and returns <code>1</code> when everything
                matches.
              </li>
            </ol>
            <h3>Why P-256?</h3>
            <p>
              Ethereum loves secp256k1. Hardware you carry loves P-256. The precompile bridges that
              gap without a 200k gas bill.
            </p>
          </div>
        )}
      </section>

      <section className="demo-section">
        <h2>Try It Yourself</h2>

        <div className="step">
          <div className="step-header">
            <span className="step-number">1</span>
            <h3>Enter a message to sign</h3>
          </div>
          <textarea
            className="input"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Enter any message..."
          />
          <button
            className="btn primary"
            onClick={handleSign}
            disabled={Boolean(loading) || !passkey.isSupported}
          >
            Generate Signature
          </button>
          {!passkey.isSupported && (
            <p className="step-hint">
              Web Crypto needs HTTPS or localhost. Switch contexts to enable signing.
            </p>
          )}
          {passkey.error && <p className="error">{passkey.error}</p>}
          <p className="step-hint">
            This simulates what happens when you authenticate with Face ID or a YubiKey.
          </p>
        </div>

        {signature && (
          <div className="step">
            <div className="step-header">
              <span className="step-number">2</span>
              <h3>Inspect the cryptographic data</h3>
            </div>

            <InfoCard title="What was generated?">
              <p>
                A fresh P-256 keypair was created, and the message was signed locally. In
                production, this all happens inside your device&apos;s secure hardware.
              </p>
            </InfoCard>

            <div className="data-grid">
              <div className="data-item">
                <label>
                  Message Hash <span className="tag">SHA-256</span>
                </label>
                <code>{formatBytes(signature.messageHash, 64)}</code>
              </div>
              <div className="data-item">
                <label>
                  Signature R <span className="tag">32 bytes</span>
                </label>
                <code>{formatBytes(signature.signature.r, 64)}</code>
              </div>
              <div className="data-item">
                <label>
                  Signature S <span className="tag">32 bytes</span>
                </label>
                <code>{formatBytes(signature.signature.s, 64)}</code>
              </div>
              <div className="data-item">
                <label>
                  Public Key X <span className="tag">32 bytes</span>
                </label>
                <code>{formatBytes(signature.publicKey.x, 64)}</code>
              </div>
              <div className="data-item">
                <label>
                  Public Key Y <span className="tag">32 bytes</span>
                </label>
                <code>{formatBytes(signature.publicKey.y, 64)}</code>
              </div>
            </div>

            <div className="calldata-section">
              <label>
                Precompile Calldata <span className="tag">160 bytes</span>
              </label>
              <p className="calldata-explain">
                This is exactly what gets sent to <code>0x0100</code>: hash (32) + r (32) + s (32) + x
                (32) + y (32).
              </p>
              <div className="calldata-box">
                <code>{calldata ? calldata.slice(2) : '—'}</code>
              </div>
            </div>

            <button
              className="btn primary"
              onClick={handleVerify}
              disabled={Boolean(loading)}
            >
              Verify on Ethereum Mainnet
            </button>
          </div>
        )}

        {verifyResult && (
          <div className="step">
            <div className="step-header">
              <span className="step-number">3</span>
              <h3>On-chain verification result</h3>
            </div>

            <div className={`result-box ${verifyResult.valid ? 'success' : 'error'}`}>
              <div className="result-icon">{verifyResult.valid ? '✓' : '✗'}</div>
              <div className="result-text">
                <strong>
                  {verifyResult.valid ? 'Signature Valid' : 'Verification Failed'}
                </strong>
                <span>
                  {verifyResult.valid
                    ? 'The P-256 precompile confirmed this signature is authentic.'
                    : verifyResult.error}
                </span>
              </div>
            </div>

            {verifyResult.valid && (
              <>
                <div className="stats">
                  <div className="stat">
                    <span className="stat-value">{verifyResult.gasUsed?.toString()}</span>
                    <span className="stat-label">Gas Used</span>
                  </div>
                  <div className="stat highlight">
                    <span className="stat-value">
                      {gasSavings !== null ? `${gasSavings}%` : '—'}
                    </span>
                    <span className="stat-label">Gas Saved</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{verifyResult.rpcLatency}ms</span>
                    <span className="stat-label">RPC Latency</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">0x0100</span>
                    <span className="stat-label">Precompile</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">
                      {verifyResult.totalCallGas?.toString() ?? '—'}
                    </span>
                    <span className="stat-label">Total Call Gas</span>
                  </div>
                </div>

                <div className="comparison">
                  <h4>Gas Comparison</h4>
                  <div className="comparison-bars">
                    <div className="bar-row">
                      <span className="bar-label">P-256 in Solidity (before Fusaka)</span>
                      <div className="bar old">
                        <div className="bar-fill" />
                      </div>
                      <span className="bar-value">~200,000</span>
                    </div>
                    <div className="bar-row">
                      <span className="bar-label">Native Precompile (after Fusaka)</span>
                      <div className="bar new">
                        <div
                          className="bar-fill"
                          style={{ width: `${gasBarWidth}%` }}
                        />
                      </div>
                      <span className="bar-value">{verifyResult.gasUsed?.toString()}</span>
                    </div>
                  </div>
                </div>

                <InfoCard title="What just happened?" variant="success">
                  <p>
                    Your browser called <code>eth_call</code> on Ethereum mainnet, targeting the
                    precompile at <code>0x0100</code>. The EVM natively verified the P-256 signature
                    and returned <code>1</code> (valid).
                  </p>
                  <p>
                    This same flow lets <strong>smart contract wallets</strong> validate passkey
                    signatures on-chain, making seed phrases optional.
                  </p>
                </InfoCard>

                <div className="explainer-card">
                  <h4>🧠 What just happened?</h4>
                  <ol>
                    <li>The browser minted a P-256 keypair.</li>
                    <li>It signed your message with ECDSA.</li>
                    <li>It called Ethereum mainnet directly.</li>
                    <li>The precompile verified the signature.</li>
                  </ol>
                  <p>
                    <strong>This unlocks:</strong> wallets that trust Face ID, Touch ID, or a hardware
                    key—no seed phrase required.
                  </p>
                </div>

                <div className="share-row">
                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn share"
                    >
                      🚀 Share on X
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>{loading}</span>
        </div>
      )}

      <footer>
        <div className="footer-links">
          <a href="https://eips.ethereum.org/EIPS/eip-7212" target="_blank" rel="noreferrer">
            EIP-7212
          </a>
          <span>•</span>
          <a href="https://github.com/omarespejel/p256-verifier" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>•</span>
          <span>
            Built at{' '}
            <a href="https://starknet.io" target="_blank" rel="noreferrer">
              @Starknet
            </a>
          </span>
        </div>
        <p className="footer-credit">
          Crafted by{' '}
          <a href="https://twitter.com/espejelomar" target="_blank" rel="noreferrer">
            @espejelomar
          </a>
        </p>
      </footer>
    </div>
  )
}

