# Plan de rediseño conceptual del index

> Proyecto: **El Alma de las Flores**  
> Fecha: 2026-07-11 · última actualización: 2026-07-11  
> Estado: Fase 0 y Fase 1 implementadas; Fase 2 (spike 2.5D vs Three.js) cerrada — Three.js descartado, 2.5D es la implementación principal del hero.  
> Alcance: portada `/`; no modifica por ahora las fichas, el archivo ni el área de autores.

---

## 1. Resumen ejecutivo

La portada actual es clara, coherente y usable, pero se percibe como un directorio: presenta una sucesión de tarjetas similares, con poca variación de ritmo y sin un relato que conecte las flores, la figura de Edward Bach y las voces del blog.

La propuesta es convertirla en un **herbario vivo y contemplativo**: una experiencia editorial inspirada en caminar por un jardín al amanecer. La página mantendrá HTML semántico, contenido rastreable y navegación convencional, pero añadirá profundidad, movimiento suave y una sola interacción visual distintiva.

La idea memorable será:

> **Cada flor es una puerta de entrada a un estado emocional y cada lectura, una forma de recorrer el jardín.**

No se recomienda convertir toda la portada en 3D. Sí se recomienda prototipar una escena limitada con **Three.js** —nombre correcto de la librería— y enfrentarla a una alternativa 2.5D hecha con CSS, imágenes recortadas y movimiento nativo. La versión 3D solo avanzará si aporta una diferencia perceptible y cumple los presupuestos de rendimiento y accesibilidad definidos en este documento.

---

## 2. Diagnóstico del index actual

### Lo que ya funciona

- Identidad cromática reconocible: crema, verde profundo y verde salvia.
- Tipografía editorial apropiada para el tema.
- Jerarquía legible y llamadas a la acción comprensibles.
- Imágenes reales de las flores y catálogo de 38 fichas ya disponible.
- Arquitectura de componentes Astro sencilla y mantenible.
- Navegación, contenido, autenticación y pie de página ya están separados.

### Lo que limita la experiencia

1. **El hero no construye un mundo.** La fotografía ampliada y desenfocada funciona como fondo, pero no crea profundidad ni invita a explorar.
2. **Demasiados módulos comparten el mismo lenguaje.** Tarjeta blanca, borde tenue, esquinas redondeadas y rejilla se repiten hasta perder jerarquía.
3. **La portada explica la arquitectura del sitio en vez de contar una historia.** “Todo el blog, organizado por rutas claras” es funcional, pero suena a mapa de producto, no a una publicación sobre naturaleza y experiencia humana.
4. **El blog vivo casi no aparece.** El catálogo y los accesos dominan, mientras que las publicaciones recientes y sus autores —la parte que puede cambiar— no ocupan un momento central.
5. **Las flores se presentan como inventario.** Seis tarjetas equivalentes no ayudan a entender relaciones, familias emocionales ni caminos de descubrimiento.
6. **La zona de autores ocupa demasiado espacio en la portada pública.** Repite tres accesos y compite con el contenido principal.
7. **La composición es segura pero predecible.** Falta contraste entre momentos amplios, íntimos, documentales y participativos.

### Principio de corrección

No se trata de añadir movimiento a cada bloque. Se trata de sustituir una secuencia de cajas por una **secuencia de escenas editoriales**, donde cada sección tenga una función y una cadencia distintas.

---

## 3. Dirección creativa: «Herbario vivo»

### Tono

- Orgánico, sereno, táctil y ligeramente misterioso.
- Editorial antes que tecnológico.
- Contemporáneo sin perder la calidez artesanal de un cuaderno botánico.
- Inmersivo sin parecer un videojuego ni una web de efectos.

### Lenguaje visual

