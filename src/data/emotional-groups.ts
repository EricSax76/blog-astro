export type EmotionalGroupSlug =
  | "fear"
  | "uncertainty"
  | "insufficient-interest"
  | "loneliness"
  | "oversensitivity"
  | "despondency-despair"
  | "over-care-for-others";

export type EmotionalGroup = {
  slug: EmotionalGroupSlug;
  label: string;
  description: string;
};

// Los siete grupos emocionales tradicionales del sistema de Edward Bach.
export const EMOTIONAL_GROUPS: EmotionalGroup[] = [
  {
    slug: "fear",
    label: "Miedo",
    description: "Temores concretos, pánico repentino o presagios sin causa clara.",
  },
  {
    slug: "uncertainty",
    label: "Incertidumbre",
    description: "Duda, indecisión y falta de rumbo ante las propias elecciones.",
  },
  {
    slug: "insufficient-interest",
    label: "Falta de interés por el presente",
    description: "Mente en el pasado o el futuro, apatía y dificultad para anclarse en el hoy.",
  },
  {
    slug: "loneliness",
    label: "Soledad",
    description: "Aislamiento, ya sea buscado con orgullo o sufrido con impaciencia.",
  },
  {
    slug: "oversensitivity",
    label: "Hipersensibilidad",
    description: "Vulnerabilidad ante influencias externas y dificultad para poner límites.",
  },
  {
    slug: "despondency-despair",
    label: "Desesperación",
    description: "Desánimo profundo, agotamiento o culpa que oscurece la confianza en uno mismo.",
  },
  {
    slug: "over-care-for-others",
    label: "Exceso de preocupación por los demás",
    description: "Amor o entrega que se vuelve control, exigencia o rigidez hacia otros.",
  },
];
