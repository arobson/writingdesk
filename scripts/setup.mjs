#!/usr/bin/env node
/**
 * WritingDesk interactive setup
 *
 * Guides you through:
 *   1. Setting your server URL (ORIGIN)
 *   2. Creating a GitHub OAuth App (opens the browser with instructions)
 *   3. Auto-generating JWT_SECRET and TOKEN_SECRET
 *   4. Writing packages/app/.env (chmod 600)
 *
 * Usage:
 *   node scripts/setup.mjs
 *   npm run setup
 *   make setup
 */

import { randomBytes }                          from 'node:crypto'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createInterface }                      from 'node:readline'
import { execSync }                             from 'node:child_process'
import { join, dirname }                        from 'node:path'
import { fileURLToPath }                        from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const ENV_FILE  = join(ROOT, 'packages', 'app', '.env')

// ── Colour helpers ────────────────────────────────────────────────────────────

const ESC = '\x1b'
const C = {
  reset:  `${ESC}[0m`,
  bold:   `${ESC}[1m`,
  dim:    `${ESC}[2m`,
  green:  `${ESC}[32m`,
  cyan:   `${ESC}[36m`,
  yellow: `${ESC}[33m`,
  red:    `${ESC}[31m`,
}

const ok   = (s) => `  ${C.green}✓${C.reset}  ${s}`
const info = (s) => `  ${C.cyan}›${C.reset}  ${s}`
const warn = (s) => `  ${C.yellow}!${C.reset}  ${s}`
const bold = (s) => `${C.bold}${s}${C.reset}`
const dim  = (s) => `${C.dim}${s}${C.reset}`
const sep  = () => console.log(`\n  ${dim('──────────────────────────────────────────')}\n`)

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())))
}

/** Keeps asking until the validator returns null (no error). */
async function askValid(prompt, validate) {
  while (true) {
    const value = await ask(prompt)
    const err   = validate(value)
    if (err === null) return value
    console.log(`  ${C.red}${err}${C.reset}`)
  }
}

function askSecret(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt)

    if (!process.stdin.isTTY) {
      // Non-interactive (pipe / CI) — read normally
      rl.once('line', line => resolve(line.trim()))
      return
    }

    // Mask input with asterisks
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    let buf = ''

    function onKey(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onKey)
        process.stdout.write('\n')
        resolve(buf)
      } else if (ch === '\u0003') {          // Ctrl+C
        process.stdout.write('\n')
        process.exit(0)
      } else if (ch === '\u007f') {          // Backspace
        if (buf.length > 0) {
          buf = buf.slice(0, -1)
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          process.stdout.write(prompt + '*'.repeat(buf.length))
        }
      } else {
        buf += ch
        process.stdout.write('*')
      }
    }

    process.stdin.on('data', onKey)
  })
}

