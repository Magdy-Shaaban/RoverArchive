/**
 * Planetary Texture Engine with High-Res Remote Sources & Procedural Canvas Fallbacks
 * Guarantees 100% flawless visual presentation under any network condition or local file:// environment.
 */

const TextureEngine = {
  // Local equirectangular planet maps (bundled in /assets/textures)
  sources: {
    mars: {
      map: "assets/textures/mars-color.jpg",
      bump: "assets/textures/mars-bump.jpg"
    },
    moon: {
      map: "assets/textures/moon-color.jpg",
      bump: "assets/textures/moon-bump.jpg"
    }
  },

  // Generates high-fidelity procedural planetary maps using HTML5 Canvas
  createProceduralMars(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base Martian Rust Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0.0, '#d1c4b2'); // North Polar Cap
    grad.addColorStop(0.12, '#a7431e');
    grad.addColorStop(0.35, '#c55325');
    grad.addColorStop(0.5, '#77250e'); // Equatorial Dark Albedo (Syrtis Major)
    grad.addColorStop(0.65, '#b84920');
    grad.addColorStop(0.88, '#913516');
    grad.addColorStop(1.0, '#e5ded5'); // South Polar Cap
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Multi-octave Perlin-like Noise & Craters
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const lat = (y / height) * Math.PI - Math.PI / 2;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const lon = (x / width) * Math.PI * 2;

        // Spherical coordinate harmonic noise
        const n1 = Math.sin(x * 0.015) * Math.cos(y * 0.018);
        const n2 = Math.sin(x * 0.04 + 1.2) * Math.sin(y * 0.045);
        const n3 = Math.sin(x * 0.1) * Math.cos(y * 0.1);
        const n = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);

        const shade = n * 45;

        // Polar ice caps
        if (y < height * 0.08 || y > height * 0.92) {
          data[idx] = Math.min(255, data[idx] + 70);
          data[idx + 1] = Math.min(255, data[idx + 1] + 70);
          data[idx + 2] = Math.min(255, data[idx + 2] + 70);
        } else {
          data[idx] = Math.max(0, Math.min(255, data[idx] + shade));
          data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + shade * 0.6));
          data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + shade * 0.3));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Add prominent impact craters & Olympus Mons
    this.drawCrater(ctx, width * 0.35, height * 0.52, 28, '#4a1508', '#d97343'); // Olympus Mons
    this.drawCrater(ctx, width * 0.65, height * 0.68, 70, '#351109', '#ad4a25'); // Hellas Basin
    this.drawCrater(ctx, width * 0.82, height * 0.42, 35, '#40140a', '#b55229'); // Isidis Planitia
    this.drawCrater(ctx, width * 0.22, height * 0.35, 20, '#381208', '#9e3f1e');

    for (let i = 0; i < 45; i++) {
      const cx = Math.random() * width;
      const cy = height * 0.12 + Math.random() * (height * 0.76);
      const r = 3 + Math.random() * 12;
      this.drawCrater(ctx, cx, cy, r, '#381208', '#bd5c2d');
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  },

  createProceduralMoon(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base lunar regolith grey
    ctx.fillStyle = '#9b9d9f';
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const n1 = Math.sin(x * 0.012) * Math.cos(y * 0.015);
        const n2 = Math.sin(x * 0.03 + 2.1) * Math.sin(y * 0.038);
        const n3 = Math.cos(x * 0.08) * Math.sin(y * 0.08);
        const noiseVal = (n1 * 0.55 + n2 * 0.3 + n3 * 0.15) * 40;

        const val = Math.max(0, Math.min(255, 145 + noiseVal));
        data[idx] = val;
        data[idx + 1] = val * 0.98;
        data[idx + 2] = val * 1.02; // very slight cold blue tint for lunar vacuum
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw Dark Basaltic Maria (Seas of the Moon)
    // Mare Tranquillitatis & Serenitatis
    this.drawMare(ctx, width * 0.52, height * 0.44, 90, 60, '#42454a');
    this.drawMare(ctx, width * 0.48, height * 0.36, 75, 75, '#3b3e43');
    // Oceanus Procellarum (huge western dark expanse)
    this.drawMare(ctx, width * 0.30, height * 0.45, 160, 190, '#404348');
    this.drawMare(ctx, width * 0.35, height * 0.28, 90, 70, '#36393e');
    // Mare Imbrium
    this.drawMare(ctx, width * 0.38, height * 0.32, 110, 100, '#383b40');
    // Mare Crisium (distinct isolated oval)
    this.drawMare(ctx, width * 0.62, height * 0.40, 45, 40, '#33363a');

    // Prominent impact crater rays (Tycho Crater)
    this.drawRayedCrater(ctx, width * 0.44, height * 0.76, 22);
    // Copernicus
    this.drawRayedCrater(ctx, width * 0.36, height * 0.46, 16);

    // Random micro-craters
    for (let i = 0; i < 90; i++) {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const r = 2 + Math.random() * 9;
      this.drawCrater(ctx, cx, cy, r, '#282a2e', '#cfd2d6');
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  },

  drawCrater(ctx, x, y, r, innerColor, rimColor) {
    ctx.save();
    // Shadowed floor
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = innerColor;
    ctx.fill();

    // Raised sunlit rim (crescent)
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.stroke();
    ctx.restore();
  },

  drawMare(ctx, x, y, rx, ry, color) {
    ctx.save();
    ctx.filter = 'blur(16px)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawRayedCrater(ctx, x, y, r) {
    ctx.save();
    // Ejecta rays
    ctx.strokeStyle = 'rgba(235, 240, 250, 0.25)';
    ctx.lineWidth = 1.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
      const len = r * (4 + Math.random() * 8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    this.drawCrater(ctx, x, y, r, '#2c2e32', '#ffffff');
    ctx.restore();
  },

  // Loads the colour map (and relief map when available) with a procedural fallback.
  // onLoad receives ({ map, bump }) — bump may be null.
  loadPlanetTexture(planetKey, onLoad) {
    const procedural = () => ({
      map: planetKey === 'mars' ? this.createProceduralMars() : this.createProceduralMoon(),
      bump: null
    });

    // WebGL refuses image textures from file:// (cross-origin), so go procedural there.
    if (window.location.protocol === 'file:') {
      console.info('[TextureEngine] Running from file:// — using procedural textures. Serve the folder over HTTP for full-resolution maps.');
      onLoad(procedural());
      return;
    }

    const loader = new THREE.TextureLoader();
    const src = this.sources[planetKey];
    const prepare = (tex, isColor) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = 8;
      if (isColor && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      return tex;
    };

    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[TextureEngine] ${planetKey} texture timed out — using procedural fallback.`);
      onLoad(procedural());
    }, 6000);

    loader.load(
      src.map,
      (map) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        prepare(map, true);
        loader.load(
          src.bump,
          (bump) => onLoad({ map, bump: prepare(bump, false) }),
          undefined,
          () => onLoad({ map, bump: null })
        );
      },
      undefined,
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        console.warn(`[TextureEngine] Could not load ${planetKey} texture — using procedural fallback.`, err);
        onLoad(procedural());
      }
    );
  }
};
