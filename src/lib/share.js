// URL state serialization: compact JSON -> LZW -> base64url (no backend needed)

function lzwCompress(raw) {
  if (!raw) return []
  const dict = {}
  let next = 256
  let phrase = ''
  const out = []
  for (const ch of raw) {
    const cand = phrase + ch
    if (dict[cand] !== undefined || cand.length === 1) {
      phrase = cand
    } else {
      out.push(dict[phrase] ?? phrase.charCodeAt(0))
      dict[cand] = next++
      phrase = ch
    }
    if (next > 55000) {
      // dictionary overflow guard — flush and restart
      out.push(dict[phrase] ?? phrase.charCodeAt(0))
      Object.keys(dict).forEach((k) => delete dict[k])
      next = 256
      phrase = ''
    }
  }
  if (phrase) out.push(dict[phrase] ?? phrase.charCodeAt(0))
  return out
}

function lzwDecompress(codes) {
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

// state: { m, g, c:[{stage,x,y}], a:[[type,color,points,label?,openFlag?,fontSize?]] }
export function encodeState(state) {
  try {
    const json = JSON.stringify(state)
    return b64urlEncode(codesToBytes(lzwCompress(json)))
  } catch {
    return null
  }
}

export function decodeState(str) {
  try {
    return JSON.parse(lzwDecompress(bytesToCodes(b64urlDecode(str))))
  } catch {
    return null
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

