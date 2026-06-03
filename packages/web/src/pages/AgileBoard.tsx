import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useBoardCollab } from '../collab/useBoardCollab'
import type { BoardPriority, BoardRow, BoardStatus } from '../types/board'

const statusOptions: { value: BoardStatus; label: string }[] = [
  { value: 'todo', label: '待办' },
  { value: 'doing', label: '进行中' },
  { value: 'review', label: '验收' },
  { value: 'done', label: '完成' },
]

const priorityOptions: { value: BoardPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]
const pageSizeOptions = [10, 20, 50]

const statusOrder: Record<BoardStatus, number> = {
  review: 0,
  doing: 1,
  todo: 2,
  done: 3,
}

function ownerKey(row: BoardRow) {
  return row.owner.trim() || '\uffff'
}

function sortBoardRows(rows: BoardRow[]) {
  return [...rows].sort((a, b) => {
    const statusCompare = statusOrder[a.status] - statusOrder[b.status]
    if (statusCompare !== 0) return statusCompare
    const ownerCompare = ownerKey(a).localeCompare(ownerKey(b), 'zh-Hans-CN')
    if (ownerCompare !== 0) return ownerCompare
    return a.createdAt - b.createdAt
  })
}

function createRow(): BoardRow {
  const now = Date.now()
  return {
    id: nanoid(),
    title: '',
    owner: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    notes: '',
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function AgileBoardPage() {
  const { roomId = 'default' } = useParams()
  const board = useBoardCollab(roomId)
  const [showArchived, setShowArchived] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const activeRows = useMemo(() => board.rows.filter((row) => !row.archived), [board.rows])
  const archivedRows = useMemo(() => board.rows.filter((row) => row.archived), [board.rows])
  const baseRows = showArchived ? archivedRows : activeRows
  const ownerOptions = useMemo(() => {
    return Array.from(new Set(baseRows.map((row) => row.owner.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'zh-Hans-CN')
    )
  }, [baseRows])
  const visibleRows = useMemo(() => {
    const filtered = ownerFilter === 'all' ? baseRows : baseRows.filter((row) => row.owner.trim() === ownerFilter)
    return sortBoardRows(filtered)
  }, [baseRows, ownerFilter])
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return visibleRows.slice(start, start + pageSize)
  }, [page, pageSize, visibleRows])

  useEffect(() => {
    if (ownerFilter !== 'all' && !ownerOptions.includes(ownerFilter)) {
      setOwnerFilter('all')
    }
  }, [ownerFilter, ownerOptions])

  useEffect(() => {
    setPage(1)
  }, [ownerFilter, pageSize, showArchived])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const addRow = () => board.upsert(createRow())

  const updateRow = (row: BoardRow, patch: Partial<BoardRow>) => {
    board.upsert({ ...row, ...patch })
  }

  const archiveRow = (row: BoardRow) => {
    updateRow(row, { archived: true, archivedAt: Date.now() })
  }

  const restoreRow = (row: BoardRow) => {
    updateRow(row, { archived: false, archivedAt: undefined })
  }

  return (
    <div className="app board-app">
      <header className="board-header">
        <div className="board-header-left">
          <Link className="toolbar-link" to={`/room/${roomId}`}>
            返回画布
          </Link>
          <button className="primary-button" type="button" onClick={addRow}>
            新增行
          </button>
          <button
            className={showArchived ? 'toolbar-link active' : 'toolbar-link'}
            type="button"
            onClick={() => setShowArchived((current) => !current)}
          >
            归档 {archivedRows.length}
          </button>
          <label className="board-filter">
            <span>负责人</span>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">全部</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar-right" title={board.online.join(', ')}>
          <span className={board.connected ? 'dot ok' : 'dot'} />
          <span>{board.connected ? '已连接' : '连接中...'}</span>
          <span className="room">{roomId}</span>
          <span>在线 {board.online.length || 1} 人</span>
        </div>
      </header>

      <main className="board-main">
        <div className="board-table-wrap">
          <table className="agile-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>负责人</th>
                <th>状态</th>
                <th>优先级</th>
                <th>截止日期</th>
                <th>备注</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.id} className={`status-${row.status}`}>
                  <td className="task-cell">
                    <div className="tooltip-cell" data-full={row.title || undefined}>
                      <input value={row.title} onChange={(e) => updateRow(row, { title: e.target.value })} />
                    </div>
                  </td>
                  <td>
                    <input value={row.owner} onChange={(e) => updateRow(row, { owner: e.target.value })} />
                  </td>
                  <td>
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(row, { status: e.target.value as BoardStatus })}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={row.priority}
                      onChange={(e) => updateRow(row, { priority: e.target.value as BoardPriority })}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateRow(row, { dueDate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.notes} onChange={(e) => updateRow(row, { notes: e.target.value })} />
                  </td>
                  <td className="row-action">
                    <div className="row-actions">
                      {showArchived ? (
                        <button type="button" onClick={() => restoreRow(row)}>
                          恢复
                        </button>
                      ) : (
                        <button type="button" onClick={() => archiveRow(row)}>
                          归档
                        </button>
                      )}
                      <button className="danger" type="button" onClick={() => board.remove(row.id)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={7}>
                    {showArchived ? (
                      <span>暂无归档内容</span>
                    ) : (
                      <button className="primary-button" type="button" onClick={addRow}>
                        新增行
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="pagination-count">共 {visibleRows.length} 行</span>
          <label className="page-size">
            <span>每页</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            上一页
          </button>
          <span className="page-index">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </button>
        </div>
      </main>
    </div>
  )
}
