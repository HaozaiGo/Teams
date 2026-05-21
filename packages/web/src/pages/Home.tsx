import { Navigate } from 'react-router-dom'
import { nanoid } from 'nanoid'

export function HomePage() {
  return <Navigate to={`/room/${nanoid(8)}`} replace />
}
