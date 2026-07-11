// Carga diferida del chunk Three.js: solo se importa si el canvas del
// hero está presente y el usuario no pidió menos datos/movimiento. La
// composición 2.5D ya está montada debajo como respaldo permanente.
//
// Spike Fase 2: el sitio es estático, así que la variante A/B no puede
// decidirse en build. Se activa solo con ?hero=3d en la URL — sin ese
// parámetro, todos los visitantes ven la variante 2.5D por defecto.
// Cuando el spike se apruebe o descarte, esta condición se retira.

const canvas = document.querySelector<HTMLCanvasElement>(
  "[data-hero-3d-canvas]"
);

const heroVariantRequested =
  new URLSearchParams(window.location.search).get("hero") === "3d";

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

if (canvas && heroVariantRequested && !prefersReducedData()) {
  import("./hero-scene-3d.ts")
    .then(({ mountHeroScene }) => {
      const handle = mountHeroScene(canvas);
      if (!handle) return;

      requestAnimationFrame(() => {
        canvas.classList.remove("opacity-0");
      });

      window.addEventListener(
        "pagehide",
        () => {
          handle.dispose();
        },
        { once: true }
      );
    })
    .catch((error) => {
      console.error("[home] failed to mount hero 3D scene", error);
    });
}