- Fondos de papel cálido con grano muy sutil.
- Fotografías botánicas de gran formato combinadas con recortes transparentes.
- Composición asimétrica: elementos que nacen desde los bordes y atraviesan la retícula.
- Etiquetas inspiradas en fichas de herbario: nombre común, nombre botánico, número y grupo emocional.
- Capas de luz, sombra foliar y profundidad; evitar abusar de vidrio, blur y tarjetas flotantes.
- Verde profundo como estructura; amarillo polen o rosa pétalo como acento escaso.
- Cormorant Garamond puede mantenerse en titulares. Red Hat Text puede mantenerse para cuerpo durante el prototipo; la tipografía no es el principal problema actual.

### Movimiento

- Entrada inicial lenta y coordinada: título, subtítulo y elemento botánico aparecen como una sola composición.
- Reacción muy contenida al puntero o inclinación, nunca necesaria para comprender o navegar.
- Revelados por scroll basados en opacidad, recorte y desplazamientos cortos.
- Nada de scroll secuestrado. El usuario conserva siempre el comportamiento nativo de la página.
- Un modo estático equivalente cuando `prefers-reduced-motion: reduce` esté activo.

---

## 4. Nueva narrativa de la portada

### Escena 1 — Umbral: «Entra en el jardín»

**Objetivo:** presentar el universo y provocar curiosidad en los primeros segundos.

- Hero de entre 85 y 100 `svh`, sin cabecera visualmente pesada.
- Titular más narrativo: **«Hay flores que empiezan por dentro»**.
- Bajada descriptiva que mantenga claridad y SEO: estudio de las 38 Flores de Bach, historia de Edward Bach y publicaciones de la comunidad.
- CTA principal: **Explorar las 38 flores**.
- CTA secundario: **Leer el último cuaderno** o la última publicación disponible.
- Una flor protagonista o pequeño ecosistema botánico con profundidad.
- Señal discreta de continuación: «Desciende para explorar».

El título de marca sigue presente en la cabecera y en metadatos; no necesita repetirse como único mensaje emocional del hero.

### Escena 2 — Brújula emocional

**Objetivo:** transformar el catálogo en exploración significativa.

- Presentar los siete grupos emocionales tradicionales como un mapa orgánico, constelación o anillos botánicos.
- Al enfocar o seleccionar un grupo, mostrar cuántas flores contiene y una explicación breve.
- Cada control será un enlace o botón HTML real, accesible con teclado.
- En móvil se convierte en una lista horizontal o acordeón; nunca depende del canvas.
- Salida clara hacia el catálogo filtrado. Si todavía no existe filtrado por grupo, esta funcionalidad se implementará antes de prometerla en la interfaz.

### Escena 3 — Atlas de las 38 flores

**Objetivo:** mostrar diversidad sin repetir una rejilla convencional.

- Selección editorial de 4–6 flores, renovable por estación, grupo o lectura destacada.
- Composición tipo láminas de herbario: una pieza dominante y varias secundarias.
- Hover/focus revela nombre botánico, estado de partida y transformación positiva.
- La tarjeta completa sigue siendo un enlace semántico.
- CTA visible al catálogo completo.

### Escena 4 — El camino de Edward Bach

**Objetivo:** aportar contexto histórico y autoridad editorial.

- Línea temporal vertical breve, integrada con una fotografía, mapa o facsímil documental.
- Cuatro hitos como máximo en portada.
- El scroll puede mover una línea dibujada o cambiar la imagen, pero el texto nunca queda bloqueado ni depende de animación.
- CTA a la biografía completa.

### Escena 5 — Cuaderno vivo

**Objetivo:** demostrar que esto es un blog actualizado, no solo una enciclopedia estática.

- Una publicación reciente como pieza principal y dos secundarias.
- Fecha, autor, imagen, extracto y tiempo estimado de lectura.
- Estado vacío editorial si no hay publicaciones nuevas: recuperar una pieza del archivo bajo «Del herbario».
- Enlace al anuario vigente y navegación opcional por año.
- Los datos deben venir de la fuente real de publicaciones; no duplicarlos en `home-page.ts`.

