import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const siteUrl = (process.env.VITE_SITE_URL || 'https://roomkhojoo.vercel.app').replace(/\/+$/, '');
const apiBase = (process.env.VITE_API_BASE_URL || 'https://roomkhojo-backend.vercel.app').replace(/\/api\/?$/, '');
const target = path.resolve('dist', 'sitemap.xml');
const today = new Date().toISOString().slice(0, 10);

const staticPages = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund', changefreq: 'yearly', priority: '0.3' }
];

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const dateOf = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? today : date.toISOString().slice(0, 10);
};

const fetchRooms = async () => {
  try {
    const response = await fetch(`${apiBase}/api/rooms`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.rooms) ? data.rooms : [];
  } catch {
    return [];
  }
};

const run = async () => {
  const rooms = await fetchRooms();
  const entries = staticPages.map((page) => ({
    ...page,
    lastmod: today
  }));

  rooms.slice(0, 5000).forEach((room) => {
    if (!room || room.isActive === false || !/^[a-f0-9]{24}$/i.test(String(room._id || ''))) return;
    entries.push({
      path: `/rooms/${room._id}`,
      lastmod: dateOf(room.createdAt),
      changefreq: 'weekly',
      priority: '0.8'
    });
  });

  const seen = new Set();
  const urls = entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });

  const body = urls.map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(`${siteUrl}${entry.path}`)}</loc>`,
    `    <lastmod>${entry.lastmod}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>'
  ].join('\n')).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  await writeFile(target, xml, 'utf8');
  console.log(`sitemap: ${urls.length} URLs (${rooms.length} rooms fetched)`);
};

run().catch((error) => {
  console.warn(`sitemap skipped: ${error.message}`);
});
