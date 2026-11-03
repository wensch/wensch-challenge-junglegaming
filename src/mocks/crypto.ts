/** WebCrypto helpers: salted SHA-256 password hashes and opaque tokens. */

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** hash = SHA-256(salt ":" password); the clear password is never stored. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`)
}

export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const newSalt = () => randomHex(16)
/** Opaque bearer token: carries no information. Only its SHA-256 is stored in the mock DB. */
export const newToken = () => `tok_${randomHex(24)}`
