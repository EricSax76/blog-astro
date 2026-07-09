// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Salida estática: todo el contenido dinámico (posts, comentarios, likes,
// perfil) se carga en cliente contra Firebase, así que no hay nada que
// renderizar en servidor. Firebase Hosting sirve dist/ directamente
// (ver firebase.json: headers de seguridad y cache).
// https://astro.build/config
export default defineConfig({
  site: 'https://el-alma-de-las-flores-blog.web.app',
  output: 'static',
  vite: {
    plugins: [tailwindcss()]
  }
});
