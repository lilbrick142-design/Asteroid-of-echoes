import * as THREE from 'three';

/**
 * Recursively disposes geometries, materials, and non-shared textures inside an Object3D subtree.
 * Skips geometries/materials/textures flagged with `userData.sharedAsset = true`.
 */
export function disposeObject3DTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj.userData?.sharedAsset) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.sharedAsset) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if (!m.userData?.sharedAsset) disposeMaterial(m);
      });
    } else if (mat && !mat.userData?.sharedAsset) {
      disposeMaterial(mat);
    }
  });
}

function disposeMaterial(mat: THREE.Material) {
  const anyMat = mat as unknown as Record<string, unknown>;
  const texKeys = [
    'map',
    'alphaMap',
    'emissiveMap',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
  ];
  texKeys.forEach((key) => {
    const val = anyMat[key];
    if (val && val instanceof THREE.Texture && !val.userData?.sharedAsset) {
      val.dispose();
    }
  });
  mat.dispose();
}

/**
 * Creates a sculpted, curved 3D rose petal BufferGeometry with spooned cupping,
 * rolled upper lip, subtle vein relief, and throat-to-edge vertex color shading.
 */
export function createSculptedPetalGeometry(
  width = 0.34,
  height = 0.42,
  cupDepth = 0.14,
  curlOut = 0.08
): THREE.BufferGeometry {
  const segX = 6;
  const segY = 8;
  const cols = segX + 1;
  const rows = segY + 1;

  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];

  for (let iy = 0; iy < rows; iy++) {
    const v = iy / segY; // 0 = base claw, 1 = upper lip
    // Natural rose petal width envelope: narrow claw -> wide rounded top
    const widthProfile = Math.sin(Math.pow(v, 0.62) * Math.PI * 0.92) * (0.35 + 0.65 * Math.sin(v * Math.PI * 0.68));
    // Slight heart/cleft dip at top center
    const topCurve = Math.sin(v * Math.PI * 0.5);

    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX;
      const sx = (u - 0.5) * 2.0; // -1 .. +1
      const idx = iy * cols + ix;

      const x = sx * (width * 0.5) * Math.max(0.14, widthProfile);
      const centerDip = Math.pow(v, 3.0) * (1.0 - sx * sx) * 0.025;
      const y = v * height - centerDip + (1.0 - Math.abs(sx)) * 0.02 * topCurve;

      // Transverse spoon cupping + longitudinal S-bend + outward rolled lip at top
      const cup = (1.0 - sx * sx) * cupDepth * Math.sin(v * Math.PI);
      const sBend = -Math.pow(v, 1.8) * 0.05;
      const lipCurl = v > 0.72 ? Math.pow((v - 0.72) / 0.28, 2.0) * curlOut * (0.4 + 0.6 * (1 - Math.abs(sx) * 0.5)) : 0;
      const veinRipple = Math.sin(sx * 10.0) * 0.0045 * Math.sin(v * Math.PI);

      const z = cup + sBend - lipCurl + veinRipple;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v;

      // Gradient factor stored in vertex color (0.58 at base throat -> 1.0 luminous edge)
      const shade = 0.54 + 0.46 * Math.pow(v, 0.75) + Math.abs(sx) * 0.06;
      const clamped = Math.min(1, shade);
      colors[idx * 3] = clamped;
      colors[idx * 3 + 1] = clamped * (0.9 + 0.1 * v);
      colors[idx * 3 + 2] = clamped * (0.92 + 0.08 * v);
    }
  }

  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = (iy + 1) * cols + ix;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Legacy simple petal helper kept compatible while using sculpted petal geometry.
 */
export function createPetalGeometry(width = 0.3, height = 0.38): THREE.BufferGeometry {
  return createSculptedPetalGeometry(width, height, 0.12, 0.06);
}

/**
 * Creates a serrated, curved botanical rose leaf geometry pivoted at its petiole base.
 */
