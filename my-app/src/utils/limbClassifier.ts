// Limb Classification Utility
// Provides heuristic-based classification of point-clouds to identify human limb types
// Uses bounding box dimensions and point density to guess limb type (finger, hand, forearm, etc.)
// Note: This is NOT a trained ML model and provides low-confidence predictions.
// For production use, integrate a trained classifier (e.g., PointNet or similar)

export type LimbClass = {
  label: string;
  confidence: number;
  bboxMeters?: { length: number; width: number; depth: number };
  points: number;
};

/**
 * Classify a point-cloud by analyzing its bounding box and geometry
 * Heuristics: assumes limbs are roughly elongated cylinders
 * Returns a best-guess label and confidence score (0..1)
 */
export function classifyPointCloud(points: Array<[number, number, number]>): LimbClass {
  if (!points || points.length === 0) return { label: 'unknown', confidence: 0, points: 0 };

  // Find bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const dx = maxX - minX; const dy = maxY - minY; const dz = maxZ - minZ;

  // Try to detect units: if largest dimension > 5, likely millimeters; convert to meters
  const longest = Math.max(dx, dy, dz);
  let scale = 1; // assume meters
  if (longest > 5) scale = 1000; // likely millimeters
  const lengthM = longest / scale;
  const widthM = Math.min(dx, dy, dz) / scale;
  const depthM = [dx, dy, dz].sort((a,b)=>a-b)[1] / scale;

  // Classify based on length (in meters)
  // Typical human limb sizes: fingers ~2-5cm, hand ~7-8cm, forearm ~25cm, etc.
  let label = 'unknown';
  let confidence = 0.0;

  if (lengthM < 0.06) { label = 'finger'; confidence = 0.45; }
  else if (lengthM < 0.25) { label = 'hand'; confidence = 0.6; }
  else if (lengthM < 0.55) { label = 'forearm'; confidence = 0.8; }
  else if (lengthM < 0.9) { label = 'upper arm'; confidence = 0.6; }
  else { label = 'leg'; confidence = 0.7; }

  // Boost confidence if width/length ratio suggests a limb (thin and long)
  if (lengthM > 0) {
    const ratio = widthM / lengthM;
    if (ratio < 0.25) confidence = Math.min(1, confidence + 0.15); // limb-like
    if (ratio > 0.6) confidence = Math.min(1, confidence - 0.2); // too blobby
  }

  // Slight confidence boost for higher point density
  const densityBoost = Math.min(0.15, Math.log10(Math.max(1, points.length)) / 10);
  confidence = Math.min(1, confidence + densityBoost);

  return {
    label,
    confidence: Number(confidence.toFixed(2)),
    bboxMeters: { length: Number(lengthM.toFixed(3)), width: Number(widthM.toFixed(3)), depth: Number(depthM.toFixed(3)) },
    points: points.length,
  };
}

/**
 * Classify from image dimensions (very low confidence fallback)
 * Without depth calibration, image-based predictions are unreliable
 */
export function classifyFromImage(width: number, height: number): LimbClass {
  return { label: 'unknown (image)', confidence: 0.2, bboxMeters: { length: width, width: height, depth: 0 }, points: 0 };
}
