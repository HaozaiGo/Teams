import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { setupWS } from './ws.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 4000)
const app = express()

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

const webDist = path.join(__dirname, '../../web/dist')
app.use(express.static(webDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'))
})

const server = createServer(app)
setupWS(server)

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`)
})