// ── Browser ───────────────────────────────────────────────────────────────────

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? `open "${url}"`
    : process.platform === 'win32'  ? `start "" "${url}"`
    : `xdg-open "${url}"`
  try { execSync(cmd, { stdio: 'ignore' }) } catch { /* headless — ignore */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────

process.on('SIGINT', () => { console.log('\n\n  Aborted.\n'); process.exit(0) })

console.log()
console.log(`  ${bold('WritingDesk Setup')}`)
console.log(dim('  Configures packages/app/.env with GitHub OAuth credentials and generated secrets.'))

// ── Step 1: ORIGIN ────────────────────────────────────────────────────────────

sep()
console.log(`  ${bold('Step 1 of 3 — Server URL')}\n`)
console.log(info('Enter the public URL where WritingDesk will be hosted.'))
console.log(dim('  This is used as the OAuth callback base and for CSRF protection.'))
console.log(dim('  Examples:  https://write.example.com   http://localhost:3000'))
console.log()

const origin = await askValid(
  `  ORIGIN  › `,
  (v) => {
    if (!v) return 'Required.'
    try { new URL(v) } catch { return 'Must be a valid URL (include http:// or https://).' }
    if (v.endsWith('/')) return 'Remove the trailing slash.'
    return null
  },
)

const callbackUrl = `${origin}/auth/github/callback`

// ── Step 2: GitHub OAuth App ──────────────────────────────────────────────────

sep()
console.log(`  ${bold('Step 2 of 3 — GitHub OAuth App')}\n`)
console.log(info(`You need a GitHub OAuth App.  Opening the creation form now…\n`))
console.log(`  Fill in the form with these values:\n`)
console.log(`    ${dim('Application name:')}  WritingDesk`)
console.log(`    ${dim('Homepage URL:')}      ${origin}`)
console.log(`    ${dim('Callback URL:')}      ${C.cyan}${callbackUrl}${C.reset}`)
console.log(`    ${dim('(Everything else can be left blank.)')}`)
console.log()

openBrowser('https://github.com/settings/applications/new')
await ask(`  Press Enter once you have created the app and are on the credentials page › `)
console.log()

const clientId = await askValid(
  `  Paste Client ID      › `,
  (v) => v ? null : 'Required.',
)

console.log()
const clientSecret = await askSecret(`  Paste Client Secret  › `)

if (!clientSecret) {
  console.log(`\n  ${C.red}Client secret is required.${C.reset}`)
  rl.close()
  process.exit(1)
}

// ── Step 3: Generate secrets ──────────────────────────────────────────────────

sep()
console.log(`  ${bold('Step 3 of 3 — Generating secrets')}\n`)

// JWT_SECRET: 64 hex chars (256 bits) — used to sign session JWTs
const jwtSecret   = randomBytes(32).toString('hex')
// TOKEN_SECRET: 32 hex chars (128 bits, padded to 32 bytes for AES-256)
const tokenSecret = randomBytes(16).toString('hex')

console.log(ok('JWT_SECRET generated   (256-bit random, hex-encoded)'))
console.log(ok('TOKEN_SECRET generated (128-bit random → AES-256 key via padding)'))

// ── Confirm overwrite ─────────────────────────────────────────────────────────

if (existsSync(ENV_FILE)) {
  console.log()
  console.log(warn(`${ENV_FILE} already exists and will be overwritten.`))
  const confirm = await ask(`  Continue? [y/N]  › `)
  if (!confirm.toLowerCase().startsWith('y')) {
    console.log('\n  Aborted — existing .env was not modified.\n')
    rl.close()
    process.exit(0)
  }
}

// ── Write .env ────────────────────────────────────────────────────────────────

mkdirSync(dirname(ENV_FILE), { recursive: true })

const content = `\
# GitHub OAuth App — created at github.com/settings/applications
GITHUB_OAUTH_CLIENT_ID=${clientId}
GITHUB_OAUTH_CLIENT_SECRET=${clientSecret}

# Session signing key (256-bit, auto-generated)
JWT_SECRET=${jwtSecret}

# Token encryption key (AES-256, auto-generated)
TOKEN_SECRET=${tokenSecret}

# Public URL of this WritingDesk instance (no trailing slash)
ORIGIN=${origin}

# Persistent data directory — mount a PVC here in Kubernetes
# DATA_DIR=/var/writingdesk
`

writeFileSync(ENV_FILE, content, { mode: 0o600 })

// ── Done ──────────────────────────────────────────────────────────────────────

sep()
console.log(ok(`Written to  ${bold(ENV_FILE)}  ${dim('(chmod 600)')}`)  )
console.log()
console.log('  Next steps:\n')
console.log(`    ${dim('Local dev server:')}  ${bold('make dev')}`)
console.log(`    ${dim('Docker (local):')}    ${bold('make docker-build && make docker-run')}`)
console.log(`    ${dim('Kubernetes:')}        set DATA_DIR to your PVC mount path in .env`)
console.log()

rl.close()
