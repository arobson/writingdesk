import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'

export interface CallbackResult {
  code: string
  state: string
}

export function startCallbackServer(port: number, expectedState: string): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) return

      const parsed = new URL(req.url, `http://localhost:${port}`)

      if (parsed.pathname === '/setup/callback') {
        const code = parsed.searchParams.get('code')
        const state = parsed.searchParams.get('state')

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html><body style="font-family:sans-serif;padding:2rem">
            <h2>WritingDesk setup</h2>
            <p>GitHub App created. You can close this tab.</p>
          </body></html>
        `)

        server.close()

        if (!code || !state) {
          reject(new Error('Missing code or state in GitHub callback'))
          return
        }
        if (state !== expectedState) {
          reject(new Error('State mismatch — possible CSRF'))
          return
        }

        resolve({ code, state })
      }
    })

    server.listen(port, '127.0.0.1')
    server.on('error', reject)
  })
}
