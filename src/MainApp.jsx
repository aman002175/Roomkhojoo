import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import * as maplibregl from 'maplibre-gl'; // v6 ESM-only: namespace import (default import hata)
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Phone, MessageCircle, Map as MapIcon, List, Plus, Camera, Target, Info, FileText, Shield, ChevronRight, Menu, User, MapPin, Lock, Search, Navigation, Loader2, AlertTriangle, Heart, Share2, Megaphone, Landmark, TrainFront, Bus, Hospital, Stethoscope, GraduationCap, School, BookOpen, Star, Satellite, Ruler, RefreshCw, Send, Copy, Home, Users, Building2, Briefcase, Hotel, Check, Tag, Image as ImageIcon, LifeBuoy, LogOut } from 'lucide-react';
import { markerIcon, ICON_STAR } from './markerIcons';
import AuthModal from './AuthModal';
import { apiFetch } from './apiFetch'; // P1 #31/#32: timeout + 401 auto-logout (sab calls)

// Effective-featured: promo + expiry valid ho tabhi orange STAR,
// expire ho chuka toh NORMAL green (ad gayab nahi hota).
const isFeatured = (room) => room
  && room.isPromoted
  && (!room.expiryDate || new Date(room.expiryDate) > new Date());

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = VITE_API_BASE_URL ? VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'https://roomkhojo-api.onrender.com'; // P2 #58: sirf trailing /api strip
const API_URL = `${BASE_URL}/api/rooms`;
const ADMIN_API = `${BASE_URL}/api/admin`; 
const getImageUrl = (path) => !path ? 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80' : path.startsWith('http') ? path : `${BASE_URL}${path}`;

// UPI note ke liye local code (asli paymentCode server banata hai)
const makePayCode = () => 'RK-' + Math.random().toString(36).substr(2, 5).toUpperCase();

// Category-wise audience options (PG/Flat/Room/service-wise Boys/Girls/Anyone)
const TYPE_OPTIONS = {
  PG: ['Boys', 'Girls'],
  Flat: ['Boys', 'Girls', 'Anyone'],
  Room: ['Boys', 'Girls', 'Anyone'],
  Hostel: ['Boys', 'Girls'],
  Library: ['Anyone'],
  Office: ['Anyone']
};
const DEFAULT_TYPES = ['Boys', 'Girls', 'Family', 'Anyone'];
const typesForCategory = (cat) => TYPE_OPTIONS[cat] || DEFAULT_TYPES;

// Service providers (tiffin/laundry etc.) — separate listing type + auto banner strip
const SERVICE_CATEGORIES = ['Tiffin / Meals', 'Laundry', 'Tuition / Coaching', 'Gym / Fitness', 'Internet / Cable', 'Cleaning / House Help', 'Water / RO', 'Other Service'];
const savedUserPhone = () => {
  try { return String(JSON.parse(localStorage.getItem('roomkhojo_user') || '{}').phone || ''); } catch { return ''; }
};

// 👁 Session me dekhe gaye room IDs (view-count spam guard, tab lifetime)
const viewedIds = new Set();

// 👁 View-count ping — ref-free + setState-free (render-closures lint-clean rahein)
const markRoomViewed = (room) => {
  if (room && room._id && !viewedIds.has(room._id)) {
    viewedIds.add(room._id);
    apiFetch(`${BASE_URL}/api/rooms/${room._id}/view`, { method: 'PUT' }).catch(() => {});
  }
};

// 🗺️ ORIGINAL OSM Standard raster (shuru wali map — user demand par wapas).
// P2 #44: single host (subdomain nahi — OSM policy + HTTP/2 benefit). maxzoom 19.
const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19
    }
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};

// 🛰️ Satellite view (deep zoom tak coverage — street me gap ho toh ye kaam aayega)
const SAT_STYLE = {
  version: 8,
  sources: {
    esriSat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      maxzoom: 18
    }
  },
  layers: [{ id: 'esriSat', type: 'raster', source: 'esriSat' }]
};

  // 💰 "₹5,500" → 5500 (filter/sort ke liye)
  const priceNum = (p) => Number(String(p || '').replace(/\D/g, '')) || 0;

// 📍 Haversine distance (meters) + format
const distMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
const fmtDist = (m) => {
  const mm = Number(m) || 0;
  return mm < 1000 ? `${mm} m` : `${(mm / 1000).toFixed(1)} km`;
};

// OSM tags → plain-text label (icon alag POI_ICONS se aata hai)
const poiLabel = (tags) => {
  if (!tags) return null;
  if (tags.railway === 'station' || tags.railway === 'halt' || tags.public_transport === 'station') return 'Railway Station';
  if (tags.amenity === 'bus_station') return 'Bus Stand';
  if (tags.highway === 'bus_stop') return tags.name ? 'Bus Stop' : null;
  if (tags.amenity === 'hospital') return 'Hospital';
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors') return 'Clinic';
  if (tags.amenity === 'training') return 'Coaching';
  if (tags.amenity === 'college' || tags.amenity === 'university') return 'College';
  if (tags.amenity === 'school') return 'School';
  return null;
};

// Category label → professional icon (puraane emoji-cats par fallback MapPin)
const POI_ICONS = {
  'Railway Station': TrainFront,
  'Bus Stand': Bus,
  'Bus Stop': Bus,
  'Hospital': Hospital,
  'Clinic': Stethoscope,
  'Coaching': BookOpen,
  'College': GraduationCap,
  'School': School
};
const PoiIcon = ({ cat, size = 14, className = '' }) => {
  const C = POI_ICONS[cat] || MapPin;
  return <C size={size} className={`shrink-0 ${className}`} />;
};

// Category → professional icon (custom categories par Tag fallback)
const CAT_ICONS = { all: Home, PG: Users, Flat: Building2, Room: Home, Hostel: Hotel, Library: BookOpen, Office: Briefcase, __services: Briefcase };
const catIcon = (id) => CAT_ICONS[id] || Tag;

// Overpass API (P2 #43: ab backend proxy se — cache + server-side timeout)
const fetchNearbyPOI = async (lat, lng, radius = 1500) => {
  const res = await apiFetch(`${BASE_URL}/api/geo/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  const data = await res.json();
  if (!data || !data.success) throw new Error((data && data.message) || 'Nearby fail');
  const seen = new Set();
  return (data.elements || [])
    .map((el) => {
      const tags = el.tags || {};
      if (!tags.name) return null;
      const plat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
      const plng = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
      const cat = poiLabel(tags);
      if (!cat) return null;
      const key = `${tags.name}|${plat.toFixed(5)}|${plng.toFixed(5)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { name: tags.name, cat, lat: plat, lng: plng, distM: distMeters(lat, lng, plat, plng) };
    })
    .filter(Boolean)
    .sort((a, b) => a.distM - b.distM)
    .slice(0, 30);
};

// Room gallery: images[] ho toh wahi, warna puraani single image
const roomGallery = (room) => {
  if (room && Array.isArray(room.images) && room.images.length > 0) return room.images.filter(Boolean);
  if (room && room.image) return [room.image];
  return [];
};

