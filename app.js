/**
 * Main Application & WebGL Planetary Explorer Controller
 * Three.js, GSAP, Web Audio API, and Interactive Storytelling Engine
 */

class SpaceStoryApp {
  constructor() {
    this.currentPlanetKey = 'mars'; // 'mars' or 'moon'
    this.currentRelicIndex = 0;
    this.isDossierOpen = false;
    this.isOrbiting = true;
    this.markers = [];
    this.markerElements = [];

    // Three.js instances
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.planetMesh = null;
    this.atmosphereMesh = null;
    this.sunLight = null;
    this.ambientLight = null;
    this.starField = null;

    // Raycasting & Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    this.setupCustomCursor();
    this.setupScene1Interactions();
    this.initThree();
    this.setupUIEvents();
    this.animate();
    // Safety net: never keep the preloader up longer than a few seconds
    setTimeout(() => this.hidePreloader(), 7000);
  }

  // =========================================================================
  // Custom Cursor & Radial Spotlight Follower
  // =========================================================================
  setupCustomCursor() {
    const dot = document.querySelector('.custom-cursor-dot');
    const ring = document.querySelector('.custom-cursor-ring');
    const spotlight = document.querySelector('.radial-spotlight');

    // Custom cursor only on precise pointers (mouse / trackpad) without reduced-motion preference
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;
    document.body.classList.add('has-custom-cursor');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
      spotlight.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    // Smooth trailing ring physics
    const updateRing = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(updateRing);
    };
    updateRing();

