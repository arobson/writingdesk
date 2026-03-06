import { SignJWT, jwtVerify } from 'jose'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Cookies } from '@sveltejs/kit'
import { getConfig } from './config.js'

const COOKIE_NAME = 'wd_session'
const SESSION_SECONDS = 8 * 60 * 60   // 8 hours
const REFRESH_THRESHOLD = 60 * 60     // refresh when < 1 hour remains

// ── Session JWT ───────────────────────────────────────────────────────────────

export interface SessionPayload {
  userId: number
  githubId: number
  login: string
  avatarUrl: string
  iat?: number
  exp?: number
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwt.secret)
}

export async function createSession(payload: SessionPayload, cookies: Cookies): Promise<void> {
  const token = await new SignJWT({
    userId: payload.userId,
    githubId: payload.githubId,
    login: payload.login,
    avatarUrl: payload.avatarUrl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(jwtSecret())

  cookies.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_SECONDS,
  })
}

export async function getSession(cookies: Cookies): Promise<SessionPayload | null> {
  const token = cookies.get(COOKIE_NAME)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, jwtSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function refreshSessionIfNeeded(session: SessionPayload, cookies: Cookies): Promise<void> {
  if (!session.exp) return
  const remaining = session.exp - Math.floor(Date.now() / 1000)
  if (remaining < REFRESH_THRESHOLD) {
    await createSession(session, cookies)
  }
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' })
}

// ── Token encryption ──────────────────────────────────────────────────────────
// Stored GitHub OAuth tokens are AES-256-GCM encrypted so they're not plaintext
// in the database.

const ALGO = 'aes-256-gcm'

function tokenKey(): Buffer {
  // TOKEN_SECRET must be 32 bytes (64 hex chars, or 32-char string padded)
  const secret = getConfig().tokenSecret
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32))
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, tokenKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // iv:tag:ciphertext — all hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGO, tokenKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(data).toString('utf8') + decipher.final('utf8')
}
