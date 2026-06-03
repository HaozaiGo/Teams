export type BoardStatus = 'todo' | 'doing' | 'review' | 'done'
export type BoardPriority = 'low' | 'medium' | 'high'

export type BoardRow = {
  id: string
  title: string
  owner: string
  status: BoardStatus
  priority: BoardPriority
  dueDate: string
  notes: string
  archived: boolean
  archivedAt?: number
  createdAt: number
  updatedAt: number
}
