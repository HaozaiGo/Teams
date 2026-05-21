import { Circle, Layer, Text } from 'react-konva'

type Cursor = { x: number; y: number; name: string; color: string }

export function RemoteCursors({ cursors }: { cursors: Map<number, Cursor> }) {
  return (
    <Layer listening={false}>
      {Array.from(cursors.entries()).map(([id, c]) => (
        <Circle key={id} x={c.x} y={c.y} radius={6} fill={c.color} opacity={0.8} />
      ))}
      {Array.from(cursors.entries()).map(([id, c]) => (
        <Text key={`t-${id}`} x={c.x + 10} y={c.y - 8} text={c.name} fontSize={12} fill={c.color} />
      ))}
    </Layer>
  )
}
