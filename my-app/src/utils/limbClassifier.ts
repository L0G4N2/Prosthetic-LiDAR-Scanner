// Lightweight heuristic limb classifier for point-clouds
// Returns a best-guess label and confidence (0..1). This is a heuristic
// and not a trained model. For real use, replace with a trained classifier.

export type LimbClass = {
  label: string;
  confidence: number;
  bboxMeters?: { length: number; width: number; depth: number };
  points: number;
};

export function classifyPointCloud(points: Array<[number, number, number]>): LimbClass {
  if (!points || points.length === 0) return { label: 'unknown', confidence: 0, points: 0 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const dx = maxX - minX; const dy = maxY - minY; const dz = maxZ - minZ;

  // Try to detect units: if longest dimension is very large, assume mm and convert to meters
  const longest = Math.max(dx, dy, dz);
  let scale = 1; // assume meters
  if (longest > 5) scale = 1000; // likely values are in millimeters
  const lengthM = longest / scale;
  const widthM = Math.min(dx, dy, dz) / scale;
  const depthM = [dx, dy, dz].sort((a,b)=>a-b)[1] / scale;

  // Heuristic thresholds (meters)
  let label = 'unknown';
  let confidence = 0.0;

  if (lengthM < 0.06) { label = 'finger'; confidence = 0.45; }
  else if (lengthM < 0.25) { label = 'hand'; confidence = 0.6; }
  else if (lengthM < 0.55) { label = 'forearm'; confidence = 0.8; }
  else if (lengthM < 0.9) { label = 'upper arm'; confidence = 0.6; }
  else { label = 'leg'; confidence = 0.7; }

  // Increase confidence if width/length ratio looks limb-like (thin long)
  if (lengthM > 0) {
    const ratio = widthM / lengthM;
    if (ratio < 0.25) confidence = Math.min(1, confidence + 0.15);
    if (ratio > 0.6) confidence = Math.min(1, confidence - 0.2);
  }

  // Slight boost for point density
  const densityBoost = Math.min(0.15, Math.log10(Math.max(1, points.length)) / 10);
  confidence = Math.min(1, confidence + densityBoost);

  return {
    label,
    confidence: Number(confidence.toFixed(2)),
    bboxMeters: { length: Number(lengthM.toFixed(3)), width: Number(widthM.toFixed(3)), depth: Number(depthM.toFixed(3)) },
    points: points.length,
  };
}

export function classifyFromImage(width: number, height: number): LimbClass {
  // Without depth calibration, image-based guesses are unreliable.
  // Provide a conservative fallback that suggests converting to a point-cloud.
  return { label: 'unknown (image)', confidence: 0.2, bboxMeters: { length: width, width: height, depth: 0 }, points: 0 };
}
