// LiDAR File Loader Component
// Accepts user file uploads and parses LiDAR data in multiple formats
// Supports: PNG/JPG images (as depth maps) and ASCII point-cloud files (PLY, PCD, XYZ)
// Validates parsed data and performs limb classification on successful load

import React, { useRef, useState } from 'react';
import { classifyPointCloud, classifyFromImage } from '../utils/limbClassifier';

// Type definition for parsed LiDAR data
// Either a depth image (RGBA pixel array) or a point-cloud (3D coordinates)
type LiDARData =
  | { type: 'image'; width: number; height: number; pixels: Uint8ClampedArray }
  | { type: 'pointcloud'; points: Array<[number, number, number]> };

export default function LiDARLoader({ onLoad }: { onLoad: (d: LiDARData) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Error message displayed when file parsing or validation fails
  const [error, setError] = useState<string | null>(null);
  // Classification result (limb type + confidence) displayed after successful parse
  const [classification, setClassification] = useState<string | null>(null);

  /**
   * Main file handler: routes uploaded file to appropriate parser based on extension
   */
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      readImageAsDepth(f, onLoad);
    } else if (name.endsWith('.ply') || name.endsWith('.pcd') || name.endsWith('.xyz') || name.endsWith('.txt')) {
      readPointCloudFile(f, onLoad);
    } else {
      setError('Unrecognized file extension. Please select a PNG/JPG image or ASCII point-cloud (.ply/.pcd/.xyz).');
    }
  }

  /**
   * Parse image file as depth map
   * Extracts pixel data from canvas and validates dimensions
   */
  function readImageAsDepth(file: File, cb: (d: LiDARData) => void) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (canvas.width === 0 || canvas.height === 0 || !imageData.data || imageData.data.length === 0) {
        setError('Image could not be read as a valid LiDAR depth image.');
        URL.revokeObjectURL(url);
        return;
      }
      const data = { type: 'image', width: canvas.width, height: canvas.height, pixels: imageData.data } as const;
      cb(data);

      // Classify image (low confidence since depth is unknown)
      const imgCls = classifyFromImage(canvas.width, canvas.height);
      setClassification(`${imgCls.label} — ${Math.round(imgCls.confidence * 100)}%`);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /**
   * Parse point-cloud file (PLY, PCD, or XYZ format)
   * Attempts format detection and parsing in order: PLY, PCD, XYZ fallback
   */
  async function readPointCloudFile(file: File, cb: (d: LiDARData) => void) {
    const txt = await file.text();
    const txtTrim = txt.trim();
    
    // Try PLY format
    if (txtTrim.startsWith('ply')) {
      const points = parsePlyAscii(txt);
      if (!points || points.length === 0) {
        setError('PLY file parsed but contains no vertex data.');
        return;
      }
      cb({ type: 'pointcloud', points });
      const cls = classifyPointCloud(points);
      setClassification(`${cls.label} — ${Math.round(cls.confidence * 100)}%`);
      return;
    }
    
    // Try PCD format
    if (txtTrim.toLowerCase().startsWith('# .pcd') || /pcd\s+v?\d/.test(txtTrim.slice(0, 200).toLowerCase())) {
      const points = parsePcdAscii(txt);
      if (!points || points.length === 0) {
        setError('PCD file parsed but contains no point data.');
        return;
      }
      cb({ type: 'pointcloud', points });
      const cls = classifyPointCloud(points);
      setClassification(`${cls.label} — ${Math.round(cls.confidence * 100)}%`);
      return;
    }
    
    // Fallback: parse lines of three numbers (x y z) - XYZ or custom format
    const pts: Array<[number, number, number]> = [];
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      if (s.startsWith('#') || /[a-z]/i.test(s.split(/\s+/)[0])) continue;
      const parts = s.split(/\s+/).map(Number).filter(n => !Number.isNaN(n));
      if (parts.length >= 3) pts.push([parts[0], parts[1], parts[2]]);
    }
    if (pts.length === 0) {
      setError('No point data found in file. Please select a valid ASCII point-cloud (.ply/.pcd/.xyz) or an image.');
      return;
    }
    cb({ type: 'pointcloud', points: pts });
    const cls = classifyPointCloud(pts);
    setClassification(`${cls.label} — ${Math.round(cls.confidence * 100)}%`);
  }

  /**
   * Parse ASCII PLY format
   * PLY header contains vertex count; data follows "end_header"
   */
  function parsePlyAscii(text: string) {
    const lines = text.split(/\r?\n/);
    let i = 0;
    let vertexCount = 0;
    // read header
    if (!lines[i].startsWith('ply')) return [];
    i++;
    while (i < lines.length) {
      const l = lines[i].trim();
      if (l.startsWith('element vertex')) {
        const parts = l.split(/\s+/);
        vertexCount = parseInt(parts[2], 10) || 0;
      }
      if (l === 'end_header') {
        i++;
        break;
      }
      i++;
    }
    const pts: Array<[number, number, number]> = [];
    for (let c = 0; c < vertexCount && i < lines.length; c++, i++) {
      const row = lines[i].trim();
      if (!row) { c--; continue; }
      const p = row.split(/\s+/).map(Number);
      if (p.length >= 3) pts.push([p[0], p[1], p[2]]);
    }
    return pts;
  }

  /**
   * Parse ASCII PCD format
   * PCD header defines fields (x, y, z, etc.); data follows "DATA ascii"
   */
  function parsePcdAscii(text: string) {
    const lines = text.split(/\r?\n/);
    let dataStart = 0;
    let fields: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      const parts = l.split(/\s+/);
      const key = parts[0].toLowerCase();
      if (key === 'fields') fields = parts.slice(1);
      if (key === 'data') { dataStart = i + 1; break; }
    }
    const pts: Array<[number, number, number]> = [];
    for (let i = dataStart; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      const vals = l.split(/\s+/).map(Number).filter(n => !Number.isNaN(n));
      if (vals.length < 3) continue;
      // Try to find x, y, z field positions; default to first three values
      let x = vals[0], y = vals[1], z = vals[2];
      if (fields.length >= 3) {
        const xi = fields.indexOf('x'), yi = fields.indexOf('y'), zi = fields.indexOf('z');
        if (xi >= 0 && yi >= 0 && zi >= 0) {
          x = vals[xi]; y = vals[yi]; z = vals[zi];
        }
      }
      pts.push([x, y, z]);
    }
    return pts;
  }

  return (
    <div className="file-input-wrapper">
      <input type="file" ref={fileRef} onChange={handleFile} />
      <small className="file-input-label">Supports PNG/JPG images or ASCII PLY/PCD/XYZ</small>
      {error && <div className="info-box error">{error}</div>}
      {classification && <div className="info-box classification">Guess: {classification}</div>}
    </div>
  );
}

export type { LiDARData };
