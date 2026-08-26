import type { APIRoute } from "astro";
import { ARCHIVE_YEARS } from "../data/archive";

const SITE = "https://el-alma-de-las-flores-blog.web.app";

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/aviso-legal", priority: "0.3", changefreq: "yearly" },
  { url: "/privacidad", priority: "0.3", changefreq: "yearly" },
  { url: "/cookies", priority: "0.3", changefreq: "yearly" },
];

const archivePages = ARCHIVE_YEARS.map((year) => ({
  url: `/archivo/${year}`,
  priority: year === ARCHIVE_YEARS[0] ? "0.9" : "0.6",
  changefreq: year === ARCHIVE_YEARS[0] ? ("weekly" as const) : ("monthly" as const),
}));

const allPages = [...staticPages, ...archivePages];

function toXmlEntry(page: { url: string; priority: string; changefreq: string }) {
  return `  <url>
    <loc>${SITE}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
}

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(toXmlEntry).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
