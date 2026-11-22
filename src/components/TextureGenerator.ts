import * as THREE from 'three';
import { SongItem } from '../types';

export class TextureGenerator {
  // Creates a 3D Canvas texture for an album cover
  static createAlbumTexture(song: SongItem): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, song.color);
    grad.addColorStop(0.5, song.secondaryColor);
    grad.addColorStop(1, '#0b0c10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Decorative artistic shapes depending on song style
    if (song.id === 1) { // Mitski - Mine All Mine
      // Glowing heart/botanical moon motif
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(256, 220, 110, 0, Math.PI * 2);
      ctx.fill();

      // Flower petals
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.arc(256 + Math.cos(angle) * 70, 220 + Math.sin(angle) * 70, 25, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (song.id === 2) { // Her's - What Once Was
      // Retro ocean wave / sun motif
      ctx.fillStyle = '#f72585';
      ctx.beginPath();
      ctx.arc(256, 260, 90, Math.PI, Math.PI * 2);
      ctx.fill();

      // Sunset grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4;
      for (let y = 260; y < 380; y += 16) {
        ctx.beginPath();
        ctx.moveTo(120, y);
        ctx.lineTo(392, y);
        ctx.stroke();
      }
    } else if (song.id === 3) { // Yoke Lore - Beige
      // Minimalist geometric folk constellation
      ctx.fillStyle = 'rgba(233, 196, 106, 0.3)';
      ctx.beginPath();
      ctx.moveTo(256, 120);
      ctx.lineTo(360, 280);
      ctx.lineTo(152, 280);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      // Cosmic stardust / geometric shapes for placeholders
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(256, 220, 80 + (song.id * 8) % 40, 0, Math.PI * 2);
      ctx.fill();

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 73 + song.id * 19) % 480 + 16;
        const sy = (i * 91 + song.id * 37) % 480 + 16;
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    // Outer album frame border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, 488, 488);

    // Vignette
    const vig = ctx.createRadialGradient(256, 256, 150, 256, 256, 360);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, 512, 512);

    // Text Overlay at bottom of album
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    
    // Title
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(song.title, 256, 420);

    // Artist
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(song.artist, 256, 455);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Generates starfield space box texture
  static createStarfieldTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Deep cosmic space gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#0d0722');
    bgGrad.addColorStop(0.5, '#150a33');
    bgGrad.addColorStop(1, '#080314');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Glowing vibrant Nebulae clouds
    const nebulaGradients = [
      { x: 300, y: 300, r: 480, color1: 'rgba(181, 23, 158, 0.28)', color2: 'rgba(114, 9, 183, 0.0)' },
      { x: 800, y: 650, r: 550, color1: 'rgba(76, 201, 240, 0.24)', color2: 'rgba(58, 12, 163, 0.0)' },
      { x: 200, y: 800, r: 420, color1: 'rgba(247, 37, 133, 0.22)', color2: 'rgba(112, 0, 255, 0.0)' },
      { x: 700, y: 250, r: 380, color1: 'rgba(255, 209, 102, 0.18)', color2: 'rgba(0, 0, 0, 0)' }
    ];

    nebulaGradients.forEach(n => {
      const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r);
      g.addColorStop(0, n.color1);
      g.addColorStop(1, n.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    });

    // Crisp glittering stars with color variations
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

      // Cross glow flare on larger stars
      if (radius > 2.2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Generates lunar rock texture for asteroids
  static createAsteroidRockTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Stylized twilight violet-grey stone base
    ctx.fillStyle = '#30214a';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle moon craters with soft purple-cyan rims
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

    // Glowing stardust speckles embedded in ground
    ctx.fillStyle = '#7209b7';
    for (let i = 0; i < 150; i++) {
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      ctx.fillRect(sx, sy, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }
}
