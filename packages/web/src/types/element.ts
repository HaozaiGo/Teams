export type ElementType = 'stroke' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow'

export type CanvasElement = {
  id: string
  type: ElementType
  x: number
  y: number
  rotation?: number
  stroke: string
  strokeWidth: number
  fill?: string
  points?: number[]
  text?: string
  width?: number
  height?: number
  fontSize?: number
  createdBy: string
  zIndex: number
}

export type Tool = 'select' | 'pen' | 'eraser' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow'

export type CursorState = {
  x: number
  y: number
  name: string
  color: string
}

export type UndoAction = {
  type: 'add' | 'update' | 'delete'
  elementId: string
  before?: CanvasElement | null
  after?: CanvasElement | null
}
