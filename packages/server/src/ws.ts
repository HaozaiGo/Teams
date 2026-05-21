import { Server } from 'http'
import { mkdirSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { WebSocketServer } from 'ws'

process.env.YPERSISTENCE ||= path.join(process.cwd(), 'data', 'yjs')
mkdirSync(process.env.YPERSISTENCE, { recursive: true })

const require = createRequire(import.meta.url)
// y-websocket exposes the server helpers as CommonJS without TypeScript declarations.
const { setupWSConnection } = require('y-websocket/bin/utils') as {
  setupWSConnection: (conn: unknown, req: unknown, opts?: { gc?: boolean }) => void
}

export function setupWS(server: Server) {
  const wss = new WebSocketServer({ server })
  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req, { gc: true })
  })
}
