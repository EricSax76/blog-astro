// Años del anuario con página propia: histórico estático (2011–2017) y el año
// vivo de Firestore. Fuente única para header, portada, sitemap y 404.
export const ARCHIVE_YEARS = [2026, 2017, 2016, 2015, 2014, 2013, 2012, 2011] as const;

export const NEWEST_ARCHIVE_YEAR = Math.max(...ARCHIVE_YEARS);
export const OLDEST_ARCHIVE_YEAR = Math.min(...ARCHIVE_YEARS);
