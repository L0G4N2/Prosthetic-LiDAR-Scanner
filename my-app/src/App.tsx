// Main App Component
// Orchestrates the LiDAR scanning workflow: file upload → classification → 3D visualization → export
// Manages shared state (lidarData) passed between LiDARLoader and Scene components

import { useState } from 'react'
import './App.css'
import Scene from './components/Scene'
import LiDARLoader from './components/LiDARLoader'
import type { LiDARData } from './components/LiDARLoader'
import { exportPointCloudToOBJ, exportPointCloudToSTL, exportPointCloudToPLY } from './utils/exporters'

function App() {
  // State for displaying scan summary (e.g., "Pointcloud 50000 points")
  const [lidarSummary, setLidarSummary] = useState<string | null>(null)
  
  // State holding the parsed LiDAR data (either point-cloud or image)
  // Passed to Scene for 3D rendering
  const [lidarData, setLidarData] = useState<LiDARData | null>(null)

  /**
   * Handler called when LiDARLoader successfully parses a file
   * Updates UI summary and stores data for rendering and export
   */
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

  /**
   * Exports the loaded point-cloud to the specified format
   * @param format - 'stl' (3D printer ready), 'obj' (editing friendly), or 'ply' (analysis format)
   * Uses timestamp in filename for easy organization
   */
  function exportPointCloud(format: 'obj' | 'stl' | 'ply') {
    if (!lidarData || lidarData.type !== 'pointcloud') {
      alert('No point-cloud loaded. Please upload a point-cloud file first.')
      return
    }
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `limb_${timestamp}.${format}`
    if (format === 'obj') exportPointCloudToOBJ(lidarData.points, filename)
    else if (format === 'stl') exportPointCloudToSTL(lidarData.points, filename)
    else if (format === 'ply') exportPointCloudToPLY(lidarData.points, filename)
  }

  return (
    <div className="app-container">
      {/* Left Sidebar: Controls and Info */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>🔬 LiDAR Scanner</h1>
          <p>Convert point-clouds to 3D-printable models</p>
        </div>

        {/* File upload section */}
        <div className="section">
          <div className="section-title">📁 Load Scan</div>
          <div className="loader-container">
            <LiDARLoader onLoad={handleLiDARLoad} />
          </div>
        </div>

        {/* Display scan info after successful upload */}
        {lidarSummary && (
          <div className="section">
            <div className="section-title">📊 Scan Info</div>
            <div className="info-box success">{lidarSummary}</div>
          </div>
        )}

        {/* Export buttons visible only for point-cloud data */}
        {lidarData && lidarData.type === 'pointcloud' && (
          <div className="section">
            <div className="section-title">💾 Export Model</div>
            <div className="export-buttons">
              <button onClick={() => exportPointCloud('stl')}>
                📥 Download STL (3D Print)
              </button>
              <button onClick={() => exportPointCloud('obj')}>
                📥 Download OBJ (Editing)
              </button>
              <button onClick={() => exportPointCloud('ply')}>
                📥 Download PLY (Analysis)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Viewer: 3D Rendering Canvas */}
      <div className="viewer">
        <div className="viewer-header">
          <h2>🎬 3D Preview</h2>
        </div>
        {/* Scene component renders the 3D model (point-cloud or depth image) */}
        <div className="viewer-content">
          <Scene lidarData={lidarData} />
        </div>
      </div>
    </div>
  )
}

export default App
