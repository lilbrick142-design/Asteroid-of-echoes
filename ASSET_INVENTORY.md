# Asset Inventory — Asteroid of Echoes

All external 3D models and PBR texture sets are sourced from **Poly Haven** (`https://polyhaven.com`), hosted locally inside `/public/assets/`, and licensed under **CC0 1.0 Universal (Public Domain Dedication)** — zero hotlinking and zero runtime external network dependencies.

## 3D Models (1K GLTF + Binary + PBR Maps)

| Asset Name | Poly Haven ID | Licence | Local File Location | Polycount (Tris) | Where Used | Performance Considerations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Moon Rock 02 | `moon_rock_02` | CC0 1.0 | `/public/assets/models/moon_rock_02/moon_rock_02_1k.gltf` | 6,194 | Asteroid perimeter boulders, floating space boulders, celestial garden rock islands | Cached once via `assetManager`; rendered via `THREE.InstancedMesh` / pooled clones with shared geometry and material |
| Moon Rock 03 | `moon_rock_03` | CC0 1.0 | `/public/assets/models/moon_rock_03/moon_rock_03_1k.gltf` | 10,492 | Asteroid surface crags and orbital boulder accents | Cached once; shared geometry & 1K JPEG textures (`diff`, `nor_gl`, `arm`) |
| Empodium Flower | `flower_empodium` | CC0 1.0 | `/public/assets/models/flower_empodium/flower_empodium_1k.gltf` | 5,820 | Celestial Garden (`My Love Mine All Mine`) wildflower clusters & floating flower islands | Cached once; instanced/cloned sparingly (10–14 clusters) alongside procedural blooming rose rigs |
| Woodland Fern 02 | `fern_02` | CC0 1.0 | `/public/assets/models/fern_02/fern_02_1k.gltf` | 6,232 | Celestial Garden foliage & floating island undergrowth | Cached once; shared geometry/material across floating islands & rock crevices |
| Sorrel Ground Shrub 01 | `shrub_sorrel_01` | CC0 1.0 | `/public/assets/models/shrub_sorrel_01/shrub_sorrel_01_1k.gltf` | 3,319 | Asteroid perimeter moss & Celestial Garden/Heather ground cover | Low polycount (3.3k tris); ideal for lightweight organic groundcover |

## PBR Surface Texture Sets (1K JPEG: Diffuse, OpenGL Normal, Roughness)

| Asset Name | Poly Haven ID | Licence | Local File Location | Where Used | Performance Considerations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Lunar Regolith 01 | `moon_01` | CC0 1.0 | `/public/assets/textures/moon_01/` | Distant Moon hero mesh, cratered orbital boulders | 1K JPEG maps (`diff` in sRGB, `nor_gl` & `rough` linear), anisotropic filtering capped by GPU capability |
| Dark Basalt Rock 02 | `dark_rock_02` | CC0 1.0 | `/public/assets/textures/dark_rock_02/` | Main Asteroid island surface & rising bridge stones | Tiled `4x4` with `RepeatWrapping`; paired with vertex mineral veins & normal relief |

## Procedural & Custom Shader Assets (Zero-Dependency In-Code)

- **Multi-Tier Parametric Botanical Roses** (`src/experiences/utils/proceduralShapes.ts`): 3 varieties (Velvet Crimson Damask, Blush Champagne Tea Rose, Celestial Lavender-Gold Hybrid) with 4 unfolding petal tiers (18–22 curved spooned petals), curved `TubeGeometry` stems, serrated veined leaves, thorns, and SSS-inspired backlit `onBeforeCompile` translucency.
- **Living High-Resolution ASCII Atlas & Sobel Edge Shader** (`src/experiences/AsciiWorldExperience.ts`): 32-glyph density + directional edge (`| - / \`) `CanvasTexture` atlas and custom GPU `ShaderPass` with High/Balanced/Performance cell presets.
- **Astrophysical Shaders** (`CosmicDanceExperience.ts`, `StarTributeExperience.ts`, `LavenderDreamExperience.ts`, `CelestialEnvironmentSystem.ts`): GLSL FBM swirling nebulae, twinkling multi-spectral starfield, accretion streams, plasma convection stellar photospheres, expanding planetary nebula ion shells, relativistic pulsar beams, and gravitational-wave ripple rings.
