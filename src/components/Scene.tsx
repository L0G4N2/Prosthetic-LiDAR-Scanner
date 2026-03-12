// 3D Scene Component
// Renders LiDAR point-clouds and depth images in 3D using Three.js via React Three Fiber
// Supports both point-cloud visualization (as scattered points) and depth image display (as textured plane)
// Provides interactive 3D controls via OrbitControls (rotate, zoom, pan with mouse)

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LiDARData } from './LiDARLoader'

interface CropBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface PointCloudProps {
  data: LiDARData | null;
  crop?: CropBox;
  fullBounds?: CropBox | null;
}

/**
 * PointCloudViewer: Renders a point-cloud as individual 3D points
 * - Converts point array to Three.js BufferGeometry
 * - Centers the points around origin for better interaction
 * - Auto-rotates for visual feedback
 */
function PointCloudViewer({ data, crop, fullBounds }: PointCloudProps) {
  const groupRef = useRef<THREE.Group>(null)
  // const pointsRef = useRef<THREE.Points>(null) // no longer used

  // Memoize geometry creation to avoid rebuilding on every render
  const { geometry, rawBounds } = useMemo(() => {
    if (!data || data.type !== 'pointcloud') return { geometry: null, rawBounds: null }

    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(data.points.flat())
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // compute extents (not used for centering anymore)
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    data.points.forEach(([x,y,z])=>{
      if(x<minX) minX=x; if(x>maxX) maxX=x;
      if(y<minY) minY=y; if(y>maxY) maxY=y;
      if(z<minZ) minZ=z; if(z>maxZ) maxZ=z;
    });

    geom.computeBoundingBox()

    return { geometry: geom, rawBounds: { minX, maxX, minY, maxY, minZ, maxZ } }
  }, [data])

  // Animate rotation for visual appeal (entire group including grid)
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001
    }
  })

  if (!geometry) {
    return null
  }

  // compute preview meshes using raw coordinates directly
  let cropMesh = null
  if (crop && rawBounds) {
    const hasCrop =
      crop.minX < crop.maxX ||
      crop.minY < crop.maxY ||
      crop.minZ < crop.maxZ
    if (hasCrop) {
      // use crop values if they define any non-degenerate interval;
      // if any axis is degenerate, extend to rawBounds for that axis
      const minX = crop.minX < crop.maxX ? crop.minX : rawBounds.minX
      const maxX = crop.minX < crop.maxX ? crop.maxX : rawBounds.maxX
      const minY = crop.minY < crop.maxY ? crop.minY : rawBounds.minY
      const maxY = crop.minY < crop.maxY ? crop.maxY : rawBounds.maxY
      const minZ = crop.minZ < crop.maxZ ? crop.minZ : rawBounds.minZ
      const maxZ = crop.minZ < crop.maxZ ? crop.maxZ : rawBounds.maxZ

      const w = maxX - minX
      const h = maxY - minY
      const d = maxZ - minZ
      const fcenter = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
      cropMesh = (
        <mesh position={[fcenter.x, fcenter.y, fcenter.z]}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial color="red" wireframe opacity={0.5} transparent />
        </mesh>
      )
    }
  }

  // full bounds wireframe (use provided fullBounds if present to show original dataset)
  let fullBox = null
  const boundsToUse = fullBounds || rawBounds
  if (boundsToUse) {
    const fw = boundsToUse.maxX - boundsToUse.minX
    const fh = boundsToUse.maxY - boundsToUse.minY
    const fd = boundsToUse.maxZ - boundsToUse.minZ
    const fcenter = new THREE.Vector3(
      (boundsToUse.minX + boundsToUse.maxX) / 2,
      (boundsToUse.minY + boundsToUse.maxY) / 2,
      (boundsToUse.minZ + boundsToUse.maxZ) / 2
    )
    fullBox = (
      <mesh position={[fcenter.x, fcenter.y, fcenter.z]}>
        <boxGeometry args={[fw, fh, fd]} />
        <meshBasicMaterial color="grey" wireframe opacity={0.2} transparent />
      </mesh>
    )
  }

  // determine grid size from raw bounds
  let grid = null
  let axisLabels = null
  let floorY = 0
  if (rawBounds) {
    floorY = rawBounds.minY
    const size = Math.max(rawBounds.maxX - rawBounds.minX, rawBounds.maxY - rawBounds.minY, rawBounds.maxZ - rawBounds.minZ) * 1.5
    grid = <gridHelper args={[size, 10, '#888', '#444']} position={[0, floorY, 0]} />
    // generate ruler-style ticks along edges rather than only endpoints
    const offset = size * 0.02
    // grid-based ticks rather than data bounds
    const half = size / 2
    // use same spacing as grid subdivisions
    const step = size / grid.props.args[1] // grid size divided by subdivisions (e.g., 10) gives step spacing
    const ticks: JSX.Element[] = []
    // x-axis ticks along front edge (z = -half)
    for (let x = -half; x <= half + 1e-6; x += step) {
      ticks.push(
        <Text
          key={"x"+x}
          position={[x, floorY, (-half - offset) - 0.015]}
          rotation={[Math.PI / 2, Math.PI, Math.PI / 2]} // lay flat with correct orientation along X
          fontSize={size * 0.035}
          color="#000"
          anchorX="center"
          anchorZ="center"
        >
          {x.toFixed(2)}
        </Text>
      )
    }
    // z-axis ticks along left edge (x = -half)
    for (let z = -half; z <= half + 1e-6; z += step) {
      ticks.push(
        <Text
          key={"z"+z}
          position={[(-half - offset) - 0.015, floorY, z]}
          rotation={[Math.PI / 2, Math.PI, Math.PI]} // lay flat and rotate within plane to align with Z
          fontSize={size * 0.035}
          color="#000"
          anchorZ="center"
          anchorX="center"
        >
          {z.toFixed(2)}
        </Text>
      )
    }
    // Y label at origin corner
    ticks.push(
      <Text
        key="ylabel"
        position={[-half - offset, floorY + offset, -half - offset]}
        fontSize={size * 0.04}
        color="#000"
        anchorY="bottom"
        anchorX="right"
        anchorZ="front"
      >
        Y={floorY.toFixed(2)}
      </Text>
    )
    axisLabels = <>{ticks}</>
  }

  return (
    <group ref={groupRef}>
      {grid}
      {axisLabels}
      <points geometry={geometry}>
        {/* Blue points with fixed size in screen space */}
        <pointsMaterial size={0.02} sizeAttenuation color={0x4488ff} />
      </points>
      {cropMesh}
      {fullBox}
      {/* always show axes for orientation */}
      {rawBounds && <axesHelper position={[0, floorY, 0]} args={[Math.max(rawBounds.maxX - rawBounds.minX, rawBounds.maxY - rawBounds.minY, rawBounds.maxZ - rawBounds.minZ) * 0.6]} />}
    </group>
  )
}

