import { describe, expect, it } from 'vitest'
import {
  appendStrokePoint,
  shouldFinalizeDraft,
  createShapeDraft,
  createStrokeDraft,
  updateShapeDraft,
} from '../../src/canvas/drawing'

describe('draw flow', () => {
  it('pen stroke finalizes after drag', () => {
    let d = createStrokeDraft('1', { x: 0, y: 0 }, 'pen', '#000', 3, 'u', 0)
    d = appendStrokePoint(d, { x: 10, y: 10 })
    d = appendStrokePoint(d, { x: 20, y: 15 })
    expect(shouldFinalizeDraft(d)).toBe(true)
  })

  it('rect finalizes with drag size', () => {
    const d = createShapeDraft('1', { x: 10, y: 10 }, 'rect', '#f00', 2, 'u', 0)
    const moved = updateShapeDraft(d, { x: 10, y: 10 }, { x: 110, y: 80 })
    expect(shouldFinalizeDraft(moved)).toBe(true)
    expect(moved.width).toBe(100)
    expect(moved.height).toBe(70)
  })

  it('ellipse finalizes with drag size', () => {
    const d = createShapeDraft('1', { x: 0, y: 0 }, 'ellipse', '#f00', 2, 'u', 0)
    const moved = updateShapeDraft(d, { x: 0, y: 0 }, { x: 40, y: 30 })
    expect(shouldFinalizeDraft(moved)).toBe(true)
  })
})
