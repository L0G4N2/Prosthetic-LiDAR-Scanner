// 3D Scene Component
// Renders LiDAR point-clouds and depth images in 3D using Three.js via React Three Fiber
// Supports both point-cloud visualization (as scattered points) and depth image display (as textured plane)
// Provides interactive 3D controls via OrbitControls (rotate, zoom, pan with mouse)

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LiDARData } from './LiDARLoader'

interface PointCloudProps {
  data: LiDARData | null;
}

/**
 * PointCloudViewer: Renders a point-cloud as individual 3D points
 * - Converts point array to Three.js BufferGeometry
 * - Centers the points around origin for better interaction
 * - Auto-rotates for visual feedback
 */
function PointCloudViewer({ data }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null)

  // Memoize geometry creation to avoid rebuilding on every render
  const geometry = useMemo(() => {
    if (!data || data.type !== 'pointcloud') return null

    const geom = new THREE.BufferGeometry()
    // Convert array of [x, y, z] points to flat Float32Array for GPU
    const positions = new Float32Array(data.points.flat())
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Compute bounding box and center the point-cloud at origin
    geom.computeBoundingBox()
    const center = new THREE.Vector3()
    geom.boundingBox?.getCenter(center)
    geom.translate(-center.x, -center.y, -center.z)

    return geom
  }, [data])

  // Animate rotation for visual appeal
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001
    }
  })

  if (!geometry) {
    return null
  }

  return (
    <points ref={pointsRef} geometry={geometry}>
      {/* Blue points with fixed size in screen space */}
      <pointsMaterial size={0.02} sizeAttenuation color={0x4488ff} />
    </points>
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
export default function Scene({ lidarData }: { lidarData: LiDARData | null }) {
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