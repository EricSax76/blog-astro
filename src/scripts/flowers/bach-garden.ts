import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type Flower = {
  id: number;
  slug: string;
  name: string;
  botanical: string;
  emotionalGroup: string;
  desc: string;
  positiveState: string;
  img: string;
};

type EmotionalGroup = { slug: string; label: string; description: string; color: string };
type GardenData = { flowers: Flower[]; groups: EmotionalGroup[] };
type DayPeriodKey = "dawn" | "day" | "dusk" | "night";
type DayPeriod = {
  key: DayPeriodKey;
  label: string;
  fog: number;
  clear: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sun: number;
  sunIntensity: number;
  exposure: number;
  surface: number;
  surfaceVeil: number;
  contour: number;
  contourOpacity: number;
  stem: number;
  leaf: number;
  dust: number;
  dustOpacity: number;
};

const DAY_PERIODS: Record<DayPeriodKey, DayPeriod> = {
  dawn: {
    key: "dawn",
    label: "Amanece",
    fog: 0xe6dcc8,
    clear: 0xece2cf,
    hemiSky: 0xfff3dd,
    hemiGround: 0xb3ab92,
    hemiIntensity: 1.15,
    sun: 0xf2c489,
    sunIntensity: 1.85,
    exposure: 1.06,
    surface: 0xafab8e,
    surfaceVeil: 0xc9c1a3,
    contour: 0x6a644c,
    contourOpacity: 0.15,
    stem: 0x5f6c55,
    leaf: 0x6e7a60,
    dust: 0xa8905e,
    dustOpacity: 0.2,
  },
  day: {
    key: "day",
    label: "Luz tranquila",
    fog: 0xe2e2d2,
    clear: 0xe9e8da,
    hemiSky: 0xfdfcf3,
    hemiGround: 0xacb598,
    hemiIntensity: 1.2,
    sun: 0xfff4da,
    sunIntensity: 1.7,
    exposure: 1.1,
    surface: 0xa9b296,
    surfaceVeil: 0xc5cbb0,
    contour: 0x59654e,
    contourOpacity: 0.16,
    stem: 0x5c7055,
    leaf: 0x6b7e62,
    dust: 0x94906b,
    dustOpacity: 0.22,
  },
  dusk: {
    key: "dusk",
    label: "Cae la tarde",
    fog: 0xc9ae92,
    clear: 0xcfb59a,
    hemiSky: 0xf7dcba,
    hemiGround: 0x8d7862,
    hemiIntensity: 1.25,
    sun: 0xefae6d,
    sunIntensity: 1.7,
    exposure: 1.02,
    surface: 0x9c9074,
    surfaceVeil: 0xb7a887,
    contour: 0x5c503c,
    contourOpacity: 0.14,
    stem: 0x5d6450,
    leaf: 0x6c745a,
    dust: 0xbb8f55,
    dustOpacity: 0.18,
  },
  night: {
    key: "night",
    label: "Noche serena",
    fog: 0x131a23,
    clear: 0x111821,
    hemiSky: 0xb9c2c8,
    hemiGround: 0x11161e,
    hemiIntensity: 1.25,
    sun: 0xaeb8bd,
    sunIntensity: 1.05,
    exposure: 0.9,
    surface: 0x555f68,
    surfaceVeil: 0x747d84,
    contour: 0xc2c9ca,
    contourOpacity: 0.085,
    stem: 0x4f5a56,
    leaf: 0x5d6762,
    dust: 0x9fa39a,
    dustOpacity: 0.1,
  },
};

const getDayPeriod = (date = new Date()): DayPeriod => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 10) return DAY_PERIODS.dawn;
  if (hour >= 10 && hour < 18) return DAY_PERIODS.day;
  if (hour >= 18 && hour < 22) return DAY_PERIODS.dusk;
  return DAY_PERIODS.night;
};

const softenColor = (color: THREE.Color) => {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(hsl.s * 0.72, 0.4), Math.min(0.66, hsl.l * 0.9 + 0.05));
  return color;
};

const createContourGeometry = (radiusX: number, radiusZ: number, seed: number) => {
  const points: THREE.Vector3[] = [];
  const segments = 168;
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const softNoise = 1 + Math.sin(angle * 3 + seed) * 0.035 + Math.cos(angle * 5 - seed * 0.7) * 0.022;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX * softNoise, 0.018, Math.sin(angle) * radiusZ * softNoise));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
};

