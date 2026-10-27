import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const siteUrl = (process.env.VITE_SITE_URL || 'https://roomkhojoo.vercel.app').replace(/\/+$/, '');
const apiBase = (process.env.VITE_API_BASE_URL || 'https://roomkhojo-backend.vercel.app').replace(/\/api\/?$/, '');
const distDir = path.resolve('dist');
const today = new Date().toISOString().slice(0, 10);
const defaultImage = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=630&fit=crop&q=80';
const defaultRobots = 'index,follow,max-image-preview:large';

const publicPages = [
  {
    path: '/about',
    title: 'About RoomKhojo — Room & PG Discovery in Hanumangarh',
    description: 'RoomKhojo ka mission, kaam karne ka tareeka aur 29 Dev\'s team ke baare me jaano. Hanumangarh me safe aur simple room discovery.'
  },
  {
    path: '/terms',
    title: 'Terms & Conditions — RoomKhojo',
    description: 'RoomKhojo ke terms and conditions: ad approval, platform responsibility, listing rules aur user obligations.'
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — RoomKhojo',
    description: 'RoomKhojo privacy policy: personal data, analytics consent, cookies, data retention aur aapke rights.'
  },
  {
    path: '/refund',
    title: 'Refund Policy — RoomKhojo',
    description: 'RoomKhojo refund policy: promotional ads, listing fees, early rent-out aur payment rules.'
  }
];

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const truncate = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const safeImage = (value) => {
  const image = String(value || '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(image) ? image : null;
};

const dateOf = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? today : date.toISOString().slice(0, 10);
};

const replaceMeta = (html, attribute, key, content) => {
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapeRegExp(key)}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
};

const renderPage = (baseHtml, { title, description, route, image = defaultImage }) => {
  const url = `${siteUrl}${route}`;
  const safeTitle = truncate(title, 70);
  const safeDescription = truncate(description, 170);
  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(safeTitle)}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`)
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '');

  html = replaceMeta(html, 'name', 'description', safeDescription);
  html = replaceMeta(html, 'name', 'robots', defaultRobots);
  html = replaceMeta(html, 'property', 'og:title', safeTitle);
  html = replaceMeta(html, 'property', 'og:description', safeDescription);
  html = replaceMeta(html, 'property', 'og:type', 'website');
  html = replaceMeta(html, 'property', 'og:url', url);
  html = replaceMeta(html, 'property', 'og:site_name', 'RoomKhojo');
  html = replaceMeta(html, 'property', 'og:locale', 'hi_IN');
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'property', 'og:image:alt', safeTitle);
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'name', 'twitter:title', safeTitle);
  html = replaceMeta(html, 'name', 'twitter:description', safeDescription);
  html = replaceMeta(html, 'name', 'twitter:image', image);
  return html;
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

const writePage = async (route, html) => {
  const target = path.resolve(distDir, `${route.replace(/^\//, '')}.html`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
};

const roomPage = (baseHtml, room) => {
  const title = [room.title || room.category || 'Room', String(room.price || '').trim()].filter(Boolean).join(' — ');
  const location = room.landmark || 'Hanumangarh';
  const details = [room.category, room.type, location].filter(Boolean).join(' • ');
  const description = `${details}. ${room.description || 'Photos, price, facilities aur owner contact RoomKhojo par dekho.'}`;
  const image = safeImage(room.image) || safeImage(Array.isArray(room.images) ? room.images[0] : '') || defaultImage;
  return renderPage(baseHtml, {
    title: `${title} | RoomKhojo`,
    description,
    route: `/rooms/${room._id}`,
    image
  });
};

const run = async () => {
  const baseHtml = await readFile(path.resolve(distDir, 'index.html'), 'utf8');
  const rooms = await fetchRooms();
  let pageCount = 0;

  for (const page of publicPages) {
    await writePage(page.path, renderPage(baseHtml, { ...page, route: page.path }));
    pageCount += 1;
  }

  const validRooms = rooms.filter((room) => room && room.isActive !== false && /^[a-f0-9]{24}$/i.test(String(room._id || '')));
  for (const room of validRooms) {
    await writePage(`/rooms/${room._id}`, roomPage(baseHtml, room));
    pageCount += 1;
  }

  const entries = [
    { path: '/', changefreq: 'daily', priority: '1.0', lastmod: today },
    ...publicPages.map((page) => ({ path: page.path, changefreq: 'monthly', priority: '0.5', lastmod: today })),
    ...validRooms.map((room) => ({
      path: `/rooms/${room._id}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: dateOf(room.createdAt)
    }))
  ];

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
  await writeFile(path.resolve(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`seo: ${urls.length} sitemap URLs, ${pageCount} static pages, ${rooms.length} rooms fetched`);
};

run().catch((error) => {
  console.warn(`seo generation skipped: ${error.message}`);
});
