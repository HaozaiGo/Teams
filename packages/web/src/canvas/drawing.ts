import type { CanvasElement, Tool } from '../types/element'

export type Point = { x: number; y: number }

export function isDrawingTool(tool: Tool) {
  return tool === 'pen' || tool === 'eraser' || ['rect', 'ellipse', 'line', 'arrow'].includes(tool)
}

export function createStrokeDraft(
  id: string,
  p: Point,
  tool: 'pen' | 'eraser',
  color: string,
  strokeWidth: number,
  userId: string,
  maxZ: number
): CanvasElement {
  return {
    id,
    type: 'stroke',
    x: 0,
    y: 0,
    stroke: tool === 'eraser' ? 'eraser' : color,
    strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
    points: [p.x, p.y],
    createdBy: userId,
    zIndex: maxZ + 1,
  }
}

export function appendStrokePoint(draft: CanvasElement, p: Point): CanvasElement {
  return { ...draft, points: [...(draft.points || []), p.x, p.y] }
}

export function createShapeDraft(
  id: string,
  p: Point,
  tool: 'rect' | 'ellipse' | 'line' | 'arrow',
  color: string,
  strokeWidth: number,
  userId: string,
  maxZ: number
): CanvasElement {
  return {
    id,
    type: tool,
    x: p.x,
    y: p.y,
    stroke: color,
    strokeWidth,
    fill: 'transparent',
    width: 0,
    height: 0,
    points: tool === 'line' || tool === 'arrow' ? [p.x, p.y, p.x, p.y] : undefined,
    createdBy: userId,
    zIndex: maxZ + 1,
  }
}

export function updateShapeDraft(draft: CanvasElement, start: Point, p: Point): CanvasElement {
  if (draft.type === 'line' || draft.type === 'arrow') {
    return { ...draft, points: [start.x, start.y, p.x, p.y] }
  }
  return {
    ...draft,
    x: Math.min(start.x, p.x),
    y: Math.min(start.y, p.y),
    width: Math.abs(p.x - start.x),
    height: Math.abs(p.y - start.y),
  }
}

export function normalizeStroke(draft: CanvasElement): CanvasElement {
  const pts = draft.points || []
  if (pts.length === 2) {
    return { ...draft, points: [pts[0], pts[1], pts[0], pts[1]] }
  }
  return draft
}

export function shouldFinalizeDraft(draft: CanvasElement): boolean {
  if (draft.type === 'stroke') {
    return (draft.points?.length || 0) >= 2
  }
  if (draft.type === 'line' || draft.type === 'arrow') {
    return (draft.points?.length || 0) >= 4
  }
  return (draft.width || 0) >= 1 || (draft.height || 0) >= 1
}

export function maxZIndex(elements: CanvasElement[]) {
  return elements.reduce((m, e) => Math.max(m, e.zIndex), 0)
}

export function translateElement(element: CanvasElement, dx: number, dy: number): CanvasElement {
  if (dx === 0 && dy === 0) return element

  if (element.points) {
    return {
      ...element,
      x: element.x + dx,
      y: element.y + dy,
      points: element.points.map((value, index) => value + (index % 2 === 0 ? dx : dy)),
    }
  }

  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
  }
}
