import * as THREE from 'three';
import { SongItem } from '../types';

export class TextureGenerator {
  static createAlbumTexture(song: SongItem, maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, song.color);
    grad.addColorStop(0.55, song.secondaryColor);
    grad.addColorStop(1, '#100c1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    if (song.id === 1) {
      // My Love Mine All Mine — Celestial Rose & Wishing Comet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(256, 210, 108, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 240, 243, 0.85)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(angle) * 58, 210 + Math.sin(angle) * 58, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (song.id === 2) {
      // Lady — Zero-Gravity Intersecting Orbits
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(226, 210, 92, 52, -0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(286, 210, 92, 52, 0.45, 0, Math.PI * 2);
      ctx.stroke();
    } else if (song.id === 3) {
      // Heather — Moon & Lavender Stems
      ctx.fillStyle = 'rgba(232, 224, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(256, 178, 72, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 4;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(256 + i * 28, 330);
        ctx.quadraticCurveTo(256 + i * 32, 265, 256 + i * 40, 220);
        ctx.stroke();
      }
    } else if (song.id === 4) {
      // Best Part — Constellation Burst
      ctx.strokeStyle = 'rgba(255, 232, 178, 0.85)';
      ctx.lineWidth = 2.5;
      const pts: [number, number][] = [
        [150, 220],
        [210, 165],
        [270, 195],
        [345, 145],
        [310, 255],
      ];
      ctx.beginPath();
      pts.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();

      ctx.fillStyle = '#fff8e7';
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (song.id === 5) {
      // Midnight Sun — Luminous Horizon Sun
      ctx.fillStyle = 'rgba(255, 243, 176, 0.9)';
      ctx.beginPath();
      ctx.arc(256, 225, 84, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 3;
      for (let y = 240; y <= 310; y += 16) {
        ctx.beginPath();
        ctx.moveTo(125, y);
        ctx.lineTo(387, y);
        ctx.stroke();
      }
    } else if (song.id === 6) {
      // Come Over and Love Me — Nested Gallery Frames
      ctx.strokeStyle = 'rgba(255, 240, 235, 0.85)';
      ctx.lineWidth = 5;
      ctx.strokeRect(156, 118, 200, 200);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(180, 142, 152, 152);
    } else {
      // Beige — Pastel ASCII Grid Motif
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      const rows = ['* + : . : + *', '+ # @ & @ # +', '= * % @ % * =', '- : + # + : -'];
      rows.forEach((row, rIdx) => {
        ctx.fillText(row, 256, 155 + rIdx * 42);
      });
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 488, 488);

    const vig = ctx.createRadialGradient(256, 256, 140, 256, 256, 360);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;

    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(song.title, 256, 418, 450);

    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(song.artist, 256, 454, 420);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    return texture;
  }

  static createStarfieldTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#0d0722');
    bgGrad.addColorStop(0.5, '#150a33');
    bgGrad.addColorStop(1, '#080314');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    const nebulaGradients = [
      { x: 300, y: 300, r: 480, color1: 'rgba(181, 23, 158, 0.25)', color2: 'rgba(114, 9, 183, 0.0)' },
      { x: 800, y: 650, r: 550, color1: 'rgba(76, 201, 240, 0.22)', color2: 'rgba(58, 12, 163, 0.0)' },
      { x: 200, y: 800, r: 420, color1: 'rgba(247, 37, 133, 0.2)', color2: 'rgba(112, 0, 255, 0.0)' },
      { x: 700, y: 250, r: 380, color1: 'rgba(255, 209, 102, 0.16)', color2: 'rgba(0, 0, 0, 0)' },
    ];

    nebulaGradients.forEach((n) => {
      const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
      g.addColorStop(0, n.color1);
      g.addColorStop(1, n.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    });

    const starColors = ['#ffffff', '#a2d2ff', '#f15bb5', '#fee440', '#90e0ef'];
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const radius = Math.random() < 0.88 ? Math.random() * 1.3 : Math.random() * 2.8;
      const alpha = 0.4 + Math.random() * 0.6;
      const color = starColors[Math.floor(Math.random() * starColors.length)];

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (radius > 2.2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x, y + 8);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  static createAsteroidRockTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#30214a';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 45; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const cr = 10 + Math.random() * 28;

      const g = ctx.createRadialGradient(cx, cy, cr * 0.15, cx, cy, cr);
      g.addColorStop(0, '#1c132e');
      g.addColorStop(0.75, '#4a386c');
      g.addColorStop(1, '#30214a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#7209b7';
    for (let i = 0; i < 150; i++) {
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.fillRect(sx, sy, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  static createEarthTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep cosmic ocean gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
    oceanGrad.addColorStop(0, '#cadff7');
    oceanGrad.addColorStop(0.12, '#1d4e89');
    oceanGrad.addColorStop(0.5, '#0f2c59');
    oceanGrad.addColorStop(0.88, '#1d4e89');
    oceanGrad.addColorStop(1, '#cadff7');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Stylized glowing continental landmasses
    const blobs = [
      { x: 110, y: 115, rx: 52, ry: 34, c: '#2d6a4f' },
      { x: 145, y: 155, rx: 28, ry: 38, c: '#40916c' },
      { x: 265, y: 98, rx: 64, ry: 32, c: '#386641' },
      { x: 280, y: 148, rx: 38, ry: 34, c: '#52b788' },
      { x: 375, y: 118, rx: 55, ry: 36, c: '#2d6a4f' },
      { x: 405, y: 170, rx: 28, ry: 18, c: '#52b788' },
    ];
    blobs.forEach((b) => {
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.rx, b.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Atmospheric swirling cloud ribbons
    ctx.fillStyle = 'rgba(235, 246, 255, 0.34)';
    for (let i = 0; i < 24; i++) {
      const cx = (i * 53) % 512;
      const cy = 28 + ((i * 37) % 200);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 38 + (i % 4) * 14, 7 + (i % 3) * 3, (i % 5) * 0.12 - 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
