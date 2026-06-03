import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { wsBase } from './useCollab'
import type { BoardRow } from '../types/board'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
const USER_KEY = 'wb-user'

function createUserId() {
  return globalThis.crypto?.randomUUID?.() ?? nanoid()
}

function readUser() {
  const saved = localStorage.getItem(USER_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { id?: string; name?: string; color?: string }
      if (parsed.id && parsed.name && parsed.color) return { id: parsed.id, name: parsed.name, color: parsed.color }
    } catch {
      localStorage.removeItem(USER_KEY)
    }
  }

  const next = {
    id: createUserId(),
    name: `用户${Math.floor(Math.random() * 9000 + 1000)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
  localStorage.setItem(USER_KEY, JSON.stringify(next))
  return next
}

function sortRows(rows: BoardRow[]) {
  return [...rows].sort((a, b) => a.createdAt - b.createdAt)
}

function readRow(raw: unknown): BoardRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as BoardRow
  if (!row.id) return null
  return {
    id: row.id,
    title: row.title || '',
    owner: row.owner || '',
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    dueDate: row.dueDate || '',
    notes: row.notes || '',
    archived: !!row.archived,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt || Date.now(),
    updatedAt: row.updatedAt || Date.now(),
  }
}

export function useBoardCollab(roomId: string) {
  const [rows, setRows] = useState<BoardRow[]>([])
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<string[]>([])

  const docRef = useRef<Y.Doc | null>(null)
  const mapRef = useRef<Y.Map<BoardRow> | null>(null)

  const user = useMemo(readUser, [])

  const syncFromMap = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    setRows(
      sortRows(
        Array.from(map.values())
          .map(readRow)
          .filter((row): row is BoardRow => row !== null)
      )
    )
  }, [])

  useEffect(() => {
    const doc = new Y.Doc()
    const map = doc.getMap<BoardRow>('rows')
    const provider = new WebsocketProvider(wsBase(), `${roomId}--agile-board`, doc, { connect: true })

    docRef.current = doc
    mapRef.current = map

    const onMap = () => syncFromMap()
    map.observe(onMap)
    syncFromMap()

    provider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected')
    })

    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: user.color,
    })

    const onAwareness = () => {
      const names: string[] = []
      provider.awareness.getStates().forEach((state) => {
        const u = state.user as { name?: string } | undefined
        if (u?.name) names.push(u.name)
      })
      setOnline(names)
    }

    provider.awareness.on('change', onAwareness)
    onAwareness()

    return () => {
      map.unobserve(onMap)
      provider.awareness.off('change', onAwareness)
      provider.destroy()
      doc.destroy()
      docRef.current = null
      mapRef.current = null
    }
  }, [roomId, syncFromMap, user.color, user.id, user.name])

  const upsert = useCallback((row: BoardRow) => {
    mapRef.current?.set(row.id, structuredClone({ ...row, updatedAt: Date.now() }))
  }, [])

  const remove = useCallback((id: string) => {
    mapRef.current?.delete(id)
  }, [])

  return { rows, upsert, remove, connected, online, user }
}
