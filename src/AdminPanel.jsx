import { useEffect, useRef, useState } from 'react';
import { User, LogOut, LayoutDashboard, Check, X, Settings, Lock, ShieldAlert, Save, Plus, BarChart3, Clock, MessageCircle, Smartphone, AlertTriangle, MapPin, Star, Megaphone, Link, Crown, Send, ArrowLeft } from 'lucide-react';
import { apiFetch } from './apiFetch'; // P1 #31/#32: timeout + 401 auto-logout (admin token)

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = VITE_API_BASE_URL ? VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'https://roomkhojo-api.onrender.com'; // P2 #58: sirf trailing /api strip
const API_URL = `${BASE_URL}/api/rooms`;
const ADMIN_API = `${BASE_URL}/api/admin`;
const SUPPORT_API = `${BASE_URL}/api/support`;
const getImageUrl = (path) => !path ? 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80' : path.startsWith('http') ? path : `${BASE_URL}${path}`;

// Admin JWT (sessionStorage me) — hardcoded 'x-admin-secret' hata diya (C5 fix)
const adminAuthHeaders = () => {
  const token = sessionStorage.getItem('roomkhojo_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// P2 #51: JWT ka exp decode (base64url payload) — expired token se khaali panel na dikhe
const getTokenExp = () => {
  try {
    const token = sessionStorage.getItem('roomkhojo_admin_token');
    if (!token || token.split('.').length !== 3) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
};

export default function AdminPanel() {
  // Refresh par admin session bana rahe (JWT sessionStorage me hai — lazy init + exp check)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = sessionStorage.getItem('roomkhojo_admin_token');
    if (!token) return false;
    const exp = getTokenExp();
    if (exp && exp <= Date.now()) { sessionStorage.removeItem('roomkhojo_admin_token'); return false; }
    return true;
  });
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [adminRooms, setAdminRooms] = useState([]);
  const [activeTab, setActiveTab] = useState('analytics');
  
  const [showCatModal, setShowCatModal] = useState(false);
  const [showFacModal, setShowFacModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [migrateEmail, setMigrateEmail] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newFacilityName, setNewFacilityName] = useState('');

  const [sysCategories, setSysCategories] = useState([]);
  const [sysFacilities, setSysFacilities] = useState([]);
  const [sysPricing, setSysPricing] = useState({ regular: '0', promo7: '299', promo15: '499', promo30: '899', upiId: '' });
  const [sysAutoApprove, setSysAutoApprove] = useState(false);
  const [sysAdminPath, setSysAdminPath] = useState('/admin-secret-29');

  const [refreshKey, setRefreshKey] = useState(0);
  // 🎧 Support tickets
  const [tickets, setTickets] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [chatTicketId, setChatTicketId] = useState(null);
  const [adminReply, setAdminReply] = useState({});
  const adminChatScrollRef = useRef(null);
  // 🔗 Purane-ad claim requests (#13 fix)
  const [claims, setClaims] = useState([]);
  // P2 #52: approve/delete/banner in-flight guard (double-tap + disabled)
  const [actionBusy, setActionBusy] = useState(null);
  // P2 #56: server-aggregated stats (fallback: client estimate)
  const [stats, setStats] = useState(null);
  // P2 #55: migrate dry-run preview + busy guard
  const [migratePreview, setMigratePreview] = useState(null);
  const [migrateBusy, setMigrateBusy] = useState(false);

  useEffect(() => {
    if (adminChatScrollRef.current) adminChatScrollRef.current.scrollTop = adminChatScrollRef.current.scrollHeight;
  }, [chatTicketId, tickets]);

  // 🔐 P1 #32: admin session expire (401) → login screen par wapas
  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail !== 'admin') return;
      setIsAuthenticated(false);
      alert('Admin session expire ho gaya. Dobara login karein.');
    };
    window.addEventListener('rk:auth-expired', onExpired);
    return () => window.removeEventListener('rk:auth-expired', onExpired);
  }, []);

  // P2 #51: har 60s JWT exp check — token expire hote hi login screen (API 401 ka wait nahi)
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = () => {
      const exp = getTokenExp();
      if (exp && exp <= Date.now()) {
        sessionStorage.removeItem('roomkhojo_admin_token');
        setIsAuthenticated(false);
        alert('Admin session expire ho gaya (12 ghante). Dobara login karein.');
      }
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch(`${API_URL}/admin/all`, { headers: adminAuthHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setAdminRooms(data.rooms); })
      .catch(() => { /* list refresh fail: silent */ });
    apiFetch(`${ADMIN_API}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setSysCategories(data.settings.categories || []);
          setSysFacilities(data.settings.facilities || []);
          setSysPricing(data.settings.pricing || { regular: '0', promo7: '299', promo15: '499', promo30: '899', upiId: '' });
          if (typeof data.settings.autoApproveFree === 'boolean') setSysAutoApprove(data.settings.autoApproveFree);
          if (data.settings.adminPath) setSysAdminPath(data.settings.adminPath);
        }
      })
      .catch(() => { /* settings load fail: silent */ });
    apiFetch(`${SUPPORT_API}/admin/all`, { headers: adminAuthHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) { setTickets(data.tickets || []); setOpenCount(data.openCount || 0); } })
      .catch(() => { /* tickets load fail: silent */ });
    apiFetch(`${API_URL}/admin/claims`, { headers: adminAuthHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setClaims(data.rooms || []); })
      .catch(() => { /* claims load fail: silent */ });
    // 📊 #56: server-aggregated stats (fail ho toh client estimate fallback)
    apiFetch(`${ADMIN_API}/stats`, { headers: adminAuthHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setStats(data.stats); })
      .catch(() => { /* stats optional */ });
  }, [isAuthenticated, refreshKey]);

  // 💬 P2 #57: chat khula ho toh 15s auto-refresh (tab hidden par pause, wapas aane par turant)
  useEffect(() => {
    if (!chatTicketId) return;
    const iv = setInterval(() => { if (!document.hidden) setRefreshKey(k => k + 1); }, 15000);
    const onVis = () => { if (!document.hidden) setRefreshKey(k => k + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [chatTicketId]);

  // 🔗 Claim request approve/reject (approve = ad claimant ke account se link)
  const handleClaim = async (id, action) => {
    try {
      const res = await apiFetch(`${API_URL}/admin/claims/${id}/${action}`, { method: 'POST', headers: adminAuthHeaders() });
      const data = await res.json();
      if (!data.success) return alert(data.message || 'Kuch gadbad ho gayi.');
      setClaims(prev => prev.filter(c => c._id !== id));
      setRefreshKey(k => k + 1);
    } catch { alert('Server connection failed.'); }
  };

  const handleLogin = async () => {
    try {
      const res = await apiFetch(`${ADMIN_API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUser.trim(), password: loginPass.trim() }) });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem('roomkhojo_admin_token', data.token);
        setLoginUser(''); setLoginPass('');
        setIsAuthenticated(true);
      } else alert(data.message || 'Login fail.');
    } catch { alert("Server Error."); }
  };

  const handleChangeCredentials = async () => {
    if (!oldPass) return alert("Old Password zaroori hai!");
    if (!newAdminUser && !newAdminPass) return alert("New credentials daliye!");
    if (!window.confirm("WARNING: Kya aap sach mein Admin Username/Password change karna chahte hain?")) return;
    try {
      const res = await apiFetch(`${ADMIN_API}/change-credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ oldPassword: oldPass, newUsername: newAdminUser, newPassword: newAdminPass }) });
      const data = await res.json(); alert(data.message);
      if(data.success) { setOldPass(''); setNewAdminUser(''); setNewAdminPass(''); if(newAdminPass) { sessionStorage.removeItem('roomkhojo_admin_token'); setIsAuthenticated(false); } }
    } catch { alert("Error."); }
  };

  // 🎧 Support: jawab + close/reopen
  const sendAdminReply = async (ticketId) => {
    const text = (adminReply[ticketId] || '').trim();
    if (!text) return alert('Jawab likho pehle.');
    try {
      const res = await apiFetch(`${SUPPORT_API}/${ticketId}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (data.success) { setAdminReply(prev => ({ ...prev, [ticketId]: '' })); setRefreshKey(k => k + 1); }
      else alert(data.message);
    } catch { alert('Server connection failed.'); }
  };

  const setTicketStatus = async (ticketId, status) => {
    try {
      const res = await apiFetch(`${SUPPORT_API}/admin/${ticketId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (data.success) setRefreshKey(k => k + 1);
      else alert(data.message);
    } catch { alert('Server connection failed.'); }
  };

  // 🚨 SMART ERROR TRACKER (Ise Update Kiya Hai)
  const saveSystemSettings = async (updatedCategories, updatedFacilities, updatedPricing, updatedAdminPath, updatedAutoApprove) => {
    // 🛡️ P2 #54: har save path par validation (central — kisi bhi caller se invalid data na jaye)
    const pathToCheck = updatedAdminPath !== undefined ? updatedAdminPath : sysAdminPath;
    const pathErr = validateAdminPath(pathToCheck);
    if (pathErr) return alert(pathErr);
    const pricingToCheck = updatedPricing || sysPricing;
    const priceErr = validatePricing(pricingToCheck);
    if (priceErr) return alert(priceErr);
    try {
      const res = await apiFetch(`${ADMIN_API}/settings`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ categories: updatedCategories || sysCategories, facilities: updatedFacilities || sysFacilities, pricing: updatedPricing || sysPricing, adminPath: updatedAdminPath !== undefined ? updatedAdminPath : sysAdminPath, autoApproveFree: updatedAutoApprove !== undefined ? updatedAutoApprove : sysAutoApprove })
      });
      
      const textData = await res.text(); 
      try {
          const data = JSON.parse(textData);
          if (data.success) {
              alert("Settings & UPI ID Successfully Saved!");
          } else {
              alert("Backend Error: " + data.message);
          }
      } catch {
          alert("Server Error/Crash! Backend terminal check karein. Response: " + textData.substring(0, 100));
      }
    } catch { 
      alert("Connection Error: Backend server band ho gaya hai. Apna Termux check karein."); 
    }
  };

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    // P2 #54: duplicate block (case-insensitive)
    if ((sysCategories || []).some(c => String(c).toLowerCase() === name.toLowerCase())) return alert('Ye category pehle se hai!');
    const updated = [...(sysCategories || []), name];
    setSysCategories(updated);
    setNewCategoryName('');
  };

  const handleRemoveCategory = (catToRemove) => {
    const updated = (sysCategories || []).filter(cat => cat !== catToRemove);
    setSysCategories(updated);
  };

  const handleAddFacility = () => {
    const name = newFacilityName.trim();
    if (!name) return;
    // P2 #54: duplicate block (case-insensitive)
    if ((sysFacilities || []).some(f => String(f).toLowerCase() === name.toLowerCase())) return alert('Ye facility pehle se hai!');
    const updated = [...(sysFacilities || []), name];
    setSysFacilities(updated);
    setNewFacilityName('');
  };

  const handleRemoveFacility = (facToRemove) => {
    const updated = (sysFacilities || []).filter(fac => fac !== facToRemove);
    setSysFacilities(updated);
  };

  // 🛡️ P2 #54: validation helpers
  const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,64}$/;
  const RESERVED_ADMIN_PATHS = ['/', '/dashboard', '/support', '/about', '/terms', '/refund'];
  const validateAdminPath = (p) => {
    const v = String(p || '').trim();
    if (v.length < 4) return 'Path kam se kam 4 characters ka ho.';
    if (!v.startsWith('/')) return 'Path "/" se shuru hona chahiye.';
    if (/\s/.test(v)) return 'Path me space nahi ho sakta.';
    if (RESERVED_ADMIN_PATHS.includes(v.toLowerCase())) return 'Ye app ka apna page hai — alag path chuno.';
    if (!/^\/[a-zA-Z0-9\-_/]+$/.test(v)) return 'Path me sirf letters, numbers, - aur _ allowed hain.';
    return null;
  };
  const validatePricing = (p) => {
    const fields = { regular: 'Regular fee', promo7: '7-din promo', promo15: '15-din promo', promo30: '30-din promo', bannerPrice: 'Banner price', bannerDays: 'Banner duration' };
    for (const [key, label] of Object.entries(fields)) {
      const val = p[key];
      if (val === '' || val === undefined || val === null) continue; // optional khaali chhod sakte ho
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) return `${label} ki value sahi positive number nahi hai.`;
    }
    return null;
  };

  // P2 #52: approve/delete — status check + busy guard + server truth refetch (rollback)
  const handleApprove = async (id) => {
    if (actionBusy) return;
    setActionBusy(id);
    try {
      const res = await apiFetch(`${API_URL}/${id}/approve`, { method: 'PATCH', headers: adminAuthHeaders() });
      const data = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !data.success) alert(data.message || `Approve fail ho gaya (${res.status}).`);
    } catch {
      alert('Server connection failed — approve nahi hua.');
    }
    setActionBusy(null);
    setRefreshKey(k => k + 1); // server truth wapas (fail par bhi state rollback)
  };

  const handleDelete = async (id) => {
    if (actionBusy) return;
    if (!window.confirm("Room delete karna hai? Ye action wapas nahi hoga.")) return;
    setActionBusy(id);
    try {
      const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
      const data = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !data.success) alert(data.message || `Delete fail ho gaya (${res.status}).`);
    } catch {
      alert('Server connection failed — delete nahi hua.');
    }
    setActionBusy(null);
    setRefreshKey(k => k + 1);
  };

  // 🎯 Banner approve/revoke (payment verify ke baad) — #52: status check + busy guard
  const handleBannerApprove = async (id, approve) => {
    if (actionBusy) return;
    setActionBusy(id);
    try {
      const res = await apiFetch(`${API_URL}/${id}/banner`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() }, body: JSON.stringify({ approve }) });
      const data = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !data.success) alert(data.message || `Banner update fail (${res.status}).`);
      else alert(data.message);
    } catch { alert('Server connection failed.'); }
    setActionBusy(null);
    setRefreshKey(k => k + 1);
  };

  // Purane (Render-time) ads ko email wale account se link karo (one-time)
  // P2 #55: pehla click = preview (dry-run), doosra click = confirm migrate
  const handleMigrateRooms = async (confirmRun) => {
    if (migrateBusy) return; // double-click guard
    if (!migrateEmail.trim()) return alert('Email daliye!');
    setMigrateBusy(true);
    try {
      const res = await apiFetch(`${ADMIN_API}/migrate-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminAuthHeaders() },
        body: JSON.stringify({ email: migrateEmail.trim(), dryRun: !confirmRun })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message);
        setMigratePreview(null);
      } else if (data.dryRun) {
        setMigratePreview(data);
      } else {
        alert(data.message);
        setMigrateEmail(''); setMigratePreview(null);
        setRefreshKey(k => k + 1);
      }
    } catch { alert('Server connection failed.'); }
    setMigrateBusy(false);
  };

  const getDaysLeft = (expiryDate, plan) => {
    if (plan === 'regular' || !plan) return <span className="text-gray-500">Lifetime</span>;
    if (!expiryDate) return <span className="text-blue-500 font-bold">Pending</span>;
    const diff = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? <span className="text-green-600 font-bold">{diff} Days</span> : <span className="text-red-500 font-bold">Expired</span>;
  };

  const chatTicket = chatTicketId ? tickets.find(x => x._id === chatTicketId) || null : null;

  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] w-full bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto"><ShieldAlert size={32}/></div>
          <h1 className="text-2xl font-black text-center mb-2">Admin Portal</h1>
          <div className="space-y-4 mb-8 mt-6">
            <input type="text" value={loginUser} onChange={(e)=>setLoginUser(e.target.value)} placeholder="Admin Username" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold border" />
            <input type="password" value={loginPass} onChange={(e)=>setLoginPass(e.target.value)} placeholder="Password" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold border" />
          </div>
          <button onClick={handleLogin} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black flex justify-center items-center gap-2 active:scale-95"><Lock size={18} className="shrink-0"/> Unlock</button>
        </div>
      </div>
    );
  }

  const pendingAds = adminRooms.filter(r => !r.isApproved);
  const liveAds = adminRooms.filter(r => r.isApproved);
  const promotedCount = adminRooms.filter(r => r.isPromoted).length;
  // #56: server stats fail ho toh client estimate (fallback)
  const estRevenue = ((adminRooms.length - promotedCount) * Number(sysPricing.regular || 0)) + (promotedCount * Number(sysPricing.promo7 || 299));
  const uniqueUsersCount = new Set(adminRooms.filter(r => r.userId && r.userId !== 'unknown_user').map(r => r.userId)).size;
  const revenueTotal = stats ? stats.totalRevenue : estRevenue;

  return (
    <div className="h-[100dvh] w-full bg-gray-100 flex flex-col font-sans relative overflow-hidden">
      
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex justify-between items-center shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30"><User size={20} className="shrink-0 text-white"/></div>
          <div>
            <h1 className="font-black text-lg leading-tight">Admin Console</h1>
            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">Welcome back, Boss! <Crown size={12} className="text-amber-400" /></p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)} className="bg-white/10 p-2 rounded-lg active:scale-95 transition-transform" title="Refresh Data"><BarChart3 size={16} /></button>
          {/* P2 #59: Exit par saari admin state reset — next login par stale data flash na ho */}
          <button onClick={() => { sessionStorage.removeItem('roomkhojo_admin_token'); setIsAuthenticated(false); setAdminRooms([]); setTickets([]); setClaims([]); setOpenCount(0); setStats(null); setChatTicketId(null); setAdminReply({}); setActiveTab('analytics'); setMigratePreview(null); setMigrateEmail(''); setOldPass(''); setNewAdminUser(''); setNewAdminPass(''); }} className="bg-red-500/20 text-red-100 p-2 rounded-lg text-sm font-bold flex items-center gap-2 active:scale-95 transition-transform"><LogOut size={16} className="shrink-0"/> Exit</button>
        </div>
      </header>
      
      {/* Tabs */}
      <div className="order-2 bg-white border-t shrink-0 px-2 pt-2 grid grid-cols-4 gap-1" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center gap-1 py-1 transition-all ${activeTab === 'analytics' ? 'text-brand scale-105' : 'text-gray-400'}`}><BarChart3 size={22} /><span className="text-[10px] font-black uppercase tracking-tighter">Analytics</span></button>
        <button onClick={() => setActiveTab('ads')} className={`flex flex-col items-center gap-1 py-1 transition-all relative ${activeTab === 'ads' ? 'text-brand scale-105' : 'text-gray-400'}`}><LayoutDashboard size={22} />{pendingAds.length > 0 && (<span className="absolute top-0 right-3 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{pendingAds.length}</span>)}<span className="text-[10px] font-black uppercase tracking-tighter">Ads</span></button>
        <button onClick={() => setActiveTab('support')} className={`flex flex-col items-center gap-1 py-1 transition-all relative ${activeTab === 'support' ? 'text-brand scale-105' : 'text-gray-400'}`}><MessageCircle size={22} />{openCount > 0 && (<span className="absolute top-0 right-3 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{openCount}</span>)}<span className="text-[10px] font-black uppercase tracking-tighter">Support</span></button>
        <button onClick={() => setActiveTab('system')} className={`flex flex-col items-center gap-1 py-1 transition-all ${activeTab === 'system' ? 'text-brand scale-105' : 'text-gray-400'}`}><Settings size={22} /><span className="text-[10px] font-black uppercase tracking-tighter">System</span></button>
      </div>

      <div className="order-1 flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 pb-10">
            <div className="grid grid-cols-2 gap-3"><div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase">Registered Users</p><p className="text-2xl font-black text-gray-800">{stats ? stats.uniqueUsers : uniqueUsersCount}</p></div><div className="bg-green-50 p-4 rounded-2xl shadow-sm border border-green-100"><p className="text-xs font-bold text-green-700 uppercase">{stats ? 'Revenue (Recorded)' : 'Est. Revenue'}</p><p className="text-2xl font-black text-green-800">₹{revenueTotal}</p>{stats ? (<p className="text-[10px] font-bold text-green-600 mt-1">Promo ₹{stats.promoRevenue} • Banner ₹{stats.bannerRevenue}</p>) : (<p className="text-[10px] font-bold text-green-600 mt-1">Approx — server stats load nahi hue</p>)}</div><div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase">Total Ads</p><p className="text-2xl font-black text-gray-800">{stats ? stats.totalAds : adminRooms.length}</p><p className="text-[10px] font-bold text-gray-400 mt-1">{stats ? `${stats.liveAds} live • ${stats.pendingAds} pending` : ''}</p></div><div className="bg-orange-50 p-4 rounded-2xl shadow-sm border border-orange-100"><p className="text-xs font-bold text-orange-700 uppercase">Promo Ads</p><p className="text-2xl font-black text-orange-800">{stats ? stats.promoAds : promotedCount}</p>{stats ? (<p className="text-[10px] font-bold text-orange-600 mt-1">Banner LIVE: {stats.bannerActive}</p>) : null}</div></div>
            {stats && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Revenue Breakdown (recorded)</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['Regular', 'regular'], ['Promo 7D', 'promo7'], ['Promo 15D', 'promo15'], ['Promo 30D', 'promo30']].map(([label, key]) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-2 border border-gray-100"><p className="text-[10px] font-black text-gray-500 uppercase">{label}</p><p className="text-sm font-black text-gray-800">₹{stats.byPlan[key] || 0}</p></div>
                  ))}
                </div>
                <p className="text-[10px] font-bold text-gray-400 mt-2">Note: sirf un ads ka record jinka payment is fix ke baad approve hua.</p>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-4"><div className="p-4 border-b bg-gray-50"><h3 className="font-black text-gray-800 flex items-center gap-2"><Clock size={18}/> Users & Ad Status Report</h3></div><div className="p-0 overflow-x-auto"><table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b"><tr><th className="p-3">User/Owner</th><th className="p-3">Ad Title</th><th className="p-3 text-brand">Pay Code</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{adminRooms.map(room => (<tr key={room._id} className="hover:bg-gray-50"><td className="p-3 font-bold text-gray-800"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-brand/10 text-brand rounded-full flex justify-center items-center text-[10px] shrink-0"><User size={12}/></div>{room.ownerName || 'Owner'}</div></td><td className="p-3 text-gray-600 line-clamp-1 max-w-[150px]">{room.title}</td><td className="p-3 font-black text-brand bg-brand/5 border-x">{room.paymentCode || 'FREE'}</td><td className="p-3">{room.isPromoted ? <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1"><Star size={11} fill="currentColor" /> Promo {room.promoPlan}D</span> : <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">Regular</span>}</td><td className="p-3">{getDaysLeft(room.expiryDate, room.promoPlan)}</td><td className="p-3"><a href={`https://wa.me/91${room.mobile}?text=${encodeURIComponent(`Namaste ${room.ownerName || 'Owner'}!\nRoomKhojo par aapka Ad ("${room.title}") jald hi expire hone wala hai.`)}`} target="_blank" rel="noreferrer" className="bg-[#25D366]/10 text-[#25D366] px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-transform w-fit"><MessageCircle size={14}/> Alert</a></td></tr>))}</tbody></table></div></div>
          </div>
        )}

        {/* Ads Tab — Section 0: Purane-ad claim requests (#13) */}
        {activeTab === 'ads' && claims.length > 0 && (<div className="space-y-3">
          <h2 className="text-base font-black text-gray-800 px-1 flex items-center gap-2"><Link size={18} className="text-blue-600" /> Purane Ad Claims ({claims.length})</h2>
          {claims.map(c => (
            <div key={c._id} className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 flex flex-col gap-3">
              <div className="flex gap-3 items-center">
                <img src={getImageUrl(c.image)} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100" alt="Room" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-800 truncate">{c.title}</h4>
                  <p className="text-xs font-bold text-gray-500 mt-0.5 truncate">Ad ka No.: {c.mobile} • Claimant: {c.claimRequestName || 'User'}</p>
                  <p className="text-[10px] font-black text-blue-700 mt-0.5">Mobile match ✅ — verify karke approve ya reject karein</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleClaim(c._id, 'approve')} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-black text-sm active:scale-95 flex items-center justify-center gap-1"><Check size={16}/> Approve (Link)</button>
                <button onClick={() => handleClaim(c._id, 'reject')} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-black text-sm active:scale-95 flex items-center justify-center gap-1"><X size={16}/> Reject</button>
              </div>
            </div>
          ))}
        </div>)}

        {/* Ads Tab — Section 1: Pending */}
        {activeTab === 'ads' && (<div className="space-y-4 pb-10">
          <h2 className="text-base font-black text-gray-800 px-1 flex items-center gap-2"><LayoutDashboard size={18} className="text-orange-500" /> Pending Approval ({pendingAds.length})</h2>
          {pendingAds.length === 0 ? (
            <p className="text-center text-gray-500 font-bold p-10">Koi pending ad nahi hai.</p>
          ) : (
            pendingAds.map(room => (
              <div key={room._id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-200 flex flex-col gap-3">
                <div className="flex gap-4">
                  <img src={getImageUrl(room.image)} className="w-24 h-24 rounded-xl object-cover shrink-0 border border-gray-100" alt="Room" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-gray-800 leading-tight text-lg">{room.title}</h4>
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Pending</span>
                    </div>
                    <p className="text-brand font-black mt-0.5">{room.price} <span className="text-xs text-gray-400 font-bold ml-1">({room.category} • {room.type})</span></p>
                    <p className="text-gray-500 text-xs font-bold mt-1.5 flex items-center gap-1"><User size={12}/> {room.ownerName || 'Owner'} <span className="mx-1">•</span> <Smartphone size={12}/> {room.mobile}</p>
                    <p className="text-gray-500 text-xs font-bold mt-1.5 flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {room.landmark || 'N/A'}</p>
                    {room.description && <p className="text-gray-400 text-[10px] font-bold mt-1.5 bg-gray-50 p-2 rounded-lg border border-gray-100 leading-tight">{room.description}</p>}
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex justify-between items-center shadow-inner">
                  <p className="text-xs font-bold text-orange-800">Pay Code: <span className="font-black text-lg tracking-widest ml-1">{room.paymentCode || 'FREE'}</span>{room.paymentRef ? (<span className="block text-[10px] mt-0.5">UPI Ref: {room.paymentRef}</span>) : null}</p>
                  <span className="text-[10px] font-black bg-white px-2 py-1 rounded-md text-orange-600 shadow-sm border border-orange-100">
                    {(room.promoRequested && room.promoRequested !== 'regular') ? (<span className="inline-flex items-center gap-1"><Star size={11} fill="currentColor" /> Promo {room.promoRequested} Days — payment verify karke Approve dabayein</span>) : 'Regular Ad'}
                  </span>
                </div>
                {room.bannerRequested && !room.isBannerActive && (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex justify-between items-center">
                    <p className="text-xs font-bold text-purple-800 flex items-center gap-1"><Megaphone size={13} className="shrink-0" /> Banner Req{room.bannerRef ? (<span className="font-black"> • Ref: {room.bannerRef}</span>) : null}</p>
                    <button onClick={() => handleBannerApprove(room._id, true)} disabled={!!actionBusy} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-[11px] font-black active:scale-95 shrink-0 ml-2 disabled:opacity-60">Approve Banner</button>
                  </div>
                )}
                {room.isBannerActive && (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex justify-between items-center">
                    <p className="text-xs font-bold text-purple-800 flex items-center gap-1"><Megaphone size={13} className="shrink-0" /> Banner LIVE</p>
                    <button onClick={() => handleBannerApprove(room._id, false)} disabled={!!actionBusy} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-[11px] font-black active:scale-95 shrink-0 ml-2 disabled:opacity-60">Remove</button>
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => handleApprove(room._id)} disabled={!!actionBusy} className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-lg shadow-green-500/20 disabled:opacity-60">{actionBusy === room._id ? 'Process ho raha hai…' : (<><Check size={18} strokeWidth={3}/> Verify Payment & Approve</>)}</button>
                  <button onClick={() => handleDelete(room._id)} disabled={!!actionBusy} className="w-14 bg-red-50 text-red-600 flex items-center justify-center rounded-xl active:scale-95 transition-transform border border-red-100 disabled:opacity-60"><X size={20} strokeWidth={3}/></button>
                </div>
              </div>
            ))
          )}
          </div>
        )}

          {/* Ads Tab — Section 2: Live */}
        {activeTab === 'ads' && (<div className="space-y-4 pb-10">
          {/* Ads Tab — Section 2: Live */}
          <h2 className="text-base font-black text-gray-800 px-1 pt-3 flex items-center gap-2"><Check size={18} className="text-green-600" /> Live Ads ({liveAds.length})</h2>
          {liveAds.length === 0 ? (
            <p className="text-center text-gray-500 font-bold p-10">Koi live ad nahi hai.</p>
          ) : (
            liveAds.map(room => {
              const hasReports = room.unavailableReportCount >= 3;
              return (
              <div key={room._id} className={`bg-white p-4 rounded-2xl shadow-sm border ${hasReports ? 'border-red-400' : 'border-green-200'} flex flex-col gap-3 relative`}>
                {hasReports && (
                  <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border border-white"></span>
                  </div>
                )}
                <div className="flex gap-4">
                  <img src={getImageUrl(room.image)} className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-100" alt="Room" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-gray-800 leading-tight text-base">{room.title}</h4>
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Live</span>
                    </div>
                    <p className="text-brand font-black text-sm mt-0.5">{room.price} <span className="text-[10px] text-gray-400 font-bold ml-1">({room.category} • {room.type})</span></p>
                    <p className="text-gray-500 text-[10px] font-bold mt-1.5 flex items-center gap-1"><User size={10}/> {room.ownerName || 'Owner'} <span className="mx-1">•</span> <Smartphone size={10}/> {room.mobile}</p>
                  </div>
                </div>
                {hasReports && (
                  <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                    <p className="text-[10px] font-black text-red-600 mb-2 uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> {room.unavailableReportCount} Users reported as unavailable!</p>
                    <a href={`https://wa.me/91${room.mobile}?text=${encodeURIComponent(`Namaste ${room.ownerName || 'Owner'}!\nRoomKhojo par aapka room "${room.title}" kuch users ne "Unavailable" report kiya hai.\nKya aapka room rent par ja chuka hai? Kripya confirm karein taaki hum status update kar sakein.`)}`} target="_blank" rel="noreferrer" className="w-full bg-[#25D366]/10 text-[#25D366] py-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><MessageCircle size={14}/> Ask Owner for Confirmation</a>
                  </div>
                )}
                {/* #53: banner controls ab Live ads me bhi (approve ke baad bhi manage ho sake) */}
                {room.bannerRequested && !room.isBannerActive && (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex justify-between items-center">
                    <p className="text-xs font-bold text-purple-800 flex items-center gap-1"><Megaphone size={13} className="shrink-0" /> Banner Request{room.bannerRef ? (<span className="font-black"> • Ref: {room.bannerRef}</span>) : null}</p>
                    <button onClick={() => handleBannerApprove(room._id, true)} disabled={!!actionBusy} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-[11px] font-black active:scale-95 shrink-0 ml-2 disabled:opacity-60">Approve Banner</button>
                  </div>
                )}
                {room.isBannerActive && (
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl flex justify-between items-center">
                    <p className="text-xs font-bold text-purple-800 flex items-center gap-1"><Megaphone size={13} className="shrink-0" /> Banner LIVE {room.bannerExpires ? <span className="text-purple-500 font-bold ml-1">({new Date(room.bannerExpires).toLocaleDateString('en-IN')} tak)</span> : null}</p>
                    <button onClick={() => handleBannerApprove(room._id, false)} disabled={!!actionBusy} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-[11px] font-black active:scale-95 shrink-0 ml-2 disabled:opacity-60">Remove</button>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <div className="flex-1 bg-gray-50 border border-gray-100 p-2 rounded-xl flex items-center justify-center text-xs font-bold text-gray-600">
                    Plan Status: <span className="ml-1.5">{getDaysLeft(room.expiryDate, room.promoPlan)}</span>
                  </div>
                  <button onClick={() => handleDelete(room._id)} disabled={!!actionBusy} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-transform border border-red-100 disabled:opacity-60"><X size={14} strokeWidth={3}/> Delete Ad</button>
                </div>
              </div>
            )})
          )}
          </div>
        )}

      {/* 💬 ADMIN CHAT OVERLAY (full-screen) */}
      {chatTicket && (
        <div className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col font-sans">
          <header className="bg-white px-3 py-3 flex items-center gap-2 border-b shrink-0">
            <button onClick={() => setChatTicketId(null)} className="p-2 -ml-1 text-gray-600 active:scale-95"><ArrowLeft size={22} /></button>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-800 leading-tight truncate">{chatTicket.category}</p>
              <p className="text-[11px] font-bold text-gray-400 truncate">{chatTicket.userName || chatTicket.userEmail || 'User'} • {chatTicket.status}</p>
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)} className="text-[11px] font-black bg-gray-100 text-gray-600 px-3 py-2 rounded-xl active:scale-95 shrink-0">Refresh</button>
            {chatTicket.status !== 'closed'
              ? <button onClick={() => setTicketStatus(chatTicket._id, 'closed')} className="text-[11px] font-black bg-gray-100 text-gray-600 px-3 py-2 rounded-xl active:scale-95 shrink-0">Close</button>
              : <button onClick={() => setTicketStatus(chatTicket._id, 'open')} className="text-[11px] font-black bg-orange-50 text-orange-700 px-3 py-2 rounded-xl active:scale-95 shrink-0">Reopen</button>}
          </header>
          <div ref={adminChatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="bg-white p-3 rounded-2xl rounded-tl-md shadow-sm border border-gray-100 max-w-[92%]">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">User complaint</p>
              <p className="text-sm font-bold text-gray-800">{chatTicket.message}</p>
              {chatTicket.image && <img src={getImageUrl(chatTicket.image)} className="w-full max-h-56 rounded-xl object-cover border border-gray-200 mt-2" alt="Proof" />}
            </div>
            {(chatTicket.replies || []).map((r, i) => (
              <div key={i} className={`p-3 rounded-2xl text-sm font-bold max-w-[88%] shadow-sm ${r.by === 'admin' ? 'bg-brand text-white rounded-tr-md ml-auto' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-md'}`}>
                <p className="text-[10px] uppercase opacity-60 mb-0.5 font-black">{r.by === 'admin' ? 'Aap (Admin)' : (chatTicket.userName || 'User')}</p>
                {r.text}
              </div>
            ))}
          </div>
          {chatTicket.status !== 'closed' ? (
            <div className="p-3 bg-white border-t flex gap-2 shrink-0">
              <input type="text" value={adminReply[chatTicket._id] || ''} onChange={(e) => setAdminReply(prev => ({ ...prev, [chatTicket._id]: e.target.value }))} placeholder="Jawab likho…" className="flex-1 p-3 bg-gray-50 rounded-2xl outline-none font-bold text-sm border" />
              <button onClick={() => sendAdminReply(chatTicket._id)} className="bg-brand text-white w-12 rounded-2xl flex items-center justify-center active:scale-95"><Send size={18} /></button>
            </div>
          ) : (
            <p className="p-4 text-center text-xs font-bold text-gray-400 bg-white border-t">Ticket band hai — reply ke liye pehle Reopen dabao.</p>
          )}
        </div>
      )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="space-y-4 pb-10">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
              <p className="font-black text-gray-800">Support Tickets</p>
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">{openCount} Khule</span>
            </div>
            {tickets.length === 0 ? (
              <p className="text-center text-gray-500 font-bold p-10">Koi ticket nahi hai.</p>
            ) : tickets.map(t => (
              <div key={t._id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${t.status === 'open' ? 'bg-orange-100 text-orange-700' : t.status === 'replied' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                    <p className="text-xs font-black text-gray-700 mt-1">{t.category} • {t.userName || t.userEmail || 'User'}</p>
                  </div>
                  <button onClick={() => setChatTicketId(t._id)} className="text-xs font-black text-white bg-brand px-3 py-1.5 rounded-lg shrink-0 active:scale-95">Chat kholo</button>
                </div>
                <p className="text-sm font-bold text-gray-700">{t.message}</p>
                {t.image && <img src={getImageUrl(t.image)} className="w-32 h-24 rounded-xl object-cover border border-gray-200 mt-2" alt="Proof" />}
              </div>
            ))}
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
           <div className="space-y-4 pb-10">
              {/* Purane Ads Migrate (one-time) — #55: preview (dry-run) → confirm */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-200">
                <h3 className="font-black text-gray-800 mb-1 flex items-center gap-1.5"><Link size={16} className="text-blue-600" /> Purane Ads Link Karo</h3>
                <p className="text-[11px] font-bold text-gray-500 mb-3">Render wale time ke ads (puraani login IDs wale) ko kisi email wale account se jod do. Sirf bina-link ads move honge, linked ads safe rahenge. Pehle Preview dikhega — tabhi confirm hoga.</p>
                <div className="flex gap-2">
                  <input type="email" value={migrateEmail} onChange={(e) => { setMigrateEmail(e.target.value); setMigratePreview(null); }} placeholder="user@email.com" className="flex-1 p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
                  <button onClick={() => handleMigrateRooms(false)} disabled={migrateBusy} className="bg-blue-600 text-white px-4 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{migrateBusy ? '…' : 'Preview'}</button>
                </div>
                {migratePreview && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-black text-blue-800">{migratePreview.count} ads move honge {migrateEmail.trim()} ko:</p>
                    {(migratePreview.sample || []).length > 0 && (
                      <ul className="text-[11px] font-bold text-blue-700 mt-1 space-y-0.5">
                        {(migratePreview.sample || []).map((s, i) => (<li key={i}>• {s.title} <span className="text-blue-400">({s.mobile})</span></li>))}
                        {migratePreview.count > (migratePreview.sample || []).length && <li className="text-blue-400">…aur {migratePreview.count - (migratePreview.sample || []).length} more</li>}
                      </ul>
                    )}
                    <button onClick={() => handleMigrateRooms(true)} disabled={migrateBusy} className="mt-3 w-full bg-blue-600 text-white py-2.5 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{migrateBusy ? 'Migrate ho raha hai…' : `Confirm — ${migratePreview.count} Ads Migrate Karo`}</button>
                  </div>
                )}
              </div>

              {/* Auto-approve FREE ads toggle */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-200">
                <h3 className="font-black text-gray-800 mb-1">Free Ads Auto-Approve</h3>
                <p className="text-[11px] font-bold text-gray-500 mb-3">ON = free/regular ads seedha live (bina review). OFF = admin verification ke baad. Paid/promo HAMESHA review mangte hain.</p>
                <button onClick={() => { const v = !sysAutoApprove; if (window.confirm(v ? "Free ads seedha LIVE honge. Continue?" : "Free ads phir se review me jayenge. Continue?")) { setSysAutoApprove(v); saveSystemSettings(sysCategories, sysFacilities, sysPricing, sysAdminPath, v); } }} className={`w-full py-3 rounded-xl font-black text-sm active:scale-95 transition-colors ${sysAutoApprove ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{sysAutoApprove ? (<span className="inline-flex items-center gap-1"><Check size={14} strokeWidth={3} /> ON — Free ads seedha live</span>) : 'OFF — Free ads review me'}</button>
              </div>
             
             {/* UPI Card */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand/20">
               <h3 className="font-black text-brand mb-2 flex items-center gap-2"><Smartphone size={18}/> Admin UPI Details</h3>
               <p className="text-xs text-gray-500 mb-4 font-bold">Payments receive karne ke liye apni asli UPI ID daalein.</p>
                <input type="text" value={sysPricing.upiId || ''} onChange={e=>setSysPricing({...sysPricing, upiId: e.target.value})} placeholder="e.g. 9145891108@ybl" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border focus:border-brand mb-3" />
                <button onClick={() => { const upi = String(sysPricing.upiId || '').trim(); if (!UPI_RE.test(upi)) return alert('Sahi UPI ID daliye (jaise: 9145891108@ybl).'); if(window.confirm("Kya aap sach mein UPI ID update karna chahte hain? Sabhi payments ab is naye UPI par aayengi.")) { saveSystemSettings(sysCategories, sysFacilities, { ...sysPricing, upiId: upi }); } }} className="bg-brand text-white font-black py-3 px-4 rounded-xl text-sm w-full active:scale-95 transition-transform">Save UPI ID</button>
             </div>

             {/* Security Card */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-red-100">
               <h3 className="font-black text-red-600 mb-2 flex items-center gap-2"><Lock size={18}/> Security Settings</h3>
               <p className="text-xs text-gray-500 mb-4 font-bold">Admin Panel ka Username aur Password change karein.</p>
               <div className="space-y-3 mb-4">
                 <input type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} placeholder="Old Password (Required)" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border focus:border-red-300" />
                 <input type="text" value={newAdminUser} onChange={e=>setNewAdminUser(e.target.value)} placeholder="New Username (Optional)" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border focus:border-red-300" />
                 <input type="password" value={newAdminPass} onChange={e=>setNewAdminPass(e.target.value)} placeholder="New Password (Optional)" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border focus:border-red-300" />
               </div>
                <button onClick={handleChangeCredentials} className="bg-red-600 text-white font-black py-3 px-4 rounded-xl text-sm w-full flex justify-center items-center gap-2 active:scale-95 transition-transform"><Save size={16}/> Update Security</button>
              </div>

              {/* Admin Path Card (backend-driven path) */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100">
                <h3 className="font-black text-purple-700 mb-2 flex items-center gap-1.5"><Link size={16} /> Admin Panel Path</h3>
                <p className="text-xs text-gray-500 mb-4 font-bold">Ye path backend se aata hai. Save ke baad page refresh karo — tab naya path chalega, puraana band.</p>
                <input type="text" value={sysAdminPath} onChange={e=>setSysAdminPath(e.target.value)} placeholder="/mera-secret-path" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border focus:border-purple-300 mb-3" />
                <button onClick={() => { const err = validateAdminPath(sysAdminPath); if (err) return alert(err); if(window.confirm("Admin panel ka path badal jayega. Puraana path kaam nahi karega. Continue?")) { saveSystemSettings(sysCategories, sysFacilities, sysPricing, sysAdminPath.trim()); } }} className="bg-purple-600 text-white font-black py-3 px-4 rounded-xl text-sm w-full active:scale-95 transition-transform">Save Path</button>
              </div>

             {/* Categories Card */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border">
               <h3 className="font-black text-gray-800 mb-2">Manage Categories</h3>
               <p className="text-xs text-gray-500 mb-4 font-bold">Add, remove or edit app categories.</p>
               <button onClick={() => setShowCatModal(true)} className="bg-brand/10 text-brand font-black py-3 px-4 rounded-xl text-sm w-full active:scale-95">Edit Categories List</button>
             </div>

             {/* Facilities Card */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border">
               <h3 className="font-black text-gray-800 mb-2">Manage Facilities</h3>
               <p className="text-xs text-gray-500 mb-4 font-bold">Add or remove room facilities.</p>
               <button onClick={() => setShowFacModal(true)} className="bg-blue-50 text-blue-600 font-black py-3 px-4 rounded-xl text-sm w-full active:scale-95">Edit Facilities List</button>
             </div>

             {/* Pricing Card */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border">
               <h3 className="font-black text-gray-800 mb-2">Customize Ad Plans</h3>
               <p className="text-xs text-gray-500 mb-4 font-bold">Change Regular and Promoted Ad pricing.</p>
               <button onClick={() => setShowPromoModal(true)} className="bg-orange-50 text-orange-600 font-black py-3 px-4 rounded-xl text-sm w-full active:scale-95">Edit Ad Pricing</button>
             </div>

           </div>
        )}
      </div>

      {/* CATEGORIES MODAL */}
      {showCatModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowCatModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X size={16}/></button>
            <h2 className="text-xl font-black mb-4">Categories</h2>
            
            <div className="flex gap-2 mb-4">
              <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New Category Name..." className="flex-1 p-3 bg-gray-50 rounded-xl font-bold border outline-none text-sm" />
              <button onClick={handleAddCategory} className="bg-brand text-white px-4 rounded-xl font-black"><Plus size={20}/></button>
            </div>
            
            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2">
              {(sysCategories || []).map(cat => (
                <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl font-bold text-sm">
                  <span>{cat}</span>
                  <button onClick={() => handleRemoveCategory(cat)} className="text-red-500 active:scale-90"><X size={16}/></button>
                </div>
              ))}
            </div>
            
            <button className="w-full bg-brand text-white py-3 rounded-xl font-black text-sm active:scale-95" onClick={() => { saveSystemSettings(sysCategories, sysFacilities, sysPricing); setShowCatModal(false); }}>Save to Database</button>
          </div>
        </div>
      )}

      {/* FACILITIES MODAL */}
      {showFacModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowFacModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X size={16}/></button>
            <h2 className="text-xl font-black mb-4">Facilities</h2>
            
            <div className="flex gap-2 mb-4">
              <input type="text" value={newFacilityName} onChange={(e) => setNewFacilityName(e.target.value)} placeholder="New Facility..." className="flex-1 p-3 bg-gray-50 rounded-xl font-bold border outline-none text-sm" />
              <button onClick={handleAddFacility} className="bg-blue-600 text-white px-4 rounded-xl font-black"><Plus size={20}/></button>
            </div>
            
            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2">
              {(sysFacilities || []).map(fac => (
                <div key={fac} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl font-bold text-sm">
                  <span>{fac}</span>
                  <button onClick={() => handleRemoveFacility(fac)} className="text-red-500 active:scale-90"><X size={16}/></button>
                </div>
              ))}
            </div>
            
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-sm active:scale-95" onClick={() => { saveSystemSettings(sysCategories, sysFacilities, sysPricing); setShowFacModal(false); }}>Save to Database</button>
          </div>
        </div>
      )}

      {/* PRICING MODAL */}
      {showPromoModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
             <button onClick={() => setShowPromoModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X size={16}/></button>
             <h2 className="text-xl font-black mb-4">Ad Pricing</h2>
             <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
               <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                 <label className="text-xs font-black text-blue-700 uppercase">Regular Ad Fee (₹)</label>
                 <input type="number" value={sysPricing.regular} onChange={(e) => setSysPricing({...sysPricing, regular: e.target.value})} className="w-full p-2 bg-white rounded-lg font-bold border mt-1 outline-none" />
               </div>
               <div><label className="text-xs font-bold text-gray-500">7 Days Promo (₹)</label><input type="number" value={sysPricing.promo7} onChange={(e) => setSysPricing({...sysPricing, promo7: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border mt-1 outline-none" /></div>
               <div><label className="text-xs font-bold text-gray-500">15 Days Promo (₹)</label><input type="number" value={sysPricing.promo15} onChange={(e) => setSysPricing({...sysPricing, promo15: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border mt-1 outline-none" /></div>
                <div><label className="text-xs font-bold text-gray-500">30 Days Promo (₹)</label><input type="number" value={sysPricing.promo30} onChange={(e) => setSysPricing({...sysPricing, promo30: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border mt-1 outline-none" /></div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <label className="text-xs font-black text-purple-700 uppercase flex items-center gap-1"><Megaphone size={12} /> Banner Add-on Price (₹)</label>
                  <input type="number" value={sysPricing.bannerPrice || ''} onChange={(e) => setSysPricing({...sysPricing, bannerPrice: e.target.value})} className="w-full p-2 bg-white rounded-lg font-bold border mt-1 outline-none" />
                </div>
                <div><label className="text-xs font-bold text-gray-500">Banner Duration (din)</label><input type="number" value={sysPricing.bannerDays || ''} onChange={(e) => setSysPricing({...sysPricing, bannerDays: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl font-bold border mt-1 outline-none" /></div>
             </div>
             <button className="w-full bg-orange-500 text-white py-3 rounded-xl font-black text-sm active:scale-95" onClick={() => { saveSystemSettings(sysCategories, sysFacilities, sysPricing); setShowPromoModal(false); }}>Update Database</button>
          </div>
        </div>
      )}
    </div>
  );
}