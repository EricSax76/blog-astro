// Escena "Flor en transición": una flor estilizada procedural suspendida
// entre capas de pétalos, polen y luz. Sin texto ni controles dentro del
// canvas — toda la interacción real vive en HTML alrededor de la escena.
//
// El desplazamiento vertical abre levemente las capas de pétalos y el
// puntero solo produce una inclinación de pocos grados. Se pausa fuera
// del viewport y cuando la pestaña queda oculta, y respeta
// prefers-reduced-motion / ahorro de datos.

import * as THREE from "three";

type SceneHandle = {
  dispose: () => void;
};

const PETAL_COLOR = 0xc98a8a; // --color-petal
const CENTER_COLOR = 0xd9a441; // --color-pollen
const AMBIENT_COLOR = 0xf3f0e6; // --color-paper
const PETAL_COUNT = 7;

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const prefersReducedData = (): boolean => {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  );
};

const supportsWebGL2 = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
};

// Pétalo alargado y puntiagudo (tipo anémona), con una ligera curva
// cóncava a lo largo de la nervadura central para que la luz lo lea
// como una superficie orgánica y no como un disco plano.
const buildPetal = (): THREE.Mesh => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.22, 0.15, 0.16, 0.85);
  shape.quadraticCurveTo(0.1, 1.55, 0, 1.85);
  shape.quadraticCurveTo(-0.1, 1.55, -0.16, 0.85);
  shape.quadraticCurveTo(-0.22, 0.15, 0, 0);

  const geometry = new THREE.ShapeGeometry(shape, 12);

  // Curva la nervadura central (leve concavidad) desplazando z según y.
  const positionAttr = geometry.getAttribute("position");
  for (let i = 0; i < positionAttr.count; i += 1) {
    const y = positionAttr.getY(i);
    const curve = Math.sin((y / 1.85) * Math.PI) * 0.12;
    positionAttr.setZ(i, curve);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: PETAL_COLOR,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const petal = new THREE.Mesh(geometry, material);
  // Pivote en la base: el pétalo nace en el origen del grupo y se abre
  // rotando sobre X, como los pétalos de una flor real.
  petal.position.set(0, 0, 0);
  return petal;
};

export const mountHeroScene = (
  canvas: HTMLCanvasElement
): SceneHandle | null => {
  if (!supportsWebGL2() || prefersReducedData()) return null;

  const reducedMotion = prefersReducedMotion();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;

  const ambientLight = new THREE.AmbientLight(AMBIENT_COLOR, 1.4);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(2, 3, 4);
  scene.add(ambientLight, keyLight);

  const flowerGroup = new THREE.Group();
  // Cada pétalo vive dentro de un pivote propio: el pivote gira en Z
  // para repartirse alrededor del centro (como radios), y el pétalo
  // dentro de él rota en X para abrirse desde su base, igual que una
  // flor real abre los pétalos desde el cáliz.
  const petalPivots: THREE.Group[] = [];

  for (let i = 0; i < PETAL_COUNT; i += 1) {
    const pivot = new THREE.Group();
    const angle = (i / PETAL_COUNT) * Math.PI * 2;
    pivot.rotation.z = angle;

    const petal = buildPetal();
    petal.position.set(0, 0.12, 0); // nace justo al borde del centro
    pivot.add(petal);

    petalPivots.push(pivot);
    flowerGroup.add(pivot);
  }

  const centerGeometry = new THREE.SphereGeometry(0.22, 24, 24);
  const centerMaterial = new THREE.MeshStandardMaterial({
    color: CENTER_COLOR,
    roughness: 0.4,
    metalness: 0.1,
  });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  flowerGroup.add(center);

  // Desplazada hacia la derecha para no solapar el título ni los CTA,
  // que viven en la mitad izquierda del hero. Escalada para encuadrar
  // bien el pétalo alargado dentro del viewport de la cámara.
  flowerGroup.position.set(3.6, -0.4, -1);
  flowerGroup.scale.setScalar(0.85);
  scene.add(flowerGroup);

  const particleCount = 60;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const radius = 2.5 + Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.6;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  const particleMaterial = new THREE.PointsMaterial({
    color: CENTER_COLOR,
    size: 0.035,
    transparent: true,
    opacity: 0.5,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  let openness = 0; // 0 = cerrada, 1 = completamente abierta
  let targetOpenness = 0.3;
  let pointerX = 0;
  let pointerY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;
  let isVisible = true;
  let isTabVisible = document.visibilityState === "visible";
  let animationFrame: number | null = null;
  let disposed = false;

  const resize = () => {
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || canvas.clientWidth || 1;
    const height = rect?.height || canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const applyOpenness = () => {
    // Cerrada (openness=0): pétalos casi verticales, como un capullo.
    // Abierta (openness=1): pétalos caídos hacia afuera, como una flor
    // en plena floración. La rotación ocurre en el pivote, con bisagra
    // en la base del pétalo, no en su centro.
    const minTiltFromVertical = 0.35; // rad, capullo entreabierto
    const maxTiltFromVertical = 1.15; // rad, flor abierta en 3/4, no de canto
    const tilt =
      minTiltFromVertical + openness * (maxTiltFromVertical - minTiltFromVertical);

    petalPivots.forEach((pivot) => {
      pivot.rotation.x = tilt;
    });
  };

  const onScroll = () => {
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const viewportHeight = window.innerHeight || 1;
    const progress = 1 - Math.min(Math.max(rect.top / viewportHeight, 0), 1);
    targetOpenness = 0.3 + progress * 0.6;
  };

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
    targetTiltY = pointerX * 0.25;
    targetTiltX = pointerY * 0.15;
  };

  const onPointerLeave = () => {
    targetTiltX = 0;
    targetTiltY = 0;
  };

  const onVisibilityChange = () => {
    isTabVisible = document.visibilityState === "visible";
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
      });
    },
    { threshold: 0.05 }
  );
  if (canvas.parentElement) intersectionObserver.observe(canvas.parentElement);

  const resizeObserver = new ResizeObserver(resize);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

  window.addEventListener("scroll", onScroll, { passive: true });
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibilityChange);

  resize();
  applyOpenness();
  renderer.render(scene, camera);

  const tick = () => {
    if (disposed) return;
    animationFrame = requestAnimationFrame(tick);

    if (!isVisible || !isTabVisible) return;

    if (!reducedMotion) {
      openness += (targetOpenness - openness) * 0.06;
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;
      flowerGroup.rotation.x = currentTiltX;
      flowerGroup.rotation.y = currentTiltY;
      particles.rotation.y += 0.0006;
      applyOpenness();
    }

    renderer.render(scene, camera);
  };

  tick();

  const dispose = () => {
    disposed = true;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    window.removeEventListener("scroll", onScroll);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    intersectionObserver.disconnect();
    resizeObserver.disconnect();

    petalPivots.forEach((pivot) => {
      const petal = pivot.children[0] as THREE.Mesh;
      petal.geometry.dispose();
      (petal.material as THREE.Material).dispose();
    });
    centerGeometry.dispose();
    centerMaterial.dispose();
    particleGeometry.dispose();
    particleMaterial.dispose();
    renderer.dispose();
  };

  return { dispose };
};
