import type { CanvasElement } from '../types/element'
import { Arrow, Ellipse, Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'

type Props = {
  element: CanvasElement
  onSelect: (id: string) => void
  onDragEnd?: (element: CanvasElement, node: Konva.Node) => void
  onTextEdit?: (element: CanvasElement) => void
  selected: boolean
  listening?: boolean
  draggable?: boolean
}

export function ElementShape({
  element,
  onSelect,
  onDragEnd,
  onTextEdit,
  selected,
  listening = true,
  draggable = false,
}: Props) {
  const handleSelect = () => onSelect(element.id)
  const common = {
    id: element.id,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    listening,
    draggable: listening && draggable,
    onClick: listening ? handleSelect : undefined,
    onTap: listening ? handleSelect : undefined,
    onMouseDown: listening ? handleSelect : undefined,
    onTouchStart: listening ? handleSelect : undefined,
    onDragEnd: listening && draggable && onDragEnd ? (event: Konva.KonvaEventObject<DragEvent>) => onDragEnd(element, event.target) : undefined,
    shadowEnabled: selected,
    shadowColor: '#3b82f6',
    shadowBlur: selected ? 8 : 0,
  }

  switch (element.type) {
    case 'stroke':
      return (
        <Line
          {...common}
          points={element.points || []}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
          globalCompositeOperation={element.stroke === 'eraser' ? 'destination-out' : 'source-over'}
        />
      )
    case 'text':
      return (
        <Text
          {...common}
          x={element.x}
          y={element.y}
          text={element.text || ''}
          fontSize={element.fontSize || 20}
          fill={element.stroke}
          stroke={undefined}
          strokeWidth={0}
          onDblClick={listening && onTextEdit ? () => onTextEdit(element) : undefined}
          onDblTap={listening && onTextEdit ? () => onTextEdit(element) : undefined}
        />
      )
    case 'rect':
      return (
        <Rect
          {...common}
          x={element.x}
          y={element.y}
          width={element.width || 0}
          height={element.height || 0}
          fill={element.fill || 'transparent'}
        />
      )
    case 'ellipse':
      return (
        <Ellipse
          {...common}
          x={element.x + (element.width || 0) / 2}
          y={element.y + (element.height || 0) / 2}
          radiusX={Math.abs(element.width || 0) / 2}
          radiusY={Math.abs(element.height || 0) / 2}
          fill={element.fill || 'transparent'}
        />
      )
    case 'line':
      return <Line {...common} points={element.points || []} lineCap="round" />
    case 'arrow': {
      const pts = element.points || []
      if (pts.length < 4) return null
      const x1 = pts[0],
        y1 = pts[1],
        x2 = pts[2],
        y2 = pts[3]
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const head = 12
      return (
        <Group
          id={element.id}
          listening={listening}
          draggable={listening && draggable}
          onClick={listening ? handleSelect : undefined}
          onTap={listening ? handleSelect : undefined}
          onMouseDown={listening ? handleSelect : undefined}
          onTouchStart={listening ? handleSelect : undefined}
          onDragEnd={listening && draggable && onDragEnd ? (event) => onDragEnd(element, event.target) : undefined}
        >
          <Line points={pts} stroke={element.stroke} strokeWidth={element.strokeWidth} lineCap="round" />
          <Line
            points={[
              x2,
              y2,
              x2 - head * Math.cos(angle - Math.PI / 6),
              y2 - head * Math.sin(angle - Math.PI / 6),
              x2,
              y2,
              x2 - head * Math.cos(angle + Math.PI / 6),
              y2 - head * Math.sin(angle + Math.PI / 6),
            ]}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            lineCap="round"
          />
        </Group>
      )
    }
    default:
      return null
  }
}
