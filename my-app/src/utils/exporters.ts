// 3D export utilities for point-clouds and meshes
// Supports OBJ and STL formats for 3D printing

/**
 * Export point-cloud to OBJ format (vertices only)
 */
export function exportPointCloudToOBJ(
  points: Array<[number, number, number]>,
  filename = 'limb.obj'
): void {
  let obj = '# Exported LiDAR Point Cloud\n'
  obj += `# Points: ${points.length}\n\n`

  // Write vertices
  for (const [x, y, z] of points) {
    obj += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
  }

  downloadFile(obj, filename, 'text/plain')
}

/**
 * Export point-cloud to PLY format (ASCII)
 */
export function exportPointCloudToPLY(
  points: Array<[number, number, number]>,
  filename = 'limb.ply'
): void {
  let ply = 'ply\n'
  ply += 'format ascii 1.0\n'
  ply += `element vertex ${points.length}\n`
  ply += 'property float x\n'
  ply += 'property float y\n'
  ply += 'property float z\n'
  ply += 'end_header\n'

  for (const [x, y, z] of points) {
    ply += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
  }

  downloadFile(ply, filename, 'text/plain')
}

/**
 * Create a simple convex hull mesh from points and export to STL
 * This uses a basic distance-field approach to create a surface
 */
export function exportPointCloudToSTL(
  points: Array<[number, number, number]>,
  filename = 'limb.stl'
): void {
  // Create a very simple mesh: connect nearest neighbors to form triangles
  // For a more robust solution, use a proper convex hull or Poisson reconstruction
  const triangles = createSimpleMeshFromPoints(points)
  exportTrianglesToSTL(triangles, filename)
}

/**
 * Simple mesh generation: creates triangles by connecting nearest neighbors
 */
function createSimpleMeshFromPoints(
  points: Array<[number, number, number]>,
  maxNeighbors = 12
): Array<[[number, number, number], [number, number, number], [number, number, number]]> {
  if (points.length < 3) return []

  const triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = []

  // Simple approach: for each point, connect to nearby points to form triangles
  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Find nearest neighbors
    const distances = points.map((q, j) => ({
      index: j,
      dist: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]),
    }))
    distances.sort((a, b) => a.dist - b.dist)

    // Create triangles with nearest neighbors (skip self)
    const neighbors = distances.slice(1, Math.min(maxNeighbors + 1, distances.length))
    for (let j = 0; j < neighbors.length - 1; j++) {
      triangles.push([
        p,
        points[neighbors[j].index],
        points[neighbors[j + 1].index],
      ])
    }
  }

  return triangles
}

/**
 * Export triangles to binary STL format
 */
function exportTrianglesToSTL(
  triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]>,
  filename: string
): void {
  const header = new ArrayBuffer(80)
  const view = new Uint8Array(header)
  for (let i = 0; i < 80; i++) {
    view[i] = 0
  }

  // Create array for 4-byte unsigned int (triangle count) + triangles
  const triangleDataSize = 4 + triangles.length * 50 // 50 bytes per triangle
  const buffer = new ArrayBuffer(80 + triangleDataSize)
  const u8 = new Uint8Array(buffer)
  const f32 = new Float32Array(buffer)

  // Copy header
  u8.set(view)

  // Write triangle count at byte 80
  const triangleCount = new Uint32Array(buffer, 80, 1)
  triangleCount[0] = triangles.length

  // Write triangles
  let offset = 84 // Start after header and count
  for (const [v1, v2, v3] of triangles) {
    // Compute normal
    const n = computeNormal(v1, v2, v3)

    // Write normal (3 floats = 12 bytes)
    f32[offset / 4] = n[0]
    f32[offset / 4 + 1] = n[1]
    f32[offset / 4 + 2] = n[2]

    // Write vertices (3 vertices × 3 floats = 36 bytes)
    f32[offset / 4 + 3] = v1[0]
    f32[offset / 4 + 4] = v1[1]
    f32[offset / 4 + 5] = v1[2]

    f32[offset / 4 + 6] = v2[0]
    f32[offset / 4 + 7] = v2[1]
    f32[offset / 4 + 8] = v2[2]

    f32[offset / 4 + 9] = v3[0]
    f32[offset / 4 + 10] = v3[1]
    f32[offset / 4 + 11] = v3[2]

    // Write attribute byte count (2 bytes) = 0
    const attrCount = new Uint16Array(buffer, offset + 48, 1)
    attrCount[0] = 0

    offset += 50
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Compute normal vector for a triangle
 */
function computeNormal(
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number]
): [number, number, number] {
  const e1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
  const e2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]

  // Cross product
  const n = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ]

  // Normalize
  const len = Math.hypot(n[0], n[1], n[2])
  if (len > 0) {
    return [n[0] / len, n[1] / len, n[2] / len]
  }
  return [0, 0, 1]
}

/**
 * Trigger download of a text file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