export function createBotanicalLeafGeometry(length = 0.42, width = 0.24): THREE.BufferGeometry {
  const segX = 4;
  const segY = 7;
  const cols = segX + 1;
  const rows = segY + 1;

  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const indices: number[] = [];

  for (let iy = 0; iy < rows; iy++) {
    const v = iy / segY;
    const serration = iy > 0 && iy < segY ? (iy % 2 === 0 ? 1.08 : 0.92) : 1.0;
    const envelope = Math.sin(Math.pow(v, 0.72) * Math.PI) * serration;

    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX;
      const sx = (u - 0.5) * 2.0;
      const idx = iy * cols + ix;

      const x = sx * (width * 0.5) * envelope;
      const z = v * length;
      // Midrib V-fold + gentle downward botanical droop
      const midribFold = Math.abs(sx) * 0.035 * Math.sin(v * Math.PI);
      const droop = -Math.pow(v, 1.9) * 0.085;
      const y = midribFold + droop;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      const edgeLight = 0.72 + Math.abs(sx) * 0.22 + v * 0.08;
      colors[idx * 3] = Math.min(1, edgeLight * 0.9);
      colors[idx * 3 + 1] = Math.min(1, edgeLight);
      colors[idx * 3 + 2] = Math.min(1, edgeLight * 0.85);
    }
  }

  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = (iy + 1) * cols + ix;
      const d = c + 1;
      indices.push(a, d, b, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a velvety PBR rose petal material with sheen and subsurface-scattering-inspired
 * warm backlit translucency via onBeforeCompile.
 */
export function createRosePetalMaterial(
  colorHex: number,
  emissiveHex: number,
  sheenHex: number
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    emissive: emissiveHex,
    emissiveIntensity: 0.22,
    roughness: 0.44,
    metalness: 0.02,
    sheen: 0.78,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(sheenHex),
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSssColor = { value: new THREE.Color(sheenHex) };
    shader.fragmentShader =
      `uniform vec3 uSssColor;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float sssRim = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.1);
        totalEmissiveRadiance += uSssColor * sssRim * 0.34;`
      );
  };
  return mat;
}

export interface RosePetalSlot {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  closedTilt: number;
  openTilt: number;
  tierNormalized: number; // 0 = inner, 1 = outer
}

export interface RoseLeafSlot {
  pivot: THREE.Group;
  openRotX: number;
  openRotZ: number;
}

export interface AnimatedRoseRig {
  root: THREE.Group;
  stemGroup: THREE.Group;
  bloomGroup: THREE.Group;
  petalSlots: RosePetalSlot[];
  leafSlots: RoseLeafSlot[];
  stamenCrown: THREE.Mesh;
  setBloomProgress: (progress: number) => void;
}

export interface RoseSharedResources {
  petalGeoInner: THREE.BufferGeometry;
  petalGeoOuter: THREE.BufferGeometry;
  leafGeo: THREE.BufferGeometry;
  budGeo: THREE.BufferGeometry;
  calyxGeo: THREE.BufferGeometry;
  stamenGeo: THREE.BufferGeometry;
  stemMat: THREE.MeshStandardMaterial;
  calyxMat: THREE.MeshStandardMaterial;
  stamenMat: THREE.MeshStandardMaterial;
  varietyMats: THREE.MeshPhysicalMaterial[];
}

export function createRoseSharedResources(): RoseSharedResources {
  const petalGeoInner = createSculptedPetalGeometry(0.24, 0.34, 0.14, 0.04);
  const petalGeoOuter = createSculptedPetalGeometry(0.38, 0.46, 0.16, 0.11);
  const leafGeo = createBotanicalLeafGeometry(0.44, 0.25);
  const budGeo = new THREE.SphereGeometry(0.11, 10, 10);
  budGeo.scale(0.85, 1.35, 0.85);
  const calyxGeo = new THREE.ConeGeometry(0.14, 0.2, 5);
  calyxGeo.rotateX(Math.PI);
  const stamenGeo = new THREE.CylinderGeometry(0.06, 0.03, 0.08, 8);

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 0.68,
    metalness: 0.04,
  });
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x3b7a57,
    roughness: 0.62,
    metalness: 0.04,
  });
  const stamenMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xff9f1c,
    emissiveIntensity: 0.65,
    roughness: 0.35,
  });

  // 3 distinct botanical rose varieties
  const varietyMats = [
    createRosePetalMaterial(0xc9184a, 0x590d22, 0xff758f), // 0: Velvet Crimson Damask
    createRosePetalMaterial(0xffb5a7, 0x6b2d38, 0xfff0f3), // 1: Champagne Blush Tea Rose
    createRosePetalMaterial(0x9d4edd, 0x3c165c, 0xffc6ff), // 2: Celestial Lavender-Rose Hybrid
  ];

  // Mark shared resources so per-flower cleanup only disposes once explicitly
  [petalGeoInner, petalGeoOuter, leafGeo, budGeo, calyxGeo, stamenGeo].forEach((g) => {
    g.userData.sharedAsset = true;
  });
  [stemMat, calyxMat, stamenMat, ...varietyMats].forEach((m) => {
    m.userData.sharedAsset = true;
  });

  return {
    petalGeoInner,
    petalGeoOuter,
    leafGeo,
    budGeo,
    calyxGeo,
    stamenGeo,
    stemMat,
    calyxMat,
    stamenMat,
    varietyMats,
  };
}

