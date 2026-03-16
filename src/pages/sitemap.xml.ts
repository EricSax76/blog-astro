import type { APIRoute } from "astro";
import { flowers } from "../data/flowers";

const SITE = "https://el-alma-de-las-flores-blog.web.app";

const archiveYears = [2026, 2017, 2016, 2015, 2014, 2013, 2012, 2011];

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/flores-de-bach", priority: "0.9", changefreq: "monthly" },
  { url: "/biografia", priority: "0.8", changefreq: "monthly" },
  { url: "/aviso-legal", priority: "0.3", changefreq: "yearly" },
  { url: "/privacidad", priority: "0.3", changefreq: "yearly" },
  { url: "/cookies", priority: "0.3", changefreq: "yearly" },
];

const archivePages = archiveYears.map((year) => ({
  url: `/archivo/${year}`,
  priority: "0.6",
  changefreq: "monthly" as const,
}));

const flowerPages = flowers.map((flower) => ({
  url: `/flores-de-bach/${flower.slug}`,
  priority: "0.7",
  changefreq: "yearly" as const,
}));

const allPages = [...staticPages, ...archivePages, ...flowerPages];

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
