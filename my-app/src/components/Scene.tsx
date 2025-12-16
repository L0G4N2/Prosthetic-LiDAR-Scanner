import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LiDARData } from './LiDARLoader'

interface PointCloudProps {
  data: LiDARData | null;
}

function PointCloudViewer({ data }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    if (!data || data.type !== 'pointcloud') return null

    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(data.points.flat())
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Compute bounding box and center
    geom.computeBoundingBox()
    const center = new THREE.Vector3()
    geom.boundingBox?.getCenter(center)
    geom.translate(-center.x, -center.y, -center.z)

    return geom
  }, [data])

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
      <pointsMaterial size={0.02} sizeAttenuation color={0x4488ff} />
    </points>
  )
}

function DepthImageViewer({ data }: PointCloudProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry, texture } = useMemo(() => {
    if (!data || data.type !== 'image') return { geometry: null, texture: null }

    // Create a canvas texture from the image data
    const canvas = document.createElement('canvas')
    canvas.width = data.width
    canvas.height = data.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { geometry: null, texture: null }

    const imageData = ctx.createImageData(data.width, data.height)
    imageData.data.set(data.pixels)
    ctx.putImageData(imageData, 0, 0)

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true

    const geom = new THREE.PlaneGeometry(data.width / 512, data.height / 512)
    return { geometry: geom, texture: tex }
  }, [data])

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

export default function Scene({ lidarData }: { lidarData: LiDARData | null }) {
  return (
    <Canvas camera={{ position: [0, 0, 2] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />

      {lidarData?.type === 'pointcloud' && <PointCloudViewer data={lidarData} />}
      {lidarData?.type === 'image' && <DepthImageViewer data={lidarData} />}

      {!lidarData && (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      )}

      <OrbitControls />
    </Canvas>
  )
}