export function disposeRoseSharedResources(res: RoseSharedResources) {
  res.petalGeoInner.dispose();
  res.petalGeoOuter.dispose();
  res.leafGeo.dispose();
  res.budGeo.dispose();
  res.calyxGeo.dispose();
  res.stamenGeo.dispose();
  res.stemMat.dispose();
  res.calyxMat.dispose();
  res.stamenMat.dispose();
  res.varietyMats.forEach((m) => m.dispose());
}

/**
 * Builds an articulated, multi-tier botanical 3D rose with curved TubeGeometry stem,
 * serrated botanical leaves, 19 spiraled sculpted petals across 4 tiers, and true
 * bud-to-flower unfolding animation.
 */
export function createAnimatedRoseRig(
  res: RoseSharedResources,
  varietyIndex: number,
  stemHeight = 1.05,
  bendSeed = 0
): AnimatedRoseRig {
  const root = new THREE.Group();
  const petalMat = res.varietyMats[varietyIndex % res.varietyMats.length];

  // 1. Curved organic TubeGeometry stem
  const stemGroup = new THREE.Group();
  const bendX = Math.sin(bendSeed * 3.1) * 0.14;
  const bendZ = Math.cos(bendSeed * 2.3) * 0.12;
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendX * 0.45, stemHeight * 0.35, bendZ * 0.45),
    new THREE.Vector3(-bendX * 0.35, stemHeight * 0.7, bendZ * 0.7),
    new THREE.Vector3(bendX * 0.25, stemHeight, 0),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 10, 0.032, 6, false);
  const stemMesh = new THREE.Mesh(stemGeo, res.stemMat);
  stemGroup.add(stemMesh);

  // Serrated leaves unfurling along the stem
  const leafSlots: RoseLeafSlot[] = [];
  const leafHeights = [0.32, 0.56, 0.74];
  leafHeights.forEach((tVal, idx) => {
    const pt = stemCurve.getPoint(tVal);
    const pivot = new THREE.Group();
    pivot.position.copy(pt);
    pivot.rotation.y = idx * 2.25 + bendSeed;

    const leafMesh = new THREE.Mesh(res.leafGeo, res.stemMat);
    leafMesh.scale.setScalar(0.85 - idx * 0.12);
    pivot.add(leafMesh);
    stemGroup.add(pivot);

    leafSlots.push({
      pivot,
      openRotX: 0.35 + idx * 0.08,
      openRotZ: idx % 2 === 0 ? 0.18 : -0.18,
    });
  });

  root.add(stemGroup);

  // 2. Sculpted Multi-Tier Rose Bloom mounted at tip of curved stem
  const bloomGroup = new THREE.Group();
  const tipPos = stemCurve.getPoint(1);
  bloomGroup.position.copy(tipPos);
  root.add(bloomGroup);

  const calyx = new THREE.Mesh(res.calyxGeo, res.calyxMat);
  calyx.position.y = -0.05;
  bloomGroup.add(calyx);

  const innerBud = new THREE.Mesh(res.budGeo, petalMat);
  innerBud.position.y = 0.13;
  bloomGroup.add(innerBud);

  const stamenCrown = new THREE.Mesh(res.stamenGeo, res.stamenMat);
  stamenCrown.position.y = 0.22;
  stamenCrown.scale.setScalar(0.001);
  bloomGroup.add(stamenCrown);

  // 19 phyllotaxis-spiraled petals across 4 concentric tiers
  const goldenAngle = 2.39996323;
  const totalPetals = 19;
  const petalSlots: RosePetalSlot[] = [];

  for (let i = 0; i < totalPetals; i++) {
    const tierNorm = i / (totalPetals - 1); // 0 = tight inner whorl, 1 = outer open whorl
    const angle = i * goldenAngle + varietyIndex * 0.7;

    const radialAnchor = new THREE.Group();
    radialAnchor.rotation.y = angle;

    const tiltPivot = new THREE.Group();
    tiltPivot.position.set(0, 0.02 + tierNorm * 0.015, 0.032 + tierNorm * 0.095);
    radialAnchor.add(tiltPivot);

    const petalGeo = tierNorm < 0.42 ? res.petalGeoInner : res.petalGeoOuter;
    const petalMesh = new THREE.Mesh(petalGeo, petalMat);
    const baseScale = 0.62 + tierNorm * 0.52;
    petalMesh.scale.set(baseScale, baseScale, baseScale);
    petalMesh.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.06;
    tiltPivot.add(petalMesh);

    bloomGroup.add(radialAnchor);

    // Closed bud angle vs lush fully unfolded angle
    const closedTilt = 0.08 + tierNorm * 0.14;
    const openTilt = 0.24 + Math.pow(tierNorm, 0.88) * 0.96;

    petalSlots.push({
      pivot: tiltPivot,
      mesh: petalMesh,
      closedTilt,
      openTilt,
      tierNormalized: tierNorm,
    });
  }

  const setBloomProgress = (progress: number) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1);

    // Phase 1 (0 -> 0.55): stem grows from ground
    const stemGrow = THREE.MathUtils.smoothstep(p, 0.0, 0.55);
    stemGroup.scale.set(
      THREE.MathUtils.lerp(0.25, 1, stemGrow),
      Math.max(0.001, stemGrow),
      THREE.MathUtils.lerp(0.25, 1, stemGrow)
    );
    bloomGroup.position.set(
      tipPos.x * stemGrow,
      tipPos.y * stemGrow,
      tipPos.z * stemGrow
    );

    // Phase 2 (0.25 -> 0.75): leaves unfurl outward from stem
    const leafUnfurl = THREE.MathUtils.smoothstep(p, 0.25, 0.78);
    for (let i = 0; i < leafSlots.length; i++) {
      const ls = leafSlots[i];
      ls.pivot.scale.setScalar(Math.max(0.001, leafUnfurl));
      ls.pivot.rotation.x = THREE.MathUtils.lerp(-1.15, ls.openRotX, leafUnfurl);
      ls.pivot.rotation.z = ls.openRotZ * leafUnfurl;
    }

    // Phase 3 (0.32 -> 1.0): outer petals unfold first, then middle, then inner spiral
    const budScale = THREE.MathUtils.smoothstep(p, 0.22, 0.55);
    bloomGroup.scale.setScalar(Math.max(0.001, 0.28 + 0.72 * budScale));

    for (let i = 0; i < petalSlots.length; i++) {
      const slot = petalSlots[i];
      // Outer petals (tierNormalized=1) begin opening earlier than tight center petals
      const startOpen = 0.36 + (1.0 - slot.tierNormalized) * 0.28;
      const openT = THREE.MathUtils.smoothstep(p, startOpen, Math.min(1.0, startOpen + 0.36));
      slot.pivot.rotation.x = THREE.MathUtils.lerp(slot.closedTilt, slot.openTilt, openT);
    }

    // Stamen crown gently glows once inner petals part
    const stamenT = THREE.MathUtils.smoothstep(p, 0.72, 1.0);
    stamenCrown.scale.setScalar(Math.max(0.001, stamenT));
  };

  setBloomProgress(0);

  return {
    root,
    stemGroup,
    bloomGroup,
    petalSlots,
    leafSlots,
    stamenCrown,
    setBloomProgress,
  };
}

