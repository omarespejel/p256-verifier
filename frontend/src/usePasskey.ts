import { useCallback, useMemo, useState } from 'react'
import type { Hex } from 'viem'
import {
  buildPrecompileCalldata,
  bytesToHex,
  decodeDerSignature,
  sha256
} from './p256'

export type PasskeyStatus = 'idle' | 'working' | 'ready' | 'error'

export interface PasskeyPayload {
  message: string
  messageHash: Hex
  signature: {
    r: Hex
    s: Hex
  }
  publicKey: {
    x: Hex
    y: Hex
  }
  calldata: Hex
  createdAt: number
}

const ensureSubtleCrypto = () => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment')
  }
}

export const usePasskey = () => {
  const [payload, setPayload] = useState<PasskeyPayload | null>(null)
  const [status, setStatus] = useState<PasskeyStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const signMessage = useCallback(async (message: string) => {
    ensureSubtleCrypto()

    const trimmed = message.trim()
    if (!trimmed) {
      setStatus('error')
      const messageError = 'Message is required'
      setError(messageError)
      throw new Error(messageError)
    }

    setStatus('working')
    setError(null)

    try {
      const encoder = new TextEncoder()
      const messageBytes = encoder.encode(trimmed)

      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      )

      const signatureDer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyPair.privateKey,
        messageBytes
      )

      const digest = await sha256(messageBytes)
      const publicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey)
      )

      if (publicKeyRaw.length !== 65 || publicKeyRaw[0] !== 0x04) {
        throw new Error('Public key is not a valid uncompressed point')
      }

      const pubX = publicKeyRaw.slice(1, 33)
      const pubY = publicKeyRaw.slice(33, 65)

      const { r, s } = decodeDerSignature(signatureDer)
      const calldata = buildPrecompileCalldata({
        messageHash: digest,
        r,
        s,
        pubX,
        pubY
      })

      const nextPayload: PasskeyPayload = {
        message: trimmed,
        messageHash: bytesToHex(digest),
        signature: {
          r: bytesToHex(r),
          s: bytesToHex(s)
        },
        publicKey: {
          x: bytesToHex(pubX),
          y: bytesToHex(pubY)
        },
        calldata,
        createdAt: Date.now()
      }

      setPayload(nextPayload)
      setStatus('ready')
      return nextPayload
    } catch (err) {
      const messageError =
        err instanceof Error ? err.message : 'Unexpected passkey error'
      setError(messageError)
      setStatus('error')
      throw (err instanceof Error ? err : new Error(messageError))
    }
  }, [])

  const reset = useCallback(() => {
    setPayload(null)
    setStatus('idle')
    setError(null)
  }, [])

  const metadata = useMemo(
    () => ({
      isReady: status === 'ready',
      isWorking: status === 'working',
      isSupported:
        typeof window !== 'undefined' &&
        !!window.isSecureContext &&
        !!window.crypto?.subtle
    }),
    [status]
  )

  return {
    payload,
    status,
    error,
    signMessage,
    reset,
    ...metadata
  }
}

