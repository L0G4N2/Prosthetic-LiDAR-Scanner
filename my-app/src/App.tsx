import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Scene from './components/Scene'
import LiDARLoader from './components/LiDARLoader'
import type { LiDARData } from './components/LiDARLoader'

function App() {
  const [count, setCount] = useState(0)
  const [lidarSummary, setLidarSummary] = useState<string | null>(null)
  const [lidarData, setLidarData] = useState<LiDARData | null>(null)

  function handleLiDARLoad(data: LiDARData) {
    setLidarData(data)
    if (data.type === 'image') {
      setLidarSummary(`Image ${data.width}x${data.height}`)
      console.log('LiDAR image loaded', data.width, data.height, data.pixels.length)
    } else {
      setLidarSummary(`Pointcloud ${data.points.length} points`)
      console.log('LiDAR pointcloud loaded', data.points.length, data.points.slice(0,5))
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 320 }}>
          <LiDARLoader onLoad={handleLiDARLoad} />
          {lidarSummary && <div style={{ marginTop: 8, color: '#333' }}>{lidarSummary}</div>}
          <div style={{ marginTop: 12 }}>
            <a href="https://vite.dev" target="_blank">
              <img src={viteLogo} className="logo" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </div>
        </div>

        <div>
          <Scene lidarData={lidarData} />
        </div>
      </div>

      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