/**
 * DepthImageViewer: Renders a depth image as a textured plane in 3D space
 * - Converts pixel data to canvas texture
 * - Displays as a rotatable plane
 * - Useful for depth map visualization
 */
function DepthImageViewer({ data }: PointCloudProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Memoize texture and geometry creation
  const { geometry, texture } = useMemo(() => {
    if (!data || data.type !== 'image') return { geometry: null, texture: null }

    // Create canvas texture from pixel data
    const canvas = document.createElement('canvas')
    canvas.width = data.width
    canvas.height = data.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { geometry: null, texture: null }

    // Draw pixel data to canvas
    const imageData = ctx.createImageData(data.width, data.height)
    imageData.data.set(data.pixels)
    ctx.putImageData(imageData, 0, 0)

    // Create Three.js texture from canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true

    // Create plane geometry scaled to image aspect ratio
    const geom = new THREE.PlaneGeometry(data.width / 512, data.height / 512)
    return { geometry: geom, texture: tex }
  }, [data])

  // Animate rotation
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001
    }
  })

  if (!geometry || !texture) {
    return null
  }

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

/**
 * Main Scene Component
 * @param lidarData - LiDAR data (point-cloud or image) to render, or null for fallback
 */
export default function Scene({ lidarData, crop, fullBounds }: { lidarData: LiDARData | null; crop?: CropBox; fullBounds?: CropBox | null }) {
  return (
    <Canvas camera={{ position: [0, 0, 2] }}>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.6} />
      {/* Directional light for shadows and depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      {/* Render point-cloud if loaded */}
      {lidarData?.type === 'pointcloud' && <PointCloudViewer data={lidarData} />}
      
      {/* Render depth image if loaded */}
      {lidarData?.type === 'image' && <DepthImageViewer data={lidarData} />}

      {/* Fallback cube when no data is loaded */}
      {!lidarData && (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      )}

      {/* Interactive orbit controls: left-click drag to rotate, scroll to zoom, right-click to pan */}
      <OrbitControls />
    </Canvas>
  )
}