import { useCallback, useRef } from 'react'
import type { UndoAction } from '../types/element'

export function useUndo(onApply: (action: UndoAction, reverse: boolean) => void) {
  const undoStack = useRef<UndoAction[]>([])
  const redoStack = useRef<UndoAction[]>([])

  const push = useCallback(
    (action: UndoAction) => {
      undoStack.current.push(action)
      redoStack.current = []
    },
    []
  )

  const undo = useCallback(() => {
    const action = undoStack.current.pop()
    if (!action) return
    onApply(action, true)
    redoStack.current.push(action)
  }, [onApply])

  const redo = useCallback(() => {
    const action = redoStack.current.pop()
    if (!action) return
    onApply(action, false)
    undoStack.current.push(action)
  }, [onApply])

  return { push, undo, redo }
}
