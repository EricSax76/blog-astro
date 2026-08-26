import { NEWEST_ARCHIVE_YEAR } from "../../../data/archive";

export { ARCHIVE_YEARS } from "../../../data/archive";

// Sitio hermano con las 38 flores y la biografía de Edward Bach (repositorio
// `flores-de-bach`). Se enlaza solo cuando PUBLIC_BACH_SITE_URL está definida:
// hasta que exista el dominio no se pinta ningún enlace roto.
export const BACH_SITE_URL: string | undefined =
  import.meta.env.PUBLIC_BACH_SITE_URL || undefined;

export type PrimaryLink = {
  href: string;
  label: string;
  external?: boolean;
};

export const PRIMARY_LINKS: PrimaryLink[] = [
  {
    href: `/archivo/${NEWEST_ARCHIVE_YEAR}`,
    label: `Anuario ${NEWEST_ARCHIVE_YEAR}`,
  },
  ...(BACH_SITE_URL
    ? [{ href: BACH_SITE_URL, label: "Flores de Bach", external: true }]
    : []),
];
