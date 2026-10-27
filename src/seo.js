const SITE_NAME = 'RoomKhojo';
const FALLBACK_ORIGIN = 'https://roomkhojoo.vercel.app';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=630&fit=crop&q=80';
const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large';

const PUBLIC_ROUTES = {
  '/': {
    title: 'RoomKhojo — PG, Flat, Hostel & Rooms in Hanumangarh',
    description: 'Hanumangarh me PG, flat, hostel aur room rent par khojo. Map par live listings dekho, owner se direct baat karo aur free me room ad post karo.'
  },
  '/about': {
    title: 'About RoomKhojo — Room & PG Discovery in Hanumangarh',
    description: 'RoomKhojo ka mission, kaam karne ka tareeka aur 29 Dev\'s team ke baare me jaano. Hanumangarh me safe aur simple room discovery.'
  },
  '/terms': {
    title: 'Terms & Conditions — RoomKhojo',
    description: 'RoomKhojo ke terms and conditions: ad approval, platform responsibility, listing rules aur user obligations.'
  },
  '/privacy': {
    title: 'Privacy Policy — RoomKhojo',
    description: 'RoomKhojo privacy policy: personal data, analytics consent, cookies, data retention aur aapke rights.'
  },
  '/refund': {
    title: 'Refund Policy — RoomKhojo',
    description: 'RoomKhojo refund policy: promotional ads, listing fees, early rent-out aur payment rules.'
  }
};

const PRIVATE_ROUTES = ['/dashboard', '/support', '/forgot-password'];
const ROOM_PATH = /^\/rooms\/[a-f0-9]{24}$/i;

const getOrigin = () => {
  try {
    return window.location.origin || FALLBACK_ORIGIN;
  } catch {
    return FALLBACK_ORIGIN;
  }
};

const normalizePath = (value) => {
  const path = String(value || '/').split('?')[0].split('#')[0] || '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path.startsWith('/') ? path : `/${path}`;
};

const absoluteUrl = (path) => `${getOrigin()}${normalizePath(path)}`;

const truncate = (value, max) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const safeImage = (value) => {
  const image = String(value || '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(image) ? image : null;
};

const upsertMeta = (key, content, attribute = 'name') => {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertCanonical = (href) => {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    if (element) element.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
};

const applySeo = ({ title, description, path, image = DEFAULT_IMAGE, robots = DEFAULT_ROBOTS, canonical = true, type = 'website' }) => {
  const url = absoluteUrl(path);
  const safeTitle = truncate(title, 70);
  const safeDescription = truncate(description, 170);

  document.title = safeTitle;
  upsertMeta('description', safeDescription);
  upsertMeta('robots', robots);
  upsertMeta('og:title', safeTitle, 'property');
  upsertMeta('og:description', safeDescription, 'property');
  upsertMeta('og:type', type, 'property');
  upsertMeta('og:url', url, 'property');
  upsertMeta('og:site_name', SITE_NAME, 'property');
  upsertMeta('og:locale', 'hi_IN', 'property');
  upsertMeta('og:image', image, 'property');
  upsertMeta('og:image:alt', safeTitle, 'property');
  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:title', safeTitle);
  upsertMeta('twitter:description', safeDescription);
  upsertMeta('twitter:image', image);
  upsertCanonical(canonical ? url : null);
};

const isPrivatePath = (path, adminPath) => {
  const normalizedAdmin = adminPath ? normalizePath(adminPath) : '';
  if (normalizedAdmin && (path === normalizedAdmin || path.startsWith(`${normalizedAdmin}/`))) return true;
  return PRIVATE_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
};

export const applyRouteSeo = (pathname, { adminPath = '', preserveRoom = false } = {}) => {
  const path = normalizePath(pathname);

  if (preserveRoom && ROOM_PATH.test(path)) return;

  if (isPrivatePath(path, adminPath)) {
    applySeo({
      title: 'RoomKhojo — Private Area',
      description: 'RoomKhojo private account area.',
      path,
      robots: 'noindex,nofollow',
      canonical: false
    });
    return;
  }

  if (ROOM_PATH.test(path)) {
    applySeo({
      title: 'Room for Rent in Hanumangarh — RoomKhojo',
      description: 'RoomKhojo par is room ki photos, price, facilities, location aur owner contact details dekho.',
      path
    });
    return;
  }

  const meta = PUBLIC_ROUTES[path];
  if (meta) {
    applySeo({ ...meta, path });
    return;
  }

  applySeo({
    title: 'Page Not Found — RoomKhojo',
    description: 'Ye page RoomKhojo par nahi mila. Home par wapas jaakar rooms, PG aur flats dhoondho.',
    path,
    robots: 'noindex,follow',
    canonical: false
  });
};

export const applyRoomSeo = (room) => {
  if (!room || !room._id) return;

  const path = `/rooms/${room._id}`;
  const price = String(room.price || '').trim();
  const label = String(room.title || room.category || 'Room').trim();
  const location = String(room.landmark || 'Hanumangarh').trim();
  const details = [room.category, room.type, location].filter(Boolean).join(' • ');
  const title = [label, price].filter(Boolean).join(' — ');
  const description = `${details}. ${room.description || 'Photos, price, facilities aur owner contact RoomKhojo par dekho.'}`;
  const image = safeImage(room.image) || safeImage(Array.isArray(room.images) ? room.images[0] : '') || DEFAULT_IMAGE;

  applySeo({
    title: `${title} | RoomKhojo`,
    description,
    path,
    image
  });
};