### Escena 6 — Invitación a participar

**Objetivo:** convertir lectores interesados sin competir con la lectura.

- Un bloque compacto, no dos paneles equivalentes.
- Mensaje: **«Añade tu voz al cuaderno»**.
- CTA principal contextual según sesión: registrarse, publicar o ver publicaciones propias.
- Acceder queda como enlace secundario.

### Escena 7 — Cierre

**Objetivo:** terminar con calma y reforzar confianza.

- Frase editorial breve, newsletter solo si existe una estrategia real para mantenerla.
- Pie actual simplificado y con contraste suficiente.
- Enlaces legales y nota de responsabilidad claramente disponibles.

---

## 5. Decisión sobre 3D

### Comparativa

| Enfoque | Aporte | Coste/riesgo | Decisión |
| --- | --- | --- | --- |
| CSS + imágenes 2.5D | Profundidad, parallax sutil, buena compatibilidad y carga baja | Menos libertad de cámara e iluminación | **Base obligatoria y fallback** |
| Three.js en una isla | Escena botánica con profundidad real y reacción suave | JS, GPU, texturas, QA móvil y mantenimiento | **Prototipo acotado** |
| Portada completa en WebGL | Experiencia muy inmersiva | SEO, accesibilidad, scroll, batería y contenido frágil | **Descartado** |
| Vídeo en bucle | Resultado visual predecible | Peso, poca interacción y coste de producir variantes | Posible fallback visual, no primera opción |

### Concepto para el prototipo Three.js

**«Flor en transición»**: una única flor estilizada suspendida entre capas de pétalos, polen y luz. El desplazamiento vertical abre levemente las capas y cambia el foco; el puntero solo produce una inclinación de pocos grados.

La escena no contiene texto, botones ni navegación. Estos permanecen en HTML sobre o junto al canvas. Si WebGL 2 no está disponible, el canvas no se monta y aparece la composición 2.5D.

### Condiciones para aprobar Three.js

- Prueba comparativa A/B interna con la alternativa 2.5D.
- La escena comunica el concepto floral sin instrucciones.
- No retrasa el contenido principal ni el CTA.
- Se carga como chunk separado y se puede retirar sin alterar la estructura del hero.
- Se pausa al salir del viewport y cuando la pestaña queda oculta.
- Respeta reducción de movimiento, ahorro de datos y dispositivos con capacidad limitada.
- No provoca mareo, saltos de layout ni interacción accidental.
- Mantiene los presupuestos del apartado 8.

Si no cumple estas condiciones, se conserva el diseño 2.5D. Eso no sería una versión inferior: será la implementación principal, diseñada desde el inicio para sostener por sí sola la identidad.

---

## 6. Librerías y assets

### Dependencias recomendadas

1. **Nativo primero:** CSS, `IntersectionObserver`, Web Animations API y scripts Astro para revelados y cambios de estado sencillos.
2. **Three.js, solo tras validar el prototipo:** importar únicamente los módulos necesarios. No añadir React solo para alojar el canvas.
3. **GSAP u otra librería de scroll:** no incluir en la primera iteración. Evaluarla solo si la coreografía final no puede expresarse de forma mantenible con APIs nativas, revisando antes licencia, peso y beneficio real.

No se instalará ninguna dependencia hasta aprobar el prototipo visual y técnico.

### Assets necesarios

- Auditoría de resolución, encuadre, derechos y peso de las 38 fotografías actuales.
- 6–10 recortes botánicos con transparencia en WebP/AVIF para composición 2.5D.
- Una textura de papel/grano pequeña y repetible; también puede generarse con CSS/SVG.
- Sombras de hojas o máscaras monocromas reutilizables.
- Para 3D: un solo modelo `.glb`, simplificado y comprimido, o geometría procedural; no 38 modelos.
- Imagen poster equivalente para el hero en móvil, ahorro de datos, reducción de movimiento y fallo de WebGL.
- Créditos y procedencia documentados en `docs/` o junto al inventario de assets.

