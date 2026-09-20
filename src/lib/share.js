// URL state serialization: compact JSON -> UTF-8 LZW -> base64url (no backend needed)

function lzwCompressBytes(bytes) {
  if (!bytes || !bytes.length) return []
  const dict = new Map()
  let next = 256
  let phrase = []
  const out = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    const cand = phrase.concat(b)
    const key = cand.join(',')
    if (phrase.length === 0 || dict.has(key)) {
      phrase = cand
    } else {
      if (phrase.length === 1) {
        out.push(phrase[0])
      } else {
        out.push(dict.get(phrase.join(',')))
      }
      if (next < 55000) {
        dict.set(key, next++)
      }
      phrase = [b]
    }
  }
  if (phrase.length > 0) {
    if (phrase.length === 1) out.push(phrase[0])
    else out.push(dict.get(phrase.join(',')))
  }
  return out
}

function lzwDecompressBytes(codes) {
  if (!codes || !codes.length) return new Uint8Array(0)
  const dict = new Map()
  let next = 256

  let prevVal = codes[0] < 256 ? [codes[0]] : dict.get(codes[0]) || [0]
  const out = [...prevVal]

  for (let i = 1; i < codes.length; i++) {
    const code = codes[i]
    let entry
    if (code < 256) {
      entry = [code]
    } else if (dict.has(code)) {
      entry = dict.get(code)
    } else {
      entry = prevVal.concat(prevVal[0])
    }
    out.push(...entry)
    if (next < 55000) {
      dict.set(next++, prevVal.concat(entry[0]))
    }
    prevVal = entry
  }
  return new Uint8Array(out)
}

// Fallback legacy decompressor for older ASCII-only hashes
function legacyLzwDecompress(codes) {
  if (!codes.length) return ''
  const dict = {}
  let next = 256
  let phrase = String.fromCharCode(codes[0])
  let out = phrase
  for (let i = 1; i < codes.length; i++) {
    const code = codes[i]
    let entry
    if (code < 256) entry = String.fromCharCode(code)
    else if (dict[code] !== undefined) entry = dict[code]
    else entry = phrase + phrase[0]
    out += entry
    dict[next++] = phrase + entry[0]
    phrase = entry
  }
  return out
}

const b64urlEncode = (bytes) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const b64urlDecode = (str) => {
  const s = str.replaceAll('-', '+').replaceAll('_', '/')
  const pad = s + '==='.slice((s.length + 3) % 4)
  const bin = atob(pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function codesToBytes(codes) {
  const bytes = new Uint8Array(codes.length * 2)
  for (let i = 0; i < codes.length; i++) {
    bytes[i * 2] = codes[i] & 255
    bytes[i * 2 + 1] = codes[i] >> 8
  }
  return bytes
}

function bytesToCodes(bytes) {
  const codes = []
  for (let i = 0; i + 1 < bytes.length; i += 2) codes.push(bytes[i] | (bytes[i + 1] << 8))
  return codes
}

export function encodeState(state) {
  try {
    const json = JSON.stringify(state)
    const utf8Bytes = new TextEncoder().encode(json)
    const compressedCodes = lzwCompressBytes(utf8Bytes)
    return b64urlEncode(codesToBytes(compressedCodes))
  } catch {
    return null
  }
}

export function decodeState(str) {
  try {
    const rawBytes = b64urlDecode(str)
    const codes = bytesToCodes(rawBytes)
    const decompressedBytes = lzwDecompressBytes(codes)
    const json = new TextDecoder().decode(decompressedBytes)
    return JSON.parse(json)
  } catch {
    // Try legacy decoder fallback
    try {
      const rawBytes = b64urlDecode(str)
      const codes = bytesToCodes(rawBytes)
      const legacyJson = legacyLzwDecompress(codes)
      return JSON.parse(legacyJson)
    } catch {
      return null
    }
  }
}

export function buildShareUrl(state) {
  const payload = encodeState(state)
  if (!payload) return null
  const base = location.origin + location.pathname
  return `${base}#s=${payload}`
}

export function readShareFromUrl() {
  const h = location.hash
  if (!h.startsWith('#s=')) return null
  return decodeState(h.slice(3))
}


