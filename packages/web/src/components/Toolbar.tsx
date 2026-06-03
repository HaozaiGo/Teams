import { Link } from 'react-router-dom'
import type { Tool } from '../types/element'

type Props = {
  tool: Tool
  color: string
  strokeWidth: number
  connected: boolean
  online: string[]
  roomId: string
  onTool: (t: Tool) => void
  onColor: (c: string) => void
  onStroke: (n: number) => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onBringFront: () => void
  onSendBack: () => void
  onCopyLink: () => void
  onClear: () => void
}

const tools: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: '选择', key: 'V' },
  { id: 'pen', label: '画笔', key: 'P' },
  { id: 'eraser', label: '橡皮', key: 'E' },
  { id: 'text', label: '文字', key: 'T' },
  { id: 'rect', label: '矩形', key: 'R' },
  { id: 'ellipse', label: '圆形', key: 'O' },
  { id: 'line', label: '直线', key: 'L' },
  { id: 'arrow', label: '箭头', key: 'A' },
]
const swatches = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', '#2563eb', '#7c3aed']

export function Toolbar({
  tool,
  color,
  strokeWidth,
  connected,
  online,
  roomId,
  onTool,
  onColor,
  onStroke,
  onUndo,
  onRedo,
  onExport,
  onBringFront,
  onSendBack,
  onCopyLink,
  onClear,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="tool-group" aria-label="工具">
          {tools.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'tool-button active' : 'tool-button'}
              onClick={() => onTool(t.id)}
              title={`${t.label} (${t.key})`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="tool-group color-group" aria-label="颜色">
          {swatches.map((item) => (
            <button
              key={item}
              className={item.toLowerCase() === color.toLowerCase() ? 'swatch active' : 'swatch'}
              style={{ background: item }}
              onClick={() => onColor(item)}
              title={`颜色 ${item}`}
            />
          ))}
          <input type="color" value={color} onChange={(e) => onColor(e.target.value)} title="自定义颜色" />
        </div>
        <label className="stroke-control" title="线条粗细">
          <span>{strokeWidth}px</span>
          <input type="range" min={1} max={24} value={strokeWidth} onChange={(e) => onStroke(Number(e.target.value))} />
        </label>
        <div className="tool-group">
          <button onClick={onUndo} title="撤销 Ctrl+Z">
            撤销
          </button>
          <button onClick={onRedo} title="重做 Ctrl+Y">
            重做
          </button>
          <button onClick={onBringFront}>置顶</button>
          <button onClick={onSendBack}>置底</button>
          <button onClick={onExport}>导出</button>
          <button onClick={onCopyLink}>复制链接</button>
          <button className="danger" onClick={onClear}>
            清空
          </button>
        </div>
      </div>
      <div className="toolbar-center">
        <Link className="toolbar-link" to={`/room/${roomId}/board`}>
          敏捷看板
        </Link>
      </div>
      <div className="toolbar-right" title={online.join(', ')}>
        <span className={connected ? 'dot ok' : 'dot'} />
        <span>{connected ? '已连接' : '连接中...'}</span>
        <span className="room">{roomId}</span>
        <span>在线 {online.length || 1} 人</span>
      </div>
    </div>
  )
}
