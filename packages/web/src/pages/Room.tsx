import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasElement, Tool, UndoAction } from '../types/element'
import { useParams } from 'react-router-dom'
import { CanvasBoard, type CanvasBoardHandle } from '../canvas/CanvasBoard'
import { Toolbar } from '../components/Toolbar'
import { useCollab } from '../collab/useCollab'
import { useUndo } from '../hooks/useUndo'

function sortEls(list: CanvasElement[]) {
  return [...list].sort((a, b) => a.zIndex - b.zIndex)
}

export function RoomPage() {
  const { roomId = 'default' } = useParams()
  const collab = useCollab(roomId)
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#1e293b')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const boardRef = useRef<CanvasBoardHandle>(null)
  const synced = useRef(false)

  useEffect(() => {
    if (collab.elements.length > 0 || !synced.current) {
      setElements(sortEls(collab.elements))
      synced.current = true
    }
  }, [collab.elements])

  const upsert = useCallback(
    (el: CanvasElement) => {
      setElements((prev) => {
        const i = prev.findIndex((x) => x.id === el.id)
        const next = i >= 0 ? prev.map((x, idx) => (idx === i ? el : x)) : [...prev, el]
        return sortEls(next)
      })
      collab.upsert(el)
    },
    [collab.upsert]
  )

  const remove = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((x) => x.id !== id))
      collab.remove(id)
    },
    [collab.remove]
  )

  const applyUndo = useCallback(
    (action: UndoAction, reverse: boolean) => {
      if (action.type === 'add') {
        reverse ? remove(action.elementId) : action.after && upsert(action.after)
      } else if (action.type === 'delete') {
        reverse ? action.before && upsert(action.before) : remove(action.elementId)
      } else if (action.type === 'update') {
        const el = reverse ? action.before : action.after
        if (el) upsert(el)
      }
    },
    [remove, upsert]
  )

  const { push, undo, redo } = useUndo(applyUndo)

  const chooseTool = useCallback((nextTool: Tool) => {
    setTool(nextTool)
    if (nextTool !== 'select') setSelectedId(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, button, [contenteditable="true"]')
      ) {
        return
      }
      const k = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z') {
          e.preventDefault()
          e.shiftKey ? redo() : undo()
        }
        if (k === 'y') {
          e.preventDefault()
          redo()
        }
        return
      }
      if (e.altKey) return

      const map: Record<string, Tool> = {
        v: 'select',
        p: 'pen',
        e: 'eraser',
        t: 'text',
        r: 'rect',
        o: 'ellipse',
        l: 'line',
        a: 'arrow',
      }
      if (map[k]) chooseTool(map[k])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chooseTool, undo, redo])

  const maxZ = () => elements.reduce((m, e) => Math.max(m, e.zIndex), 0)
  const minZ = () => elements.reduce((m, e) => Math.min(m, e.zIndex), 1)

  const bringFront = () => {
    if (!selectedId) return
    const el = elements.find((x) => x.id === selectedId)
    if (!el) return
    upsert({ ...el, zIndex: maxZ() + 1 })
    push({ type: 'update', elementId: el.id, before: el, after: { ...el, zIndex: maxZ() + 1 } })
  }

  const sendBack = () => {
    if (!selectedId) return
    const el = elements.find((x) => x.id === selectedId)
    if (!el) return
    upsert({ ...el, zIndex: minZ() - 1 })
    push({ type: 'update', elementId: el.id, before: el, after: { ...el, zIndex: minZ() - 1 } })
  }

  const exportPng = () => boardRef.current?.exportPng(`whiteboard-${roomId}.png`)
  const copyLink = () => navigator.clipboard.writeText(location.href)
  const clearBoard = () => {
    if (elements.length === 0) return
    if (!window.confirm('清空当前房间的全部内容？')) return
    setElements([])
    setSelectedId(null)
    collab.clear()
  }

  return (
    <div className="app">
      <Toolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        connected={collab.connected}
        online={collab.online}
        roomId={roomId}
        onTool={chooseTool}
        onColor={setColor}
        onStroke={setStrokeWidth}
        onUndo={undo}
        onRedo={redo}
        onExport={exportPng}
        onBringFront={bringFront}
        onSendBack={sendBack}
        onCopyLink={copyLink}
        onClear={clearBoard}
      />
      <CanvasBoard
        ref={boardRef}
        elements={elements}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        userId={collab.user.id}
        cursors={collab.cursors}
        onUpsert={upsert}
        onRemove={remove}
        onUndoPush={push}
        onCursorMove={collab.updateCursor}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  )
}
