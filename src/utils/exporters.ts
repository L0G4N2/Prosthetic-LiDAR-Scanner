// 3D Export Utilities
// Converts point-cloud data to industry-standard 3D formats for printing and modeling
// Supports:
// - OBJ: ASCII format, widely compatible for editing in Blender, Maya, etc.
// - PLY: ASCII format, preserves point cloud structure
// - STL: Binary format, standard for 3D printing (slicers: Cura, PrusaSlicer, etc.)

/**
 * Export point-cloud to OBJ format (vertices only)
 * @param points - Array of [x, y, z] coordinates
 * @param filename - Output filename (e.g., "scan.obj")
 */
export function exportPointCloudToOBJ(
  points: Array<[number, number, number]>,
  filename = 'limb.obj'
): void {
  let obj = '# Exported LiDAR Point Cloud\n'
  obj += `# Points: ${points.length}\n\n`

  // Write vertices: OBJ format uses "v x y z" for each vertex
  for (const [x, y, z] of points) {
    obj += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
  }

  downloadFile(obj, filename, 'text/plain')
}

/**
 * Export point-cloud to PLY format (ASCII)
 * @param points - Array of [x, y, z] coordinates
 * @param filename - Output filename (e.g., "scan.ply")
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

  // Write vertex data
  for (const [x, y, z] of points) {
    ply += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
  }

  downloadFile(ply, filename, 'text/plain')
}

/**
 * Export point-cloud to STL format (binary)
 * Creates a simple mesh surface by connecting nearest neighbors
 * STL is the standard format for 3D printing
 * @param points - Array of [x, y, z] coordinates
 * @param filename - Output filename (e.g., "scan.stl")
 */
export function exportPointCloudToSTL(
  points: Array<[number, number, number]>,
  filename = 'limb.stl'
): void {
  // Generate mesh triangles by connecting nearby points
  const triangles = createSimpleMeshFromPoints(points)
  exportTrianglesToSTL(triangles, filename)
}

/**
 * Simple mesh generation: creates triangles by connecting nearest neighbors
 * This is a fast heuristic for creating a surface from scattered points
 * For higher-quality meshes, use Poisson reconstruction or similar post-processing
 * @param points - Point array
 * @param maxNeighbors - Max neighbors to connect per point (trade-off: quality vs speed)
 */
function createSimpleMeshFromPoints(
  points: Array<[number, number, number]>,
  maxNeighbors = 12
): Array<[[number, number, number], [number, number, number], [number, number, number]]> {
  if (points.length < 3) return []

  const triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = []

  // For each point, connect to nearest neighbors to form triangles
  for (let i = 0; i < points.length; i++) {
    const p = points[i]

    // Calculate distance to all other points
    const distances = points.map((q, j) => ({
      index: j,
      dist: Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]),
    }))
    distances.sort((a, b) => a.dist - b.dist)

    // Create triangles with nearest neighbors (skip self at index 0)
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
 * Export triangles to binary STL format (standard for 3D printers)
 * STL file structure:
 * - 80-byte header (ignored by most printers)
 * - 4-byte unsigned int: triangle count
 * - Per triangle: 12 bytes normal + 36 bytes vertices + 2 bytes attribute = 50 bytes
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

  // Create array for triangle count (4 bytes) + triangle data (50 bytes each)
  const triangleDataSize = 4 + triangles.length * 50
  const buffer = new ArrayBuffer(80 + triangleDataSize)
  const u8 = new Uint8Array(buffer)
  const f32 = new Float32Array(buffer)

  // Copy header
  u8.set(view)

  // Write triangle count at byte 80
  const triangleCount = new Uint32Array(buffer, 80, 1)
  triangleCount[0] = triangles.length

  // Write each triangle
  let offset = 84 // Start after header (80) and count (4)
  for (const [v1, v2, v3] of triangles) {
    // Compute surface normal using cross product
    const n = computeNormal(v1, v2, v3)

    // Write normal (3 floats = 12 bytes)
    f32[offset / 4] = n[0]
    f32[offset / 4 + 1] = n[1]
    f32[offset / 4 + 2] = n[2]

    // Write three vertices (9 floats = 36 bytes)
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

  // Create blob and trigger download
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
 * Compute surface normal for a triangle using cross product
 * Normal direction: (v2-v1) × (v3-v1)
 * Normal is normalized to unit length
 */
function computeNormal(
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number]
): [number, number, number] {
  const e1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
  const e2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]

  // Cross product: e1 × e2
  const n = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ]

  // Normalize to unit length
  const len = Math.hypot(n[0], n[1], n[2])
  if (len > 0) {
    return [n[0] / len, n[1] / len, n[2] / len]
  }
  return [0, 0, 1]
}

/**
 * Generic file download utility
 * Creates a blob, generates a download link, and triggers browser download
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
