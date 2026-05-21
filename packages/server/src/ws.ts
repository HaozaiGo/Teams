import { Server } from 'http'
import { WebSocketServer } from 'ws'
// @ts-expect-error no types
import { setupWSConnection } from 'y-websocket/bin/utils'

export function setupWS(server: Server) {
  const wss = new WebSocketServer({ server })
  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req, { gc: true })
  })
}
