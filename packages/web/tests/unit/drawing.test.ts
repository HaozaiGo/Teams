import { describe, expect, it } from 'vitest'
import {
  appendStrokePoint,
  createShapeDraft,
  createStrokeDraft,
  maxZIndex,
  normalizeStroke,
  shouldFinalizeDraft,
  translateElement,
  updateShapeDraft,
} from '../../src/canvas/drawing'
import type { CanvasElement } from '../../src/types/element'

describe('drawing', () => {
  it('creates stroke draft', () => {
    const d = createStrokeDraft('1', { x: 10, y: 20 }, 'pen', '#000', 3, 'u1', 0)
    expect(d.type).toBe('stroke')
    expect(d.points).toEqual([10, 20])
    expect(d.zIndex).toBe(1)
  })

  it('appends stroke points', () => {
    const base = createStrokeDraft('1', { x: 0, y: 0 }, 'pen', '#000', 3, 'u1', 0)
    const next = appendStrokePoint(base, { x: 5, y: 5 })
    expect(next.points).toEqual([0, 0, 5, 5])
  })

  it('normalizes single-point stroke', () => {
    const base = createStrokeDraft('1', { x: 1, y: 2 }, 'pen', '#000', 3, 'u1', 0)
    const n = normalizeStroke(base)
    expect(n.points).toEqual([1, 2, 1, 2])
    expect(shouldFinalizeDraft(n)).toBe(true)
  })

  it('updates rect draft while dragging', () => {
    const base = createShapeDraft('1', { x: 10, y: 10 }, 'rect', '#f00', 2, 'u1', 0)
    const next = updateShapeDraft(base, { x: 10, y: 10 }, { x: 50, y: 40 })
    expect(next).toMatchObject({ x: 10, y: 10, width: 40, height: 30 })
    expect(shouldFinalizeDraft(next)).toBe(true)
  })

  it('updates ellipse draft while dragging', () => {
    const base = createShapeDraft('1', { x: 0, y: 0 }, 'ellipse', '#f00', 2, 'u1', 0)
    const next = updateShapeDraft(base, { x: 0, y: 0 }, { x: 30, y: 20 })
    expect(next.width).toBe(30)
    expect(next.height).toBe(20)
    expect(shouldFinalizeDraft(next)).toBe(true)
  })

  it('rejects zero-size shape', () => {
    const base = createShapeDraft('1', { x: 5, y: 5 }, 'rect', '#f00', 2, 'u1', 0)
    expect(shouldFinalizeDraft(base)).toBe(false)
  })

  it('computes max zIndex', () => {
    const els: CanvasElement[] = [
      { id: 'a', type: 'rect', x: 0, y: 0, stroke: '#000', strokeWidth: 1, createdBy: 'u', zIndex: 2 },
      { id: 'b', type: 'rect', x: 0, y: 0, stroke: '#000', strokeWidth: 1, createdBy: 'u', zIndex: 5 },
    ]
    expect(maxZIndex(els)).toBe(5)
  })

  it('translates positioned elements', () => {
    const rect: CanvasElement = {
      id: 'r',
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      stroke: '#000',
      strokeWidth: 1,
      createdBy: 'u',
      zIndex: 1,
    }
    expect(translateElement(rect, 15, -5)).toMatchObject({ x: 25, y: 15 })
  })

  it('translates point-based elements', () => {
    const stroke = createStrokeDraft('s', { x: 10, y: 20 }, 'pen', '#000', 3, 'u', 0)
    const moved = translateElement(appendStrokePoint(stroke, { x: 30, y: 40 }), 5, -10)
    expect(moved.points).toEqual([15, 10, 35, 30])
  })
})
