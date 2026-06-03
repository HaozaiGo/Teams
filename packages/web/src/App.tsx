import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AgileBoardPage } from './pages/AgileBoard'
import { HomePage } from './pages/Home'
import { RoomPage } from './pages/Room'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/room/:roomId/board" element={<AgileBoardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