### Criterio de estilo para los assets

La fotografía debe sentirse observacional y botánica, no como un catálogo de stock saturado. Conviene unificar temperatura, contraste y recorte antes de buscar más imágenes.

---

## 7. Arquitectura propuesta en Astro

Astro seguirá entregando la mayor parte de la portada como HTML estático/SSR. La interacción se dividirá en islas pequeñas y prescindibles.

```text
src/pages/_views/home/index.astro
├── HomeHero.astro
│   ├── HeroBotanicalFallback.astro
│   └── HeroBotanicalScene.ts      # Three.js, solo si se aprueba
├── HomeEmotionalCompass.astro
│   └── emotional-compass.ts       # interacción ligera
├── HomeFlowerAtlas.astro
├── HomeBachJourney.astro
├── HomeLatestStories.astro
├── HomeCommunityInvitation.astro
└── HomeClosing.astro
```

### Reglas técnicas

- No introducir un framework UI si Astro y TypeScript cubren la interacción.
- El canvas será decorativo (`aria-hidden="true"`) y no contendrá información exclusiva.
- La escena se importará dinámicamente y no formará parte del JS crítico.
- Usar una estrategia equivalente a `client:visible`/carga diferida para módulos que estén bajo el primer viewport.
- Compartir tipos y fuente de datos de flores; no copiar el catálogo en componentes.
- Crear tokens semánticos en `global.css`: superficie papel, tinta, musgo, polen, pétalo, duraciones y curvas.
- Mantener el contenido de publicaciones desacoplado del layout y definir estados de carga, error y vacío.
- No alterar autenticación, Firestore ni Cloud Functions durante la fase conceptual.

