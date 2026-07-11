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
const PETAL_COUNT = 8;

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

const buildPetal = (): THREE.Mesh => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.35, 0.25, 0.35, 0.95, 0, 1.3);
  shape.bezierCurveTo(-0.35, 0.95, -0.35, 0.25, 0, 0);

  const geometry = new THREE.ShapeGeometry(shape, 8);
  const material = new THREE.MeshStandardMaterial({
    color: PETAL_COLOR,
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
};

export const mountHeroScene = (
  canvas: HTMLCanvasElement
): SceneHandle | null => {
  if (!supportsWebGL2() || prefersReducedData()) return null;

  const reducedMotion = prefersReducedMotion();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.4, 6);

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
  const petals: THREE.Mesh[] = [];

  for (let i = 0; i < PETAL_COUNT; i += 1) {
    const petal = buildPetal();
    const angle = (i / PETAL_COUNT) * Math.PI * 2;
    petal.userData.angle = angle;
    petal.position.set(0, 0, 0);
    petal.rotation.z = angle;
    petals.push(petal);
    flowerGroup.add(petal);
  }

  const centerGeometry = new THREE.SphereGeometry(0.45, 24, 24);
  const centerMaterial = new THREE.MeshStandardMaterial({
    color: CENTER_COLOR,
    roughness: 0.4,
    metalness: 0.1,
  });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  flowerGroup.add(center);

  // Desplazada hacia la derecha para no solapar el título ni los CTA,
  // que viven en la mitad izquierda del hero.
  flowerGroup.position.set(2.1, 0.2, 0);
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
    petals.forEach((petal) => {
      const angle = petal.userData.angle as number;
      const spread = 0.4 + openness * 0.9;
      petal.position.set(
        Math.cos(angle) * spread * 0.3,
        Math.sin(angle) * spread * 0.15,
        0.05
      );
      petal.rotation.x = -openness * 0.6;
      petal.rotation.z = angle;
      const scale = 0.85 + openness * 0.3;
      petal.scale.set(scale, scale, scale);
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

    petals.forEach((petal) => {
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
