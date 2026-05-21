import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { nanoid } from 'nanoid'
import type { CanvasElement, CursorState } from '../types/element'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
const USER_KEY = 'wb-user'

export function wsBase() {
  const configured = import.meta.env.VITE_WS_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (import.meta.env.DEV) {
    const host = location.hostname || 'localhost'
    return `${proto}//${host}:4000`
  }
  return `${proto}//${location.host}`
}

function sortElements(list: CanvasElement[]) {
  return [...list].sort((a, b) => a.zIndex - b.zIndex)
}

function readElement(raw: unknown): CanvasElement | null {
  if (!raw || typeof raw !== 'object') return null
  const el = raw as CanvasElement
  if (!el.id || !el.type) return null
  return {
    ...el,
    points: el.points ? [...el.points] : el.points,
  }
}

function createUserId() {
  return globalThis.crypto?.randomUUID?.() ?? nanoid()
}

export function useCollab(roomId: string) {
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map())
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<string[]>([])

  const docRef = useRef<Y.Doc | null>(null)
  const mapRef = useRef<Y.Map<CanvasElement> | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const clientIdRef = useRef<number>(0)

  const user = useMemo(() => {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id?: string; name?: string; color?: string }
        if (parsed.id && parsed.name && parsed.color) {
          return { id: parsed.id, name: parsed.name, color: parsed.color }
        }
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
  }, [])

  const syncFromMap = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const list = sortElements(
      Array.from(map.values())
        .map(readElement)
        .filter((x): x is CanvasElement => x !== null)
    )
    setElements(list)
  }, [])

  useEffect(() => {
    const doc = new Y.Doc()
    const map = doc.getMap<CanvasElement>('elements')
    const provider = new WebsocketProvider(wsBase(), roomId, doc, { connect: true })

    docRef.current = doc
    mapRef.current = map
    providerRef.current = provider
    clientIdRef.current = doc.clientID

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
      cursor: { x: 0, y: 0 },
    })

    const onAwareness = () => {
      const states = provider.awareness.getStates()
      const next = new Map<number, CursorState>()
      const names: string[] = []
      states.forEach((state, id) => {
        const u = state.user as { id?: string; name: string; color: string; cursor?: { x: number; y: number } }
        if (u?.name) names.push(u.name)
        if (id !== doc.clientID && u?.cursor) {
          next.set(id, { x: u.cursor.x, y: u.cursor.y, name: u.name, color: u.color })
        }
      })
      setCursors(next)
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
  }, [roomId, user.color, user.name, syncFromMap])

  const upsert = useCallback((el: CanvasElement) => {
    const copy = structuredClone(el)
    mapRef.current?.set(copy.id, copy)
  }, [])

  const remove = useCallback((id: string) => {
    mapRef.current?.delete(id)
  }, [])

  const clear = useCallback(() => {
    const map = mapRef.current
    const doc = docRef.current
    if (!map || !doc) return
    doc.transact(() => {
      Array.from(map.keys()).forEach((key) => map.delete(key))
    })
  }, [])

  const updateCursor = (x: number, y: number) => {
    providerRef.current?.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: user.color,
      cursor: { x, y },
    })
  }

  return { elements, upsert, remove, clear, updateCursor, cursors, connected, online, user, clientId: clientIdRef }
}
