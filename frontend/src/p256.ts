import { createPublicClient, http, type Hex, type PublicClient } from 'viem'
import { mainnet } from 'viem/chains'

export const P256_PRECOMPILE = '0x0000000000000000000000000000000000000100' as const

const TEXT_ENCODER = new TextEncoder()
const DEFAULT_RPC = 'https://eth.llamarpc.com'

const toBytes = (value: ArrayBuffer | Uint8Array): Uint8Array =>
  value instanceof ArrayBuffer ? new Uint8Array(value) : value

const trimLeadingZeros = (bytes: Uint8Array): Uint8Array => {
  let start = 0
  while (start < bytes.length && bytes[start] === 0) {
    start += 1
  }
  return bytes.slice(start)
}

const leftPad = (bytes: Uint8Array, targetLength = 32): Uint8Array => {
  if (bytes.length > targetLength) {
    return bytes.slice(bytes.length - targetLength)
  }

  if (bytes.length === targetLength) {
    return bytes
  }

  const result = new Uint8Array(targetLength)
  result.set(bytes, targetLength - bytes.length)
  return result
}

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const buffer = new Uint8Array(total)
  let offset = 0

  parts.forEach((part) => {
    buffer.set(part, offset)
    offset += part.length
  })

  return buffer
}

export const bytesToHex = (bytes: Uint8Array): Hex =>
  `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}` as Hex

const strip0x = (value: Hex): string => value.replace(/^0x/, '')

const hexFromBytes = (value: Hex | Uint8Array): string => {
  if (typeof value === 'string') {
    return strip0x(value)
  }

  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const sha256 = async (value: Uint8Array | string): Promise<Uint8Array> => {
  const data: Uint8Array =
    typeof value === 'string' ? TEXT_ENCODER.encode(value) : value
  const normalized =
    data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data
      : data.slice()
  const digest = await crypto.subtle.digest(
    'SHA-256',
    normalized.buffer as ArrayBuffer
  )
  return new Uint8Array(digest)
}

export interface BuildPrecompileCalldataParams {
  messageHash: Uint8Array
  r: Uint8Array
  s: Uint8Array
  pubX: Uint8Array
  pubY: Uint8Array
}

export const buildPrecompileCalldata = ({
  messageHash,
  r,
  s,
  pubX,
  pubY
}: BuildPrecompileCalldataParams): Hex => {
  if (
    ![messageHash, r, s, pubX, pubY].every((segment) => segment.length === 32)
  ) {
    throw new Error('Each calldata segment must be 32 bytes')
  }

  const payload = concatBytes([messageHash, r, s, pubX, pubY])
  return bytesToHex(payload)
}

export interface BuildCalldataHexParams {
  messageHash: Hex
  r: Hex
  s: Hex
  pubX: Hex
  pubY: Hex
}

export const buildCalldata = ({
  messageHash,
  r,
  s,
  pubX,
  pubY
}: BuildCalldataHexParams): Hex =>
  (`0x${[
    messageHash,
    r,
    s,
    pubX,
    pubY
  ]
    .map((segment) => strip0x(segment))
    .join('')}` as Hex)

export interface DerSignature {
  r: Uint8Array
  s: Uint8Array
}

export const decodeDerSignature = (
  signature: ArrayBuffer | Uint8Array
): DerSignature => {
  const bytes = toBytes(signature)

  if (bytes[0] !== 0x30) {
    if (bytes.length === 64) {
      return {
        r: bytes.slice(0, 32),
        s: bytes.slice(32, 64)
      }
    }

    throw new Error('Invalid DER sequence header')
  }

  let offset = 2
  if (bytes[1] & 0x80) {
    const lengthBytes = bytes[1] & 0x7f
    offset = 2 + lengthBytes
  }

  const readInteger = () => {
    if (bytes[offset] !== 0x02) {
      throw new Error('Invalid DER integer header')
    }

    const length = bytes[offset + 1]
    const start = offset + 2
    const end = start + length

    offset = end
    return bytes.slice(start, end)
  }

  const r = leftPad(trimLeadingZeros(readInteger()))
  const s = leftPad(trimLeadingZeros(readInteger()))

  return { r, s }
}

export const callP256Precompile = async (
  client: PublicClient,
  calldata: Hex
): Promise<boolean> => {
  const response = await client.call({
    to: P256_PRECOMPILE,
    data: calldata,
    gas: 100000n
  })
  const data =
    typeof response === 'string'
      ? response
      : (response as { data?: Hex }).data

  if (!data || data === '0x' || data === '0x0') {
    return false
  }

  const normalized = data.toLowerCase()
  return (
    normalized ===
      '0x0000000000000000000000000000000000000000000000000000000000000001' ||
    normalized === '0x01' ||
    normalized === '0x1'
  )
}

export const formatBytes = (value: Hex | Uint8Array, maxLen = 64): string => {
  const hex = hexFromBytes(value)
  if (maxLen >= hex.length || hex.length <= maxLen) {
    return `0x${hex}`
  }
  return `0x${hex.slice(0, maxLen)}...`
}

export interface VerifyParams {
  messageHash: Hex
  r: Hex
  s: Hex
  pubX: Hex
  pubY: Hex
}

export interface VerifyResult {
  valid: boolean
  gasUsed?: bigint
  totalCallGas?: bigint
  blockNumber?: bigint
  rpcLatency?: number
  error?: string
}

const PRECOMPILE_GAS_FALLBACK = 3450n
const BASE_OVERHEAD = 21000n + 160n * 16n

export const verifyOnChain = async (
  params: VerifyParams,
  rpcUrl?: string
): Promise<VerifyResult> => {
  const start = performance.now()

  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl ?? DEFAULT_RPC)
    })

    const calldata = buildCalldata(params)
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
    const fullGas = await client.estimateGas({
      to: P256_PRECOMPILE,
      data: calldata
    })

    const response = await client.call({
      to: P256_PRECOMPILE,
      data: calldata,
      gas: 100000n
    })

    const rpcLatency = Math.round(performance.now() - start)

    const data =
      typeof response === 'string'
        ? response
        : (response as { data?: Hex }).data

    const precompileGas =
      fullGas > BASE_OVERHEAD ? fullGas - BASE_OVERHEAD : PRECOMPILE_GAS_FALLBACK

    if (!data || data === '0x' || data === '0x0') {
      return {
        valid: false,
        error: 'Empty response (precompile not active)',
        gasUsed: precompileGas,
        totalCallGas: fullGas,
        blockNumber,
        rpcLatency
      }
    }

    const normalized = data.toLowerCase()
    const valid =
      normalized ===
        '0x0000000000000000000000000000000000000000000000000000000000000001' ||
      normalized === '0x01' ||
      normalized === '0x1'

    return {
      valid,
      gasUsed: precompileGas,
      totalCallGas: fullGas,
      blockNumber,
      rpcLatency
    }
  } catch (error) {
    const rpcLatency = Math.round(performance.now() - start)
    const message =
      error instanceof Error && error.message ? error.message : String(error)
    return { valid: false, error: message, rpcLatency }
  }
}

