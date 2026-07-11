const root = document.querySelector<HTMLElement>("[data-biography-journey]");
type Material = import("three").Material;

if (root) {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-biography-canvas]");
  const visual = root.querySelector<HTMLElement>(".journey-visual");
  const journey = root.querySelector<HTMLElement>(".journey");
  const chapters = [...root.querySelectorAll<HTMLElement>("[data-biography-chapter]")];
  const stageNumber = root.querySelector<HTMLElement>("[data-stage-number]");
  const stageLabel = root.querySelector<HTMLElement>("[data-stage-label]");
  const progressLine = root.querySelector<HTMLElement>("[data-progress-line]");
  const fallback = root.querySelector<HTMLElement>("[data-canvas-fallback]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (canvas && visual && journey && chapters.length) {
    let hasStarted = false;
    const startScene = async () => {
      if (hasStarted) return;
      hasStarted = true;

      try {
      const THREE = await import("three");
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0xeee7d4, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xeee7d4, 0.026);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      camera.position.set(0, .15, 14);

      scene.add(new THREE.HemisphereLight(0xfff8df, 0x7a6240, 2.7));
      const keyLight = new THREE.DirectionalLight(0xffe7b2, 3.8);
      keyLight.position.set(-5, 8, 7);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x9eb69b, 1.25);
      fillLight.position.set(6, 1, 5);
      scene.add(fillLight);

      const stageLabels = ["La semilla", "El estudio", "La apertura", "El brote", "La flor", "El legado"];

      // Objeto principal: una semilla sólida con superficie irregular, hendidura e hilio.
      const seedGeometry = new THREE.SphereGeometry(1.35, 64, 40);
      const seedPosition = seedGeometry.attributes.position;
      const workingVertex = new THREE.Vector3();
      for (let index = 0; index < seedPosition.count; index += 1) {
        workingVertex.fromBufferAttribute(seedPosition, index);
        const normalizedY = workingVertex.y / 1.35;
        const silhouette = 1 - Math.max(0, normalizedY) * .2;
        const grain = 1 + Math.sin(workingVertex.x * 15 + workingVertex.y * 9) * .012 + Math.cos(workingVertex.z * 17) * .009;
        workingVertex.x *= silhouette * grain;
        workingVertex.z *= silhouette * grain;
        seedPosition.setXYZ(index, workingVertex.x, workingVertex.y, workingVertex.z);
      }
      seedGeometry.computeVertexNormals();

      const seedMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6436, roughness: .82, metalness: 0, transparent: true });
      const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x4b3420, roughness: .95, transparent: true });
      const seedGroup = new THREE.Group();
      const seedBody = new THREE.Mesh(seedGeometry, seedMaterial);
      seedBody.scale.set(.86, 1.25, .67);
      seedBody.castShadow = true;
      seedGroup.add(seedBody);

      const seamPoints = Array.from({ length: 11 }, (_, index) => {
        const t = index / 10;
        return new THREE.Vector3(Math.sin(t * Math.PI * 2) * .09 - .1, (t - .5) * 2.65, .92 - Math.abs(t - .5) * .18);
      });
      const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints), 32, .035, 7, false), seamMaterial);
      seam.castShadow = true;
      seedGroup.add(seam);
      const hilum = new THREE.Mesh(new THREE.SphereGeometry(.12, 18, 12), seamMaterial);
      hilum.scale.set(1.35, .55, .28);
      hilum.position.set(-.08, -1.33, .82);
      seedGroup.add(hilum);
      seedGroup.rotation.set(.08, -.35, -.2);
      scene.add(seedGroup);

      // Dos valvas permiten que la semilla se abra durante el capítulo de 1917.
      const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6436, roughness: .84, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const innerMaterial = new THREE.MeshStandardMaterial({ color: 0xd4b06d, roughness: .78, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const leftShell = new THREE.Mesh(new THREE.SphereGeometry(1.35, 40, 28, 0, Math.PI), shellMaterial);
      const rightShell = new THREE.Mesh(new THREE.SphereGeometry(1.35, 40, 28, Math.PI, Math.PI), innerMaterial);
      [leftShell, rightShell].forEach((shell) => { shell.scale.set(.86, 1.25, .67); shell.castShadow = true; scene.add(shell); });
      const embryoMaterial = new THREE.MeshStandardMaterial({ color: 0xe8c879, emissive: 0x6b4a18, emissiveIntensity: .22, roughness: .7, transparent: true, opacity: 0 });
      const embryo = new THREE.Mesh(new THREE.SphereGeometry(.58, 32, 20), embryoMaterial);
      embryo.scale.set(.62, 1.35, .48);
      embryo.rotation.z = -.35;
      scene.add(embryo);

      // El brote mantiene continuidad material entre la semilla, el sendero y las flores.
      const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x61764c, roughness: .88, transparent: true, opacity: 0 });
      const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x788b5e, roughness: .9, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const sproutGroup = new THREE.Group();
      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -2, 0), new THREE.Vector3(-.15, -1, .05), new THREE.Vector3(.18, .15, 0), new THREE.Vector3(-.08, 1.55, 0),
      ]);
      sproutGroup.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 42, .055, 8, false), plantMaterial));
      [-1, 1].forEach((side, index) => {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(.48, 24, 12), leafMaterial);
        leaf.scale.set(1.15, .24, .52);
        leaf.position.set(side * .42, -.45 + index * .65, 0);
        leaf.rotation.z = side * .58;
        sproutGroup.add(leaf);
      });
      scene.add(sproutGroup);

      const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xe4d9ad, roughness: .92, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const flowerCenterMaterial = new THREE.MeshStandardMaterial({ color: 0xb48b32, roughness: .75, transparent: true, opacity: 0 });
      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(-.08, 1.65, 0);
      for (let index = 0; index < 7; index += 1) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 12), petalMaterial);
        const angle = (index / 7) * Math.PI * 2;
        petal.scale.set(.58, 1.25, .18);
        petal.position.set(Math.cos(angle) * .48, Math.sin(angle) * .48, 0);
        petal.rotation.z = angle - Math.PI / 2;
        flowerGroup.add(petal);
      }
      flowerGroup.add(new THREE.Mesh(new THREE.SphereGeometry(.27, 24, 16), flowerCenterMaterial));
      scene.add(flowerGroup);

      const studyMaterial = new THREE.MeshBasicMaterial({ color: 0x64725a, transparent: true, opacity: 0, side: THREE.DoubleSide });
      const studyRings = new THREE.Group();
      [2.05, 2.65, 3.25].forEach((radius) => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .009, radius + .009, 96), studyMaterial);
        studyRings.add(ring);
      });
      scene.add(studyRings);

      const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.1, 64), new THREE.MeshBasicMaterial({ color: 0x6d5433, transparent: true, opacity: .11, depthWrite: false }));
      shadow.scale.set(1, .22, 1);
      shadow.position.set(0, -2.15, -.7);
      scene.add(shadow);

      const fadeMaterials = (materials: Material[], targetOpacity: number) => {
        materials.forEach((material) => {
          material.opacity += (targetOpacity - material.opacity) * .055;
          material.transparent = true;
        });
      };

      let activeStage = 0;
      let isVisible = true;
      let mouseX = 0;
      let mouseY = 0;
      const animationStart = performance.now();
      const seedTargetPosition = new THREE.Vector3();
      const seedTargetScale = new THREE.Vector3(1, 1, 1);
      const sproutTargetScale = new THREE.Vector3(1, .05, 1);
      const flowerTargetScale = new THREE.Vector3(.05, .05, .05);

      const updateStage = (nextStage: number) => {
        activeStage = Math.max(0, Math.min(chapters.length - 1, nextStage));
        chapters.forEach((chapter, index) => chapter.classList.toggle("is-active", index === activeStage));
        if (stageNumber) stageNumber.textContent = String(activeStage + 1).padStart(2, "0");
        if (stageLabel) stageLabel.textContent = stageLabels[activeStage];
        if (progressLine) progressLine.style.height = `${(activeStage / (chapters.length - 1)) * 100}%`;
      };

      const chapterObserver = new IntersectionObserver((entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio);
        const mostVisible = visibleEntries[0];
        if (mostVisible) updateStage(Number((mostVisible.target as HTMLElement).dataset.stage || 0));
      }, { rootMargin: "-28% 0px -28% 0px", threshold: [0, .15, .35, .6] });
      chapters.forEach((chapter) => chapterObserver.observe(chapter));

      const visibilityObserver = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { rootMargin: "150px" });
      visibilityObserver.observe(journey);

      visual.addEventListener("pointermove", (event) => {
        const rect = visual.getBoundingClientRect();
        mouseX = ((event.clientX - rect.left) / rect.width - .5) * 2;
        mouseY = ((event.clientY - rect.top) / rect.height - .5) * 2;
      }, { passive: true });
      visual.addEventListener("pointerleave", () => { mouseX = 0; mouseY = 0; });

      const resize = () => {
        const { width, height } = visual.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(visual);
      resize();

      const render = () => {
        if (isVisible && !document.hidden) {
          const elapsed = (performance.now() - animationStart) / 1000;

          const seedOpacities = [1, .4, 0, .62, .16, 0];
          fadeMaterials([seedMaterial, seamMaterial], seedOpacities[activeStage]);
          fadeMaterials([shellMaterial, innerMaterial], activeStage === 2 ? .96 : 0);
          fadeMaterials([embryoMaterial], activeStage === 2 ? 1 : 0);
          fadeMaterials([plantMaterial, leafMaterial], activeStage >= 3 ? (activeStage === 5 ? .72 : 1) : 0);
          fadeMaterials([petalMaterial, flowerCenterMaterial], activeStage >= 4 ? 1 : 0);
          fadeMaterials([studyMaterial], activeStage === 1 ? .34 : 0);

          seedTargetPosition.set(0, activeStage >= 3 ? -1.72 : 0, 0);
          seedGroup.position.lerp(seedTargetPosition, .045);
          seedTargetScale.setScalar(activeStage === 1 ? .82 : activeStage >= 3 ? .56 : 1);
          seedGroup.scale.lerp(seedTargetScale, .045);

          leftShell.position.x += (((activeStage === 2 ? -.62 : 0)) - leftShell.position.x) * .05;
          rightShell.position.x += (((activeStage === 2 ? .62 : 0)) - rightShell.position.x) * .05;
          leftShell.rotation.z += (((activeStage === 2 ? .22 : 0)) - leftShell.rotation.z) * .05;
          rightShell.rotation.z += (((activeStage === 2 ? -.22 : 0)) - rightShell.rotation.z) * .05;
          embryo.scale.set(.62, 1.35, .48).multiplyScalar(activeStage === 2 ? 1 : .7);

          sproutTargetScale.set(1, activeStage >= 3 ? 1 : .05, 1);
          sproutGroup.scale.lerp(sproutTargetScale, .05);
          flowerTargetScale.setScalar(activeStage === 4 ? .58 : activeStage === 5 ? 1 : .05);
          flowerGroup.scale.lerp(flowerTargetScale, .05);
          studyRings.rotation.z = elapsed * .018;

          if (!reducedMotion) {
            seedGroup.rotation.y = -.35 + Math.sin(elapsed * .32) * .055 + mouseX * .04;
            sproutGroup.rotation.y = mouseX * .035;
            flowerGroup.rotation.y = mouseX * .035;
          }
          camera.position.x += ((mouseX * .35) - camera.position.x) * .035;
          camera.position.y += ((-mouseY * .22) - camera.position.y) * .035;
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        }
        requestAnimationFrame(render);
      };
      render();
    } catch (error) {
      console.error("No se pudo iniciar el relato visual de la biografía", error);
      fallback?.classList.add("is-visible");
      }
    };

    const sceneLoader = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        sceneLoader.disconnect();
        void startScene();
      }
    }, { rootMargin: "300px" });
    sceneLoader.observe(journey);
  }
}