La arquitectura de islas de Astro permite mantener HTML rápido y cargar JavaScript solo en los componentes interactivos: [Astro Islands](https://docs.astro.build/en/concepts/islands/) y [componentes de framework](https://docs.astro.build/en/guides/framework-components/).

---

## 8. Rendimiento, accesibilidad y calidad

### Presupuestos iniciales

- Core Web Vitals objetivo en percentil 75: LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1.
- Imagen LCP optimizada y con dimensiones explícitas.
- JS inicial propio de la portada: objetivo ≤ 80 KB gzip, sin contar código que se carga después de interacción/visibilidad.
- Chunk 3D diferido: objetivo ≤ 200 KB gzip.
- Texturas de la escena: ≤ 1,2 MB en escritorio y poster ≤ 350 KB en móvil.
- Modelo 3D comprimido: objetivo ≤ 400 KB.
- Máximo orientativo de 50 draw calls; registrar triángulos, texturas y memoria con `renderer.info` durante QA.
- Animación estable: objetivo 55–60 fps en escritorio medio y ≥ 30 fps en móvil de prueba.

Estos números son puertas de decisión, no promesas sin medición. Se ajustarán tras medir el prototipo en dispositivos reales.

### Accesibilidad obligatoria

- Orden de lectura y navegación completos sin JavaScript.
- Foco visible y contraste WCAG AA.
- Controles accesibles por teclado; estados `hover` replicados con `focus-visible`.
- Texto alternativo útil para imágenes informativas; decoraciones sin ruido para lectores de pantalla.
- Sin texto dentro de canvas.
- `prefers-reduced-motion: reduce`: sin parallax, cámara, partículas ni revelados desplazados. MDN documenta este mecanismo y su relevancia para trastornos vestibulares y migrañas: [uso de media queries para accesibilidad](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility).
- Botón opcional «Pausar movimiento» si queda alguna animación ambiental continua.
- No usar color como único código para los grupos emocionales.

### Comportamiento adaptativo de la escena

- Comprobar soporte WebGL 2 antes de crear el renderer; Three.js dispone de una utilidad oficial para ello: [WebGL capability](https://threejs.org/docs/pages/WebGL.html).
- Limitar el pixel ratio, desactivar sombras dinámicas y evitar postprocesado en móvil.
- Pausar el loop fuera del viewport y liberar recursos al desmontar.
- Preferir iluminación horneada o materiales sencillos.
- Usar el loop recomendado por el renderer y medir llamadas, geometrías y texturas: [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

### Responsabilidad editorial

- Separar claramente historia, tradición y testimonios de afirmaciones médicas demostradas.
- No presentar las esencias como sustituto de diagnóstico o tratamiento profesional.
- Revisar microcopy de fichas y portada con el mismo criterio editorial.
- Hacer visible una nota de carácter informativo sin convertir el hero en un aviso legal.

---

## 9. Plan de ejecución por fases

### Fase 0 — Alineación y contenido ✅ implementada

**Objetivo:** decidir antes de producir.

- Validar la dirección «Herbario vivo» y el nuevo relato de scroll.
- Definir audiencia principal y acción prioritaria.
- Confirmar los siete grupos emocionales y su taxonomía en los datos.
- Seleccionar publicaciones y flores protagonistas.
- Inventariar imágenes y derechos.

**Salida:** brief aprobado, esquema de contenido y lista de assets.

**Estado:** decisiones de §11 resueltas en conversación (conversión principal = unirse como autor; fuente de publicaciones = Firestore real). Los siete grupos emocionales se añadieron como campo `emotionalGroup` en `src/data/flowers.js` y su taxonomía/labels en `src/data/emotional-groups.ts`. Pendiente real: inventario formal de derechos/resolución de las 38 fotografías (no bloquea el resto, pero sigue abierto).

### Fase 1 — Wireframe y sistema visual ✅ implementada

**Objetivo:** resolver jerarquía sin depender de efectos.

- Wireframe desktop y móvil de las siete escenas.
- Prototipo estático del hero, brújula, atlas y cuaderno vivo.
- Tokens de color, espaciado, radios, textura y movimiento.
- Revisión de copy, contraste y navegación por teclado.

**Salida:** portada completa y convincente sin Three.js.

**Estado:** las siete escenas están construidas directamente en HTML/Astro (sin fase de wireframe separada) en `src/components/home/`: `HomeHero`, `HomeEmotionalCompass`, `HomeFlowerAtlas`, `HomeBachJourney`, `HomeLatestStories`, `HomeCommunityInvitation`, `HomeClosing`. Tokens semánticos (papel, tinta, musgo/moss-text, polen, pétalo, duraciones) en `src/styles/global.css`. La brújula emocional (Escena 2) incluye filtrado real por grupo en `/flores-de-bach` en vez de prometer una funcionalidad inexistente. Verificado: `astro check` y `npm run build` limpios, contraste WCAG AA corregido tras detectar un fallo real (texto verde-musgo sobre papel, ratio 2.2 → corregido a `moss-text` con ratio ≥5), navegación por teclado y `prefers-reduced-motion` probados con Playwright.

### Fase 2 — Spike de interacción ✅ cerrada: Three.js descartado

**Objetivo:** decidir 2.5D frente a 3D con evidencia.

- Variante A: hero 2.5D con recortes, capas y CSS.
- Variante B: escena Three.js encapsulada y con poster idéntico.
- Medición en portátil medio, iPhone/Safari y Android medio.
- Revisión con reducción de movimiento y red lenta.

**Salida:** decisión documentada de continuar o descartar Three.js.

**Estado:** se construyeron y midieron ambas variantes en `HomeHero.astro`:
- **Variante A (2.5D):** `HeroBotanicalFallback.astro` + `hero-parallax.ts`, capas de imagen con paralaje sutil al puntero.
- **Variante B (Three.js, descartada):** escena "Flor en transición" con geometría procedural (pétalos sobre pivotes, sin modelo `.glb` ni recortes fotográficos reales, que no existían en el inventario de assets), activable con `?hero=3d`. Cumplía los presupuestos técnicos (chunk diferido ~135 KB gzip, ~60 fps, sin bloqueo de CTA, accesible), pero tras dos rondas de ajuste de geometría (la primera se leía como un huevo, no como una flor) el resultado visual seguía sin aportar una diferencia perceptible que justificara su coste. Retirada del hero: `hero-scene-3d.ts` y `hero-scene-3d-loader.ts` eliminados, dependencia `three` desinstalada.

**Decisión:** 2.5D es la implementación principal del hero, no un fallback de segunda categoría. No se retoma Three.js salvo que aparezca un concepto visual distinto (p. ej. con un modelo `.glb` real en vez de geometría procedural) que sí se sostenga por sí solo.

### Fase 3 — Implementación Astro ✅ implementada

**Objetivo:** construir por capas y conservar regresión sencilla.

- Reestructurar componentes de portada.
- Integrar publicaciones recientes y sus estados.
- Implementar brújula emocional y atlas.
- Añadir escena aprobada con carga progresiva.
- Mantener links, SEO y contenido base en HTML.

**Salida:** versión candidata en entorno local/preview.

**Estado:** al construir Fase 1 directamente en Astro (sin wireframe separado previo), esta fase quedó cubierta a la vez: componentes de portada reestructurados, publicaciones recientes integradas contra Firestore con estados de carga/vacío (`HomeLatestStories.astro` + `latest-stories.ts`), brújula y atlas implementados. La "escena aprobada" de la Fase 2 es la variante 2.5D (`HeroBotanicalFallback.astro`), ya integrada como parte del hero.

### Fase 4 — QA y afinado (sin empezar)

**Objetivo:** comprobar que la experiencia real sostiene el concepto.

- Auditoría Lighthouse y medición Web Vitals.
- Pruebas de teclado, lector de pantalla, zoom 200 % y reducción de movimiento.
- Pruebas responsive y de orientación.
- Revisión de rutas, autenticación y estados sin datos.
- Compresión final de imágenes, texturas y modelos.

**Salida:** release candidate con criterios de aceptación cumplidos.

**Estado:** no iniciada. La auditoría Lighthouse/Web Vitals y las pruebas en dispositivos móviles reales siguen pendientes — son, de hecho, el mismo trabajo que falta para cerrar la Fase 2 (medir la escena 3D fuera de Chromium de escritorio).

### Fase 5 — Extensión opcional (sin empezar, salvo lo indicado)

Solo después de validar la portada:

- Aplicar el sistema editorial a catálogo, ficha de flor y biografía.
- Filtros reales por grupo emocional.
- Favoritos o itinerarios de lectura, si existe una necesidad de usuario demostrada.
- Transiciones entre páginas puntuales; nunca como requisito para navegar.

**Estado:** el filtro real por grupo emocional en `/flores-de-bach` (botones + `?grupo=` en la URL, `src/scripts/flowers/group-filter.ts`) se adelantó desde la Fase 1 porque la brújula del index no debía prometer un filtrado inexistente. El resto (sistema editorial en ficha/biografía, favoritos, transiciones entre páginas) sigue sin empezar y sigue condicionado a validar antes la portada.

---

## 10. Criterios de aceptación

El rediseño conceptual se considerará logrado cuando:

- La portada se entiende y se puede recorrer con imágenes, animaciones y JavaScript desactivados.
- En cinco segundos se comprende qué es el sitio y cuál es la acción principal.
- La primera pantalla tiene una identidad propia y no parece una plantilla de blog.
- Las publicaciones recientes tienen protagonismo real.
- Catálogo, historia, archivo y comunidad se diferencian por ritmo visual sin perder coherencia.
- No hay dos secciones consecutivas resueltas como rejillas equivalentes de tarjetas.
- La zona de autores deja de competir con el contenido público.
- La experiencia móvil no es una reducción torpe de escritorio.
- La interacción respeta teclado, foco, reducción de movimiento y fallos de WebGL.
- Se cumplen los presupuestos de rendimiento o se descarta la capa 3D.
- `npm run check` y `npm run build` terminan correctamente.

---

## 11. Decisiones pendientes antes de diseñar

1. **Audiencia prioritaria:** curiosos, lectores habituales, practicantes/terapeutas o autores.
2. **Conversión principal:** explorar flores, leer artículos o unirse como autor.
3. **Tratamiento editorial:** nivel de énfasis en experiencia personal frente a contexto histórico y científico.
4. **Publicaciones recientes:** fuente, frecuencia y criterio de selección en portada.
5. **Assets:** derechos de las imágenes actuales y presupuesto para fotografía/ilustración/modelado.
6. **3D:** validar el spike, no aprobarlo por anticipado.

---

## 12. Recomendación final

Construir primero una portada excelente en HTML, CSS y assets botánicos, con una narrativa clara y composiciones menos repetitivas. Después, dedicar un spike corto a una sola escena Three.js en el hero. Si esa escena supera a la versión 2.5D sin comprometer carga, lectura o accesibilidad, se incorpora como mejora progresiva.

El dinamismo que más necesita el proyecto no procede solo del movimiento: procede de **hacer visibles las relaciones entre las flores, la historia y las publicaciones vivas**. El 3D puede ser la puerta; el contenido debe seguir siendo el jardín.

---

## Addendum 2026-08-26 — extracción del sitio Bach

La portada «Herbario vivo», el jardín 3D, las fichas y la biografía se
extrajeron al repositorio hermano `flores-de-bach` (`~/flores-de-bach`,
Astro + Tailwind, sin Firebase). Este blog conserva el sistema de tokens,
el revelado por scroll y las escenas «Cuaderno vivo» y «Comunidad».

Nueva portada del blog (2D, `src/pages/_views/home/index.astro`):

1. `HomeHero` — umbral tipográfico con el arco de años 2011 → año vivo.
2. `HomeLatestStories` — cuaderno vivo (posts reales de Firestore).
3. `HomeYearbooks` — estantería de anuarios, un lomo por año.
4. `HomeCommunityInvitation` — invitación a escribir.
5. `HomeClosing` — cierre editorial.

### El camino del cuaderno (escena 2 en 3D) — implementado 2026-08-26

`HomeStoryPath.astro` + `scripts/home/story-path.ts` + `stories-feed.ts`.

- Las últimas 12 publicaciones se pintan primero en una rejilla 2D (fallback
  y estado sin movimiento). Si hay movimiento permitido, IntersectionObserver
  y ≥ 2 entradas, se cargan `three` + `CSS3DRenderer` (~92 KB) y las mismas
  tarjetas pasan a la escena. Cualquier fallo deja la rejilla.
- Tarjetas = DOM real (texto seleccionable, enlaces, foco). Three.js solo
  las posiciona; no hay WebGL ni geometría.
- Visor `sticky` bajo la cabecera; el scroll nativo de la página mueve la
  cámara (track de `(N) × 0.85 × alto del visor`). Sin scroll secuestrado.
- Distancia focal = perspectiva del visor → tarjeta enfocada a escala 1,
  ancho en px predecible (`--story-card-width`); espaciado, fades y amplitud
  del serpenteo se derivan de ahí. Fade asimétrico: las tarjetas que la
  cámara deja atrás se desvanecen rápido (crecen mucho por perspectiva).
- Paralaje leve con puntero fino; teclado: enfocar una tarjeta desplaza la
  página a su parada. HUD con contador y pista de scroll.
- Tarjeta final «Fin del camino» → anuario del año vivo. Enlaces de tarjeta
  a `/archivo/{año}#post-{id}` (anclas añadidas en `yearbook.ts`).
- Verificado en Chrome headless (1440×1000 y 390×844) con 12 posts reales
  vía `astro dev` + token de depuración de App Check.
