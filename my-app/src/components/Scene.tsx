import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export default function Scene() {
  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />

      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>

      <OrbitControls />
    </Canvas>
  )
}