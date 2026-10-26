export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80';

const parseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value.trim(), window.location.origin);
  } catch {
    return null;
  }
};

const isAllowedImageHost = (host) => host === 'res.cloudinary.com'
  || host === 'images.unsplash.com'
  || host === 'cdn-icons-png.flaticon.com'
  || host.endsWith('.googleusercontent.com');

export const safeImageUrl = (value) => {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || !isAllowedImageHost(url.hostname.toLowerCase())) {
    return FALLBACK_IMAGE;
  }
  return url.href;
};

const isAllowedMapHost = (host) => host === 'goo.gl'
  || host === 'maps.app.goo.gl'
  || /^(?:(?:www|maps)\.)?google\.(?:com|co\.[a-z]{2}|[a-z]{2,3})$/.test(host);

export const safeMapUrl = (value, fallback = '') => {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || !isAllowedMapHost(url.hostname.toLowerCase())) {
    return fallback;
  }
  return url.href;
};

export const directionsUrl = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
};

export const phoneDigits = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(normalized) ? normalized : '';
};

export const telUrl = (value) => {
  const digits = phoneDigits(value);
  return digits ? `tel:+91${digits}` : '';
};

export const whatsappUrl = (value, text = '') => {
  const digits = phoneDigits(value);
  if (!digits) return '';
  return `https://wa.me/91${digits}?text=${encodeURIComponent(String(text || ''))}`;
};

export const upiUrl = (upiId, amount, note = '') => {
  const id = String(upiId || '').trim();
  if (!/^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$/.test(id)) return '';
  const amt = String(amount || '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amt)) return '';
  const params = new URLSearchParams({
    pa: id,
    pn: 'RoomKhojo',
    am: amt,
    cu: 'INR',
    tn: String(note || '')
  });
  return `upi://pay?${params.toString()}`;
};
