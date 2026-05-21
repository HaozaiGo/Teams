import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import type Konva from 'konva'
import { nanoid } from 'nanoid'
import { ElementShape } from './ElementShape'
import { RemoteCursors } from './RemoteCursors'
import {
  appendStrokePoint,
  createShapeDraft,
  createStrokeDraft,
  maxZIndex,
  normalizeStroke,
  shouldFinalizeDraft,
  translateElement,
  updateShapeDraft,
  type Point,
} from './drawing'
import type { CanvasElement, Tool, UndoAction } from '../types/element'

type Props = {
  elements: CanvasElement[]
  tool: Tool
  color: string
  strokeWidth: number
  userId: string
  cursors: Map<number, { x: number; y: number; name: string; color: string }>
  onUpsert: (el: CanvasElement) => void
  onRemove: (id: string) => void
  onUndoPush: (action: UndoAction) => void
  onCursorMove: (x: number, y: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export type CanvasBoardHandle = { exportPng: (name: string) => void }
type Viewport = { x: number; y: number; scale: number }
type TextEditor = {
  x: number
  y: number
  value: string
  color: string
  fontSize: number
  editing?: CanvasElement
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 1.18

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function screenToWorld(p: Point, viewport: Viewport): Point {
  return {
    x: (p.x - viewport.x) / viewport.scale,
    y: (p.y - viewport.y) / viewport.scale,
  }
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, button, [contenteditable="true"]')
}

function pointer(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, viewport: Viewport): Point | null {
  const p = e.target.getStage()?.getPointerPosition()
  return p ? screenToWorld(p, viewport) : null
}

function renderedPosition(element: CanvasElement): Point {
  if (element.points) return { x: 0, y: 0 }
  if (element.type === 'ellipse') {
    return {
      x: element.x + (element.width || 0) / 2,
      y: element.y + (element.height || 0) / 2,
    }
  }
  return { x: element.x, y: element.y }
}

export const CanvasBoard = forwardRef<CanvasBoardHandle, Props>(function CanvasBoard(
  {
    elements,
    tool,
    color,
    strokeWidth,
    userId,
    cursors,
    onUpsert,
    onRemove,
    onUndoPush,
    onCursorMove,
    selectedId,
    onSelect,
  },
  ref
) {
  const [draft, setDraft] = useState<CanvasElement | null>(null)
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 56 })
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const draftRef = useRef<CanvasElement | null>(null)
  const skipTextCommitRef = useRef(false)
  const shapeStartRef = useRef<Point | null>(null)
  const drawingRef = useRef(false)
  const viewportRef = useRef(viewport)
  const spaceDownRef = useRef(spaceDown)
  const panRef = useRef<{ x: number; y: number; viewport: Viewport; moved: boolean } | null>(null)
  const suppressClearRef = useRef(false)
  const toolRef = useRef(tool)
  const propsRef = useRef({ color, strokeWidth, userId, elements })

  viewportRef.current = viewport
  spaceDownRef.current = spaceDown
  toolRef.current = tool
  propsRef.current = { color, strokeWidth, userId, elements }

  const setDraftSync = useCallback((el: CanvasElement | null) => {
    draftRef.current = el
    setDraft(el)
  }, [])

  useImperativeHandle(ref, () => ({
    exportPng: (name: string) => {
      const stage = stageRef.current
      if (!stage) return
      const uri = stage.toDataURL({ pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = uri
      a.download = name
      a.click()
    },
  }))

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!selectedId || !trRef.current || !stageRef.current) return
    const node = stageRef.current.findOne(`#${selectedId}`)
    if (node) {
      trRef.current.nodes([node])
      trRef.current.getLayer()?.batchDraw()
    } else {
      trRef.current.nodes([])
    }
  }, [selectedId, elements])

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' || isTypingTarget(ev.target)) return
      ev.preventDefault()
      spaceDownRef.current = true
      setSpaceDown(true)
    }
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        spaceDownRef.current = false
        setSpaceDown(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!textEditor) return
    requestAnimationFrame(() => {
      textInputRef.current?.focus()
    })
  }, [textEditor])

  const finishDraft = useCallback(
    (el: CanvasElement) => {
      onUpsert(el)
      onUndoPush({ type: 'add', elementId: el.id, after: el })
      setDraftSync(null)
    },
    [onUpsert, onUndoPush, setDraftSync]
  )

  const endDraw = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const current = draftRef.current
    const t = toolRef.current
    shapeStartRef.current = null
    if (!current) return

    if (t === 'pen' || t === 'eraser') {
      const normalized = normalizeStroke(current)
      if (shouldFinalizeDraft(normalized)) finishDraft(normalized)
      else setDraftSync(null)
      return
    }
    if (shouldFinalizeDraft(current)) finishDraft(current)
    else setDraftSync(null)
  }, [finishDraft, setDraftSync])

  const moveDraw = useCallback(
    (p: Point) => {
      onCursorMove(p.x, p.y)
      if (!drawingRef.current || !draftRef.current) return
      const t = toolRef.current
      if (t === 'pen' || t === 'eraser') {
        setDraftSync(appendStrokePoint(draftRef.current, p))
        return
      }
      if (shapeStartRef.current) {
        setDraftSync(updateShapeDraft(draftRef.current, shapeStartRef.current, p))
      }
    },
    [onCursorMove, setDraftSync]
  )

  const startDraw = useCallback(
    (p: Point) => {
      const t = toolRef.current
      const { color: c, strokeWidth: sw, userId: uid, elements: els } = propsRef.current
      if (t === 'select' || t === 'text') return
      drawingRef.current = true
      onCursorMove(p.x, p.y)
      const z = maxZIndex(els)
      if (t === 'pen' || t === 'eraser') {
        setDraftSync(createStrokeDraft(nanoid(), p, t, c, sw, uid, z))
        return
      }
      if (['rect', 'ellipse', 'line', 'arrow'].includes(t)) {
        shapeStartRef.current = p
        setDraftSync(createShapeDraft(nanoid(), p, t as 'rect' | 'ellipse' | 'line' | 'arrow', c, sw, uid, z))
      }
    },
    [onCursorMove, setDraftSync]
  )

  const openTextEditor = useCallback(
    (p: Point) => {
      onCursorMove(p.x, p.y)
      onSelect(null)
      skipTextCommitRef.current = false
      setTextEditor({ x: p.x, y: p.y, value: '', color, fontSize: 22 })
    },
    [color, onCursorMove, onSelect]
  )

  const editTextElement = useCallback(
    (el: CanvasElement) => {
      if (el.type !== 'text') return
      onSelect(el.id)
      skipTextCommitRef.current = false
      setTextEditor({
        x: el.x,
        y: el.y,
        value: el.text || '',
        color: el.stroke,
        fontSize: el.fontSize || 22,
        editing: el,
      })
    },
    [onSelect]
  )

  const commitText = useCallback(() => {
    if (!textEditor) return
    if (skipTextCommitRef.current) {
      skipTextCommitRef.current = false
      return
    }
    const text = textEditor.value.trim()
    setTextEditor(null)
    if (!text) return

    if (textEditor.editing) {
      const before = textEditor.editing
      if (before.text === text) return
      const after = { ...before, text }
      onUpsert(after)
      onUndoPush({ type: 'update', elementId: before.id, before, after })
      return
    }

    finishDraft({
      id: nanoid(),
      type: 'text',
      x: textEditor.x,
      y: textEditor.y,
      stroke: textEditor.color,
      strokeWidth: 0,
      text,
      fontSize: textEditor.fontSize,
      createdBy: userId,
      zIndex: maxZIndex(elements) + 1,
    })
  }, [elements, finishDraft, onUndoPush, onUpsert, textEditor, userId])

  const onDrawDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (toolRef.current === 'select') return
    const p = pointer(e, viewportRef.current)
    if (!p) return
    e.evt.preventDefault()
    if (toolRef.current === 'text') {
      openTextEditor(p)
      return
    }
    startDraw(p)
  }

  const onDrawMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current) return
    const p = pointer(e, viewportRef.current)
    if (p) moveDraw(p)
  }

  const zoomAt = useCallback((screenPoint: Point, nextScale: number) => {
    setViewport((current) => {
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM)
      const worldPoint = screenToWorld(screenPoint, current)
      return {
        scale,
        x: screenPoint.x - worldPoint.x * scale,
        y: screenPoint.y - worldPoint.y * scale,
      }
    })
  }, [])

  const zoomBy = useCallback(
    (factor: number) => {
      zoomAt({ x: size.w / 2, y: size.h / 2 }, viewportRef.current.scale * factor)
    },
    [size.h, size.w, zoomAt]
  )

  const resetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 })
  }, [])

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      const screenPoint = stage?.getPointerPosition()
      if (!screenPoint) return
      const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP
      zoomAt(screenPoint, viewportRef.current.scale * factor)
    },
    [zoomAt]
  )

  const startPan = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!('clientX' in e.evt) || !('clientY' in e.evt)) return
    e.evt.preventDefault()
    panRef.current = {
      x: e.evt.clientX,
      y: e.evt.clientY,
      viewport: viewportRef.current,
      moved: false,
    }
    setPanning(true)
  }, [])

  const movePan = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pan = panRef.current
    if (!pan || !('clientX' in e.evt) || !('clientY' in e.evt)) return false
    e.evt.preventDefault()
    const dx = e.evt.clientX - pan.x
    const dy = e.evt.clientY - pan.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pan.moved = true
    setViewport({
      ...pan.viewport,
      x: pan.viewport.x + dx,
      y: pan.viewport.y + dy,
    })
    return true
  }, [])

  const endPan = useCallback(() => {
    if (!panRef.current) return
    suppressClearRef.current = panRef.current.moved
    panRef.current = null
    setPanning(false)
    window.setTimeout(() => {
      suppressClearRef.current = false
    }, 0)
  }, [])

  const isPanMouse = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    return e.evt instanceof MouseEvent && (e.evt.button === 1 || spaceDownRef.current)
  }

  const onPointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isPanMouse(e)) {
      startPan(e)
      return
    }
    if (hasInputSurface) onDrawDown(e)
  }

  const onPointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (movePan(e)) return
    if (hasInputSurface) onDrawMove(e)
  }

  useEffect(() => {
    const onUp = () => {
      endPan()
      endDraw()
    }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [endDraw, endPan])

  const handleTransformEnd = () => {
    if (!selectedId || !stageRef.current) return
    const node = stageRef.current.findOne(`#${selectedId}`)
    const el = elements.find((x) => x.id === selectedId)
    if (!node || !el) return
    const before = { ...el }
    let after: CanvasElement
    if (el.type === 'text') {
      after = { ...el, x: node.x(), y: node.y(), rotation: node.rotation() }
    } else if (el.type === 'rect') {
      after = {
        ...el,
        x: node.x(),
        y: node.y(),
        width: node.width() * node.scaleX(),
        height: node.height() * node.scaleY(),
        rotation: node.rotation(),
      }
      node.scaleX(1)
      node.scaleY(1)
    } else {
      after = { ...el, x: node.x(), y: node.y(), rotation: node.rotation() }
    }
    onUpsert(after)
    onUndoPush({ type: 'update', elementId: el.id, before, after })
  }

  const handleDragEnd = useCallback(
    (el: CanvasElement, node: Konva.Node) => {
      const start = renderedPosition(el)
      const dx = node.x() - start.x
      const dy = node.y() - start.y
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

      const after = translateElement(el, dx, dy)
      if (el.points) {
        node.position({ x: 0, y: 0 })
        node.getLayer()?.batchDraw()
      }
      onUpsert(after)
      onUndoPush({ type: 'update', elementId: el.id, before: el, after })
    },
    [onUndoPush, onUpsert]
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const el = elements.find((x) => x.id === selectedId)
    if (!el) return
    onRemove(selectedId)
    onUndoPush({ type: 'delete', elementId: selectedId, before: el })
    onSelect(null)
  }, [selectedId, elements, onRemove, onUndoPush, onSelect])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        const tagName = document.activeElement?.tagName
        if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected])

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex)
  const visibleElements = textEditor?.editing ? sorted.filter((el) => el.id !== textEditor.editing?.id) : sorted
  const interactive = tool === 'select'
  const drawing = tool !== 'select' && tool !== 'text'
  const hasInputSurface = drawing || tool === 'text'
  const backgroundX = -viewport.x / viewport.scale - 1000
  const backgroundY = -viewport.y / viewport.scale - 1000
  const backgroundWidth = size.w / viewport.scale + 2000
  const backgroundHeight = size.h / viewport.scale + 2000
  const textEditorStyle = textEditor
    ? {
        left: textEditor.x * viewport.scale + viewport.x,
        top: textEditor.y * viewport.scale + viewport.y,
        color: textEditor.color,
        fontSize: textEditor.fontSize * viewport.scale,
      }
    : undefined

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ touchAction: 'none' }}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onWheel={onWheel}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onTouchStart={hasInputSurface ? onDrawDown : undefined}
        onTouchMove={hasInputSurface ? onDrawMove : undefined}
        style={{ cursor: panning ? 'grabbing' : spaceDown ? 'grab' : drawing ? 'crosshair' : tool === 'text' ? 'text' : 'default' }}
      >
        <Layer>
          <Rect
            x={backgroundX}
            y={backgroundY}
            width={backgroundWidth}
            height={backgroundHeight}
            fill="#fbfdff"
            listening={interactive || hasInputSurface}
            onClick={() => {
              if (!suppressClearRef.current) onSelect(null)
            }}
            onTap={() => {
              if (!suppressClearRef.current) onSelect(null)
            }}
          />
        </Layer>
        <Layer>
          {visibleElements.map((el) => (
            <ElementShape
              key={el.id}
              element={el}
              selected={selectedId === el.id}
              onSelect={onSelect}
              onDragEnd={handleDragEnd}
              onTextEdit={editTextElement}
              listening={interactive}
              draggable={interactive}
            />
          ))}
          {draft && draft.type === 'stroke' && (
            <Line
              points={draft.points || []}
              stroke={draft.stroke === 'eraser' ? '#000' : draft.stroke}
              strokeWidth={draft.strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={0.4}
              listening={false}
              globalCompositeOperation={draft.stroke === 'eraser' ? 'destination-out' : 'source-over'}
            />
          )}
          {draft && draft.type !== 'stroke' && (
            <ElementShape element={draft} onSelect={() => {}} selected={false} listening={false} />
          )}
          <Transformer
            ref={trRef}
            rotateEnabled
            listening={interactive && !!selectedId}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
        <RemoteCursors cursors={cursors} />
      </Stage>
      {textEditor && (
        <textarea
          ref={textInputRef}
          className="text-editor"
          value={textEditor.value}
          style={textEditorStyle}
          placeholder="输入文字"
          onChange={(e) => setTextEditor((current) => (current ? { ...current, value: e.target.value } : current))}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitText()
            }
            if (e.key === 'Escape') {
              skipTextCommitRef.current = true
              setTextEditor(null)
            }
          }}
        />
      )}
      <div className="zoom-controls" aria-label="缩放控制">
        <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="缩小">
          -
        </button>
        <button type="button" onClick={resetZoom} aria-label="重置缩放">
          {Math.round(viewport.scale * 100)}%
        </button>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="放大">
          +
        </button>
      </div>
    </div>
  )
})
