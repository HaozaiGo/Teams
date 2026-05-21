import { describe, expect, it } from 'vitest'
import http from 'node:http'

function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode || 0, body }))
      })
      .on('error', reject)
  })
}

describe('smoke', () => {
  it('server health responds ok', async () => {
    const port = process.env.SMOKE_PORT || '4000'
    const { status, body } = await get(`http://127.0.0.1:${port}/health`)
    expect(status).toBe(200)
    expect(JSON.parse(body)).toEqual({ ok: true })
  })
})
