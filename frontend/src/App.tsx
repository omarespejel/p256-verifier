import { useMemo, useState } from 'react'
import {
  buildCalldata,
  formatBytes,
  verifyOnChain,
  type VerifyResult
} from './p256'
import { usePasskey, type PasskeyPayload } from './usePasskey'
import { InfoCard } from './components/InfoCard'
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

  return (
    <div className="app">
      <header className="header">
        <div className="logo-row">
          <EthereumLogo />
        </div>
        <h1>EIP-7212 Verifier</h1>
        <p className="tagline">Native P-256 signature verification on Ethereum</p>
        {verifyResult?.blockNumber && (
          <div className="live-badge">
            <span className="pulse" />
            Mainnet Block #{verifyResult.blockNumber.toString()}
          </div>
        )}
      </header>

      <section className="explainer">
        <h2>What is this demo proving?</h2>
        <p>
          This demo verifies a <strong>P-256 (secp256r1)</strong> signature directly on
          Ethereum using the new <code>0x0100</code> precompile introduced in the{' '}
          <strong>Fusaka upgrade</strong>.
        </p>

        <div className="why-matters">
          <div className="why-item">
            <span className="why-icon">🔐</span>
            <div>
              <strong>Passkeys & WebAuthn</strong>
              <p>
                P-256 is the curve used by Face ID, Touch ID, YubiKeys, and all FIDO2
                authenticators.
              </p>
            </div>
          </div>
          <div className="why-item">
            <span className="why-icon">⚡</span>
            <div>
              <strong>60x Gas Reduction</strong>
              <p>
                Verifying P-256 in Solidity costs ~200,000 gas. This native precompile needs
                ~3,500 gas.
              </p>
            </div>
          </div>
          <div className="why-item">
            <span className="why-icon">🌐</span>
            <div>
              <strong>Account Abstraction</strong>
              <p>Enables smart accounts controlled by passkeys instead of seed phrases.</p>
            </div>
          </div>
        </div>

        <button
          className="link-btn"
          type="button"
          onClick={() => setShowLearnMore((prev) => !prev)}
        >
          {showLearnMore ? 'Hide technical details ↑' : 'Learn more about the cryptography ↓'}
        </button>

        {showLearnMore && (
          <div className="learn-more">
            <h3>The Cryptographic Flow</h3>
            <ol className="flow-steps">
              <li>
                <strong>Key Generation</strong> — A P-256 keypair is generated. The private key
                stays secure (in your device&apos;s secure enclave for real passkeys), while the
                public key (X, Y coordinates) is shared.
              </li>
              <li>
                <strong>Message Hashing</strong> — The message is hashed with SHA-256 to produce a
                32-byte digest. This is what actually gets signed.
              </li>
              <li>
                <strong>ECDSA Signing</strong> — The private key signs the hash, producing two
                32-byte values: <code>r</code> and <code>s</code>.
              </li>
              <li>
                <strong>Precompile Verification</strong> — The precompile at <code>0x0100</code>
                receives 160 bytes (<code>hash || r || s || x || y</code>) and returns <code>1</code>{' '}
                if valid.
              </li>
            </ol>
            <h3>Why P-256 instead of secp256k1?</h3>
            <p>
              Ethereum uses <strong>secp256k1</strong> for EOAs, but consumer devices use{' '}
              <strong>P-256 (secp256r1)</strong>. Without this precompile, verifying passkey
              signatures required expensive Solidity. Now it&apos;s native.
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
                </div>

                <div className="comparison">
                  <h4>Gas Comparison</h4>
                  <div className="comparison-bars">
                    <div className="bar-row">
                      <span className="bar-label">Solidity (before)</span>
                      <div className="bar old">
                        <div className="bar-fill" />
                      </div>
                      <span className="bar-value">~200,000</span>
                    </div>
                    <div className="bar-row">
                      <span className="bar-label">EIP-7212 (now)</span>
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

                <div className="share-row">
                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn share"
                    >
                      Share on X
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
          <span>·</span>
          <a
            href="https://github.com/espejelomar/eip-7951-demo"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <span>·</span>
          <a href="https://ethereum.org" target="_blank" rel="noreferrer">
            ethereum.org
          </a>
          <span>·</span>
          <a href="https://starknet.io" target="_blank" rel="noreferrer">
            starknet.io
          </a>
        </div>
        <p className="footer-credit">
          Built by{' '}
          <a href="https://twitter.com/espejelomar" target="_blank" rel="noreferrer">
            @espejelomar
          </a>{' '}
          at Starknet Foundation
        </p>
      </footer>
    </div>
  )
}