const root = document.querySelector<HTMLElement>("[data-bach-garden]");
const dataNode = document.querySelector<HTMLScriptElement>("#bach-garden-data");

if (root && dataNode) {
  const data = JSON.parse(dataNode.textContent || "{}") as GardenData;
  const stage = root.querySelector<HTMLElement>("[data-garden-stage]");
  const canvas = root.querySelector<HTMLCanvasElement>("[data-garden-canvas]");
  const story = root.querySelector<HTMLElement>("[data-flower-story]");
  const tooltip = root.querySelector<HTMLElement>("[data-garden-tooltip]");
  const instruction = root.querySelector<HTMLElement>("[data-garden-instruction]");
  const list = root.querySelector<HTMLElement>("[data-flower-list]");
  const listToggle = root.querySelector<HTMLButtonElement>("[data-list-toggle]");
  const clock = root.querySelector<HTMLTimeElement>("[data-garden-clock]");
  const daypart = root.querySelector<HTMLElement>("[data-garden-daypart]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (stage && canvas && story && tooltip && instruction && list && listToggle) {
    try {
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(DAY_PERIODS.day.fog, 0.032);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      const homeCamera = new THREE.Vector3(0, 15.5, 24);
      const homeTarget = new THREE.Vector3(0, 1.2, 0);
      camera.position.copy(homeCamera);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.35 : 1.8));
      renderer.setClearColor(DAY_PERIODS.day.clear, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = DAY_PERIODS.day.exposure;

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = !reducedMotion;
      controls.dampingFactor = 0.055;
      controls.enablePan = false;
      controls.minDistance = 12;
      controls.maxDistance = 32;
      controls.minPolarAngle = 0.55;
      controls.maxPolarAngle = 1.3;
      controls.target.copy(homeTarget);

      const hemisphereLight = new THREE.HemisphereLight(DAY_PERIODS.day.hemiSky, DAY_PERIODS.day.hemiGround, DAY_PERIODS.day.hemiIntensity);
      scene.add(hemisphereLight);
      const sunlight = new THREE.DirectionalLight(DAY_PERIODS.day.sun, DAY_PERIODS.day.sunIntensity);
      sunlight.position.set(-8, 14, 7);
      scene.add(sunlight);

      const surfaceMaterial = new THREE.MeshStandardMaterial({ color: DAY_PERIODS.day.surface, roughness: 1, metalness: 0 });
      const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 128), surfaceMaterial);
      surface.rotation.x = -Math.PI / 2;
      surface.scale.set(19.2, 12.6, 1);
      surface.position.y = -0.075;
      scene.add(surface);

      const surfaceVeilMaterial = new THREE.MeshBasicMaterial({
        color: DAY_PERIODS.day.surfaceVeil,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
      const surfaceVeil = new THREE.Mesh(new THREE.CircleGeometry(1, 128), surfaceVeilMaterial);
      surfaceVeil.rotation.x = -Math.PI / 2;
      surfaceVeil.scale.set(12.4, 7.4, 1);
      surfaceVeil.position.y = -0.052;
      scene.add(surfaceVeil);

      const contourMaterials: THREE.LineBasicMaterial[] = [];
      const contourLines = [
        { x: 6.2, z: 3.9, seed: 0.4 },
        { x: 10.2, z: 6.4, seed: 1.3 },
        { x: 14.1, z: 8.8, seed: 2.2 },
        { x: 17.4, z: 10.7, seed: 3.1 },
      ].map(({ x, z, seed }, index) => {
        const material = new THREE.LineBasicMaterial({
          color: DAY_PERIODS.day.contour,
          transparent: true,
          opacity: Math.max(0.035, DAY_PERIODS.day.contourOpacity - index * 0.014),
          depthWrite: false,
        });
        contourMaterials.push(material);
        const line = new THREE.LineLoop(createContourGeometry(x, z, seed), material);
        line.userData = { seed };
        scene.add(line);
        return line;
      });

      const clickable: THREE.Object3D[] = [];
      const flowerObjects = new Map<string, THREE.Group>();
      const groupObjects = new Map<string, THREE.Group[]>();
      const textureLoader = new THREE.TextureLoader();
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = 128;
      maskCanvas.height = 128;
      const maskContext = maskCanvas.getContext("2d");
      if (maskContext) {
        const gradient = maskContext.createRadialGradient(64, 64, 45, 64, 64, 63);
        gradient.addColorStop(0, "white");
        gradient.addColorStop(0.86, "white");
        gradient.addColorStop(1, "transparent");
        maskContext.fillStyle = gradient;
        maskContext.fillRect(0, 0, 128, 128);
      }
      const portraitMask = new THREE.CanvasTexture(maskCanvas);
      const stemGeometry = new THREE.CylinderGeometry(0.035, 0.07, 1, 7);
      const leafGeometry = new THREE.SphereGeometry(0.22, 8, 5);
      const petalGeometry = new THREE.CircleGeometry(0.32, 14);
      const stemMaterial = new THREE.MeshStandardMaterial({ color: DAY_PERIODS.day.stem, roughness: 1 });
      const leafMaterial = new THREE.MeshStandardMaterial({ color: DAY_PERIODS.day.leaf, roughness: 1 });

      const groupCenters = data.groups.map((group, index) => {
        const angle = (index / data.groups.length) * Math.PI * 2 - Math.PI / 2;
        return { group, x: Math.cos(angle) * 9.2, z: Math.sin(angle) * 7.4 };
      });

      data.flowers.forEach((flower, globalIndex) => {
        const centerIndex = data.groups.findIndex((group) => group.slug === flower.emotionalGroup);
        const center = groupCenters[centerIndex];
        const siblings = data.flowers.filter((item) => item.emotionalGroup === flower.emotionalGroup);
        const localIndex = siblings.findIndex((item) => item.slug === flower.slug);
        const localAngle = localIndex * 2.39996 + centerIndex * 0.47;
        const localRadius = localIndex === 0 ? 0 : 1.05 + Math.sqrt(localIndex) * 0.78;
        const x = center.x + Math.cos(localAngle) * localRadius;
        const z = center.z + Math.sin(localAngle) * localRadius * 0.72;
        const height = 1.55 + ((globalIndex * 37) % 9) * 0.12;
        const color = softenColor(new THREE.Color(center.group.color));
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.userData = { flower, baseY: 0, seed: globalIndex * 0.73 };

        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.scale.y = height;
        stem.position.y = height / 2;
        group.add(stem);

        [-1, 1].forEach((side, leafIndex) => {
          const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
          leaf.scale.set(1.55, 0.16, 0.65);
          leaf.position.set(side * 0.18, height * (0.38 + leafIndex * 0.16), 0);
          leaf.rotation.z = side * 0.65;
          group.add(leaf);
        });

        const bloom = new THREE.Group();
        bloom.position.y = height;
        group.userData.bloom = bloom;
        for (let p = 0; p < 7; p += 1) {
          const petal = new THREE.Mesh(petalGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.84, side: THREE.DoubleSide }));
          const angle = (p / 7) * Math.PI * 2;
          petal.position.set(Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, -0.04);
          petal.scale.set(1, 1.45, 1);
          petal.rotation.z = angle - Math.PI / 2;
          bloom.add(petal);
        }

        const texture = textureLoader.load(flower.img);
        texture.colorSpace = THREE.SRGBColorSpace;
        const portrait = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaMap: portraitMask, transparent: true, color: 0xffffff }));
        portrait.scale.set(0.78, 0.78, 1);
        portrait.position.z = 0.04;
        portrait.userData = { flower, owner: group };
        bloom.add(portrait);
        group.add(bloom);
        scene.add(group);
        clickable.push(portrait);
        flowerObjects.set(flower.slug, group);
        groupObjects.set(flower.emotionalGroup, [...(groupObjects.get(flower.emotionalGroup) || []), group]);
      });

      const dustGeometry = new THREE.BufferGeometry();
      const dustCount = 260;
      const dustPositions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i += 1) {
        const radius = Math.sqrt(Math.random()) * 18;
        const angle = Math.random() * Math.PI * 2;
        dustPositions[i * 3] = Math.cos(angle) * radius;
        dustPositions[i * 3 + 1] = 0.45 + Math.random() * 5.8;
        dustPositions[i * 3 + 2] = Math.sin(angle) * radius * 0.72;
      }
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      const dustMaterial = new THREE.PointsMaterial({
        color: DAY_PERIODS.day.dust,
        size: 0.026,
        transparent: true,
        opacity: DAY_PERIODS.day.dustOpacity,
        depthWrite: false,
      });
      const dust = new THREE.Points(dustGeometry, dustMaterial);
      scene.add(dust);

      let activePeriod: DayPeriodKey | null = null;
      const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

      const applyDayPeriod = (period: DayPeriod) => {
        if (activePeriod === period.key) return;
        activePeriod = period.key;
        root.dataset.dayPeriod = period.key;
        scene.fog = new THREE.FogExp2(period.fog, 0.032);
        renderer.setClearColor(period.clear, 0);
        renderer.toneMappingExposure = period.exposure;
        hemisphereLight.color.setHex(period.hemiSky);
        hemisphereLight.groundColor.setHex(period.hemiGround);
        hemisphereLight.intensity = period.hemiIntensity;
        sunlight.color.setHex(period.sun);
        sunlight.intensity = period.sunIntensity;
        surfaceMaterial.color.setHex(period.surface);
        surfaceVeilMaterial.color.setHex(period.surfaceVeil);
        stemMaterial.color.setHex(period.stem);
        leafMaterial.color.setHex(period.leaf);
        dustMaterial.color.setHex(period.dust);
        dustMaterial.opacity = period.dustOpacity;
        contourMaterials.forEach((material, index) => {
          material.color.setHex(period.contour);
          material.opacity = Math.max(0.03, period.contourOpacity - index * 0.014);
        });
      };

      const updateTime = () => {
        const now = new Date();
        const period = getDayPeriod(now);
        if (clock) {
          clock.textContent = timeFormatter.format(now);
          clock.dateTime = now.toISOString();
        }
        if (daypart) daypart.textContent = period.label;
        applyDayPeriod(period);
      };
      updateTime();
      window.setInterval(updateTime, 60_000);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hovered: THREE.Object3D | null = null;
      let dragStart = { x: 0, y: 0 };
      let cameraTween: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | null = null;

      const setStory = (flower: Flower) => {
        const group = data.groups.find((item) => item.slug === flower.emotionalGroup);
        const image = story.querySelector<HTMLImageElement>("[data-story-image]");
        const link = story.querySelector<HTMLAnchorElement>("[data-story-link]");
        if (image) { image.src = flower.img; image.alt = `Flor de Bach ${flower.name}`; }
        if (link) link.href = `/flores-de-bach/${flower.slug}`;
        const values: Record<string, string> = {
          "[data-story-count]": `Esencia ${String(flower.id).padStart(2, "0")} / 38`,
          "[data-story-group]": group?.label || "Flor de Bach",
          "[data-story-name]": flower.name,
          "[data-story-botanical]": flower.botanical,
          "[data-story-description]": flower.desc,
          "[data-story-positive]": flower.positiveState,
        };
        Object.entries(values).forEach(([selector, value]) => {
          const element = story.querySelector<HTMLElement>(selector);
          if (element) element.textContent = value;
        });
        story.classList.add("is-open");
        story.setAttribute("aria-hidden", "false");
        instruction.classList.add("is-hidden");
      };

      const moveCamera = (position: THREE.Vector3, target: THREE.Vector3) => {
        if (reducedMotion) {
          camera.position.copy(position);
          controls.target.copy(target);
          return;
        }
        cameraTween = { start: performance.now(), from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target };
      };

      const focusFlower = (flower: Flower) => {
        const object = flowerObjects.get(flower.slug);
        if (!object) return;
        const target = object.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const direction = camera.position.clone().sub(controls.target).normalize();
        const position = target.clone().add(direction.multiplyScalar(window.innerWidth < 700 ? 10 : 7.2));
        moveCamera(position, target);
        setStory(flower);
      };

      const closeStory = () => {
        story.classList.remove("is-open");
        story.setAttribute("aria-hidden", "true");
        instruction.classList.remove("is-hidden");
      };

      const resetView = () => { closeStory(); moveCamera(homeCamera, homeTarget); };

      const filterGroup = (slug: string) => {
        closeStory();
        const url = new URL(window.location.href);
        if (slug === "all") url.searchParams.delete("grupo");
        else url.searchParams.set("grupo", slug);
        window.history.replaceState(null, "", url);
        root.querySelectorAll<HTMLButtonElement>("[data-group]").forEach((button) => {
          const active = button.dataset.group === slug;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
        flowerObjects.forEach((object) => {
          const visible = slug === "all" || object.userData.flower.emotionalGroup === slug;
          object.visible = visible;
        });
        root.querySelectorAll<HTMLElement>("[data-index-flower]").forEach((item) => item.classList.toggle("is-filtered", slug !== "all" && item.dataset.indexGroup !== slug));

        if (slug === "all") {
          moveCamera(homeCamera, homeTarget);
        } else {
          const objects = groupObjects.get(slug) || [];
          const center = objects.reduce((sum, object) => sum.add(object.position), new THREE.Vector3()).multiplyScalar(1 / Math.max(objects.length, 1));
          const target = center.clone().add(new THREE.Vector3(0, 1, 0));
          moveCamera(target.clone().add(new THREE.Vector3(0, 8.5, 12)), target);
        }
      };

      const updatePointer = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(clickable, false).find((item) => item.object.userData.owner?.visible !== false);
        hovered = hit?.object || null;
        canvas.classList.toggle("has-target", Boolean(hovered));
        if (hovered) {
          const flower = hovered.userData.flower as Flower;
          tooltip.textContent = flower.name;
          tooltip.style.left = `${event.clientX - rect.left}px`;
          tooltip.style.top = `${event.clientY - rect.top}px`;
          tooltip.classList.add("is-visible");
        } else {
          tooltip.classList.remove("is-visible");
        }
      };

      canvas.addEventListener("pointerdown", (event) => { dragStart = { x: event.clientX, y: event.clientY }; canvas.classList.add("is-dragging"); });
      canvas.addEventListener("pointerup", (event) => {
        canvas.classList.remove("is-dragging");
        if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) < 6 && hovered) focusFlower(hovered.userData.flower as Flower);
      });
      canvas.addEventListener("pointerleave", () => { hovered = null; tooltip.classList.remove("is-visible"); canvas.classList.remove("has-target", "is-dragging"); });
      canvas.addEventListener("pointermove", updatePointer);
      root.querySelector("[data-reset-view]")?.addEventListener("click", resetView);
      root.querySelector("[data-story-close]")?.addEventListener("click", closeStory);
      root.querySelectorAll<HTMLButtonElement>("[data-group]").forEach((button) => button.addEventListener("click", () => filterGroup(button.dataset.group || "all")));
      root.querySelectorAll<HTMLButtonElement>("[data-index-flower]").forEach((button) => button.addEventListener("click", () => {
        const flower = data.flowers.find((item) => item.slug === button.dataset.indexFlower);
        if (flower) { list.hidden = true; listToggle.setAttribute("aria-expanded", "false"); stage.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }); focusFlower(flower); }
      }));

      const requestedGroup = new URLSearchParams(window.location.search).get("grupo");
      if (requestedGroup && data.groups.some((group) => group.slug === requestedGroup)) {
        filterGroup(requestedGroup);
        stage.scrollIntoView({ behavior: "auto", block: "center" });
      }

      const toggleList = (open: boolean) => {
        list.hidden = !open;
        listToggle.setAttribute("aria-expanded", String(open));
        if (open) list.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      };
      listToggle.addEventListener("click", () => toggleList(list.hidden));
      root.querySelector("[data-list-close]")?.addEventListener("click", () => toggleList(false));
      root.querySelector("[data-open-list]")?.addEventListener("click", () => toggleList(true));
      window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeStory(); });

      const resize = () => {
        const { width, height } = stage.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(stage);
      resize();

      const animationStart = performance.now();
      const animate = () => {
        const elapsed = (performance.now() - animationStart) / 1000;
        if (!reducedMotion) {
          flowerObjects.forEach((object) => {
            object.rotation.z = Math.sin(elapsed * 0.34 + object.userData.seed) * 0.008;
          });
          contourLines.forEach((line, index) => {
            const breath = 1 + Math.sin(elapsed * 0.14 + line.userData.seed) * (0.004 + index * 0.001);
            line.scale.set(breath, 1, breath);
          });
          surfaceVeil.scale.set(12.4 + Math.sin(elapsed * 0.12) * 0.06, 7.4 + Math.sin(elapsed * 0.12) * 0.04, 1);
          dust.rotation.y = elapsed * 0.0035;
        }
        flowerObjects.forEach((object) => object.userData.bloom.quaternion.copy(camera.quaternion));
        if (cameraTween) {
          const progress = Math.min(1, (performance.now() - cameraTween.start) / 1050);
          const eased = 1 - Math.pow(1 - progress, 4);
          camera.position.lerpVectors(cameraTween.from, cameraTween.to, eased);
          controls.target.lerpVectors(cameraTween.targetFrom, cameraTween.targetTo, eased);
          if (progress === 1) cameraTween = null;
        }
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      animate();
    } catch (error) {
      console.error("No se pudo iniciar el jardín 3D", error);
      const note = root.querySelector<HTMLElement>("[data-webgl-note]");
      if (note) note.hidden = false;
    }
  }
}