    // Hover magnetic classes
    const interactables = 'button, a, .planet-card, .relic-chip, .marker-pin, .hud-btn, .switcher-pill';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactables)) {
        document.body.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactables)) {
        document.body.classList.remove('cursor-hover');
      }
    });
  }

  // =========================================================================
  // Scene 1: Parallax 3D Card Physics & Selection Transitions
  // =========================================================================
  setupScene1Interactions() {
    const cards = document.querySelectorAll('.planet-card');

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        gsap.to(card, {
          rotationY: x * 16,
          rotationX: -y * 16,
          transformPerspective: 1000,
          ease: 'power2.out',
          duration: 0.4
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotationY: 0,
          rotationX: 0,
          ease: 'power2.out',
          duration: 0.8
        });
      });

      card.addEventListener('mouseenter', () => {
        window.soundEngine.playHover();
      });

      card.addEventListener('click', () => {
        const planet = card.dataset.planet;
        this.selectPlanetAndLaunch(planet);
      });

      // Keyboard activation (cards are focusable role="button")
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectPlanetAndLaunch(card.dataset.planet);
        }
      });
    });
  }

  selectPlanetAndLaunch(planetKey) {
    window.soundEngine.unmute();
    window.soundEngine.playWhoosh();

    const sceneLanding = document.getElementById('scene-landing');
    const sceneExplorer = document.getElementById('scene-explorer');

    // Fade out Scene 1
    gsap.to(sceneLanding, {
      opacity: 0,
      scale: 1.1,
      duration: 1.0,
      ease: 'power3.inOut',
      onComplete: () => {
        sceneLanding.classList.add('hidden');
        sceneExplorer.classList.add('active');
        this.syncControls();
      }
    });

    this.switchPlanet(planetKey, true);
  }

  // =========================================================================
  // Scene 2: Three.js WebGL Engine Initialization
  // =========================================================================
  initThree() {
    const container = document.getElementById('webgl-canvas');

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0.4, 3.2);

    // High-performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: container,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // OrbitControls with Damping & Inertia
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.25;
    this.controls.maxDistance = 5.5;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.enabled = false; // Initially inactive on Scene 1 Landing

    this.controls.addEventListener('start', () => {
      this.isOrbiting = false;
      this.controls.autoRotate = false;
    });

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0x1a2230, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    this.sunLight.position.set(5, 3, 5);
    this.scene.add(this.sunLight);

    // Deep Cosmic Starfield
    this.createStarfield();

    // Planet Object Group
    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    // Initial Planet Setup
    this.createPlanet(this.currentPlanetKey);

    // Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createStarfield() {
    const starCount = 2800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xaad5ff),
      new THREE.Color(0xffe6c2),
      new THREE.Color(0x99bbff)
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  createPlanet(planetKey) {
    // Clear previous planet & atmosphere
    if (this.planetMesh) {
      this.planetGroup.remove(this.planetMesh);
      if (this.planetMesh.geometry) this.planetMesh.geometry.dispose();
      if (this.planetMesh.material) this.planetMesh.material.dispose();
    }
    if (this.atmosphereMesh) {
      this.planetGroup.remove(this.atmosphereMesh);
      if (this.atmosphereMesh.geometry) this.atmosphereMesh.geometry.dispose();
      if (this.atmosphereMesh.material) this.atmosphereMesh.material.dispose();
      this.atmosphereMesh = null;
    }

    const data = RELICS_DATA[planetKey];
    const geometry = new THREE.SphereGeometry(1.0, 64, 64);

    // Initial temporary placeholder material while textures stream
    const tempMat = new THREE.MeshStandardMaterial({
      color: planetKey === 'mars' ? 0x9e3816 : 0x7a7c80,
      roughness: 0.9,
      metalness: 0.05
    });

    this.planetMesh = new THREE.Mesh(geometry, tempMat);
    this.planetGroup.add(this.planetMesh);

    // Load High-Res Texture (+ relief map) with Procedural Fallback
    const meshForThisPlanet = this.planetMesh;
    TextureEngine.loadPlanetTexture(planetKey, ({ map, bump }) => {
      // Ignore late results if the user already switched to the other body
      if (this.planetMesh !== meshForThisPlanet) return;
      const old = meshForThisPlanet.material;
      meshForThisPlanet.material = new THREE.MeshStandardMaterial({
        map,
        bumpMap: bump || null,
        bumpScale: planetKey === 'mars' ? 0.035 : 0.025,
        roughness: planetKey === 'mars' ? 0.85 : 0.95,
        metalness: 0.02
      });
      if (old) old.dispose();
      this.hidePreloader();
    });

    // Mars Atmospheric Scattering Shader Rim
    if (planetKey === 'mars') {
      const atmosGeo = new THREE.SphereGeometry(1.028, 64, 64);
      const atmosMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.8);
            gl_FragColor = vec4(1.0, 0.32, 0.12, 1.0) * intensity * 1.6;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
      });
      this.atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
      this.planetGroup.add(this.atmosphereMesh);
    }

    // Populate Relic Markers
    this.buildRelicMarkers(planetKey);
    this.buildBottomTray(planetKey);
    this.updateHUDStats(planetKey);
  }

  // =========================================================================
  // Relic Markers, Spherical Math & Screen Projection
  // =========================================================================
  latLonToVector3(lat, lon, radius = 1.018) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));

    return new THREE.Vector3(x, y, z);
  }

  buildRelicMarkers(planetKey) {
    // Clear old DOM markers
    const markerContainer = document.getElementById('markers-container');
    markerContainer.innerHTML = '';
    this.markers = [];
    this.markerElements = [];

    const relics = RELICS_DATA[planetKey].relics;
    const themeClass = planetKey === 'mars' ? 'mars-theme' : 'moon-theme';

    relics.forEach((relic, idx) => {
      const pos = this.latLonToVector3(relic.coords.lat, relic.coords.lon);

      // Create DOM Marker Pin
      const pin = document.createElement('div');
      pin.className = `marker-pin ${themeClass}`;
      pin.dataset.id = relic.id;
      pin.dataset.index = idx;

      pin.innerHTML = `
        <div class="marker-beacon">
          <div class="marker-pulse"></div>
          <div class="marker-pulse"></div>
          <div class="marker-core"></div>
        </div>
        <div class="marker-label">${relic.title}</div>
      `;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusOnRelic(idx);
      });

      pin.addEventListener('mouseenter', () => {
        window.soundEngine.playHover();
      });

      markerContainer.appendChild(pin);

      this.markers.push({
        id: relic.id,
        index: idx,
        data: relic,
        worldPos: pos,
        element: pin
      });
    });
  }

  updateMarkerPositions() {
    if (!this.markers.length || !this.camera) return;

    const cameraPos = this.camera.position.clone();

    this.markers.forEach((marker) => {
      // Calculate planet rotation offset if planet rotates
      const worldPos = marker.worldPos.clone().applyEuler(this.planetGroup.rotation);
      
      // Occlusion test: dot product with camera normal
      const normal = worldPos.clone().normalize();
      const camDir = cameraPos.clone().sub(worldPos).normalize();
      const dot = normal.dot(camDir);

      if (dot < 0.05) {
        // Behind the horizon of the sphere
        marker.element.classList.add('occluded');
      } else {
        marker.element.classList.remove('occluded');
      }

      // Project 3D vector to 2D Screen Space
      const screenPos = worldPos.project(this.camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

      marker.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
  }

  // =========================================================================
  // Cinematic Camera Fly-To & Relic Dossier Display
  // =========================================================================
  focusOnRelic(index) {
    const relic = RELICS_DATA[this.currentPlanetKey].relics[index];
    if (!relic) return;

    this.currentRelicIndex = index;
    window.soundEngine.playWhoosh();
    window.soundEngine.playScanChirp();

    // Disable auto orbit during inspection
    this.controls.autoRotate = false;

    // Calculate destination camera position
    const targetVector = this.latLonToVector3(relic.coords.lat, relic.coords.lon, 1.0)
      .applyEuler(this.planetGroup.rotation);

    const cameraDest = targetVector.clone().normalize().multiplyScalar(1.55);

    // Smooth GSAP Camera Fly-To
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);

    gsap.to(this.camera.position, {
      x: cameraDest.x,
      y: cameraDest.y + 0.08,
      z: cameraDest.z,
      duration: 1.8,
      ease: 'power3.inOut'
    });

    gsap.to(this.controls.target, {
      x: targetVector.x,
      y: targetVector.y,
      z: targetVector.z,
      duration: 1.8,
      ease: 'power3.inOut',
      onComplete: () => {
        this.openDossierModal(relic);
      }
    });

    // Update Bottom Tray Highlight
    this.highlightTrayCard(index);
  }

  openDossierModal(relic) {
    this.isDossierOpen = true;
    if (this.controls) this.controls.enabled = false;
    const modal = document.getElementById('relic-dossier-modal');

    // Reset Tabs to Story Tab & Reset Scroll to Top
    this.switchDossierTab('story');
    const dossierBody = document.querySelector('.dossier-body');
    if (dossierBody) dossierBody.scrollTop = 0;

    // Populate data fields
    document.getElementById('dossier-agency-tag').textContent = `${relic.agency} • ${relic.year}`;
    document.getElementById('dossier-site-tag').textContent = relic.site;
    document.getElementById('dossier-title').textContent = relic.title;
    document.getElementById('dossier-date-val').textContent = relic.date;
    document.getElementById('dossier-coords-val').textContent = relic.displayCoords;
    document.getElementById('dossier-mass-val').textContent = relic.mass;
    document.getElementById('dossier-mission-val').textContent = relic.mission;
    document.getElementById('dossier-story-p').textContent = relic.story;
    document.getElementById('dossier-quote-text').textContent = `“${relic.quote}”`;
    document.getElementById('dossier-credit').textContent = relic.credit ? `Image: ${relic.credit}` : '';
    document.getElementById('dossier-counter').textContent =
      `${String(this.currentRelicIndex + 1).padStart(2, '0')} / ${String(RELICS_DATA[this.currentPlanetKey].relics.length).padStart(2, '0')}`;

    // Populate Geologic & Environmental Analysis fields
    document.getElementById('dossier-elevation-val').textContent = relic.elevation || 'Surface elevation pending surveyor lidar';
    document.getElementById('dossier-geology-p').textContent = relic.geology || 'Geologic data recorded by orbital spectrometry.';
    document.getElementById('dossier-environment-p').textContent = relic.environment || 'Environmental parameters unavailable.';

    // Populate photo (local asset; thumbnail shows instantly while full image loads)
    const imgDiv = document.getElementById('dossier-image-target');
    imgDiv.style.backgroundImage = `url('${relic.photo}'), url('${relic.thumb}')`;
    imgDiv.setAttribute('aria-label', relic.title);

    // Populate artifacts pills
    const artList = document.getElementById('dossier-artifacts-list');
    artList.innerHTML = '';
    relic.artifacts.forEach((art) => {
      const pill = document.createElement('span');
      pill.className = 'artifact-pill';
      pill.textContent = art;
      artList.appendChild(pill);
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('dossier-close-x').focus({ preventScroll: true });
  }

  switchDossierTab(tabKey) {
    const btnStory = document.getElementById('tab-btn-story');
    const btnGeology = document.getElementById('tab-btn-geology');
    const paneStory = document.getElementById('dossier-tab-story-content');
    const paneGeology = document.getElementById('dossier-tab-geology-content');
    const dossierBody = document.querySelector('.dossier-body');

    const isStory = tabKey === 'story';
    btnStory.classList.toggle('active', isStory);
    btnGeology.classList.toggle('active', !isStory);
    btnStory.setAttribute('aria-selected', String(isStory));
    btnGeology.setAttribute('aria-selected', String(!isStory));
    paneStory.hidden = !isStory;
    paneGeology.hidden = isStory;

    if (dossierBody) dossierBody.scrollTop = 0;
  }

  // =========================================================================
  // Planetary Science & Geologic Compendium Modal
  // =========================================================================
  openPlanetSpecsModal() {
    const data = RELICS_DATA[this.currentPlanetKey];
    if (!data || !data.specs) return;
    if (this.controls) this.controls.enabled = false;

    window.soundEngine.playScanChirp();

    const modal = document.getElementById('planet-specs-modal');
    document.getElementById('specs-body-badge').textContent = `${data.name.toUpperCase()} // ASTROPHYSICAL & STRATIGRAPHIC DOSSIER`;
    document.getElementById('specs-planet-title').textContent = `${data.name} Planetary Compendium`;
    document.getElementById('specs-planet-subtitle').textContent = `Full scientific profile, atmospheric composition, and geological evolutionary epochs.`;

    // Populate Physical Metrics
    const s = data.specs;
    document.getElementById('spec-val-diameter').textContent = s.diameter;
    document.getElementById('spec-val-mass').textContent = s.mass;
    document.getElementById('spec-val-density').textContent = s.density;
    document.getElementById('spec-val-escape').textContent = s.escapeVelocity;
    document.getElementById('spec-val-distance').textContent = s.solarDistance || s.distanceFromEarth;
    document.getElementById('spec-val-orbit').textContent = s.orbitalPeriod;
    document.getElementById('spec-val-tilt').textContent = s.axialTilt;
    document.getElementById('spec-val-pressure').textContent = s.surfacePressure;
    document.getElementById('spec-val-temprange').textContent = s.tempRange;

    // Populate Gas Breakdown Bars
    const gasContainer = document.getElementById('specs-gas-bars');
    gasContainer.innerHTML = '';
    // Bars: true percentages when given in %, otherwise scaled relative to the largest value
    const parseVal = (str) => parseFloat(String(str).replace(/,/g, '')) || 0;
    const isPct = s.atmosphereGases.every((g) => String(g.pct).includes('%'));
    const maxVal = Math.max(...s.atmosphereGases.map((g) => parseVal(g.pct)), 1);
    s.atmosphereGases.forEach((gas) => {
      const row = document.createElement('div');
      row.className = 'gas-row';
      const pctNum = isPct ? parseVal(gas.pct) : (parseVal(gas.pct) / maxVal) * 100;
      row.innerHTML = `
        <div class="gas-label-row">
          <span>${gas.name}</span>
          <span style="color: ${gas.color}; font-weight: 600;">${gas.pct}</span>
        </div>
        <div class="gas-progress-track">
          <div class="gas-progress-fill" style="width: ${Math.max(4, Math.min(100, pctNum))}%; background-color: ${gas.color};"></div>
        </div>
      `;
      gasContainer.appendChild(row);
    });

    // Populate Geological Epochs
    const epochsContainer = document.getElementById('specs-epochs-container');
    epochsContainer.innerHTML = '';
    s.geologicalEpochs.forEach((ep) => {
      const card = document.createElement('div');
      card.className = 'epoch-item';
      card.innerHTML = `
        <span class="epoch-tag">${ep.tag}</span>
        <h4 class="epoch-title">${ep.name}</h4>
        <p class="epoch-desc">${ep.desc}</p>
      `;
      epochsContainer.appendChild(card);
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('specs-close-x').focus({ preventScroll: true });
  }

  // Re-enable globe controls only when no overlay is open and the explorer is visible
  syncControls() {
    if (!this.controls) return;
    const anyOpen = document.querySelector('#relic-dossier-modal.open, #planet-specs-modal.open, #missions-roster-modal.open');
    const explorerActive = document.getElementById('scene-explorer').classList.contains('active');
    this.controls.enabled = !anyOpen && explorerActive;
  }

  closePlanetSpecsModal() {
    const modal = document.getElementById('planet-specs-modal');
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    this.syncControls();
    window.soundEngine.playClick();
  }

  closeDossierModal() {
    const modal = document.getElementById('relic-dossier-modal');
    const wasOpen = modal.classList.contains('open');
    this.isDossierOpen = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    this.syncControls();
    if (wasOpen) window.soundEngine.playClick();
  }

  nextRelic() {
    const relics = RELICS_DATA[this.currentPlanetKey].relics;
    const nextIdx = (this.currentRelicIndex + 1) % relics.length;
    this.closeDossierModal();
    this.focusOnRelic(nextIdx);
  }

  prevRelic() {
    const relics = RELICS_DATA[this.currentPlanetKey].relics;
    const prevIdx = (this.currentRelicIndex - 1 + relics.length) % relics.length;
    this.closeDossierModal();
    this.focusOnRelic(prevIdx);
  }

  resetOrbitView() {
    window.soundEngine.playClick();
    this.closeDossierModal();

    gsap.to(this.camera.position, {
      x: 0,
      y: 0.4,
      z: 3.2,
      duration: 1.6,
      ease: 'power3.inOut'
    });

    gsap.to(this.controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.6,
      ease: 'power3.inOut',
      onComplete: () => {
        this.controls.autoRotate = true;
      }
    });
  }

  // =========================================================================
  // Planet Switching (Mars ⇄ Moon)
  // =========================================================================
  switchPlanet(planetKey, isInitial = false) {
    if (this.currentPlanetKey === planetKey && !isInitial) return;

    this.currentPlanetKey = planetKey;
    this.currentRelicIndex = 0;
    this.closeDossierModal();

    if (!isInitial) {
      window.soundEngine.playClick();
      window.soundEngine.playWhoosh();
    }

    // Update Pill Buttons
    document.querySelectorAll('.switcher-pill').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-switch-${planetKey}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Camera animation during planet transition
    gsap.to(this.planetGroup.scale, {
      x: 0.001,
      y: 0.001,
      z: 0.001,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        this.createPlanet(planetKey);
        this.resetOrbitView();

        const specsModal = document.getElementById('planet-specs-modal');
        if (specsModal && specsModal.classList.contains('open')) {
          this.openPlanetSpecsModal();
        }

        gsap.to(this.planetGroup.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.8,
          ease: 'power2.out'
        });
      }
    });
  }

  // =========================================================================
  // UI & HUD Sync Helpers
  // =========================================================================
  buildBottomTray(planetKey) {
    const container = document.getElementById('tray-carousel-target');
    container.innerHTML = '';

    const relics = RELICS_DATA[planetKey].relics;
    document.getElementById('tray-relic-count').textContent = relics.length;

    relics.forEach((relic, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'relic-chip';
      chip.setAttribute('aria-label', `${relic.title} — ${relic.agency}, ${relic.year}`);
      chip.dataset.index = idx;
      chip.id = `relic-chip-${idx}`;

      chip.innerHTML = `
        <div class="relic-chip-thumb" style="background-image: url('${relic.thumb}');"></div>
        <div class="relic-chip-info">
          <span class="relic-chip-mission">${relic.year} • ${relic.agency}</span>
          <h4 class="relic-chip-title">${relic.title}</h4>
          <span class="relic-chip-coords">${relic.displayCoords}</span>
        </div>
      `;

      chip.addEventListener('click', () => {
        this.focusOnRelic(idx);
      });

      chip.addEventListener('mouseenter', () => {
        window.soundEngine.playHover();
      });

      container.appendChild(chip);
    });

    // Arrow controls for horizontal scrolling
    const leftBtn = document.getElementById('tray-arrow-left');
    const rightBtn = document.getElementById('tray-arrow-right');
    if (leftBtn) {
      leftBtn.onclick = () => {
        container.scrollBy({ left: -320, behavior: 'smooth' });
        window.soundEngine.playClick();
      };
    }
    if (rightBtn) {
      rightBtn.onclick = () => {
        container.scrollBy({ left: 320, behavior: 'smooth' });
        window.soundEngine.playClick();
      };
    }

    // Convert mouse wheel into smooth horizontal scroll
    container.onwheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 1.5;
      }
    };
  }

  // =========================================================================
  // All Missions Roster Modal (Fully Scrollable Grid View)
  // =========================================================================
  openMissionsRosterModal() {
    const data = RELICS_DATA[this.currentPlanetKey];
    const modal = document.getElementById('missions-roster-modal');
    document.getElementById('roster-body-badge').textContent = `${data.name.toUpperCase()} // ALL ${data.relics.length} CATALOGUED RELIC SITES`;
    document.getElementById('roster-planet-title').textContent = `${data.name} Historical Equipment Directory`;

    const grid = document.getElementById('roster-grid-target');
    grid.innerHTML = '';
    data.relics.forEach((relic, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'roster-card';
      card.innerHTML = `
        <div class="roster-card-img" style="background-image: url('${relic.thumb}');"></div>
        <div class="roster-card-content">
          <span class="roster-card-tag">${relic.agency} • ${relic.year}</span>
          <h4 class="roster-card-title">${relic.title}</h4>
          <span class="roster-card-coords">${relic.displayCoords}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        this.closeMissionsRosterModal();
        this.focusOnRelic(idx);
      });
      grid.appendChild(card);
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    this.syncControls();
    document.getElementById('roster-close-x').focus({ preventScroll: true });
    window.soundEngine.playScanChirp();
  }

  closeMissionsRosterModal() {
    const modal = document.getElementById('missions-roster-modal');
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    this.syncControls();
    window.soundEngine.playClick();
  }

  hidePreloader() {
    const pre = document.getElementById('preloader');
    if (!pre || pre.classList.contains('done')) return;
    pre.classList.add('done');
    setTimeout(() => pre.remove(), 900);
  }

  highlightTrayCard(index) {
    document.querySelectorAll('.relic-chip').forEach(c => c.classList.remove('selected'));
    const selected = document.getElementById(`relic-chip-${index}`);
    if (selected) {
      selected.classList.add('selected');
      selected.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  updateHUDStats(planetKey) {
    const data = RELICS_DATA[planetKey];
    document.getElementById('hud-brand-planet').textContent = `${data.name.toUpperCase()} RECON`;
    document.getElementById('hud-planet-name-val').textContent = data.name;
    document.getElementById('hud-gravity-val').textContent = data.gravity;
    document.getElementById('hud-day-val').textContent = data.dayLength;
    document.getElementById('hud-atmos-val').textContent = data.atmosphere;
    document.getElementById('hud-temp-val').textContent = data.avgTemp;
    document.getElementById('hud-sites-val').textContent = `${data.relics.length} sites`;
  }

  setupUIEvents() {
    // Switcher buttons
    document.getElementById('btn-switch-mars').addEventListener('click', () => this.switchPlanet('mars'));
    document.getElementById('btn-switch-moon').addEventListener('click', () => this.switchPlanet('moon'));

    // Audio toggle button
    const audioBtn = document.getElementById('btn-audio-toggle');
    audioBtn.addEventListener('click', () => {
      const isUnmuted = window.soundEngine.toggleMute();
      audioBtn.classList.toggle('active', isUnmuted);
      document.getElementById('audio-status-label').textContent = isUnmuted ? 'AUDIO ON' : 'AUDIO OFF';
    });

    // Reset View button
    document.getElementById('btn-reset-view').addEventListener('click', () => this.resetOrbitView());

    // Back to Intro / Selection
    document.getElementById('hud-brand-btn').addEventListener('click', () => {
      window.soundEngine.playClick();
      const sceneLanding = document.getElementById('scene-landing');
      const sceneExplorer = document.getElementById('scene-explorer');
      this.closeDossierModal();
      this.closePlanetSpecsModal();
      this.closeMissionsRosterModal();
      sceneExplorer.classList.remove('active');
      sceneLanding.classList.remove('hidden');
      this.syncControls();
      gsap.to(sceneLanding, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' });
    });

    // Click on the dimmed backdrop (outside the window) closes any overlay
    [
      ['relic-dossier-modal', () => this.closeDossierModal()],
      ['planet-specs-modal', () => this.closePlanetSpecsModal()],
      ['missions-roster-modal', () => this.closeMissionsRosterModal()]
    ].forEach(([id, close]) => {
      const el = document.getElementById(id);
      el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
    });

    // "Scroll to read" hint scrolls the dossier body
    const hint = document.getElementById('dossier-scroll-hint');
    if (hint) {
      hint.addEventListener('click', () => {
        const body = document.querySelector('.dossier-body');
        body.scrollBy({ top: body.clientHeight * 0.7, behavior: 'smooth' });
      });
    }

    // Planetary Specs Modal Toggle
    document.getElementById('btn-planet-specs').addEventListener('click', () => this.openPlanetSpecsModal());
    document.getElementById('specs-close-x').addEventListener('click', () => this.closePlanetSpecsModal());

    // All Missions Roster Grid Toggle
    const rosterBtn = document.getElementById('btn-toggle-roster');
    if (rosterBtn) rosterBtn.addEventListener('click', () => this.openMissionsRosterModal());
    const rosterCloseX = document.getElementById('roster-close-x');
    if (rosterCloseX) rosterCloseX.addEventListener('click', () => this.closeMissionsRosterModal());

    // Dossier Tab Switchers
    document.getElementById('tab-btn-story').addEventListener('click', () => this.switchDossierTab('story'));
    document.getElementById('tab-btn-geology').addEventListener('click', () => this.switchDossierTab('geology'));

    // Modal Dossier Controls
    document.getElementById('dossier-close-x').addEventListener('click', () => this.closeDossierModal());
    document.getElementById('dossier-prev-btn').addEventListener('click', () => this.prevRelic());
    document.getElementById('dossier-next-btn').addEventListener('click', () => this.nextRelic());
    document.getElementById('dossier-orbit-btn').addEventListener('click', () => this.resetOrbitView());

    // Keyboard navigation (Esc to close dossier, specs, or roster, Left/Right for relics)
    window.addEventListener('keydown', (e) => {
      const specsModal = document.getElementById('planet-specs-modal');
      const rosterModal = document.getElementById('missions-roster-modal');
      if (e.key === 'Escape') {
        if (rosterModal && rosterModal.classList.contains('open')) {
          this.closeMissionsRosterModal();
        } else if (specsModal && specsModal.classList.contains('open')) {
          this.closePlanetSpecsModal();
        } else if (this.isDossierOpen) {
          this.closeDossierModal();
        }
      } else if (e.key === 'ArrowRight' && this.isDossierOpen) {
        this.nextRelic();
      } else if (e.key === 'ArrowLeft' && this.isDossierOpen) {
        this.prevRelic();
      }
    });
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // =========================================================================
  // Main Animation Loop (60 FPS)
  // =========================================================================
  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    // Subtle starfield twinkling and drift
    if (this.starField) {
      this.starField.rotation.y += 0.00015;
    }

    // Update 3D Markers Screen Coordinates
    this.updateMarkerPositions();

    // Audio Visualizer Equalizer Simulation
    const audioData = window.soundEngine.getFrequencyData();
    if (!this.audioBars) this.audioBars = document.querySelectorAll('.audio-bar');
    const bars = this.audioBars;
    if (bars.length) {
      bars.forEach((bar, i) => {
        if (audioData) {
          const val = (audioData[i * 4] || 20) / 255;
          bar.style.height = `${Math.max(3, val * 16)}px`;
        } else {
          bar.style.height = '3px';
        }
      });
    }

    // Render WebGL
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Instantiate on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SpaceStoryApp();
});

