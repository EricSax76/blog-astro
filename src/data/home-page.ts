import { flowers } from "./flowers";

export type HomeTimelineItem = {
  year: string;
  title: string;
  text: string;
};

export type HomeFeaturedFlower = {
  id: number;
  slug: string;
  name: string;
  botanical: string;
  img: string;
  summary: string;
};

export const ARCHIVE_YEARS = [2026, 2017, 2016, 2015, 2014, 2013, 2012, 2011] as const;

export const NEWEST_ARCHIVE_YEAR = Math.max(...ARCHIVE_YEARS);
export const OLDEST_ARCHIVE_YEAR = Math.min(...ARCHIVE_YEARS);

export const HOME_TIMELINE: HomeTimelineItem[] = [
  {
    year: "1886",
    title: "Orígenes en Moseley",
    text: "Nace Edward Bach y comienza una vida orientada a comprender el sufrimiento humano.",
  },
  {
    year: "1912",
    title: "Formación médica",
    text: "Se gradúa en Londres e integra cirugía, bacteriología y salud pública a su enfoque.",
  },
  {
    year: "1928",
    title: "Doce Curadores",
    text: "Identifica las primeras flores en sus caminatas y sienta las bases del sistema floral.",
  },
  {
    year: "1930-1934",
    title: "Sistema completo",
    text: "Completa las 38 esencias y formula Rescue Remedy con un método claro y replicable.",
  },
];

export const HOME_PRINCIPLES = [
  "Simplicidad: contenido comprensible y aplicable.",
  "Individualidad: cada persona vive un proceso emocional distinto.",
  "Autocuración: observar emociones para recuperar equilibrio.",
] as const;

export const HOME_FEATURED_FLOWERS: HomeFeaturedFlower[] = flowers
  .slice(0, 6)
  .map((flower) => ({
    id: flower.id,
    slug: flower.slug,
    name: flower.name,
    botanical: flower.botanical,
    img: flower.img,
    summary:
      flower.desc.length > 130 ? `${flower.desc.slice(0, 127)}...` : flower.desc,
  }));
