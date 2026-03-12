// Main App Component
// Orchestrates the LiDAR scanning workflow: file upload → classification → 3D visualization → export
// Manages shared state (lidarData) passed between LiDARLoader and Scene components

import { useState } from 'react'
import './App.css'
import Scene from './components/Scene'
import LiDARLoader from './components/LiDARLoader'
import type { LiDARData } from './components/LiDARLoader'
import { exportPointCloudToOBJ, exportPointCloudToSTL, exportPointCloudToPLY } from './utils/exporters'
import { classifyPointCloud, measurePointCloud, convertMeasurements } from './utils/limbClassifier' // for dimensions, volume and classification
import type { LimbClass } from './utils/limbClassifier'
import * as THREE from 'three';
import * as ADDON from 'three/examples/jsm/Addons.js';

function App() {
  // State for displaying scan summary (e.g., "Pointcloud 50000 points")
  const [lidarSummary, setLidarSummary] = useState<string | null>(null)
  // measurement results (length/width/depth/volume in metric)
  const [measurements, setMeasurements] = useState<{
    length: number;
    width: number;
    depth: number;
    volume: number;
  } | null>(null)
  // classification result (recomputed after each edit)
  const [classification, setClassification] = useState<LimbClass | null>(null)
  // units for display
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')
  
  // State holding the parsed LiDAR data (either point-cloud or image)
  // Passed to Scene for 3D rendering
  const [lidarData, setLidarData] = useState<LiDARData | null>(null)
  // preserve original upload so edits can be reset
  const [originalData, setOriginalData] = useState<LiDARData | null>(null)

  // store the raw extents of the current pointcloud (never modified)
  const [fullBounds, setFullBounds] = useState<{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number;} | null>(null)

  // editing controls
  const [scaleFactor, setScaleFactor] = useState<number>(1)
  const [cropBounds, setCropBounds] = useState({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
  })

  /**
   * Handler called when LiDARLoader successfully parses a file
   * Updates UI summary and stores data for rendering and export
   */
  function handleLiDARLoad(data: LiDARData) {
    setOriginalData(data)
    setLidarData(data)
    // reset scale
    setScaleFactor(1)

    // compute and remember full extents; crop inputs start at zero
    if (data.type === 'pointcloud') {
      let minX = Infinity, minY = Infinity, minZ = Infinity
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
      data.points.forEach(([x, y, z]) => {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
      })
      setFullBounds({ minX, maxX, minY, maxY, minZ, maxZ })
      setCropBounds({ minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 })
    } else {
      setFullBounds(null)
      setCropBounds({ minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 })
    }

    if (data.type === 'image') {
      setLidarSummary(`Image ${data.width}x${data.height}`)
      setMeasurements(null)
      setClassification(null)
      console.log('LiDAR image loaded', data.width, data.height, data.pixels.length)
    } else {
      setLidarSummary(`Pointcloud ${data.points.length} points`)
      // compute measurements for point cloud
      const m = measurePointCloud(data.points)
      setMeasurements({ length: m.length, width: m.width, depth: m.depth, volume: m.volume })
      console.log('LiDAR pointcloud loaded', data.points.length, data.points.slice(0,5), 'meas', m)
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

  // ---------------------------------------------
  // Editing helpers
  // ---------------------------------------------

  function applyScale(factor: number) {
    if (!lidarData || lidarData.type !== 'pointcloud') return
    const pts = lidarData.points.map(([x, y, z]) => [x * factor, y * factor, z * factor] as [number, number, number])
    // update crop bounds as well
    setCropBounds((b) => ({
      minX: b.minX * factor,
      maxX: b.maxX * factor,
      minY: b.minY * factor,
      maxY: b.maxY * factor,
      minZ: b.minZ * factor,
      maxZ: b.maxZ * factor,
    }))
    setLidarData({ type: 'pointcloud', points: pts })
    setLidarSummary(`Pointcloud ${pts.length} points`)
    const m2 = measurePointCloud(pts)
    setMeasurements({ length: m2.length, width: m2.width, depth: m2.depth, volume: m2.volume })
    const cls2 = classifyPointCloud(pts)
    setClassification(cls2)
  }

  function applyCrop(bounds: typeof cropBounds) {
    // always filter original data to avoid cumulative rounding/shifting
    const src = originalData && originalData.type === 'pointcloud' ? originalData.points : (lidarData && lidarData.type === 'pointcloud' ? lidarData.points : null)
    if (!src) return

    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds

    const pts = src.filter(([x, y, z]) => {
      if (minX < maxX && (x < minX || x > maxX)) return false
      if (minY < maxY && (y < minY || y > maxY)) return false
      if (minZ < maxZ && (z < minZ || z > maxZ)) return false
      return true
    })
    setLidarData({ type: 'pointcloud', points: pts })
    setLidarSummary(`Pointcloud ${pts.length} points`)
    const m3 = measurePointCloud(pts)
    setMeasurements({ length: m3.length, width: m3.width, depth: m3.depth, volume: m3.volume })
    const cls3 = classifyPointCloud(pts)
    setClassification(cls3)
  }

  function resetEdits() {
    if (originalData) {
      setLidarData(originalData)
      if (originalData.type === 'pointcloud') {
        setLidarSummary(`Pointcloud ${originalData.points.length} points`)
        const cls0 = classifyPointCloud(originalData.points)
        setClassification(cls0)
      }
    }
    setScaleFactor(1)
    setCropBounds({minX:0,maxX:0,minY:0,maxY:0,minZ:0,maxZ:0})
  }

  return (
    <div className="app-container">
      {/* Left Sidebar: Controls and Info */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>LiDAR Scanner</h1>
          <p>Convert point-clouds to 3D-printable models</p>
        </div>

        {/* File upload section */}
        <div className="section">
          <div className="section-title">Load Scan</div>
          <div className="loader-container">
            <LiDARLoader onLoad={handleLiDARLoad} />
          </div>
        </div>

        {/* Display scan info after successful upload */}
        {lidarSummary && (
          <div className="section">
            <div className="section-title">Scan Info</div>
            <div className="info-box success">
              {lidarSummary}
              {classification && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Guess:</strong> {classification.label} ({(classification.confidence*100).toFixed(0)}%)
                </div>
              )}
            </div>
          </div>
        )}
        {measurements && (
          <div className="section">
            <div className="section-title">
              Measurements ({unit === 'metric' ? 'm' : 'ft'})
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                <input
                  type="radio"
                  name="unit"
                  value="metric"
                  checked={unit === 'metric'}
                  onChange={() => setUnit('metric')}
                />
                Metric
              </label>{' '}
              <label>
                <input
                  type="radio"
                  name="unit"
                  value="imperial"
                  checked={unit === 'imperial'}
                  onChange={() => setUnit('imperial')}
                />
                Imperial
              </label>
            </div>
            <ul className="info-box success measurements-list">
              {(() => {
                const mdisp = unit === 'metric' ? measurements : convertMeasurements(measurements, 'imperial')
                return (
                  <>
                    <li>Length: {mdisp.length.toFixed(3)}</li>
                    <li>Width: {mdisp.width.toFixed(3)}</li>
                    <li>Depth: {mdisp.depth.toFixed(3)}</li>
                    <li>
                      BBox volume: {mdisp.volume.toFixed(6)} {unit === 'metric' ? 'm³' : 'ft³'}
                    </li>
                  </>
                )
              })()}
            </ul>
          </div>
        )}

        {/* Export buttons visible only for point-cloud data */}
        {lidarData && lidarData.type === 'pointcloud' && (
          <>
            <div className="section">
              <div className="section-title">Export Model</div>
              <div className="export-buttons">
                <button onClick={() => exportPointCloud('stl')}>
                  Download STL (3D Print)
                </button>
                <button onClick={() => exportPointCloud('obj')}>
                  Download OBJ (Editing)
                </button>
                <button onClick={() => exportPointCloud('ply')}>
                  Download PLY (Analysis)
                </button>
              </div>
            </div>

            {/* Editing controls */}
            <div className="section">
              <div className="section-title">Edit Scan</div>

              {/* scale */}
              <div className="edit-group">
                <label>
                  Scale factor:
                  <input
                    type="number"
                    step="0.01"
                    value={scaleFactor}
                    onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1)}
                  />
                </label>
                <button onClick={() => applyScale(scaleFactor)}>Apply</button>
              </div>

              {/* crop bounds */}
              <div className="edit-group crop-group">
                <div className="crop-title">Crop bounds (inclusive):</div>
                <div className="axis-row">
                  <label>
                    X min:
                    <input
                      type="number"
                      value={cropBounds.minX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, minX: Math.min(val, b.maxX) }));
                      }}
                    />
                  </label>
                  <label>
                    X max:
                    <input
                      type="number"
                      value={cropBounds.maxX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, maxX: Math.max(val, b.minX) }));
                      }}
                    />
                  </label>
                </div>
                <div className="axis-row">
                  <label>
                    Y min:
                    <input
                      type="number"
                      value={cropBounds.minY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, minY: Math.min(val, b.maxY) }));
                      }}
                    />
                  </label>
                  <label>
                    Y max:
                    <input
                      type="number"
                      value={cropBounds.maxY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, maxY: Math.max(val, b.minY) }));
                      }}
                    />
                  </label>
                </div>
                <div className="axis-row">
                  <label>
                    Z min:
                    <input
                      type="number"
                      value={cropBounds.minZ}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, minZ: Math.min(val, b.maxZ) }));
                      }}
                    />
                  </label>
                  <label>
                    Z max:
                    <input
                      type="number"
                      value={cropBounds.maxZ}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCropBounds((b) => ({ ...b, maxZ: Math.max(val, b.minZ) }));
                      }}
                    />
                  </label>
                </div>
                <button onClick={() => applyCrop(cropBounds)}>Crop</button>
              </div>

              <div className="edit-group">
                <button onClick={resetEdits}>Reset Edits</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Viewer: 3D Rendering Canvas */}
      <div className="viewer">
        <div className="viewer-header">
          <h2>3D Preview</h2>
        </div>
        {/* Scene component renders the 3D model (point-cloud or depth image) */}
        <div className="viewer-content">
          <Scene lidarData={lidarData} crop={cropBounds} fullBounds={fullBounds} />
        </div>
      </div>
    </div>
  )
}

export default App