/**
 * Legacy helper kept for floating sky roses (now using sculpted multi-tier petals).
 */
export function createRoseBloomGroup(
  petalGeo: THREE.BufferGeometry,
  petalColorHex: number,
  emissiveHex: number,
  scale = 1
): THREE.Group {
  const bloom = new THREE.Group();
  const mat = createRosePetalMaterial(petalColorHex, emissiveHex, 0xffe5ec);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), mat);
  bud.scale.set(0.85, 1.35, 0.85);
  bud.position.y = 0.13;
  bloom.add(bud);

  const goldenAngle = 2.39996323;
  for (let i = 0; i < 16; i++) {
    const tier = i / 15;
    const angle = i * goldenAngle;
    const petalPivot = new THREE.Group();
    petalPivot.rotation.y = angle;
    const petal = new THREE.Mesh(petalGeo, mat);
    petal.position.set(0, 0.02 + tier * 0.012, 0.04 + tier * 0.1);
    petal.rotation.x = 0.22 + tier * 0.9;
    petal.scale.setScalar(0.65 + tier * 0.5);
    petalPivot.add(petal);
    bloom.add(petalPivot);
  }

  const calyxGeo = new THREE.ConeGeometry(0.15, 0.18, 5);
  calyxGeo.rotateX(Math.PI);
  const calyx = new THREE.Mesh(
    calyxGeo,
    new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.7 })
  );
  calyx.position.y = -0.04;
  bloom.add(calyx);

  bloom.scale.setScalar(scale);
  return bloom;
}