// Logged-in API calls ke liye Bearer header
const authHeaders = () => {
  const token = localStorage.getItem('roomkhojo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function MainApp() {
  const navigate = useNavigate();
  const mapContainer = useRef(null); 
  const map = useRef(null); 
  const markersRef = useRef([]);
  const userLocMarkerRef = useRef(null); 
  const submitLockRef = useRef(false); // 🚫 double-submit guard (duplicate ads rokne ke liye)
  const submitAbortRef = useRef(null); // 🛑 P1 #35: cancel-able submit (AbortController)
  const submitCanceledRef = useRef(false); // user ne khud cancel kiya? (timeout se farq)
  const pendingActionRef = useRef(null); // P2 #36: guest ka adhoora kaam (login ke baad resume)
  const suppressPopstateRef = useRef(false); // P2 #39: apna hi back() detect na ho
  const pendingFlyToRef = useRef(null); // P2 #38: map ready hone se pehle ka fly target
  const reportBusyRef = useRef(new Set()); // P2 #41: report double-tap guard (per-room)
  const geoWatchIdRef = useRef(null); // 📍 blue-dot live watch id (unmount par clearWatch — P1 #27)

  const [view, setView] = useState('map'); 
  const [selectedRoom, setSelectedRoom] = useState(null);
  // P2 #40: URL se filters restore (reload/share par reset nahi hote)
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [activeCategory, setActiveCategory] = useState(() => initialParams.get('cat') || 'all');
  const [activeAudience, setActiveAudience] = useState(() => initialParams.get('type') || 'all');
  // 🔍 Filters: price range + sort + radius
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(() => (/^\d+$/.test(initialParams.get('min') || '') ? initialParams.get('min') : ''));
  const [maxPrice, setMaxPrice] = useState(() => (/^\d+$/.test(initialParams.get('max') || '') ? initialParams.get('max') : ''));
  const [sortBy, setSortBy] = useState(() => (['new', 'lo', 'hi'].includes(initialParams.get('sort')) ? initialParams.get('sort') : 'new'));
  const [nearRadius, setNearRadius] = useState(() => ([0, 2, 5, 10].includes(Number(initialParams.get('near'))) ? Number(initialParams.get('near')) : 0));
  const [userLoc, setUserLoc] = useState(null);
  // ❤️ Favorites + 🔗 Share
  const [savedIds, setSavedIds] = useState([]);
  const [shareRoom, setShareRoom] = useState(null);
  const [isSharingCard, setIsSharingCard] = useState(false); // P2 #42: card ban raha hai (loading)
  // P2 #41: kaunse ads report ho chuke (button "Reported" dikhe; reload par bhi yaad rahe)
  const [reportedIds, setReportedIds] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('roomkhojo_reported') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const [bannerRooms, setBannerRooms] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [wantBanner, setWantBanner] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState(() => initialParams.get('q') || ''); 
  
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [authMode, setAuthMode] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };
  
  // Refresh par login bana rahe (session localStorage me hai)
  // 🔐 Session ek hi jagahse validate: token + user dono chahiye, aur token expire ho chuka ho
  // toh chupchaap saaf (app khulte hi surprise "session expire" alert band).
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const t = localStorage.getItem('roomkhojo_token');
      const u = localStorage.getItem('roomkhojo_user');
      if (!t || !u) { localStorage.removeItem('roomkhojo_token'); localStorage.removeItem('roomkhojo_user'); return false; }
      const { exp } = jwtDecode(t);
      if (!exp || exp * 1000 <= Date.now()) { localStorage.removeItem('roomkhojo_token'); localStorage.removeItem('roomkhojo_user'); return false; }
      return true;
    } catch {
      localStorage.removeItem('roomkhojo_token');
      localStorage.removeItem('roomkhojo_user');
      return false;
    }
  });
  
  const [isPostAdOpen, setIsPostAdOpen] = useState(false); 
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const pickSnapshotRef = useRef(null);
  const pickCanceledRef = useRef(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [adType, setAdType] = useState('regular'); 
  const [promoPlan, setPromoPlan] = useState('7'); 
  
  const [showPaymentWindow, setShowPaymentWindow] = useState(false);
  const [payCode, setPayCode] = useState('');

  const [postKind, setPostKind] = useState('room'); // room | service
  const [postDays, setPostDays] = useState('30'); // service listing duration (admin rate × days)
  const [postTitle, setPostTitle] = useState('');
  const [postPrice, setPostPrice] = useState(''); 
  const [postDesc, setPostDesc] = useState('');
  const [postCategory, setPostCategory] = useState('PG');
  const [postType, setPostType] = useState('Boys'); 
  const [postMobile, setPostMobile] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState([]); 
  const [postLandmark, setPostLandmark] = useState('');
  const [postMapUrl, setPostMapUrl] = useState(''); // 🗺️ optional Google Maps link
  // 📞 P1: number reveal — login gate + daily limit + revealed numbers (session)
  const [contactGate, setContactGate] = useState(false);
  const [revealedContacts, setRevealedContacts] = useState({});
  const [contactUsage, setContactUsage] = useState(null);
  const revealBusyRef = useRef(false);
  const [postImages, setPostImages] = useState([]); // [{file, url}] max 6 
  const [isCompressingPhotos, setIsCompressingPhotos] = useState(false); // P2 #37: compress ke dauran UI feedback
  const [postLng, setPostLng] = useState(null);
  const [postLat, setPostLat] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payRef, setPayRef] = useState('');
  // 📍 POI picker states
  const [poiOpen, setPoiOpen] = useState(false);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiList, setPoiList] = useState([]);
  const [poiSelected, setPoiSelected] = useState([]);
  // 🗺️ Map load states (loader + dead-fallback UI ke liye)
  const [mapLoaded, setMapLoaded] = useState(false);
  // WebGL nahi (Brave Shields/purana browser) toh map kabhi nahi chalega — render-time check
  const [mapDead] = useState(() => (maplibregl.supported ? !maplibregl.supported() : false));
  // P2 #44: tiles baar-baar fail → saaf banner (blank map chup-chaap nahi)
  const [mapTilesDown, setMapTilesDown] = useState(false);
  const tileErrCountRef = useRef(0);
  // Street / Satellite toggle
  const [mapStyle, setMapStyle] = useState('street');

  const switchMapStyle = (s) => {
    setMapStyle(s);
    tileErrCountRef.current = 0; // naya source — dobara se gino
    setMapTilesDown(false);
    if (map.current) {
      try { if (map.current) map.current.setStyle(s === 'sat' ? SAT_STYLE : MAP_STYLE); } catch { /* ignore */ }
    }
  };

  const [sysSettings, setSysSettings] = useState({
    categories: ['PG', 'Flat', 'Hostel', 'Library', 'Office'],
    pricing: { regular: '0', promo7: '299', promo15: '499', promo30: '899', upiId: 'admin@ybl', bannerPrice: '499', bannerDays: '7', serviceDailyRate: '0' }
  });

  // Hotfix: batch-9 refactor me ye definition galti se delete ho gayi thi — chips row "dynamicCategories is not defined" crash karta tha
  const dynamicCategories = [{ id: 'all', name: 'All Rooms' }, ...(sysSettings.categories || []).map(cat => ({ id: cat, name: cat }))];
  const isServiceView = activeCategory === '__services';
  const serviceListingCount = rooms.filter(r => r.listingType === 'service').length;
  const serviceDailyRate = Math.max(0, Math.floor(Number(sysSettings.pricing && sysSettings.pricing.serviceDailyRate) || 0));
  const serviceDaysNum = Math.max(0, Math.floor(Number(postDays) || 0));
  const serviceFee = serviceDailyRate * serviceDaysNum;

  // P1 #33: rooms load-fail par misleading "koi result nahi" nahi — error card + Retry
  const [roomsError, setRoomsError] = useState(false);
  const [roomsReloadKey, setRoomsReloadKey] = useState(0);
  // P1 #34: offline banner + cached list (net na ho toh purane ads dikhein)
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  // P2 #61: PromoPopup ko batao jab koi critical modal khula ho (payment/auth/form/popup)
  useEffect(() => {
    const anyModal = Boolean(selectedRoom || authMode || isPostAdOpen || showPaymentWindow || showLocationWarning || isPickingLocation || isMenuOpen || contactGate);
    window.__rkModalOpen = anyModal;
    window.dispatchEvent(new Event('rk:modal'));
  }, [selectedRoom, authMode, isPostAdOpen, showPaymentWindow, showLocationWarning, isPickingLocation, isMenuOpen, contactGate]);

  // P2 #59: logout (menu drawer se) — session clear + reload se saara state reset
  const handleLogout = () => {
    localStorage.removeItem('roomkhojo_user');
    localStorage.removeItem('roomkhojo_token');
    window.location.reload();
  };

  useEffect(() => {
    setRoomsError(false);
    apiFetch(`${API_URL}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRooms(data.rooms);
          // P1 #34: agle offline ke liye cache (1.5MB se bada ho toh skip)
          try { const json = JSON.stringify(data.rooms || []); if (json.length < 1500000) localStorage.setItem('roomkhojo_rooms_cache', json); } catch { /* cache optional */ }
          // 🔗 P2 #38/#39: shared link → popup + map fly; ad na mile toh saaf message (silent nahi)
          const rid = new URLSearchParams(window.location.search).get('room');
          if (rid) {
            const found = (data.rooms || []).find(r => r._id === rid);
            if (found) {
              setSelectedRoom(found);
              // reload ke waqt duplicate history entry na bane
              if (!(window.history.state && window.history.state.roomPopup)) window.history.pushState({ roomPopup: true }, '', window.location.href);
              flyWhenReady(found.lng, found.lat, 16);
            } else {
              alert('Ye ad ab available nahi hai — delete ho gayi ya expire ho chuki hai.');
              cleanRoomParam();
            }
          }
        } else setRoomsError(true);
      })
      .catch(() => {
        // P1 #33/#34: pehle cached list try karo (offline-friendly), warna error card
        try {
          const cached = JSON.parse(localStorage.getItem('roomkhojo_rooms_cache') || 'null');
          if (Array.isArray(cached) && cached.length > 0) setRooms(cached);
          else setRoomsError(true);
        } catch { setRoomsError(true); }
      });
    apiFetch(`${ADMIN_API}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setSysSettings(data.settings);
          if (data.settings.categories.length > 0) setPostCategory(data.settings.categories[0]);
        }
      })
      .catch(() => { /* settings optional: defaults use honge */ });
  }, [roomsReloadKey]);

  // 📞 P1: logged-in user ka number-reveal usage (login par + har list refresh par)
  useEffect(() => {
    if (!isLoggedIn) { setContactUsage(null); setRevealedContacts({}); return; }
    apiFetch(`${API_URL}/contact-usage`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setContactUsage({ used: data.used, limit: data.limit, remaining: data.remaining }); })
      .catch(() => { /* usage optional */ });
  }, [isLoggedIn, roomsReloadKey]);

  // P1 #34: online/offline events — wapas online hote hi rooms auto-refresh
  useEffect(() => {
    const goOnline = () => { setIsOffline(false); setRoomsReloadKey(k => k + 1); };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // P2 #40: filter badle → URL me likho (replaceState; ?room= wala param safe rehta hai)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ['cat', 'type', 'q', 'min', 'max', 'sort', 'near'].forEach(k => params.delete(k));
    if (activeCategory !== 'all') params.set('cat', activeCategory);
    if (activeAudience !== 'all') params.set('type', activeAudience);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (minPrice !== '') params.set('min', minPrice);
    if (maxPrice !== '') params.set('max', maxPrice);
    if (sortBy !== 'new') params.set('sort', sortBy);
    if (nearRadius !== 0) params.set('near', String(nearRadius));
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
  }, [activeCategory, activeAudience, searchQuery, minPrice, maxPrice, sortBy, nearRadius]);

  // Login/signup success par session save (token + user)
  const saveSession = (token, userData) => {
    localStorage.setItem('roomkhojo_token', token);
    localStorage.setItem('roomkhojo_user', JSON.stringify(userData));
    setIsLoggedIn(true);
    setAuthMode(null);
    // P2 #36: guest ne Post Ad tap kiya tha → login ke baad form khud khul jaye
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending === 'postAd') openPostAdForm();
  };

  // 🔐 P1 #32: kabhi bhi 401 (session expire) → auto logout + login screen
  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail !== 'user') return;
      setIsLoggedIn(false);
      setAuthMode('login');
      alert('Aapka session expire ho gaya. Dobara login karein.');
    };
    window.addEventListener('rk:auth-expired', onExpired);
    return () => window.removeEventListener('rk:auth-expired', onExpired);
  }, []);

  // 🔐 Dashboard se bounce hone par (token missing/expire) login modal khud khule — one-shot flag
  useEffect(() => {
    if (sessionStorage.getItem('roomkhojo_need_login')) {
      sessionStorage.removeItem('roomkhojo_need_login');
      setAuthMode('login');
    }
  }, []);

  // 💰 Dual-range slider logic (0–20000, ends = no limit)
  const PRICE_CAP = 20000;
  const priceLo = minPrice === '' ? 0 : Number(minPrice);
  const priceHi = maxPrice === '' ? PRICE_CAP : Number(maxPrice);
  const onMinSlide = (v) => {
    const n = Number(v);
    setMinPrice(n <= 0 ? '' : String(Math.min(n, priceHi)));
  };
  const onMaxSlide = (v) => {
    const n = Number(v);
    setMaxPrice(n >= PRICE_CAP ? '' : String(Math.max(n, priceLo)));
  };
  const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  // Dots ko ungli/mouse se ghaseeto (pointer drag — har browser me same).
  // Ref-free: track element event se milta hai (lint-clean).
  const onDotDown = (which) => (e) => {
    e.preventDefault();
    const track = e.currentTarget.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const toVal = (clientX) => {
      const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      return Math.round(((pct / 100) * PRICE_CAP) / 500) * 500;
    };
    const move = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      const v = toVal(ev.touches ? ev.touches[0].clientX : ev.clientX);
      if (which === 'min') onMinSlide(v);
      else onMaxSlide(v);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up); // P2 #46: cancel par bhi cleanup (leak nahi)
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
  };

  const getAdAmount = () => {
    if (postKind === 'service') return String(serviceFee);
    if (adType === 'regular') return sysSettings.pricing.regular;
    if (promoPlan === '7') return sysSettings.pricing.promo7;
    if (promoPlan === '15') return sysSettings.pricing.promo15;
    if (promoPlan === '30') return sysSettings.pricing.promo30;
    return '0';
  };

  // Total = ad amount + banner add-on (dono admin-pricing se)
  const getPayAmount = () => {
    const ad = Number(getAdAmount() || 0);
    const banner = wantBanner && postKind !== 'service' ? Number(sysSettings.pricing.bannerPrice || 0) : 0;
    return String(ad + banner);
  };

  // 📍 Blue dot marker create/update (guarded — map null ho toh crash nahi; P1 #27/#29)
  const updateUserMarker = (latitude, longitude) => {
    if (!map.current) return;
    if (userLocMarkerRef.current) {
      userLocMarkerRef.current.setLngLat([longitude, latitude]);
      return;
    }
    const el = document.createElement('div'); el.className = 'w-5 h-5 bg-blue-500 border-[3px] border-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse';
    userLocMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map.current);
  };

  const handleLiveLocation = (sharp = false) => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition((pos) => {
        setIsLocating(false);
        // User ne location-pick cancel kiya — late GPS callback form/map ko chhuna nahi chahiye.
        if (sharp && pickCanceledRef.current) { pickCanceledRef.current = false; return; }
        const { latitude, longitude, accuracy } = pos.coords;
        const acc = Math.round(accuracy || 0);
        setGpsAccuracy(acc);
        const zoom = sharp ? (acc <= 30 ? 18 : acc <= 100 ? 17 : acc <= 300 ? 16 : 15) : (acc <= 100 ? 16.5 : 15.5);
        if(map.current) map.current.flyTo({ center: [longitude, latitude], zoom });
        setPostLng(longitude); setPostLat(latitude);
        updateUserMarker(latitude, longitude);
        // P1 #27: pehli location ke baad live watch chalu — blue dot stale nahi rehta.
        // (Permission ab mil chuki hai; unmount par clearWatch neeche wale effect me.)
        if (geoWatchIdRef.current === null) {
          geoWatchIdRef.current = navigator.geolocation.watchPosition(
            (p) => updateUserMarker(p.coords.latitude, p.coords.longitude),
            () => { /* watch fail: purana dot hi dikhega, crash nahi */ },
            { enableHighAccuracy: false, maximumAge: 20000, timeout: 20000 }
          );
        }
      }, () => {
        setIsLocating(false);
        if (sharp && pickCanceledRef.current) { pickCanceledRef.current = false; return; }
        alert("Location permission denied ya accuracy issue hai. Kripya map par drag karke location pin karein.");
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }
  };

  // 📍 P1 #26: form se GPS refresh — stale/purana pin kabhi bhi update kar sakte ho.
  // Low accuracy (>150m) par purana pin CHUPKE se overwrite nahi hota — warning modal.
  const refreshGpsPin = () => {
    if (!navigator.geolocation) return alert('Browser location support nahi karta.');
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const acc = Math.round(pos.coords.accuracy || 0);
      setIsLocating(false);
      setGpsAccuracy(acc);
      if (acc > 150) { setShowLocationWarning(true); return; }
      setPostLng(pos.coords.longitude); setPostLat(pos.coords.latitude);
      updateUserMarker(pos.coords.latitude, pos.coords.longitude);
      reverseGeocode(pos.coords.latitude, pos.coords.longitude); // P1 #25
      if (map.current) map.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 });
    }, () => {
      setIsLocating(false);
      alert('Location nahi mili — GPS/permission check karke dobara try karein.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  // 📍 P1 #25: reverse geocoding — pin ke address se landmark auto-fill
  // (sirf tab jab landmark khaali ho — user ka likha kabhi overwrite nahi)
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await apiFetch(`${BASE_URL}/api/geo/reverse?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      const raw = (data && data.address) || '';
      const label = String(raw).split(',').map(s => s.trim()).filter(Boolean).slice(0, 3).join(', ');
      if (label) setPostLandmark(prev => (prev && prev.trim() ? prev : label.slice(0, 120)));
    } catch { /* optional: landmark khaali rahega, user khud likh sakta hai */ }
  };

  const handleMapSearch = async (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      if (!searchQuery.trim()) return;
      try {
        const res = await apiFetch(`${BASE_URL}/api/geo/search?q=${encodeURIComponent(searchQuery.trim())}`); const data = await res.json();
        const first = data && data.success && Array.isArray(data.results) ? data.results[0] : null;
        if (first) { if (map.current) map.current.flyTo({ center: [first.lng, first.lat], zoom: 13, speed: 1.5 }); } else { alert(`Nahi mila.`); }
      } catch { /* search fail: user dobara try karega */ }
    }
  };

  const initiatePayment = () => {
    if(!postTitle || !postPrice || !postMobile) return alert(postKind === 'service' ? "Service name, Price aur Mobile zaroori hai!" : "Title, Price aur Mobile zaroori hai!");
    if (!/^[6-9]\d{9}$/.test(String(postMobile).replace(/\D/g, '').slice(-10))) return alert("Sahi 10-digit mobile number dalein.");
    if (postKind === 'service') {
      const days = Number(postDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) return alert('Service listing duration 1 se 365 din ke beech chunein.');
    }
    if(!postLng || !postLat) return alert("Kripya map par location select karein! 'Map' button par click karein ya Live Location chunein.");
    const amount = getPayAmount();
    if (amount === '0' || amount === '') {
      // ✅ P0 fix: bina confirm ke publish nahi (free bhi)
      if (!window.confirm('Ad publish karna hai? Confirm karein.')) return;
      submitAd(); 
    } else {
      // 🔁 P0 fix: same ad ka same code reuse — cancel ke baad naya code na bane (payment mismatch na ho)
      if (!payCode) setPayCode(makePayCode());
      setShowPaymentWindow(true);
    }
  };

  const submitAd = async () => {
    if (submitLockRef.current) return; // 🚫 P0 fix: double-tap par 2 ads nahi
    submitLockRef.current = true;
    setIsSubmitting(true);
    // 🛑 P1 #35: 60s timeout + Cancel — "Verifying..." kabhi indefinite nahi
    const controller = new AbortController();
    submitAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const fd = new FormData();
      fd.append('listingType', postKind);
      if (postKind === 'service') fd.append('serviceDays', String(serviceDaysNum));
      fd.append('title', postTitle); fd.append('price', `₹${postPrice}`); fd.append('category', postCategory); fd.append('type', postKind === 'service' ? 'Service' : postType); fd.append('landmark', postLandmark); fd.append('mobile', postMobile);
      fd.append('description', postKind === 'service' ? postDesc.trim() : selectedFacilities.join(', '));
      fd.append('lng', postLng); fd.append('lat', postLat); fd.append('isPromoted', adType === 'promo');
      fd.append('promoPlan', adType === 'promo' ? promoPlan : 'regular');
      fd.append('paymentRef', payRef.trim());
      if (payCode) fd.append('paymentCode', payCode); // 💳 P0 fix: UPI note wala HI code server ko (admin ko wahi dikhega)
      fd.append('bannerRequested', wantBanner);
      fd.append('bannerRef', payRef.trim());
      fd.append('landmarks', JSON.stringify(poiSelected));
      fd.append('googleMapUrl', postMapUrl.trim()); // 🗺️ optional — link se location accurate hogi
      postImages.forEach(p => fd.append('images', p.file));

      // NOTE: userId/ownerName server token se leta hai (spoof-proof).
      const res = await apiFetch(API_URL, { method: 'POST', headers: authHeaders(), body: fd, signal: controller.signal });
      const data = await res.json().catch(() => null);
      if(data && data.success) { 
        alert(data.message || 'Ad submitted!'); 
        // ⚡ Instant listing: approved ad turant list/map me dikhao (site reload ka wait nahi)
        const fresh = data.room;
        if (fresh && fresh.isApproved && fresh.isActive) {
          setRooms(prev => {
            const next = prev.some(r => r._id === fresh._id) ? prev : [fresh, ...prev];
            try { const json = JSON.stringify(next); if (json.length < 1500000) localStorage.setItem('roomkhojo_rooms_cache', json); } catch { /* cache optional */ }
            return next;
          });
          if (fresh.mobile) setRevealedContacts(prev => ({ ...prev, [fresh._id]: fresh.mobile })); // apna number turant dikhe
          setSelectedRoom(fresh);
          flyWhenReady(fresh.lng, fresh.lat, 16);
        }
        setRoomsReloadKey(k => k + 1); // 🔄 background me server se sync (source of truth)
        resetPostForm(); // P2 #45: pura reset (pehle landmark/category/plan stale reh jate the)
      } else {
        // ⚠️ P0 fix: fail par SILENT nahi — asli reason dikhao
        alert((data && data.message) || `Ad submit nahi hua (error ${res.status}). Dobara try karein.`);
      }
    } catch (err) {
      if (submitCanceledRef.current) alert('Submit cancel kar diya — ad publish nahi hua.');
      else if (err && err.name === 'AbortError') alert('Submit time out ho gaya (60s). Internet check karke dobara try karein.');
      else alert("Server connection failed.");
    } finally {
      clearTimeout(timeoutId);
      submitAbortRef.current = null;
      submitCanceledRef.current = false;
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // 🛑 P1 #35: submit beech me rok do (payment window / form dono se)
  const cancelSubmit = () => {
    submitCanceledRef.current = true;
    if (submitAbortRef.current) submitAbortRef.current.abort();
  };

  // P2 #45: submit ke baad PURA form reset — landmark/category/pin/plan kuch bhi stale na rahe
  const resetPostForm = () => {
    setIsPostAdOpen(false); setShowPaymentWindow(false); setIsPickingLocation(false);
    setPostKind('room'); setPostDays('30'); setPostTitle(''); setPostPrice(''); setPostDesc(''); setPostMobile(savedUserPhone()); setPostLandmark(''); setPostMapUrl('');
    const defaultCat = (sysSettings.categories && sysSettings.categories[0]) || 'PG';
    setPostCategory(defaultCat); setPostType(typesForCategory(defaultCat)[0]);
    setSelectedFacilities([]); setPoiSelected([]); pickSnapshotRef.current = null; pickCanceledRef.current = false;
    setPostLng(null); setPostLat(null); setGpsAccuracy(null);
    setAdType('regular'); setPromoPlan('7'); setWantBanner(false);
    setPayRef(''); setPayCode('');
    setPostCategory((sysSettings.categories && sysSettings.categories[0]) || 'PG');
    clearPostPhotos();
  };

  useEffect(() => {
    if (map.current || mapDead) return;
    map.current = new maplibregl.Map({ container: mapContainer.current, style: MAP_STYLE, center: [74.3218, 29.5894], zoom: 13, maxZoom: 19, attributionControl: { compact: true } });
    map.current.on('load', () => {
      setMapLoaded(true);
      // P2 #38: rooms map se pehle aa gaye the → pending fly ab
      if (pendingFlyToRef.current) {
        const t = pendingFlyToRef.current;
        pendingFlyToRef.current = null;
        try { map.current.flyTo({ center: [t.lng, t.lat], zoom: t.zoom || 16 }); } catch { /* map dead → ignore */ }
      }
    });
    // P2 #44: tile-load errors gino — 6 ke baad banner ("internet check / satellite try")
    map.current.on('error', (e) => {
      const isTileErr = !!(e && e.tile) || /tile|failed to fetch|network/i.test(String((e && e.error && e.error.message) || ''));
      if (!isTileErr) return;
      tileErrCountRef.current += 1;
      if (tileErrCountRef.current >= 6) setMapTilesDown(true);
    });
    // 🧹 P1 #28: unmount (ya map dead) par poora map destroy — WebGL context/workers leak na ho
    return () => {
      if (userLocMarkerRef.current) { userLocMarkerRef.current.remove(); userLocMarkerRef.current = null; }
      markersRef.current.forEach(m => m.remove()); markersRef.current = [];
      if (map.current) { map.current.remove(); map.current = null; }
      setMapLoaded(false);
    };
  }, [mapDead]);

  // 🛑 P1 #27: geolocation watch unmount par band (battery + memory)
  useEffect(() => () => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, []);

  // 👁 P2 #46: view-count sirf 3s dwell ke baad (turant open-close se count na badhe)
  useEffect(() => {
    if (!selectedRoom || !selectedRoom._id) return;
    const t = setTimeout(() => markRoomViewed(selectedRoom), 3000);
    return () => clearTimeout(t);
  }, [selectedRoom]);

  // 🔙 P2 #39: phone back button popup band kare (pushState/popstate sync)
  useEffect(() => {
    const onPop = () => {
      if (suppressPopstateRef.current) {
        // apna hi history.back() tha (close button) → URL bhi saaf
        suppressPopstateRef.current = false;
        setSelectedRoom(null);
        if (new URLSearchParams(window.location.search).get('room')) cleanRoomParam();
        return;
      }
      const rid = new URLSearchParams(window.location.search).get('room');
      if (rid) setSelectedRoom(rooms.find(r => r._id === rid) || null);
      else setSelectedRoom(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [rooms]);

  // useMemo: har render par nayi array NA banao — warna markers bekaar me rebuild (flicker)
  const filteredRooms = useMemo(() => rooms.filter(r => {
    const isServiceRoom = r.listingType === 'service';
    // Room tab me sirf rooms; Service tab me sirf service providers.
    const matchesCategory = activeCategory === '__services'
      ? isServiceRoom
      : (activeCategory === 'all' ? !isServiceRoom : (!isServiceRoom && r.category === activeCategory));
    const matchesAudience = isServiceRoom || activeAudience === 'all' || (r.type || '') === activeAudience;
    const price = priceNum(r.price);
    const okMin = minPrice === '' || price >= Number(minPrice);
    const okMax = maxPrice === '' || price <= Number(maxPrice);
    let okNear = true;
    if (nearRadius !== 0 && userLoc) {
      okNear = distMeters(userLoc.lat, userLoc.lng, r.lat, r.lng) <= nearRadius * 1000;
    }
    const searchStr = searchQuery.toLowerCase();
    // P1 #30: title/type/category missing ho (purana/khaali data) toh bhi crash nahi
    const matchesSearch = (r.title || '').toLowerCase().includes(searchStr) || (r.landmark || 'hanumangarh').toLowerCase().includes(searchStr) || (r.type || '').toLowerCase().includes(searchStr) || (r.category || '').toLowerCase().includes(searchStr) || (r.listingType === 'service' && 'service'.includes(searchStr));
    return matchesCategory && matchesAudience && matchesSearch && okMin && okMax && okNear;
  }), [rooms, activeCategory, activeAudience, searchQuery, minPrice, maxPrice, nearRadius, userLoc]);

  // Sort: newest / price low-high / high-low
  const sortedRooms = useMemo(() => [...filteredRooms].sort((a, b) => {
    if (sortBy === 'lo') return priceNum(a.price) - priceNum(b.price);
    if (sortBy === 'hi') return priceNum(b.price) - priceNum(a.price);
    return new Date(b.createdAt) - new Date(a.createdAt);
  }), [filteredRooms, sortBy]);

  const activeFilterCount = (minPrice !== '' ? 1 : 0) + (maxPrice !== '' ? 1 : 0)
    + (sortBy !== 'new' ? 1 : 0) + (nearRadius !== 0 ? 1 : 0);

  // 📍 Nearby radius cycle (location lekar)
  const cycleRadius = () => {
    const opts = [0, 2, 5, 10];
    const next = opts[(opts.indexOf(nearRadius) + 1) % opts.length];
    if (next === 0) { setNearRadius(0); return; }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearRadius(next); },
        () => alert('Location on karo nearby filter ke liye.'),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else alert('Browser location not supported.');
  };

  // 🎯 Banner strip data + auto-flip (har 4 sec)
  useEffect(() => {
    apiFetch(`${BASE_URL}/api/rooms/banners`)
      .then(res => res.json())
      .then(data => { if (data.success) { setBannerRooms(data.rooms || []); setBannerIndex(0); } })
      .catch(() => { /* banner optional: strip chhupa rahega */ });
  }, []);

  useEffect(() => {
    if (bannerRooms.length < 2) return;
    const t = setInterval(() => setBannerIndex(i => (i + 1) % bannerRooms.length), 4000);
    return () => clearInterval(t);
  }, [bannerRooms.length]);

  // 📍 POI modal: pinned location (ya map center) ke aas-paas dhoondo
  const openPoiPicker = async () => {
    let lat = postLat;
    let lng = postLng;
    if ((lat === null || lat === undefined) && map.current) {
      const c = map.current.getCenter();
      lat = c.lat; lng = c.lng;
    }
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return alert('Pehle Map button se location pin karein, phir landmarks dekhein.');
    }
    setPoiOpen(true);
    setPoiLoading(true);
    setPoiList([]);
    try {
      setPoiList(await fetchNearbyPOI(lat, lng));
    } catch {
      alert('Nearby jagah load nahi hui. Internet check karke dobara try karein.');
    }
    setPoiLoading(false);
  };

  const togglePoi = (poi) => {
    setPoiSelected(prev => {
      const exists = prev.some(p => p.name === poi.name && p.lat === poi.lat && p.lng === poi.lng);
      if (exists) return prev.filter(p => !(p.name === poi.name && p.lat === poi.lat && p.lng === poi.lng));
      if (prev.length >= 5) { alert('Max 5 landmarks select kar sakte ho.'); return prev; }
      return [...prev, poi];
    });
  };

  // 🗜️ P2 #37: canvas resize — bhaari phone photos (3-8MB) chhoti JPEG me (fast upload)
  const compressImage = (file, maxDim = 1600, quality = 0.8) => new Promise(resolve => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob || blob.size >= file.size) return resolve(file); // chhota tha / fail → original
            resolve(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        } catch { resolve(file); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch { resolve(file); }
  });

  // 📸 Multi-photo picker (max 6) + compress + object-URL leak-proof (P2 #37)
  const addPostPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // same file dobara select ho sake
    if (files.length === 0) return;
    const room = 6 - postImages.length;
    if (room <= 0) { alert('Max 6 photos — pehle koi photo hatao.'); return; }
    let picked = files;
    if (files.length > room) { alert(`Sirf ${room} aur photo add ho sakti hain (max 6) — baaki skip.`); picked = files.slice(0, room); }
    setIsCompressingPhotos(true);
    try {
      const processed = [];
      for (const f of picked) {
        const cf = await compressImage(f);
        processed.push({ file: cf, url: URL.createObjectURL(cf) });
      }
      setPostImages(prev => {
        const next = [...prev, ...processed];
        next.slice(6).forEach(p => { if (p.url) URL.revokeObjectURL(p.url); }); // overflow URLs leak na ho
        return next.slice(0, 6);
      });
    } finally {
      setIsCompressingPhotos(false);
    }
  };

  const removePostPhoto = (idx) => {
    setPostImages(prev => {
      const item = prev[idx];
      if (item && item.url) URL.revokeObjectURL(item.url);
      return prev.filter((_, j) => j !== idx);
    });
  };

  const clearPostPhotos = () => {
    setPostImages(prev => {
      prev.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
      return [];
    });
  };

  // 📍 P2 #38: map ready ho ya na ho — fly guaranteed (late map ke liye pending)
  const flyWhenReady = (lng, lat, zoom = 16) => {
    if (map.current) {
      try { map.current.flyTo({ center: [lng, lat], zoom }); return; } catch { /* map dead → pending */ }
    }
    pendingFlyToRef.current = { lng, lat, zoom };
  };

  // Popup khulne par link me ?room=id lagao (share/copy ke liye) + back-button history entry (P2 #39)
  const openRoomPopup = (room) => {
    setSelectedRoom(room);
    if (room && room._id) {
      const p = new URLSearchParams(window.location.search);
      p.set('room', room._id);
      const url = `?${p.toString()}`;
      if (window.history.state && window.history.state.roomPopup) window.history.replaceState({ roomPopup: true }, '', url);
      else window.history.pushState({ roomPopup: true }, '', url);
    }
  };

  const openBannerRoom = (e) => {
    const b = bannerRooms[Number(e.currentTarget.dataset.roomIdx)];
    if (!b) return;
    openRoomPopup(b); // P2 #39: URL/history bhi sahi
    setView('map');
    if (map.current) map.current.flyTo({ center: [b.lng, b.lat], zoom: 15.5 });
  };

  // ❤️ Favorites load (login par) + toggle
  useEffect(() => {
    if (!isLoggedIn) return;
    apiFetch(`${BASE_URL}/api/users/favorites`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.success) setSavedIds((data.rooms || []).map(r => r._id));
        else setSavedIds([]);
      })
      .catch(() => setSavedIds([]));
  }, [isLoggedIn]);

  const toggleFavorite = async (roomId) => {
    if (!isLoggedIn) { setAuthMode('login'); return; }
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/favorites/${roomId}/toggle`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (data.success) setSavedIds(prev => data.saved ? [...prev, roomId] : prev.filter(id => id !== roomId));
      else alert(data.message || 'Fail ho gaya.');
    } catch { alert('Server connection failed.'); }
  };

  // 🔗 Share helpers — FRONTEND deep-link (app seedha ad kholegi).
  // (Backend /r/:id ab sirf puraane links ka redirect-fallback hai.)
  const shareUrl = (room) => `${window.location.origin}/?room=${room._id}`;
  const shareText = (room) => `${room.title} — ${room.price} (${room.category} • ${room.type})\n${room.landmark || 'Hanumangarh'}\nDekho: ${shareUrl(room)}`;

  const shareWhatsApp = (room) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText(room))}`, '_blank');
  };

  const copyShareLink = async (room) => {
    try {
      await navigator.clipboard.writeText(shareText(room));
      alert('Link copy ho gaya!');
    } catch { alert(shareUrl(room)); }
  };

  const nativeShare = async (room) => {
    if (navigator.share) {
      try { await navigator.share({ title: room.title, text: `${room.title} — ${room.price}`, url: shareUrl(room) }); } catch { /* user ne cancel kiya */ }
    } else copyShareLink(room);
  };

  // 🖼️ Visiting-card IMAGE banao (canvas) — WhatsApp par waisa-ka-waisa card jayega
  const loadCardPhoto = (url) => new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

  const wrapCardText = (ctx, text, x, y, maxW, lh, maxLines) => {
    const words = String(text || '').split(' ').filter(Boolean);
    let line = '';
    let yy = y;
    let lines = 0;
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line && lines + 1 < maxLines) {
        ctx.fillText(line, x, yy);
        line = w; yy += lh; lines += 1;
      } else if (ctx.measureText(t).width > maxW && line) {
        ctx.fillText(`${line}…`, x, yy);
        return yy;
      } else line = t;
    }
    if (line) ctx.fillText(line, x, yy);
    return yy;
  };

  const drawShareCard = async (room) => {
    const W = 900;
    const H = 1260;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // Photo (cover crop) ya brand placeholder
    const photoUrl = roomGallery(room)[0];
    const photo = await loadCardPhoto(photoUrl ? getImageUrl(photoUrl) : null);
    if (photo) {
      const scale = Math.max(900 / photo.width, 560 / photo.height);
      const dw = photo.width * scale;
      const dh = photo.height * scale;
      ctx.drawImage(photo, (900 - dw) / 2, (560 - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#0d9488';
      ctx.fillRect(0, 0, 900, 560);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 72px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RoomKhojo', 450, 300);
    }
    // Price pill
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(36, 456, 300, 72, 36);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(room.price || ''), 66, 506);
    if (room.isPromoted) {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.roundRect(36, 36, 250, 64, 32);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.fillText('FEATURED', 62, 80);
    }
    // Details
    let y = 660;
    ctx.fillStyle = '#111827';
    ctx.font = '900 46px system-ui, sans-serif';
    y = wrapCardText(ctx, room.title, 40, y, 820, 56, 2) + 44;
    ctx.fillStyle = '#6b7280';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(`${room.category || ''} • ${room.type || ''}`, 40, y);
    y += 48;
    ctx.fillText(`Landmark: ${room.landmark || 'Hanumangarh'}`, 40, y);
    y += 48;
    ctx.fillStyle = '#111827';
    ctx.fillText(`${room.ownerName || 'Owner'}`, 40, y); // P2 #46: mobile card par public NAHI (privacy)
    y += 52;
    if (room.description) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '700 27px system-ui, sans-serif';
      const facs = String(room.description).split(', ').slice(0, 6).join(' • ');
      y = wrapCardText(ctx, facs, 40, y, 820, 38, 2) + 44;
    }
    if (Array.isArray(room.landmarks) && room.landmarks.length > 0) {
      ctx.fillStyle = '#7c3aed';
      ctx.font = '700 27px system-ui, sans-serif';
      room.landmarks.slice(0, 2).forEach((l) => {
        ctx.fillText(`${l.name || ''} (${fmtDist(l.distM)})`, 40, y);
        y += 38;
      });
      y += 10;
    }
    // Link + footer
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, y); ctx.lineTo(860, y);
    ctx.stroke();
    y += 46;
    ctx.fillStyle = '#0d9488';
    ctx.font = '900 32px system-ui, sans-serif';
    ctx.fillText(window.location.host || 'roomkhojoo.vercel.app', 40, y);
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(0, H - 110, W, 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RoomKhojo', 450, H - 40);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob fail'))), 'image/png');
    });
  };

  // Card image ko native share-sheet se bhejo (WhatsApp = photo + caption)
  const shareCardImage = async (room) => {
    if (isSharingCard) return; // P2 #42: double-tap par 2 baar card na bane
    setIsSharingCard(true);
    try {
      const blob = await drawShareCard(room);
      const file = new File([blob], 'roomkhojo-ad.png', { type: 'image/png' });
      const caption = `${room.title} — ${room.price}\n${shareUrl(room)}`;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: room.title, text: caption });
        return;
      }
      throw new Error('file-share unsupported');
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user ne cancel kiya
      copyShareLink(room); // fallback: text+link
    } finally {
      setIsSharingCard(false);
    }
  };

  // P2 #42: Esc se share modal band
  useEffect(() => {
    if (!shareRoom) return;
    const onKey = (e) => { if (e.key === 'Escape') setShareRoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shareRoom]);

  // P2 #40: sirf room param hatao — filters URL me bane rahein
  const cleanRoomParam = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('room');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  };

  // Popup band karo + history/URL sahi karo (P2 #39)
  const closeRoomPopup = () => {
    setSelectedRoom(null);
    if (window.history.state && window.history.state.roomPopup) {
      suppressPopstateRef.current = true;
      window.history.back();
    } else if (new URLSearchParams(window.location.search).get('room')) {
      cleanRoomParam();
    }
  };

  // P2 #41: confirm + loading guard + 429 ka saaf message + "Reported" state
  // P1-2 fix: report ke liye login zaroori (server bhi 401 dega, par modal yahin khol dete hain)
  const handleReportUnavailable = async (roomId) => {
    if (!roomId || reportedIds.includes(roomId) || reportBusyRef.current.has(roomId)) return;
    if (!isLoggedIn) {
      alert('Report karne ke liye pehle login karo.');
      setAuthMode('login');
      return;
    }
    if (!window.confirm('Ye ad available nahi hai? 5 alag users ke report par ad auto-hide ho jata hai.')) return;
    reportBusyRef.current.add(roomId);
    try {
      const token = localStorage.getItem('roomkhojo_token');
      const res = await apiFetch(`${BASE_URL}/api/rooms/${roomId}/report-unavailable`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setReportedIds(prev => {
          const next = [...prev, roomId];
          try { localStorage.setItem('roomkhojo_reported', JSON.stringify(next)); } catch { /* private mode */ }
          return next;
        });
        alert((data && data.message) || 'Thanks! Admin verify karke update karega.');
      } else if (res.status === 429) {
        alert((data && data.message) || 'Aap ye report pehle hi kar chuke hain.');
      } else {
        alert((data && data.message) || `Report nahi hua (error ${res.status}). Dobara try karein.`);
      }
    } catch {
      alert('Server connection failed.');
    } finally {
      reportBusyRef.current.delete(roomId);
    }
  };

  // 📞 P1: revealed number par call/whatsapp kholo
  const doContactNav = (mobile, room, type) => {
    const clean = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) return alert('Number available nahi hai.');
    if (type === 'call') { window.location.href = `tel:${clean}`; return; }
    const text = encodeURIComponent(`Namaste! Maine RoomKhojo par aapka room "${room.title}" dekha. Kya ye abhi available hai? \n\nRoom Link: ${window.location.href}`);
    window.location.href = `https://wa.me/91${clean}?text=${text}`;
  };

  // 📞 P1: contact click — guest ko security popup, logged-in ko number reveal (daily limit se)
  const openContact = async (room, type) => {
    if (!room) return;
    if (!isLoggedIn) { setContactGate(true); return; }
    const revealed = revealedContacts[room._id];
    if (revealed) { doContactNav(revealed, room, type); return; }
    if (revealBusyRef.current) return;
    revealBusyRef.current = true;
    try {
      const res = await apiFetch(`${API_URL}/${room._id}/contact`, { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setRevealedContacts(prev => ({ ...prev, [room._id]: data.mobile }));
        setContactUsage({ used: data.used, limit: data.limit, remaining: data.remaining });
        doContactNav(data.mobile, room, type);
      } else if (res.status === 429) {
        if (data && data.used !== undefined) setContactUsage({ used: data.used, limit: data.limit, remaining: 0 });
        alert((data && data.message) || 'Aaj ka number-reveal limit khatam. Kal dobara try karo.');
      } else {
        alert((data && data.message) || `Number reveal nahi hua (error ${res.status}).`);
      }
    } catch {
      alert('Server connection failed.');
    } finally {
      revealBusyRef.current = false;
    }
  };

  useEffect(() => {
    if (!map.current) return;
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    sortedRooms.forEach(room => {
      const isSelected = selectedRoom && selectedRoom._id === room._id;
      const featured = isFeatured(room);
      const el = document.createElement('div');
      // Select hone par: ye POP-UP (upar+zoom), baaki FADE (halke)
      const popCls = !selectedRoom
        ? 'active:scale-90'
        : isSelected
          ? '-translate-y-4 scale-125 shadow-2xl'
          : 'opacity-40 saturate-50';
      el.className = `flex flex-col items-center cursor-pointer ${isSelected ? 'z-40' : featured ? 'z-20' : 'z-10'}`;
      const chip = document.createElement('div');
      chip.className = `font-bold px-3 py-1.5 rounded-full shadow-lg border-2 border-white text-xs transition-all duration-300 flex items-center gap-1 ${featured ? 'bg-orange-500 text-white' : 'bg-green-600 text-white'} ${popCls}`;
      // Static SVG icon (category/star) + textContent price (user-data kabhi innerHTML me nahi — XSS-safe)
      chip.innerHTML = featured ? ICON_STAR : markerIcon(room.category);
      const sp = document.createElement('span');
      sp.textContent = room.price;
      chip.appendChild(sp);
      const dot = document.createElement('div');
      dot.className = `w-2 h-2 rounded-full border border-white shadow-md ${featured ? 'bg-orange-500' : 'bg-green-600'}`;
      dot.style.marginBottom = '-4px';
      el.appendChild(chip); el.appendChild(dot);
      // P2 #46: touchstart ke BAAD click bhi fire hota hai — dedupe (warna popup 2x khulta)
      let lastTapAt = 0;
      const onClick = (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTapAt < 400) return;
        lastTapAt = now;
        openRoomPopup(room);
        if (map.current) map.current.flyTo({ center: [room.lng, room.lat], zoom: 15.5 });
      };
      el.addEventListener('click', onClick); el.addEventListener('touchstart', onClick);
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([room.lng, room.lat]).addTo(map.current); markersRef.current.push(marker);
    });
  }, [sortedRooms, selectedRoom]);

  const openPostAdForm = () => {
    // Signup/profile ka mobile listing form me prefill — user chaahe toh badal bhi sakta hai.
    if (!postMobile) {
      const saved = savedUserPhone();
      if (saved) setPostMobile(saved);
    }
    // Form TURANT kholo — location ka 5-sec wait khatam.
    // Location background me best-effort (mil gayi toh pre-pin, nahi toh Map button hai).
    setIsPostAdOpen(true);
    if (navigator.geolocation && postLng === null) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if ((pos.coords.accuracy || 9999) <= 150) { setPostLng(pos.coords.longitude); setPostLat(pos.coords.latitude); }
          else setShowLocationWarning(true);
        },
        () => { setShowLocationWarning(true); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  const handlePostAdClick = () => {
    if (!isLoggedIn) {
      pendingActionRef.current = 'postAd'; // P2 #36: login ke baad form khud khulega
      setAuthMode('login');
      return;
    }
    openPostAdForm();
  };

  const startPickingLocation = () => {
    pickSnapshotRef.current = { lng: postLng, lat: postLat, accuracy: gpsAccuracy };
    pickCanceledRef.current = false;
    setIsPostAdOpen(false);
    setIsPickingLocation(true);
    setView('map');
    setGpsAccuracy(null);
    handleLiveLocation(true);
  };

  const cancelPickingLocation = () => {
    pickCanceledRef.current = true;
    setIsLocating(false);
    const snap = pickSnapshotRef.current;
    if (snap) {
      setPostLng(snap.lng);
      setPostLat(snap.lat);
      setGpsAccuracy(snap.accuracy);
    }
    pickSnapshotRef.current = null;
    setIsPickingLocation(false);
    setIsPostAdOpen(true);
  };

  const confirmPickingLocation = () => {
    if (!map.current) return;
    const center = map.current.getCenter();
    pickCanceledRef.current = false;
    setPostLng(center.lng);
    setPostLat(center.lat);
    reverseGeocode(center.lat, center.lng);
    setIsPickingLocation(false);
    setGpsAccuracy(null);
    pickSnapshotRef.current = null;
    setIsPostAdOpen(true);
  };

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden relative font-sans">
      {isOffline && (<div className="z-50 bg-amber-500 text-white text-center text-xs font-black py-1.5 px-3 shrink-0">Aap offline hain — internet check karein. Purane ads dikh rahe hain.</div>)}
      <div className="z-40 bg-white shadow-sm shrink-0">
        <header className="px-3 py-1.5 flex justify-between items-center border-b border-gray-50"><div className="flex items-center gap-2"><button onClick={() => setIsMenuOpen(true)} className="p-1.5 -ml-1 text-gray-600 active:scale-95"><Menu size={24} /></button><div className="flex flex-col"><h1 className="text-xl font-black text-gray-800 tracking-tighter leading-tight">Room<span className="text-brand">Khojo</span></h1><a href="https://amanbishnoi.oneapp.dev" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-gray-500 hover:opacity-80 transition-opacity leading-none mt-0.5 tracking-tight">Built with <Heart size={10} fill="currentColor" className="inline text-brand" /> by <span className="text-brand">29 Dev's</span></a></div></div><button onClick={() => isLoggedIn ? navigate('/dashboard') : setAuthMode('login')} className={`w-9 h-9 border rounded-full flex items-center justify-center active:scale-95 transition-all ${isLoggedIn ? 'bg-brand text-white border-brand shadow-lg shadow-brand/30' : 'bg-gray-50 text-gray-600'}`}><User size={20} /></button></header>
         <div className="px-3 pt-2"><div className="relative flex items-center"><Search className="absolute left-3 text-gray-400" size={18} /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleMapSearch} placeholder={isServiceView ? 'Service ya area search karein...' : 'Enter city (e.g. Ganganagar) & Search...'} className="w-full bg-gray-100 text-sm font-bold text-gray-700 rounded-2xl py-2 pl-10 pr-20 outline-none border border-transparent focus:border-brand/30 transition-colors"/><button onClick={handleMapSearch} className="absolute right-2 bg-brand text-white text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition-transform shadow-md flex items-center gap-1">Go <Send size={13} /></button></div></div>
         <div className="grid grid-cols-2 gap-1 mx-3 my-2 p-1 bg-gray-100 border rounded-2xl">
           <button onClick={() => { setActiveCategory('all'); setActiveAudience('all'); }} className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${!isServiceView ? 'bg-white text-gray-900 shadow-sm border' : 'text-gray-500'}`}><Home size={16} /> Rooms</button>
           <button onClick={() => { setActiveCategory('__services'); setActiveAudience('all'); }} className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${isServiceView ? 'bg-white text-gray-900 shadow-sm border' : 'text-gray-500'}`}><Briefcase size={16} /> Service Providers {serviceListingCount > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isServiceView ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>{serviceListingCount}</span>}</button>
         </div>
         {!isServiceView && (<div className="flex overflow-x-auto no-scrollbar py-2 px-3 gap-2">{dynamicCategories.map((cat) => { const Icon = catIcon(cat.id); return (<button key={cat.id} onClick={() => { setActiveCategory(cat.id); setActiveAudience('all'); }} className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[13px] font-bold whitespace-nowrap ${activeCategory === cat.id ? 'bg-brand text-white shadow-lg shadow-brand/30 scale-105' : 'bg-gray-100 text-gray-600'}`}><Icon size={16} /><span>{cat.name}</span></button>); })}</div>)}
         {isServiceView && (<div className="px-3 pb-2 flex items-center justify-between"><p className="text-[11px] font-black text-gray-600 flex items-center gap-1"><Briefcase size={12} className="text-purple-600" /> Service Providers</p><span className="text-[10px] font-bold text-gray-400">{serviceListingCount} listed</span></div>)}
        {/* 🔍 FILTERS (price + sort + radius) */}
        <div className="px-3 pb-2">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-2xl text-xs font-black text-gray-600 active:scale-95"><Search size={14} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}<span>{filtersOpen ? '▲' : '▼'}</span></button>
          {filtersOpen && (
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-2">
              <div className="px-1">
                <div className="flex justify-between text-[11px] font-black mb-1"><span className="bg-brand/10 text-brand px-2 py-1 rounded-lg">{minPrice === '' ? 'Min' : inr(minPrice)}</span><span className="text-gray-400 font-bold self-center">ke beech</span><span className="bg-brand/10 text-brand px-2 py-1 rounded-lg">{maxPrice === '' ? 'Max' : inr(maxPrice)}</span></div>
                <div className="relative h-8 select-none" style={{ touchAction: 'none' }}>
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full" />
                  <div className="absolute top-1/2 -translate-y-1/2 h-1 bg-brand rounded-full" style={{ left: `${(priceLo / PRICE_CAP) * 100}%`, right: `${100 - (priceHi / PRICE_CAP) * 100}%` }} />
                  <div onMouseDown={onDotDown('min')} onTouchStart={onDotDown('min')} role="slider" aria-label="Minimum price" aria-valuenow={priceLo} className="absolute top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border-[3px] border-brand shadow cursor-grab active:cursor-grabbing active:scale-110 transition-transform" style={{ left: `calc(${(priceLo / PRICE_CAP) * 100}% - 12px)` }} />
                  <div onMouseDown={onDotDown('max')} onTouchStart={onDotDown('max')} role="slider" aria-label="Maximum price" aria-valuenow={priceHi} className="absolute top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border-[3px] border-brand shadow cursor-grab active:cursor-grabbing active:scale-110 transition-transform" style={{ left: `calc(${(priceHi / PRICE_CAP) * 100}% - 12px)` }} />
                </div>
                <p className="text-[10px] font-bold text-gray-400 text-center">Slide karo — in dono ke beech wale ads dikhenge</p>
              </div>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 p-2.5 bg-white rounded-xl outline-none font-bold text-sm border"><option value="new">Newest first</option><option value="lo">Price: Low to High</option><option value="hi">Price: High to Low</option></select>
                <button onClick={cycleRadius} className={`flex-1 p-2.5 rounded-xl font-black text-sm border active:scale-95 flex items-center justify-center gap-1.5 ${nearRadius !== 0 ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600'}`}><MapPin size={14} /> {nearRadius === 0 ? 'Nearby: Off' : `${nearRadius} km me`}</button>
              </div>
              {activeFilterCount > 0 && (<button onClick={() => { setMinPrice(''); setMaxPrice(''); setSortBy('new'); setNearRadius(0); }} className="w-full text-xs font-black text-red-500 underline">Clear filters</button>)}
            </div>
          )}
        </div>
        {activeCategory !== 'all' && activeCategory !== '__services' && (
          <div className="flex overflow-x-auto no-scrollbar pb-2 px-3 gap-2">
            {['all', ...typesForCategory(activeCategory)].map(aud => (
              <button key={aud} onClick={() => setActiveAudience(aud)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap border ${activeAudience === aud ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                {aud === 'all' ? 'Sab' : aud}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden bg-gray-100">
        {view === 'map' && !mapLoaded && !mapDead && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-gray-100/90 pointer-events-none">
            <p className="text-2xl font-black text-gray-800 tracking-tighter">Room<span className="text-brand">Khojo</span></p>
            <div className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-[11px] font-bold text-gray-400">Map load ho raha hai…</p>
          </div>
        )}
        {mapDead && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gray-100 p-8 text-center">
            <p className="font-black text-gray-700">Map browser me blocked hai (WebGL off / Shields on).</p>
            <p className="text-xs font-bold text-gray-500">Brave Shields down karke ya Chrome me kholo. List view waise bhi chal raha hai.</p>
            <button onClick={() => setView('list')} className="bg-brand text-white px-5 py-3 rounded-2xl font-black text-sm">List View kholo</button>
          </div>
        )}
        {/* 🎯 Sponsored banner strip (auto-flip, click = location popup) */}
        {bannerRooms.length > 0 && (() => {
          const b = bannerRooms[bannerIndex % bannerRooms.length];
          return (
            <div className="absolute top-2 left-2 right-2 z-30">
              <div onClick={openBannerRoom} data-room-idx={bannerIndex % bannerRooms.length} className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-purple-200 px-2 py-1.5 flex items-center gap-2 active:scale-[0.98] transition-transform cursor-pointer">
                <img src={getImageUrl(b.image)} className="w-11 h-11 rounded-lg object-cover bg-gray-200 shrink-0" alt="Sponsored" />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-purple-600 uppercase tracking-wider flex items-center gap-1"><Star size={10} fill="currentColor" /> {b.listingType === 'service' ? 'Service Ad' : 'Sponsored'}</p>
                  <p className="font-black text-gray-800 text-[13px] leading-tight truncate">{b.title}</p>
                  <p className="text-brand font-black text-[13px]">{b.price} <span className="text-[10px] text-gray-400 font-bold">• {b.category} • {b.type}</span></p>
                </div>
                <div className="flex gap-1 pr-1 shrink-0">
                  {bannerRooms.map((_, i) => (<span key={i} className={`w-1.5 h-1.5 rounded-full ${i === (bannerIndex % bannerRooms.length) ? 'bg-purple-600' : 'bg-gray-300'}`} />))}
                </div>
              </div>
            </div>
          );
        })()}
        <div className={`absolute inset-0 transition-opacity duration-500 ${view === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}><div ref={mapContainer} className="w-full h-full" /></div>
        {view === 'map' && roomsError && rooms.length === 0 && (<div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-white shadow-xl border border-amber-200 rounded-2xl px-4 py-2 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500 shrink-0" /><span className="text-xs font-bold text-gray-700">Ads load nahi hue.</span><button onClick={() => setRoomsReloadKey(k => k + 1)} className="text-xs font-black text-brand underline shrink-0">Retry</button></div>)}
        {view === 'map' && mapTilesDown && !mapDead && (<div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-40 bg-white shadow-xl border border-amber-200 rounded-2xl px-4 py-2 flex items-center gap-2 max-w-[92%]"><AlertTriangle size={16} className="text-amber-500 shrink-0" /><span className="text-xs font-bold text-gray-700">Map tiles load nahi ho rahe — internet check karein.</span>{mapStyle === 'street' && (<button onClick={() => switchMapStyle('sat')} className="text-xs font-black text-brand underline shrink-0">Satellite try</button>)}</div>)}
        {view === 'map' && !isPickingLocation && (<button onClick={() => handleLiveLocation(false)} disabled={isLocating} className="absolute bottom-28 right-4 z-40 bg-white p-3 rounded-full shadow-xl border border-gray-100 text-brand active:scale-90 transition-transform disabled:opacity-60 disabled:cursor-wait">{isLocating ? <Loader2 size={24} className="animate-spin" /> : <Navigation size={24} fill="currentColor"/>}</button>)}
        {view === 'map' && (<button onClick={() => switchMapStyle(mapStyle === 'street' ? 'sat' : 'street')} className="absolute left-4 bottom-28 z-40 bg-white px-3 py-2 rounded-full shadow-xl border border-gray-100 text-xs font-black text-gray-700 flex items-center gap-1.5 active:scale-90 transition-transform">{mapStyle === 'street' ? (<><Satellite size={14} /> Satellite</>) : (<><MapIcon size={14} /> Street</>)}</button>)}
        {view === 'map' && isPickingLocation && (<button onClick={() => handleLiveLocation(true)} disabled={isLocating} className="absolute bottom-[90px] right-4 z-40 bg-white px-4 py-2.5 rounded-full shadow-xl border border-gray-100 text-brand font-black text-xs flex items-center gap-2 active:scale-90 transition-transform disabled:opacity-70 disabled:cursor-wait">{isLocating ? (<><Loader2 size={16} className="animate-spin" /> Finding Your Location…</>) : (<><Navigation size={16} fill="currentColor"/> My Location</>)}</button>)}
        {isPickingLocation && view === 'map' && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 pointer-events-none drop-shadow-xl" style={{ transform: 'translate(-50%, -100%)' }}>
              <svg width="42" height="56" viewBox="0 0 24 32" aria-hidden="true">
                <path d="M12 32C10.5 28 3 24 3 13.5A9 9 0 1 1 21 13.5C21 24 13.5 28 12 32Z" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                <circle cx="12" cy="13.5" r="3.4" fill="#7f1d1d" />
              </svg>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-2 bg-white px-4 py-1 rounded-full shadow-md text-xs font-bold text-gray-700">
              {isLocating ? 'Finding Your Current Location…' : gpsAccuracy ? `GPS ±${gpsAccuracy}m — drag karke adjust karein` : 'Drag map to pin'}
            </div>
          </div>
        )}
        
        <div className={`absolute inset-0 z-20 bg-background overflow-y-auto p-4 transition-transform duration-500 ${view === 'list' ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="grid gap-5 pb-32">
            {roomsError ? (<div className="text-center p-10"><AlertTriangle size={28} className="mx-auto text-amber-500 mb-2" /><p className="text-gray-600 font-bold text-sm mb-3">Ads load nahi ho paye. Internet check karein.</p><button onClick={() => setRoomsReloadKey(k => k + 1)} className="bg-brand text-white px-5 py-2.5 rounded-xl font-black text-sm active:scale-95">Retry</button></div>) : sortedRooms.length === 0 ? (<div className="text-center p-10 text-gray-500 font-bold">{isServiceView ? 'Koi service provider nahi mila.' : 'Koi result nahi mila.'}</div>) : (sortedRooms.map(room => (
              <div key={room._id} className={`bg-white rounded-3xl overflow-hidden shadow-md border ${room.isPromoted ? 'border-orange-200' : 'border-gray-50'}`}>
                <div className="relative"><img src={getImageUrl(room.image)} className="w-full h-48 object-cover bg-gray-200" alt="Room" />{isFeatured(room) && <div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Star size={10} fill="currentColor" /> Featured</div>}<div className="absolute top-3 right-3 bg-white/90 px-3 py-1 rounded-full text-brand font-black">{room.price}</div></div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1"><h3 className="font-bold text-gray-900 text-lg leading-tight">{room.title}</h3><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ml-2">{room.listingType === 'service' ? 'Service' : room.type} • {room.category}</span></div>
                  <p className="text-sm font-bold text-gray-500 flex items-center gap-1"><MapPin size={14} className="shrink-0" /> {room.landmark || 'Hanumangarh'}</p>
                  {Array.isArray(room.landmarks) && room.landmarks.length > 0 && (<div className="mt-1 space-y-0.5">{room.landmarks.slice(0, 3).map((l, i) => (<p key={i} className="text-[11px] font-bold text-purple-700 flex items-center gap-1"><PoiIcon cat={l.cat} size={12} /><span className="truncate">{l.name} ({fmtDist(l.distM)})</span></p>))}{room.landmarks.length > 3 && (<p className="text-[10px] font-bold text-purple-500">+{room.landmarks.length - 3} aur</p>)}</div>)}
                  <div className="flex gap-2 mt-3 items-center">
                    {reportedIds.includes(room._id) ? (<span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-1.5 rounded-lg font-bold border border-gray-200">Reported</span>) : (<button onClick={() => handleReportUnavailable(room._id)} className="text-[10px] bg-red-50 text-red-600 px-2 py-1.5 rounded-lg font-bold border border-red-100 active:scale-95">Unavailable?</button>)}<button onClick={() => toggleFavorite(room._id)} className="text-[10px] bg-pink-50 text-pink-600 px-2 py-1.5 rounded-lg font-bold border border-pink-100 active:scale-95 inline-flex items-center gap-1">{savedIds.includes(room._id) ? (<><Heart size={12} fill="currentColor" /> Saved</>) : (<><Heart size={12} /> Save</>)}</button><button onClick={() => setShareRoom(room)} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg font-bold border border-blue-100 active:scale-95 inline-flex items-center gap-1"><Share2 size={12} /> Share</button>
                  </div>
                  <div className="flex gap-3 mt-3"><button onClick={() => openContact(room, 'call')} className="flex-1 bg-brand text-white py-2 rounded-xl font-black flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"><Phone size={16}/> Call</button><button onClick={() => openContact(room, 'whatsapp')} className="w-12 border-2 border-[#25D366] text-[#25D366] flex items-center justify-center rounded-xl active:scale-95 transition-transform"><MessageCircle size={18}/></button><a href={room.googleMapUrl || `https://www.google.com/maps/dir/?api=1&destination=${room.lat},${room.lng}`} target="_blank" rel="noreferrer" className="w-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl active:scale-95 transition-transform border border-blue-200"><Navigation size={18}/></a></div>
                </div>
              </div>
            )))}
          </div>
        </div>

        {selectedRoom && view === 'map' && !isPickingLocation && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-h-[42dvh] overflow-y-auto bg-white rounded-2xl shadow-2xl z-[100] p-3 border border-gray-100">
              <button onClick={closeRoomPopup} className="absolute top-2 right-2 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 z-10"><X size={18}/></button>
            <div className="flex gap-3 mb-2"><div className="flex gap-2 overflow-x-auto shrink-0 max-w-[45%] no-scrollbar">{roomGallery(selectedRoom).map((u, i) => (<img key={i} src={getImageUrl(u)} className="w-16 h-16 object-cover rounded-xl bg-gray-200 shrink-0 border border-gray-100" alt={`Room ${i + 1}`} />))}</div><div className="flex-1"><div className="flex justify-between items-start pr-10"><h3 className="font-black text-gray-800 line-clamp-1">{selectedRoom.title}</h3><span className="bg-brand/10 text-brand px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ml-1">{selectedRoom.listingType === 'service' ? 'Service' : selectedRoom.category}</span></div><p className="text-brand font-black text-xl leading-none mt-1">{selectedRoom.price}</p><p className="text-[11px] font-bold text-gray-500 mt-1.5 flex items-center gap-1"><User size={12}/> {selectedRoom.ownerName || 'Owner'} <span className="mx-1">•</span> <Phone size={12}/> {revealedContacts[selectedRoom._id] ? `+91 ${revealedContacts[selectedRoom._id]}` : '••••• •••••'}</p></div></div>
            {selectedRoom.description && (selectedRoom.listingType === 'service' ? (
              <p className="mb-2 border-t border-gray-50 pt-2 text-[11px] font-semibold leading-relaxed text-gray-600">{selectedRoom.description}</p>
            ) : (
              <div className="flex gap-1.5 mb-2 pt-2 border-t border-gray-50 overflow-x-auto no-scrollbar flex-nowrap">{selectedRoom.description.split(', ').map(fac => (<span key={fac} className="bg-gray-50 text-gray-600 border px-2 py-1 rounded-md text-[9px] font-bold uppercase shrink-0">{fac}</span>))}</div>
            ))}
            {Array.isArray(selectedRoom.landmarks) && selectedRoom.landmarks.length > 0 && (<div className="bg-purple-50 border border-purple-100 rounded-xl p-2 mb-2"><p className="text-[10px] font-black text-purple-700 uppercase mb-1 flex items-center gap-1"><MapPin size={12} /> Aas-paas ki jagah</p>{selectedRoom.landmarks.map((l, i) => (<p key={i} className="text-[11px] font-bold text-gray-700 flex items-center gap-1"><PoiIcon cat={l.cat} size={12} /><span>{l.name} — <span className="text-purple-700">{fmtDist(l.distM)}</span></span></p>))}</div>)}
            <div className="flex gap-2 items-center mb-3">
              {reportedIds.includes(selectedRoom._id) ? (<span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-1 rounded border border-gray-200 font-bold shrink-0">Reported</span>) : (<button onClick={() => handleReportUnavailable(selectedRoom._id)} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 active:scale-95 font-bold shrink-0">Unavailable?</button>)}<button onClick={() => toggleFavorite(selectedRoom._id)} className="text-[10px] bg-pink-50 text-pink-600 px-2 py-1 rounded border border-pink-100 active:scale-95 font-bold shrink-0 inline-flex items-center gap-1">{savedIds.includes(selectedRoom._id) ? (<><Heart size={12} fill="currentColor" /> Saved</>) : (<><Heart size={12} /> Save</>)}</button><button onClick={() => setShareRoom(selectedRoom)} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 active:scale-95 font-bold shrink-0 inline-flex items-center gap-1"><Share2 size={12} /> Share</button>
            </div>
            <div className="flex gap-2"><button onClick={() => openContact(selectedRoom, 'call')} className="flex-1 bg-brand text-white py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95"><Phone size={14}/> Call</button><button onClick={() => openContact(selectedRoom, 'whatsapp')} className="flex-1 border-2 border-[#25D366] text-[#25D366] py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95"><MessageCircle size={14}/> WhatsApp</button><a href={selectedRoom.googleMapUrl || `https://www.google.com/maps/dir/?api=1&destination=${selectedRoom.lat},${selectedRoom.lng}`} target="_blank" rel="noreferrer" className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95"><Navigation size={14}/> Navigate</a></div>
            {isLoggedIn && contactUsage && (<p className="text-[9px] font-bold text-gray-400 text-center mt-1.5">Aaj ke number reveals: {contactUsage.used}/{contactUsage.limit}{contactUsage.remaining > 0 ? ` — ${contactUsage.remaining} baaki` : ' — limit khatam'}{!revealedContacts[selectedRoom._id] && ' • Call/WhatsApp par number dikhega'}</p>)}
          </div>
        )}
      </div>

      {isPickingLocation ? (
        <div className="bg-white border-t py-3 px-4 flex items-center gap-3 z-50 h-[64px] shrink-0">
          <button onClick={cancelPickingLocation} className="px-5 py-2.5 rounded-2xl font-black text-sm border-2 border-gray-200 text-gray-600 active:scale-95 transition-transform">Cancel</button>
          <button onClick={confirmPickingLocation} className="flex-1 bg-brand text-white py-2.5 rounded-2xl font-black shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-transform"><MapPin size={20}/> Confirm Location</button>
        </div>
      ) : (
<div className="shrink-0 flex flex-col z-50"><footer className="bg-white border-t py-1 px-10 flex justify-between items-center h-[56px] shadow-[0_-10px_20px_rgba(0,0,0,0.02)]"><button onClick={() => setView('map')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'map' ? 'text-brand scale-110' : 'text-gray-400 opacity-60'}`}><MapIcon size={22} strokeWidth={view === 'map' ? 2.5 : 2} /><span className="text-[10px] font-black uppercase tracking-tighter">Map</span></button><button onClick={handlePostAdClick} className="relative bg-brand text-white w-12 h-12 flex items-center justify-center rounded-2xl -mt-10 shadow-xl shadow-brand/40 border-4 border-white active:scale-90 transition-all duration-200"><Plus size={30} strokeWidth={3} /></button><button onClick={() => setView('list')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'list' ? 'text-brand scale-110' : 'text-gray-400 opacity-60'}`}><List size={22} strokeWidth={view === 'list' ? 2.5 : 2} /><span className="text-[10px] font-black uppercase tracking-tighter">List</span></button></footer><div className="bg-white border-t border-gray-100 py-1 px-2 flex items-center justify-center gap-2 text-[9px] font-bold text-gray-400 whitespace-nowrap overflow-hidden"><button onClick={() => navigate('/about')} className="hover:text-brand transition-colors">About</button><span>•</span><button onClick={() => navigate('/terms')} className="hover:text-brand transition-colors">Terms</button><span>•</span><button onClick={() => navigate('/privacy')} className="hover:text-brand transition-colors">Privacy</button><span>•</span><button onClick={() => navigate('/refund')} className="hover:text-brand transition-colors">Refund</button><span>•</span><a href="https://amanbishnoi.oneapp.dev" target="_blank" rel="noreferrer" className="hover:text-brand transition-colors active:scale-95 inline-block">Built with <Heart size={9} fill="currentColor" className="inline text-brand" /> by 29 Dev's</a></div></div>
      )}
      <div className={`fixed inset-0 z-[8000] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div><div className={`absolute top-0 left-0 bottom-0 w-[80%] max-w-sm bg-white flex flex-col transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="p-6 bg-brand/5 border-b"><h2 className="text-3xl font-black text-gray-800">Room<span className="text-brand">Khojo</span></h2></div><div className="p-4 space-y-2 flex-1 overflow-y-auto mt-4">{isLoggedIn && (<button onClick={() => { navigate('/dashboard'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"><div className="flex items-center gap-3"><User size={20} className="text-brand"/> My Ads / Dashboard</div> <ChevronRight size={18} className="text-gray-400"/></button>)}{isLoggedIn && (<button onClick={handleLogout} className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 hover:bg-red-100 font-bold text-red-600"><div className="flex items-center gap-3"><LogOut size={20}/> Logout</div> <ChevronRight size={18} className="text-red-300"/></button>)}{/* P2 #59: logout ab menu me bhi (dashboard settings ke saath) */}<button onClick={() => { navigate('/about'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"><div className="flex items-center gap-3"><Info size={20} className="text-brand"/> About Us</div> <ChevronRight size={18} className="text-gray-400"/></button><button onClick={() => { navigate('/terms'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"><div className="flex items-center gap-3"><FileText size={20} className="text-brand"/> Terms</div> <ChevronRight size={18} className="text-gray-400"/></button><button onClick={() => { navigate('/privacy'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"><div className="flex items-center gap-3"><Lock size={20} className="text-brand"/> Privacy Policy</div> <ChevronRight size={18} className="text-gray-400"/></button><button onClick={() => { navigate('/refund'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 font-bold text-gray-700"><div className="flex items-center gap-3"><Shield size={20} className="text-brand"/> Refund Policy</div> <ChevronRight size={18} className="text-gray-400"/></button><button onClick={() => { if (!isLoggedIn) { setIsMenuOpen(false); setAuthMode('login'); } else { navigate('/support'); setIsMenuOpen(false); } }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-brand/5 hover:bg-brand/10 font-bold text-gray-700 border border-brand/20"><div className="flex items-center gap-3"><LifeBuoy size={20} className="text-brand"/> Support</div> <ChevronRight size={18} className="text-gray-400"/></button></div></div></div>
      <AuthModal
        open={Boolean(authMode)}
        mode={authMode || 'login'}
        onClose={() => setAuthMode(null)}
        onModeChange={setAuthMode}
        onAuthed={(token, user, kind) => {
          saveSession(token, user);
          const first = String((user && user.name) || '').trim().split(' ')[0];
          showToast(kind === 'signup' ? `Account ban gaya${first ? `, ${first}` : ''}!` : `Welcome back${first ? `, ${first}` : ''}!`);
        }}
      />
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[9000] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white shadow-xl rk-fade-in">
          <Check size={16} className="text-emerald-400" />
          {toast}
        </div>
      )}

      {contactGate && (
        <div className="fixed inset-0 z-[8500] bg-black/60 flex items-center justify-center p-6" onClick={() => setContactGate(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4"><Lock size={26} /></div>
            <h3 className="text-xl font-black text-gray-800 mb-1.5">Number Hidden</h3>
            <p className="text-sm font-bold text-gray-500 mb-5">Security reason se owner ka number sirf logged-in users ko dikh raha hai — scrapers aur spam se bachane ke liye. Login/Signup karke Call ya WhatsApp karo.</p>
            <button onClick={() => { setContactGate(false); setAuthMode('login'); }} className="w-full bg-brand text-white py-3.5 rounded-2xl font-black active:scale-95">Login / Signup karo</button>
            <button onClick={() => setContactGate(false)} className="w-full mt-2 text-gray-500 font-black text-sm py-2">Abhi nahi</button>
          </div>
        </div>
      )}

      <div className={`fixed inset-0 z-[7000] bg-black/60 overflow-hidden transition-opacity ${isPostAdOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[30px] flex flex-col transition-transform duration-500 ${isPostAdOpen ? 'translate-y-0' : 'translate-y-full'}`} style={{ maxHeight: '92dvh' }}>
          <div className="p-5 border-b shrink-0 flex justify-between items-center sticky top-0 bg-white rounded-t-[30px] z-10"><h2 className="text-xl font-black">Post Ad</h2><button onClick={() => setIsPostAdOpen(false)} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button></div>
          <div className="p-5 overflow-y-auto overflow-x-hidden space-y-5 flex-1">
             <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1 border">
               <button type="button" onClick={() => { setPostKind('room'); setAdType('regular'); setWantBanner(false); setPostCategory((sysSettings.categories && sysSettings.categories[0]) || 'PG'); setPostType(typesForCategory((sysSettings.categories && sysSettings.categories[0]) || 'PG')[0]); }} className={`py-3 rounded-xl font-black text-sm transition-all ${postKind === 'room' ? 'bg-white text-gray-900 shadow-sm border' : 'text-gray-400'}`}>Room / Property</button>
                <button type="button" onClick={() => { setPostKind('service'); setAdType('regular'); setWantBanner(false); setPostCategory(SERVICE_CATEGORIES[0]); setPostType('Service'); if (!postDays) setPostDays('30'); }} className={`py-3 rounded-xl font-black text-sm transition-all ${postKind === 'service' ? 'bg-white text-gray-900 shadow-sm border' : 'text-gray-400'}`}>Service Provider</button>
             </div>
             {postKind === 'room' && (
               <>
                 <div className="flex bg-gray-100 p-1 rounded-2xl border"><button type="button" onClick={() => setAdType('regular')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all shadow-sm ${adType === 'regular' ? 'bg-white text-gray-900 border' : 'text-gray-400'}`}>Standard Ad</button><button type="button" onClick={() => setAdType('promo')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-1.5 ${adType === 'promo' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}><Star size={14} fill="currentColor" /> Promoted Ad</button></div>
                 {adType === 'promo' && (<div className="flex gap-2"><button type="button" onClick={() => setPromoPlan('7')} className={`flex-1 p-2 rounded-xl border text-xs font-bold transition-colors ${promoPlan === '7' ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-gray-50 border-transparent text-gray-500'}`}>7 Days<br/><span className="text-lg">₹{sysSettings.pricing.promo7}</span></button><button type="button" onClick={() => setPromoPlan('15')} className={`flex-1 p-2 rounded-xl border text-xs font-bold transition-colors ${promoPlan === '15' ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-gray-50 border-transparent text-gray-500'}`}>15 Days<br/><span className="text-lg">₹{sysSettings.pricing.promo15}</span></button><button type="button" onClick={() => setPromoPlan('30')} className={`flex-1 p-2 rounded-xl border text-xs font-bold transition-colors ${promoPlan === '30' ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-gray-50 border-transparent text-gray-500'}`}>30 Days<br/><span className="text-lg">₹{sysSettings.pricing.promo30}</span></button></div>)}
               </>
             )}
              <div>
                <label className="bg-brand/5 h-24 rounded-2xl border-2 border-dashed border-brand/30 flex flex-col items-center justify-center gap-2 text-brand cursor-pointer"><Camera size={24}/><span className="font-bold text-xs">{isCompressingPhotos ? 'Photos optimize ho rahi hain…' : postImages.length > 0 ? `${postImages.length}/6 Photos Selected` : 'Upload Photos (max 6)'}</span><input type="file" className="hidden" multiple accept="image/*" onChange={addPostPhotos} disabled={isCompressingPhotos} /></label>
                {postImages.length > 0 && (<div className="grid grid-cols-3 gap-2 mt-2">{postImages.map((p, i) => (<div key={i} className="relative"><img src={p.url} className="w-full h-20 rounded-xl object-cover border border-gray-200" alt={`Photo ${i + 1}`} /><button type="button" onClick={() => removePostPhoto(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center shadow">✕</button><span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{i + 1}</span></div>))}</div>)}
              </div>
              {postKind === 'room' ? (
                <div className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-colors ${wantBanner ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-transparent'}`}><div><p className="text-sm font-black text-gray-800 flex items-center gap-1.5"><Megaphone size={16} className="text-purple-600" /> Top Banner Add-on</p><p className="text-[11px] font-bold text-gray-500">₹{sysSettings.pricing.bannerPrice || '499'} • {sysSettings.pricing.bannerDays || '7'} din top strip par (paid)</p></div><button type="button" onClick={() => setWantBanner(!wantBanner)} className={`w-12 h-7 rounded-full font-black text-[10px] transition-colors ${wantBanner ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-500'}`}>{wantBanner ? 'ON' : 'OFF'}</button></div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl border border-purple-200 bg-purple-50 p-3">
                  <Megaphone size={18} className="mt-0.5 shrink-0 text-purple-600" />
                  <p className="text-[11px] font-bold leading-relaxed text-purple-800">Service provider ads admin approval ke baad {serviceDaysNum || 0} din tak map ke upar banner strip me automatically dikhte hain — alag banner payment ki zaroorat nahi.</p>
                </div>
              )}
             <div className="space-y-3">
               <input type="text" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder={postKind === 'service' ? 'Business / Service name' : 'Title'} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" />
               <div className="flex gap-3">
                 {postKind === 'service' ? (
                   <select value={postCategory} onChange={(e) => setPostCategory(e.target.value)} className="flex-1 min-w-0 p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm">{SERVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                 ) : (
                   <>
                     <select value={postCategory} onChange={(e) => { setPostCategory(e.target.value); const opts = typesForCategory(e.target.value); setPostType(opts[0]); }} className="flex-1 min-w-0 p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm">{sysSettings.categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                     <select value={postType} onChange={(e) => setPostType(e.target.value)} className="flex-1 min-w-0 p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm">{typesForCategory(postCategory).map(t => <option key={t} value={t}>{t}</option>)}</select>
                   </>
                 )}
               </div>
               <div className="flex gap-3">
                  <input type="number" value={postPrice} onChange={(e) => setPostPrice(e.target.value)} placeholder={postKind === 'service' ? 'Service price (₹)' : 'Rent (₹)/Month'} className="flex-1 min-w-0 p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm"/>
                 <input type="tel" inputMode="numeric" value={postMobile} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setPostMobile((d.length > 10 && d.startsWith('91') ? d.slice(2, 12) : d).slice(0, 10)); }} placeholder="Mobile No." className="flex-[1.5] min-w-0 p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm"/>
               </div>
                <p className="text-[10px] font-bold text-gray-400 ml-1">Mobile signup/profile se prefill hai — chaahein toh badal ya hata kar naya number daalein.</p>
                {postKind === 'service' && (<p className="text-[10px] font-bold text-purple-500 ml-1">Service price customer ko dikhega; listing fee duration ke hisaab se neeche hai.</p>)}
              </div>
              {postKind === 'service' ? (
                <div>
                  <p className="text-xs font-black text-gray-500 mb-2 uppercase">Service Details</p>
                  <textarea value={postDesc} onChange={(e) => setPostDesc(e.target.value)} rows={3} placeholder="Kya service dete hain, timing, delivery area..." className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm resize-none" />
                  <div className="mt-3 rounded-2xl border-2 border-purple-200 bg-purple-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase text-purple-800">Listing Duration</p>
                      <span className="text-[11px] font-black text-purple-700 bg-white border border-purple-200 px-2 py-1 rounded-lg">₹{serviceDailyRate}/day</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[7, 15, 30].map(d => (<button type="button" key={d} onClick={() => setPostDays(String(d))} className={`py-2 rounded-xl text-xs font-black border transition-colors ${Number(postDays) === d ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-purple-700 border-purple-200'}`}>{d} din</button>))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" min="1" max="365" step="1" value={postDays} onChange={(e) => setPostDays(e.target.value)} placeholder="Custom days" className="flex-1 min-w-0 p-3 bg-white rounded-xl outline-none font-bold text-sm border border-purple-200" />
                      <span className="text-xs font-bold text-gray-500">din</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">₹{serviceDailyRate} × {serviceDaysNum} din =</span>
                      <span className="text-lg font-black text-purple-800">{serviceDailyRate > 0 ? `₹${serviceFee}` : 'Free'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-purple-600 mt-1">Listing fee payment submit par; admin approval ke baad {serviceDaysNum || 0} din duration start hogi.</p>
                  </div>
                </div>
              ) : (
               <div><p className="text-xs font-black text-gray-500 mb-2 uppercase">Select Facilities</p><div className="flex flex-wrap gap-2">{(sysSettings.facilities || []).map(fac => (<button type="button" key={fac} onClick={() => setSelectedFacilities(prev => prev.includes(fac) ? prev.filter(f => f !== fac) : [...prev, fac])} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedFacilities.includes(fac) ? 'bg-brand text-white border-brand shadow-md' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{fac}</button>))}</div></div>
             )}
              <div className="flex flex-wrap gap-2 mt-2"><input type="text" value={postLandmark} onChange={(e) => setPostLandmark(e.target.value)} placeholder="Landmark" className="flex-1 min-w-[140px] p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm"/><button onClick={refreshGpsPin} disabled={isLocating} title="GPS se refresh" className="p-3 shrink-0 rounded-2xl font-black text-xs flex items-center justify-center border-2 bg-gray-50 text-gray-600 border-gray-200 active:scale-95 disabled:opacity-60">{isLocating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button><button onClick={startPickingLocation} className={`p-3 shrink-0 whitespace-nowrap rounded-2xl font-black text-xs flex items-center justify-center gap-1 border-2 transition-colors ${postLng ? 'bg-green-50 text-green-600 border-green-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}><Target size={16}/> {postLng ? (gpsAccuracy ? `Pinned! ±${gpsAccuracy}m` : 'Pinned!') : 'Map'}</button><button onClick={openPoiPicker} className="p-3 shrink-0 whitespace-nowrap rounded-2xl font-black text-xs flex items-center justify-center gap-1 border-2 transition-colors bg-purple-50 text-purple-700 border-purple-200 active:scale-95"><Landmark size={16} /> Nearby</button></div>
              <div>
                <input type="url" value={postMapUrl} onChange={(e) => setPostMapUrl(e.target.value)} placeholder="Google Maps link (optional)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" />
                <p className="text-[10px] font-bold text-gray-400 mt-1 ml-1">Google Maps par apni jagah kholo → Share link → yahan paste karo. Location isi link se set hogi (zyada accurate).</p>
              </div>
              {poiSelected.length > 0 && (<div className="flex flex-wrap gap-2 mt-2">{poiSelected.map((p, i) => (<span key={`${p.name}-${i}`} className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"><PoiIcon cat={p.cat} size={11} /><span>{p.name}</span><span>• {fmtDist(p.distM)}</span><button type="button" onClick={() => setPoiSelected(prev => prev.filter((_, j) => j !== i))} className="text-purple-400 font-black ml-1">✕</button></span>))}</div>)}
          </div>
          <div className="p-4 border-t bg-white sticky bottom-0 z-10">
             <button onClick={initiatePayment} disabled={isSubmitting} className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2 ${adType === 'promo' ? 'bg-orange-500 text-white' : 'bg-brand text-white'}`}>
                {isSubmitting ? (<><Loader2 size={20} className="animate-spin" /> Publishing…</>) : (getPayAmount() === '0' || getPayAmount() === '' ? (postKind === 'service' ? 'Publish Service Ad (Free)' : 'Publish Ad (Free)') : `Pay ₹${getPayAmount()} & Publish`)}
             </button>
             {isSubmitting && !showPaymentWindow && (<button onClick={cancelSubmit} className="w-full mt-2 text-red-600 font-black text-sm underline">Submit cancel karein</button>)}
          </div>
        </div>
      </div>

      {showPaymentWindow && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="bg-orange-500 text-white p-6 text-center"><p className="font-bold text-orange-100 text-sm mb-1 uppercase tracking-wider">Payment Required</p><h2 className="text-4xl font-black">₹{getPayAmount()}</h2>{postKind === 'service' && (<p className="text-[11px] font-bold text-orange-100 mt-1">Service listing • {serviceDaysNum} din • approval ke baad duration start</p>)}</div>
            <div className="p-6 text-center">
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl"><p className="text-xs font-bold text-gray-500 mb-2 uppercase">Your Secret Payment Code</p><h3 className="text-3xl font-black tracking-widest text-gray-800">{payCode}</h3></div>
              <div className="flex items-start gap-3 bg-blue-50 text-blue-800 p-4 rounded-2xl text-left text-xs font-bold mb-6"><AlertTriangle size={24} className="shrink-0 text-blue-600 mt-0.5" /><p>Niche 'Pay via UPI App' par click karein. Aapki UPI app open hogi. <strong>Payment karne ke baad wapas yahan aakar 'I have paid' par click karna na bhoolein.</strong></p></div>
              <a href={`upi://pay?pa=${sysSettings.pricing.upiId || 'admin@ybl'}&pn=RoomKhojo&am=${getPayAmount()}&cu=INR&tn=Code: ${payCode}`} className="w-full bg-brand text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 mb-3 shadow-lg shadow-brand/30 active:scale-95 transition-transform">Pay via UPI App</a>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI Ref / UTR No. (payment ke baad milta hai)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm mb-3 border" />
              <button onClick={() => submitAd()} disabled={isSubmitting} className="w-full bg-green-50 text-green-700 py-4 rounded-2xl font-black flex items-center justify-center border border-green-200 active:scale-95 transition-transform">{isSubmitting ? (<><Loader2 size={18} className="animate-spin mr-2" /> Verifying… (max 60s)</>) : 'I have completed the payment'}</button>
              {isSubmitting && (<button onClick={cancelSubmit} className="mt-2 w-full bg-red-50 text-red-600 py-3 rounded-2xl font-black text-sm border border-red-200 active:scale-95 transition-transform">Submit Rok Do (Cancel)</button>)}
              <button onClick={() => setShowPaymentWindow(false)} className="mt-4 text-sm font-bold text-gray-400 underline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔗 SHARE VISITING-CARD MODAL */}
      {shareRoom && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShareRoom(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShareRoom(null)} className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 text-white shadow-lg rounded-full flex items-center justify-center"><X size={18}/></button>
            <div className="relative">
              <img src={getImageUrl(roomGallery(shareRoom)[0])} className="w-full h-52 object-cover bg-gray-200" alt={shareRoom.title} />
              <div className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full text-brand font-black">{shareRoom.price}</div>
              {isFeatured(shareRoom) && (<div className="absolute bottom-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Star size={10} fill="currentColor" /> Featured</div>)}
            </div>
            <div className="p-4">
              <div className="text-center mb-1"><h3 className="font-black text-gray-900 text-xl leading-tight">Room<span className="text-brand">Khojo</span></h3></div>
              <h4 className="font-black text-gray-800 leading-tight">{shareRoom.title}</h4>
              <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {shareRoom.category} • {shareRoom.type} • {shareRoom.landmark || 'Hanumangarh'}</p>
              <p className="text-[11px] font-bold text-gray-500 mt-1 flex items-center gap-1"><User size={12}/> {shareRoom.ownerName || 'Owner'}</p>
              {shareRoom.description && (<p className="text-[11px] font-bold text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border line-clamp-2">{shareRoom.description}</p>)}
              <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-blue-700 truncate flex-1">{shareUrl(shareRoom)}</p>
                <button onClick={() => copyShareLink(shareRoom)} className="text-[10px] font-black bg-blue-600 text-white px-2 py-1.5 rounded-lg shrink-0 active:scale-95 inline-flex items-center gap-1"><Copy size={12} /> Copy</button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => shareCardImage(shareRoom)} disabled={isSharingCard} className="flex-1 bg-purple-600 text-white py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-purple-600/30 disabled:opacity-60">{isSharingCard ? (<><Loader2 size={18} className="animate-spin" /> Card ban raha hai…</>) : (<><ImageIcon size={18} /> Card Share</>)}</button>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => shareWhatsApp(shareRoom)} className="flex-1 bg-[#25D366] text-white py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95"><MessageCircle size={18}/> WhatsApp</button>
                <button onClick={() => nativeShare(shareRoom)} className="flex-1 bg-slate-900 text-white py-3 rounded-2xl font-black text-sm active:scale-95 inline-flex items-center justify-center gap-2"><Share2 size={16} /> More</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📍 POI PICKER MODAL (nearby landmarks select) */}
      {poiOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[30px] sm:rounded-3xl flex flex-col h-[80dvh] sm:h-auto sm:max-h-[80dvh] shadow-2xl relative">
            <div className="p-5 border-b shrink-0 flex justify-between items-center sticky top-0 bg-white rounded-t-[30px] sm:rounded-t-3xl z-10">
              <div><h2 className="text-xl font-black flex items-center gap-2"><MapPin size={22} className="text-purple-600" /> Aas-paas ki jagah</h2><p className="text-[11px] font-bold text-gray-500">1.5 km ke andar • max 5 select</p></div>
              <button onClick={() => setPoiOpen(false)} className="bg-gray-100 p-2 rounded-full active:scale-90"><X size={20}/></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2 flex-1">
              {poiLoading ? (<p className="text-center text-gray-500 font-bold p-8">Dhoondh rahe hain…</p>) : poiList.length === 0 ? (<p className="text-center text-gray-500 font-bold p-8">1.5 km me koi coaching/hospital/bus/railway nahi mila.</p>) : (poiList.map((poi, i) => {
                const sel = poiSelected.some(p => p.name === poi.name && p.lat === poi.lat && p.lng === poi.lng);
                return (<button key={`${poi.name}-${i}`} onClick={() => togglePoi(poi)} className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 text-left active:scale-[0.98] transition-all ${sel ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-gray-50 border-transparent'}`}><div className="flex-1 min-w-0 flex items-center gap-2"><PoiIcon cat={poi.cat} size={18} /><div className="flex-1 min-w-0"><p className="font-black text-sm leading-tight truncate">{poi.name}</p><p className={`text-[11px] font-bold flex items-center gap-1 ${sel ? 'text-purple-100' : 'text-gray-500'}`}><Ruler size={11} /> {fmtDist(poi.distM)} door</p></div></div>{sel ? (<span className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center shrink-0 ml-2"><Check size={14} strokeWidth={3} /></span>) : (<span className="w-6 h-6 rounded-full border-2 border-current opacity-30 shrink-0 ml-2" />)}</button>);
              }))}
            </div>
            <div className="p-4 border-t bg-white sticky bottom-0 z-10 shrink-0">
              <button onClick={() => setPoiOpen(false)} className="w-full bg-brand text-white py-4 rounded-xl font-black shadow-lg active:scale-95">Done ({poiSelected.length} selected)</button>
            </div>
          </div>
        </div>
      )}

      {showLocationWarning && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
              <MapPin size={32} strokeWidth={2.5}/>
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Location Required</h2>
            <p className="text-sm font-bold text-gray-500 mb-6">RoomKhojo needs your live location to place the ad correctly on the map. Kripya apne browser settings se location permission <strong className="text-gray-800">Allow</strong> karein.</p>
            <button onClick={() => setShowLocationWarning(false)} className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-black flex items-center justify-center active:scale-95 transition-transform">Samajh Gaya (Close)</button>
          </div>
        </div>
      )}
    </div>
  );
}