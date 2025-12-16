import React, { useRef, useState } from 'react';

type LiDARData =
  | { type: 'image'; width: number; height: number; pixels: Uint8ClampedArray }
  | { type: 'pointcloud'; points: Array<[number, number, number]> };

export default function LiDARLoader({ onLoad }: { onLoad: (d: LiDARData) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      cb({ type: 'image', width: canvas.width, height: canvas.height, pixels: imageData.data });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  async function readPointCloudFile(file: File, cb: (d: LiDARData) => void) {
    const txt = await file.text();
    // Attempt formats in order: PLY (ASCII), PCD (ASCII), XYZ
    const txtTrim = txt.trim();
    if (txtTrim.startsWith('ply')) {
      const points = parsePlyAscii(txt);
      if (!points || points.length === 0) {
        setError('PLY file parsed but contains no vertex data.');
        return;
      }
      cb({ type: 'pointcloud', points });
      return;
    }
    if (txtTrim.toLowerCase().startsWith('# .pcd') || /pcd\s+v?\d/.test(txtTrim.slice(0, 200).toLowerCase())) {
      const points = parsePcdAscii(txt);
      if (!points || points.length === 0) {
        setError('PCD file parsed but contains no point data.');
        return;
      }
      cb({ type: 'pointcloud', points });
      return;
    }
    // fallback: parse lines of three numbers (x y z)
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
  }

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
      // assume x y z are first three or find indexes
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
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <input type="file" ref={fileRef} onChange={handleFile} />
        <small style={{ color: '#666' }}>Supports PNG/JPG images or ASCII PLY/PCD/XYZ</small>
        {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

export type { LiDARData };