/**
 * Generates clean, extruded, beveled 3D geometric letter shapes without external typeface JSON dependencies.
 */
function buildGlyphShape(char: string): { shapes: THREE.Shape[]; width: number } {
  const s = new THREE.Shape();
  const holes: THREE.Path[] = [];
  const t = 0.18;
  const h = 1.0;

  switch (char) {
    case 'I': {
      const w = 0.44;
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, t * 0.85);
      s.lineTo(w * 0.5 + t * 0.5, t * 0.85);
      s.lineTo(w * 0.5 + t * 0.5, h - t * 0.85);
      s.lineTo(w, h - t * 0.85);
      s.lineTo(w, h);
      s.lineTo(0, h);
      s.lineTo(0, h - t * 0.85);
      s.lineTo(w * 0.5 - t * 0.5, h - t * 0.85);
      s.lineTo(w * 0.5 - t * 0.5, t * 0.85);
      s.lineTo(0, t * 0.85);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'L': {
      const w = 0.62;
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, t);
      s.lineTo(t, t);
      s.lineTo(t, h);
      s.lineTo(0, h);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'O': {
      const w = 0.78;
      const rx = w / 2;
      const ry = h / 2;
      s.absellipse(rx, ry, rx, ry, 0, Math.PI * 2, false, 0);
      const hole = new THREE.Path();
      hole.absellipse(rx, ry, rx - t, ry - t, 0, Math.PI * 2, true, 0);
      holes.push(hole);
      s.holes = holes;
      return { shapes: [s], width: w };
    }
    case 'V': {
      const w = 0.76;
      s.moveTo(w / 2 - t * 0.55, 0);
      s.lineTo(w / 2 + t * 0.55, 0);
      s.lineTo(w, h);
      s.lineTo(w - t, h);
      s.lineTo(w / 2, t * 1.15);
      s.lineTo(t, h);
      s.lineTo(0, h);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'E': {
      const w = 0.64;
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, t);
      s.lineTo(t, t);
      s.lineTo(t, h * 0.5 - t * 0.45);
      s.lineTo(w * 0.82, h * 0.5 - t * 0.45);
      s.lineTo(w * 0.82, h * 0.5 + t * 0.45);
      s.lineTo(t, h * 0.5 + t * 0.45);
      s.lineTo(t, h - t);
      s.lineTo(w, h - t);
      s.lineTo(w, h);
      s.lineTo(0, h);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'Y': {
      const w = 0.74;
      const cx = w / 2;
      s.moveTo(cx - t * 0.5, 0);
      s.lineTo(cx + t * 0.5, 0);
      s.lineTo(cx + t * 0.5, h * 0.46);
      s.lineTo(w, h);
      s.lineTo(w - t * 1.05, h);
      s.lineTo(cx, h * 0.62);
      s.lineTo(t * 1.05, h);
      s.lineTo(0, h);
      s.lineTo(cx - t * 0.5, h * 0.46);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'U': {
      const w = 0.72;
      s.moveTo(0, h);
      s.lineTo(t, h);
      s.lineTo(t, 0.34);
      s.quadraticCurveTo(t, t, w / 2, t);
      s.quadraticCurveTo(w - t, t, w - t, 0.34);
      s.lineTo(w - t, h);
      s.lineTo(w, h);
      s.lineTo(w, 0.34);
      s.quadraticCurveTo(w, 0, w / 2, 0);
      s.quadraticCurveTo(0, 0, 0, 0.34);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'A': {
      const w = 0.76;
      s.moveTo(0, 0);
      s.lineTo(t * 0.95, 0);
      s.lineTo(t * 1.45, 0.28);
      s.lineTo(w - t * 1.45, 0.28);
      s.lineTo(w - t * 0.95, 0);
      s.lineTo(w, 0);
      s.lineTo(w / 2 + t * 0.45, h);
      s.lineTo(w / 2 - t * 0.45, h);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(t * 1.75, 0.44);
      hole.lineTo(w - t * 1.75, 0.44);
      hole.lineTo(w / 2, h - t * 1.15);
      hole.closePath();
      s.holes = [hole];
      return { shapes: [s], width: w };
    }
    case 'R': {
      const w = 0.7;
      s.moveTo(0, 0);
      s.lineTo(t, 0);
      s.lineTo(t, 0.44);
      s.lineTo(w * 0.45, 0.44);
      s.lineTo(w - t * 0.4, 0);
      s.lineTo(w, 0);
      s.lineTo(w * 0.65, 0.47);
      s.quadraticCurveTo(w, 0.54, w, 0.74);
      s.quadraticCurveTo(w, h, w * 0.56, h);
      s.lineTo(0, h);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(t, 0.58);
      hole.lineTo(w * 0.52, 0.58);
      hole.quadraticCurveTo(w - t, 0.58, w - t, 0.73);
      hole.quadraticCurveTo(w - t, h - t * 0.85, w * 0.52, h - t * 0.85);
      hole.lineTo(t, h - t * 0.85);
      hole.closePath();
      s.holes = [hole];
      return { shapes: [s], width: w };
    }
    case 'T': {
      const w = 0.68;
      s.moveTo(w / 2 - t / 2, 0);
      s.lineTo(w / 2 + t / 2, 0);
      s.lineTo(w / 2 + t / 2, h - t);
      s.lineTo(w, h - t);
      s.lineTo(w, h);
      s.lineTo(0, h);
      s.lineTo(0, h - t);
      s.lineTo(w / 2 - t / 2, h - t);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'H': {
      const w = 0.72;
      s.moveTo(0, 0);
      s.lineTo(t, 0);
      s.lineTo(t, 0.42);
      s.lineTo(w - t, 0.42);
      s.lineTo(w - t, 0);
      s.lineTo(w, 0);
      s.lineTo(w, h);
      s.lineTo(w - t, h);
      s.lineTo(w - t, 0.58);
      s.lineTo(t, 0.58);
      s.lineTo(t, h);
      s.lineTo(0, h);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'B': {
      const w = 0.68;
      s.moveTo(0, 0);
      s.lineTo(w * 0.58, 0);
      s.quadraticCurveTo(w, 0, w, 0.26);
      s.quadraticCurveTo(w, 0.48, w * 0.74, 0.52);
      s.quadraticCurveTo(w * 0.95, 0.57, w * 0.95, 0.76);
      s.quadraticCurveTo(w * 0.95, h, w * 0.55, h);
      s.lineTo(0, h);
      s.closePath();

      const hole1 = new THREE.Path();
      hole1.moveTo(t, t * 0.85);
      hole1.lineTo(w * 0.52, t * 0.85);
      hole1.quadraticCurveTo(w - t, t * 0.85, w - t, 0.27);
      hole1.quadraticCurveTo(w - t, 0.44, w * 0.52, 0.44);
      hole1.lineTo(t, 0.44);
      hole1.closePath();

      const hole2 = new THREE.Path();
      hole2.moveTo(t, 0.58);
      hole2.lineTo(w * 0.5, 0.58);
      hole2.quadraticCurveTo(w - t * 1.15, 0.58, w - t * 1.15, 0.73);
      hole2.quadraticCurveTo(w - t * 1.15, h - t * 0.85, w * 0.5, h - t * 0.85);
      hole2.lineTo(t, h - t * 0.85);
      hole2.closePath();

      s.holes = [hole1, hole2];
      return { shapes: [s], width: w };
    }
    case 'S': {
      const w = 0.66;
      s.moveTo(0.05, 0.14);
      s.quadraticCurveTo(0.18, 0, w * 0.52, 0);
      s.quadraticCurveTo(w, 0, w, 0.28);
      s.quadraticCurveTo(w, 0.52, w * 0.52, 0.56);
      s.quadraticCurveTo(t, 0.6, t, 0.74);
      s.quadraticCurveTo(t, h - t * 0.85, w * 0.48, h - t * 0.85);
      s.quadraticCurveTo(w * 0.76, h - t * 0.85, w * 0.88, h - 0.15);
      s.lineTo(w * 0.95, h - 0.03);
      s.quadraticCurveTo(w * 0.78, h, w * 0.46, h);
      s.quadraticCurveTo(0.02, h, 0.02, 0.73);
      s.quadraticCurveTo(0.02, 0.49, w * 0.48, 0.44);
      s.quadraticCurveTo(w - t, 0.4, w - t, 0.26);
      s.quadraticCurveTo(w - t, t * 0.85, w * 0.5, t * 0.85);
      s.quadraticCurveTo(0.22, t * 0.85, 0.1, 0.22);
      s.closePath();
      return { shapes: [s], width: w };
    }
    case 'P': {
      const w = 0.68;
      s.moveTo(0, 0);
      s.lineTo(t, 0);
      s.lineTo(t, 0.42);
      s.lineTo(w * 0.56, 0.42);
      s.quadraticCurveTo(w, 0.42, w, 0.71);
      s.quadraticCurveTo(w, h, w * 0.56, h);
      s.lineTo(0, h);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(t, 0.57);
      hole.lineTo(w * 0.52, 0.57);
      hole.quadraticCurveTo(w - t, 0.57, w - t, 0.71);
      hole.quadraticCurveTo(w - t, h - t * 0.85, w * 0.52, h - t * 0.85);
      hole.lineTo(t, h - t * 0.85);
      hole.closePath();
      s.holes = [hole];
      return { shapes: [s], width: w };
    }
    default:
      return { shapes: [], width: 0.34 };
  }
}

export interface ExtrudedTextResult {
  group: THREE.Group;
  letterMeshes: THREE.Mesh[];
}

export function create3DTextGroup(
  text: string,
  material: THREE.Material,
  scale = 1,
  letterSpacing = 0.14
): ExtrudedTextResult {
  const group = new THREE.Group();
  const letterMeshes: THREE.Mesh[] = [];

  const glyphs = text.toUpperCase().split('');
  let totalWidth = 0;

  glyphs.forEach((ch, idx) => {
    const { width } = buildGlyphShape(ch);
    totalWidth += width + (idx < glyphs.length - 1 ? letterSpacing : 0);
  });

  let cursorX = -totalWidth / 2;

  glyphs.forEach((ch) => {
    const { shapes, width } = buildGlyphShape(ch);
    if (shapes.length > 0) {
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: 0.22,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.03,
        bevelSegments: 3,
        curveSegments: 10,
      });
      geo.translate(-width / 2, -0.5, -0.11);

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(cursorX + width / 2, 0, 0);
      mesh.castShadow = false;
      group.add(mesh);
      letterMeshes.push(mesh);
    }
    cursorX += width + letterSpacing;
  });

  group.scale.setScalar(scale);
  return { group, letterMeshes };
}

/**
 * Generates a soft radial glow sprite texture in memory for celestial flares, dust, and pollen.
 */
export function createSoftGlowTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 248, 235, 0.78)');
  grad.addColorStop(0.55, 'rgba(255, 230, 210, 0.22)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a tasteful placeholder canvas texture for unconfigured memory frames.
 */
export function createMemoryPlaceholderTexture(label: string, sublabel?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#2a1e30');
  grad.addColorStop(0.5, '#3b283f');
  grad.addColorStop(1, '#1f1624');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(255, 205, 178, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 448, 448);

  ctx.strokeStyle = 'rgba(255, 205, 178, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(256, 170);
  ctx.lineTo(256, 230);
  ctx.moveTo(226, 200);
  ctx.lineTo(286, 200);
  ctx.stroke();

  ctx.fillStyle = '#f8edeb';
  ctx.font = '600 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 256, 290);

  if (sublabel) {
    ctx.fillStyle = 'rgba(255, 205, 178, 0.72)';
    ctx.font = '400 17px sans-serif';
    ctx.fillText(sublabel, 256, 330);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
