import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Star, ArrowLeft, Settings, Bell, MapPin, Trash2, Edit3, X, Camera, ShieldAlert, Phone, Clock, Eye, Heart, RefreshCw, Link, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from './apiFetch'; // P1 #31/#32: timeout + 401 auto-logout
import { safeImageUrl, telUrl, upiUrl } from './safeUrl';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BASE_URL = VITE_API_BASE_URL ? VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'https://roomkhojo-backend.vercel.app'; // P2 #58: sirf trailing /api strip
const getImageUrl = (path) => safeImageUrl(path);
// Number ho toh ₹ lagao, "Contact for price"/"Negotiable" jaisa text waisa hi bhejo
const fmtPrice = (p) => { const t = String(p == null ? '' : p).trim(); return /^\d+$/.test(t) ? `₹${t}` : t; };

// Logged-in API calls ke liye Bearer header
const authHeaders = () => {
  const token = localStorage.getItem('roomkhojo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function UserDashboard() {
  const navigate = useNavigate();

  // 🔐 P1 #32: session expire (401) → message + login page (login modal khud khulega)
  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail !== 'user') return;
      alert('Aapka session expire ho gaya. Dobara login karein.');
      sessionStorage.setItem('roomkhojo_need_login', '1');
      navigate('/');
    };
    window.addEventListener('rk:auth-expired', onExpired);
    return () => window.removeEventListener('rk:auth-expired', onExpired);
  }, [navigate]);
  // Session lazy-load (refresh par login bana rehta hai)
  const [currentUser, setCurrentUser] = useState(() => {
    try { const saved = localStorage.getItem('roomkhojo_user'); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  // ⚙️ Settings panel states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingName, setSavingName] = useState(false); // P2 #48: save loading states
  const [savingPw, setSavingPw] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState('request');
  const [emailInfo, setEmailInfo] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [delConfirm, setDelConfirm] = useState('');
  const [delOtp, setDelOtp] = useState('');
  const [delOtpSent, setDelOtpSent] = useState(false);
  const [delInfo, setDelInfo] = useState('');
  const [sendingDelOtp, setSendingDelOtp] = useState(false);
  const [delCooldown, setDelCooldown] = useState(0);
  const [deletingAcc, setDeletingAcc] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Pehli load par skeleton dikhao (fetch complete hote hi hatेगा)
  const [adsLoaded, setAdsLoaded] = useState(false);
  const [myRooms, setMyRooms] = useState([]);

  // 🚨 EDIT STATES
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', price: '', type: 'Boys', category: 'PG', landmark: '', mobile: '', ownerName: '', description: [], googleMapUrl: '', listingType: 'room' });
  const [editKeep, setEditKeep] = useState([]); // mevcut URLs (✕ se hatao)
  const [editNew, setEditNew] = useState([]); // nayi files [{file, url}]
  // 🔄 Renew states
  const [renewRoom, setRenewRoom] = useState(null);
  const [renewPlan, setRenewPlan] = useState('7');
  const [renewRef, setRenewRef] = useState('');
  // 💳 P0 fix: UPI note ka code — server bhi yahi save karega (admin ko wahi dikhega)
  const [renewCode, setRenewCode] = useState('');
  const renewCodeRoomRef = useRef(null); // same room reopen par wahi code reuse
  // 🔗 Purane ad claim (#13 fix): mobile match + admin approval
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimMobile, setClaimMobile] = useState('');
  const [claimResults, setClaimResults] = useState([]);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimSearched, setClaimSearched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressingEdit, setIsCompressingEdit] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);
  const showNotice = (message, ms = 3500) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), ms);
  };
  const [sysSettings, setSysSettings] = useState({ facilities: ['Wi-Fi', 'AC', 'Water 24x7', 'Electricity', 'Geyser', 'RO Water', 'Parking', 'CCTV', 'Meals', 'Attached Washroom'] });

  // ❤️ Saved ads (favorites) + unsave
  const [savedRooms, setSavedRooms] = useState([]);
  const unsaveBusyRef = useRef(new Set()); // P2 #47: double-tap guard (toggle wapas save kar deta tha)

  useEffect(() => {
    if (emailCooldown <= 0) return undefined;
    const t = setInterval(() => setEmailCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [emailCooldown]);

  useEffect(() => {
    if (delCooldown <= 0) return undefined;
    const t = setInterval(() => setDelCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [delCooldown]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const fetchSaved = () => {
    apiFetch(`${BASE_URL}/api/users/favorites`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setSavedRooms(data.rooms || []); })
      .catch(() => { /* saved optional */ });
  };

  const unsaveRoom = async (roomId) => {
    if (unsaveBusyRef.current.has(roomId)) return;
    unsaveBusyRef.current.add(roomId);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/favorites/${roomId}/toggle`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      // P2 #47: functional update — stale closure fix (purane savedRooms par nahi)
      if (data.success && !data.saved) setSavedRooms(prev => prev.filter(r => r._id !== roomId));
    } catch { alert('Server connection failed.'); }
    finally { unsaveBusyRef.current.delete(roomId); }
  };

  useEffect(() => {
    // 🔐 Token/user dono hon tabhi dashboard load — warna seedha login modal (adha-adhura session band)
    if (!currentUser || !localStorage.getItem('roomkhojo_token')) {
      localStorage.removeItem('roomkhojo_user');
      localStorage.removeItem('roomkhojo_token');
      sessionStorage.setItem('roomkhojo_need_login', '1');
      navigate('/');
      return;
    }
    apiFetch(`${BASE_URL}/api/rooms/user/${currentUser.id}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => { if (data.success) setMyRooms(data.rooms); })
      .catch((err) => console.error(err))
      .finally(() => setAdsLoaded(true));
    apiFetch(`${BASE_URL}/api/admin/settings`)
      .then(res => res.json())
      .then(data => { if (data.success && data.settings) setSysSettings(data.settings); })
      .catch(() => { /* settings optional: defaults use honge */ });
    fetchSaved();
  }, [navigate, currentUser, refreshKey]);

  const handleLogout = () => { localStorage.removeItem('roomkhojo_user'); localStorage.removeItem('roomkhojo_token'); navigate('/'); window.location.reload(); };

  // 🔗 Purane ads claim — mobile match + admin approval (purana one-tap claim-orphans hata diya)
  const openClaimModal = () => { setClaimOpen(true); setClaimResults([]); setClaimSearched(false); };

  const searchClaimable = async () => {
    const digits = claimMobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return alert('Sahi 10-digit mobile number daliye.');
    setClaimBusy(true); setClaimSearched(false);
    try {
      const res = await apiFetch(`${BASE_URL}/api/rooms/claimable?mobile=${digits}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) { setClaimResults(data.rooms || []); setClaimSearched(true); }
      else alert(data.message || 'Search fail ho gaya.');
    } catch { alert('Server connection failed.'); }
    setClaimBusy(false);
  };

  const submitClaim = async (roomId) => {
    setClaimBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/rooms/${roomId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mobile: claimMobile })
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Request bhej di!' : 'Claim fail ho gaya.'));
      if (data.success) setClaimResults(prev => prev.map(r => r._id === roomId ? { ...r, claimPending: true, claimByMe: true } : r));
    } catch { alert('Server connection failed.'); }
    setClaimBusy(false);
  };

  const toggleRoomStatus = async (roomId) => {
    const room = myRooms.find((item) => item._id === roomId);
    if (!room) return;
    const nextActive = !room.isActive;
    setMyRooms((prev) => prev.map((item) => item._id === roomId ? { ...item, isActive: nextActive } : item));
    try {
      const res = await apiFetch(`${BASE_URL}/api/rooms/${roomId}/toggle-status`, { method: 'PATCH', headers: authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Status update fail ho gaya.');
      setMyRooms((prev) => prev.map((item) => item._id === roomId ? { ...item, isActive: data.isActive } : item));
    } catch {
      setMyRooms((prev) => prev.map((item) => item._id === roomId ? { ...item, isActive: room.isActive } : item));
      showNotice('Status update fail ho gaya. Dobara try karein.');
    }
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm("Kya aap sach mein is Ad ko hamesha ke liye Delete karna chahte hain?")) return;
    const room = myRooms.find((item) => item._id === roomId);
    setMyRooms((prev) => prev.filter((item) => item._id !== roomId));
    try {
      const res = await apiFetch(`${BASE_URL}/api/rooms/${roomId}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Delete fail ho gaya.');
      showNotice('Ad delete ho gaya.');
    } catch {
      if (room) setMyRooms((prev) => [room, ...prev]);
      showNotice('Delete fail ho gaya. Dobara try karein.');
    }
  };

  // 🚨 OPEN EDIT MODAL
  const openEditModal = (room) => {
    const isService = room.listingType === 'service';
    // Service description free-text hai — comma split sirf room facilities ke liye.
    const details = isService
      ? [room.description || '']
      : (room.description ? room.description.split(', ') : []);
    
    setEditForm({
      title: room.title, price: String(room.price || '').replace('₹', ''), type: room.type, // P2 #47: number/missing price par crash nahi
      category: room.category, landmark: room.landmark, mobile: room.mobile, ownerName: room.ownerName || '', description: details,
      googleMapUrl: room.googleMapUrl || '', listingType: isService ? 'service' : 'room'
    });
    setEditingRoomId(room._id);
    setEditKeep(room.images && room.images.length > 0 ? [...room.images] : (room.image ? [room.image] : []));
    setEditNew([]);
    setIsEditModalOpen(true);
  };

  // 🗜️ Edit photos bhi post-ad jaisi compress karo — upload latency kam
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
            if (!blob || blob.size >= file.size) return resolve(file);
            resolve(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        } catch { resolve(file); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch { resolve(file); }
  });

  // 🚨 SUBMIT EDIT — save tabhi maana jaata hai jab server confirm kare.
  //    Modal save ke dauran BAND nahi hota (button par "Saving Changes…" spinner),
  //    fail hone par user seedha dobara try kar sakta hai.
  const submitEdit = async () => {
    if (isSubmitting) return;
    if (!editForm.title || !editForm.price || !editForm.mobile) return alert('All fields required!');
    if (isCompressingEdit) return showNotice('Photos optimize ho rahi hain — ek second wait karein.');

    const roomId = editingRoomId;
    const sourceRoom = myRooms.find((room) => room._id === roomId);
    const nextType = editForm.listingType === 'service' ? 'Service' : editForm.type;
    const nextDescription = editForm.description.join(', ');
    const nextMapUrl = (editForm.googleMapUrl || '').trim();

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('title', editForm.title); fd.append('price', fmtPrice(editForm.price)); fd.append('type', nextType);
      fd.append('category', editForm.category); fd.append('landmark', editForm.landmark); fd.append('mobile', editForm.mobile);
      fd.append('ownerName', editForm.ownerName.trim() || (sourceRoom?.ownerName || ''));
      fd.append('description', nextDescription);
      fd.append('googleMapUrl', nextMapUrl);
      fd.append('keepImages', JSON.stringify(editKeep));
      editNew.forEach(p => fd.append('images', p.file));

      // Never-throw sender: {res, data} — non-JSON error pages (502/504) par data: null
      const send = () => apiFetch(`${BASE_URL}/api/rooms/${roomId}/edit`, { method: 'PUT', headers: authHeaders(), body: fd, signal: AbortSignal.timeout(60000) })
        .then(res => res.json().then(data => ({ res, data })).catch(() => ({ res, data: null })))
        .catch(() => ({ res: { status: 0 }, data: null }));

      let out = await send();
      // Cold-start / 5xx / network glitch: ek baar automatic retry (jaise 3-4 try ke baad aana)
      if (!out.data || out.res.status === 0 || out.res.status >= 500) out = await send();
      const { res, data } = out;

      if (res.status === 401) throw new Error('Session expire ho gaya — dashboard band karke dobara login karein.');
      if (!data) throw new Error(res.status === 0 || res.status >= 500 ? 'Server busy hai — internet check karke dobara try karein.' : `Update fail (error ${res.status}).`);
      if (!data.success) throw new Error(data.message || 'Ad update fail ho gaya.');

      // ✅ Server confirm kar chuka hai — tabhi list update + modal close + success notice
      const savedRoom = data.room || (sourceRoom ? {
        ...sourceRoom,
        title: editForm.title,
        price: fmtPrice(editForm.price),
        type: nextType,
        category: editForm.category,
        landmark: editForm.landmark,
        mobile: editForm.mobile,
        ownerName: editForm.ownerName.trim() || sourceRoom.ownerName,
        description: nextDescription,
        googleMapUrl: nextMapUrl,
        image: editKeep[0] || editNew[0]?.url || sourceRoom.image,
        images: [...editKeep, ...editNew.map((photo) => photo.url)]
      } : null);
      if (savedRoom) setMyRooms((prev) => prev.map((room) => room._id === roomId ? savedRoom : room));
      setIsEditModalOpen(false);
      showNotice(data.message || 'Ad live update ho gaya.');
      editNew.forEach((photo) => URL.revokeObjectURL(photo.url));
      setEditNew([]);
      setEditingRoomId(null);
    } catch (error) {
      // ❌ Fail — modal khula chhodo (edits safe), sirf clear error dikhao
      showNotice(error?.message || 'Ad update fail ho gaya. Dobara try karein.', 6000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📸 Edit gallery me nayi photos add (max 6 total)
  const addEditPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const room = Math.max(0, 6 - editKeep.length - editNew.length);
    if (room <= 0) return alert('Max 6 photos allowed hai — pehle koi photo hatao.');
    let picked = files;
    if (files.length > room) {
      alert(`Sirf ${room} aur photo add ho sakti hain (max 6) — baaki skip.`);
      picked = files.slice(0, room);
    }
    setIsCompressingEdit(true);
    try {
      const processed = [];
      for (const file of picked) {
        const compressed = await compressImage(file);
        processed.push({ file: compressed, url: URL.createObjectURL(compressed) });
      }
      setEditNew((prev) => {
        const next = [...prev, ...processed];
        next.slice(Math.max(0, 6 - editKeep.length)).forEach((photo) => URL.revokeObjectURL(photo.url));
        return next.slice(0, Math.max(0, 6 - editKeep.length));
      });
    } finally {
      setIsCompressingEdit(false);
    }
  };

  // 🔄 Renew helpers + submit (expired promo → payment → admin verify)
  const renewPrice = (d) => {
    const p = sysSettings.pricing || {};
    if (d === '7') return p.promo7 || '299';
    if (d === '15') return p.promo15 || '499';
    return p.promo30 || '899';
  };
  const renewUpiId = (sysSettings.pricing && sysSettings.pricing.upiId) || 'admin@ybl';

  // 💳 Renew modal kholo — code strategy: SAME room dobara kholo toh WAHI code
  // (paid-then-cancel safe), naya room toh naya code. Server bhi yahi save karega.
  const openRenewModal = (room, plan) => {
    setRenewRoom(room); setRenewPlan(plan); setRenewRef('');
    setRenewCode(prev => (renewCodeRoomRef.current === room._id && prev) ? prev : 'RK-' + Math.random().toString(36).substr(2, 5).toUpperCase());
    renewCodeRoomRef.current = room._id;
  };

  const submitRenew = async () => {
    if (!renewRoom) return;
    if (!renewRef.trim()) return alert('UPI Ref / UTR No. daliye (payment ke baad milta hai).');
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/rooms/${renewRoom._id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ promoPlan: renewPlan, paymentRef: renewRef.trim(), paymentCode: renewCode })
      });
      const data = await res.json();
      alert(data.message || (data.success ? 'Done!' : 'Renew request nahi bhej paaye. Dobara try karein.'));
      if (data.success) { setRenewRoom(null); setRenewRef(''); setRenewCode(''); renewCodeRoomRef.current = null; setRefreshKey(k => k + 1); }
    } catch { alert('Server connection failed.'); }
    setIsSubmitting(false);
  };

  // ⚙️ Settings: naam + password save
  const saveProfileName = async () => {
    if (!editName.trim()) return alert('Naam khaali nahi ho sakta.');
    const phone = String(editPhone || '').replace(/\D/g, '');
    if (editPhone.trim() && !/^[6-9]\d{9}$/.test(phone)) return alert('Sahi 10-digit mobile number dalein.');
    if (savingName) return; // P2 #48: double-tap guard
    setSavingName(true);
    try {
      const body = { name: editName.trim() };
      if (phone) body.phone = phone;
      const res = await apiFetch(`${BASE_URL}/api/users/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        const merged = { ...currentUser, ...data.user };
        setCurrentUser(merged);
        localStorage.setItem('roomkhojo_user', JSON.stringify(merged));
      }
    } catch { alert('Server connection failed.'); }
    setSavingName(false);
  };

  const saveNewPassword = async () => {
    if (!oldPw || !newPw) return alert('Puraana aur naya password dono daliye.');
    if (newPw.length < 8) return alert('Naya password kam se kam 8 characters ka ho.'); // P2 #48: client validation
    if (newPw === oldPw) return alert('Naya password purane se alag rakho.');
    if (savingPw) return;
    setSavingPw(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) { setOldPw(''); setNewPw(''); }
    } catch { alert('Server connection failed.'); }
    setSavingPw(false);
  };

  // 📧 Email change: nayi email par OTP verify hone ke baad hi update
  const requestEmailOtp = async () => {
    if (!newEmail.trim() || !emailPw) return alert('Naya email aur password dono daliye.');
    if (savingEmail) return;
    setSavingEmail(true);
    setEmailInfo('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/change-email/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ newEmail: newEmail.trim(), password: emailPw })
      });
      const data = await res.json();
      if (data.success) {
        setEmailStep('verify');
        setEmailOtp('');
        setEmailInfo(data.message || 'Nayi email par OTP bhej diya gaya hai.');
        setEmailCooldown(60);
      } else alert(data.message || 'OTP bhejne me dikkat aayi.');
    } catch { alert('Server connection failed.'); }
    setSavingEmail(false);
  };

  const verifyEmailChange = async () => {
    if (!/^\d{6}$/.test(emailOtp.trim())) return alert('6-digit OTP dalein.');
    if (savingEmail) return;
    setSavingEmail(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/change-email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ newEmail: newEmail.trim(), otp: emailOtp.trim() })
      });
      const data = await res.json();
      if (data.success && data.user) {
        const merged = { ...currentUser, ...data.user };
        setCurrentUser(merged);
        localStorage.setItem('roomkhojo_user', JSON.stringify(merged));
        if (data.token) localStorage.setItem('roomkhojo_token', data.token);
        alert(data.message || 'Email update ho gaya!');
        setNewEmail(''); setEmailPw(''); setEmailOtp(''); setEmailInfo(''); setEmailStep('request');
      } else {
        alert(data.message || 'OTP verify nahi hua.');
      }
    } catch { alert('Server connection failed.'); }
    setSavingEmail(false);
  };

  // 🗑️ Account delete: current email par OTP verify hone ke baad hi delete
  const requestDeleteOtp = async () => {
    if (delConfirm.trim().toUpperCase() !== 'DELETE') return alert('Pehle confirm box me DELETE likho.');
    if (sendingDelOtp) return;
    setSendingDelOtp(true);
    setDelInfo('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/delete-account/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confirm: 'DELETE' })
      });
      const data = await res.json();
      if (data.success) {
        setDelOtpSent(true);
        setDelOtp('');
        setDelInfo(data.message || 'Email par OTP bhej diya gaya hai.');
        setDelCooldown(60);
      } else alert(data.message || 'OTP bhejne me dikkat aayi.');
    } catch { alert('Server connection failed.'); }
    setSendingDelOtp(false);
  };

  const deleteAccount = async () => {
    if (delConfirm.trim().toUpperCase() !== 'DELETE') return alert('Confirm box me DELETE likho — tabhi delete hoga.');
    if (!/^\d{6}$/.test(delOtp.trim())) return alert('Email par aaya 6-digit OTP dalein.');
    if (!window.confirm('Pakka? Account + SAARE ads hamesha ke liye delete ho jayenge. Ye undo NAHI hota.')) return;
    if (deletingAcc) return;
    setDeletingAcc(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confirm: 'DELETE', otp: delOtp.trim() })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) { localStorage.removeItem('roomkhojo_user'); localStorage.removeItem('roomkhojo_token'); navigate('/'); }
    } catch { alert('Server connection failed.'); }
    setDeletingAcc(false);
  };

  const getDaysLeft = (expiryDate, plan) => {
    if (plan === 'regular' || !plan) return null;
    if (!expiryDate) return null;
    return Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col font-sans">
      <header className="bg-brand text-white p-6 rounded-b-[40px] shadow-lg relative shrink-0">
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 p-2 bg-white/20 rounded-full active:scale-95 transition-transform"><ArrowLeft size={20}/></button>
        <button onClick={() => { setEditName(currentUser?.name || ''); setEditPhone(currentUser?.phone || ''); setOldPw(''); setNewPw(''); setEmailStep('request'); setEmailOtp(''); setEmailInfo(''); setDelOtpSent(false); setDelOtp(''); setDelInfo(''); setSettingsOpen(true); }} className="absolute top-6 right-6 p-2 bg-white/20 rounded-full active:scale-95 transition-transform"><Settings size={20}/></button>
        <div className="flex flex-col items-center mt-6">
          {currentUser?.pic ? ( <img src={safeImageUrl(currentUser.pic)} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white shadow-xl mb-4 object-cover" /> ) : ( <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center border-4 border-white shadow-xl mb-4"><User size={40}/></div> )}
          <h1 className="text-2xl font-black">Welcome, {currentUser?.name?.split(' ')[0] || 'User'}</h1>
          <p className="text-white/80 font-bold text-sm">{currentUser?.email || 'user@roomkhojo.com'}</p>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><Star className="text-brand"/> My Posted Ads</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setRefreshKey(k => k + 1)} title="Refresh" className="bg-gray-100 text-gray-600 border border-gray-200 p-1.5 rounded-full active:scale-95 transition-transform"><RefreshCw size={14} /></button>
            <button onClick={openClaimModal} className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1 active:scale-95"><Link size={12} /> Claim Purana Ad</button>
            <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-xs font-black">{myRooms.length} Total</span>
          </div>
        </div>
        
        {!adsLoaded ? (
          <div className="grid gap-4 pb-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-3 flex gap-4 animate-pulse">
                <div className="w-24 h-24 rounded-2xl bg-gray-200 shrink-0" />
                <div className="flex-1 py-1 space-y-2"><div className="h-4 bg-gray-200 rounded-lg w-3/4" /><div className="h-4 bg-gray-200 rounded-lg w-1/3" /><div className="h-3 bg-gray-100 rounded-lg w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : myRooms.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-5 rounded-3xl border border-blue-200 text-center">
                <p className="font-black text-blue-900 mb-1 flex items-center justify-center gap-1.5"><Link size={16} /> Purane ads hain?</p>
                <p className="text-xs font-bold text-blue-700 mb-3">Mobile number se verify karke claim karein — admin approve karega. Ads live rehte hain.</p>
                <button onClick={openClaimModal} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-sm active:scale-95">Purana Ad Claim Karein</button>
              </div>
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center"><div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Bell size={24} className="text-gray-300"/></div><p className="text-gray-500 font-bold">Abhi aapne koi room ad post nahi kiya hai.</p><button onClick={() => navigate('/')} className="mt-4 text-brand font-black underline">Go post an ad</button></div>
            </div>
        ) : (
            <div className="grid gap-4 pb-10">
                {myRooms.map(room => {
                const daysLeft = getDaysLeft(room.expiryDate, room.promoPlan);
                const isExpired = daysLeft !== null && daysLeft <= 0;
                const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 3;
                const serviceDaysLeft = room.listingType === 'service' && room.serviceExpiresAt
                  ? Math.ceil((new Date(room.serviceExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
                  : null;
                const serviceExpired = serviceDaysLeft !== null && serviceDaysLeft <= 0;
                const serviceExpiringSoon = serviceDaysLeft !== null && serviceDaysLeft > 0 && serviceDaysLeft <= 3;

                return (
                    <div key={room._id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-3 flex flex-col gap-2 relative">
                        {/* 🚨 STATUS BANNERS */}
                        {!room.isApproved && (
                          <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black text-center py-1 uppercase tracking-widest z-10 shadow-sm">
                            Verification Pending (Hidden)
                          </div>
                        )}
                        {room.listingType !== 'service' && room.isApproved && isExpired && (
                          <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-[10px] font-black text-center py-1 uppercase tracking-widest z-10 shadow-sm flex items-center justify-center gap-1">
                            <AlertTriangle size={12} /> Promo khatam — Normal ad live hai
                          </div>
                        )}
                        {room.listingType !== 'service' && room.isApproved && isExpiringSoon && (
                          <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-[10px] font-black text-center py-1 uppercase tracking-widest z-10 shadow-sm flex items-center justify-center gap-1">
                            <Clock size={12} /> Expiring in {daysLeft} Days
                          </div>
                        )}
                        {room.listingType === 'service' && room.isApproved && serviceExpired && (
                          <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-[10px] font-black text-center py-1 uppercase tracking-widest z-10 shadow-sm flex items-center justify-center gap-1">
                            <AlertTriangle size={12} /> Service listing khatam — dobara list karein
                          </div>
                        )}
                        {room.listingType === 'service' && room.isApproved && serviceExpiringSoon && (
                          <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-[10px] font-black text-center py-1 uppercase tracking-widest z-10 shadow-sm flex items-center justify-center gap-1">
                            <Clock size={12} /> Service listing {serviceDaysLeft} din me khatam
                          </div>
                        )}

                        <div className={`flex gap-4 ${(!room.isApproved || isExpired || serviceExpired) ? 'mt-4 opacity-80' : (isExpiringSoon || serviceExpiringSoon) ? 'mt-4' : ''}`}>
                          <img src={getImageUrl(room.image)} className="w-24 h-24 rounded-2xl object-cover bg-gray-200 shrink-0 border border-gray-100" alt="Room" />
                          <div className="flex-1 py-1 flex flex-col justify-between">
                              <div>
                                  <div className="flex justify-between items-start">
                                      <h3 className="font-black text-gray-800 leading-tight line-clamp-1">{room.title}</h3>
                                      {room.isPromoted && !isExpired && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-black uppercase shrink-0 ml-2 inline-flex items-center gap-1"><Star size={10} fill="currentColor" /> Promoted</span>}
                                  </div>
                                  <p className="text-brand font-black mt-1">{room.price}</p>
                                  {room.listingType === 'service' && room.serviceDays > 0 && (
                                    <p className="text-[10px] font-bold text-purple-600 mt-0.5">Listing {room.serviceDays} din • ₹{room.serviceDailyRate || 0}/day • Fee ₹{room.serviceFee || 0}</p>
                                  )}
                                  <p className="text-xs font-bold text-gray-400 mt-1 flex items-center gap-1"><MapPin size={12}/> {room.landmark || 'Hanumangarh'}</p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg inline-flex items-center gap-1.5 ${room.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                  <span className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                  {room.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                                  <Eye size={12} /> {room.views || 0}
                                </span>
                                {room.listingType === 'service' && (
                                  <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-purple-50 text-purple-700">Service</span>
                                )}
                                {((daysLeft !== null && daysLeft > 3) || (serviceDaysLeft !== null && serviceDaysLeft > 3)) && (
                                  <span className="text-[10px] font-bold text-gray-500">{serviceDaysLeft ?? daysLeft} Days Left</span>
                                )}
                              </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                          <button onClick={() => toggleRoomStatus(room._id)} className="text-[10px] font-bold text-gray-500 border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-lg active:scale-95 transition-colors hover:bg-gray-100">Hide/Show</button>
                          <div className="flex gap-2">
                            {/* 🔄 RENEW BUTTON (expired promo par) */}
                            {room.listingType !== 'service' && isExpired && (<button onClick={() => openRenewModal(room, room.promoPlan && room.promoPlan !== 'regular' ? room.promoPlan : '7')} className="text-[11px] font-black text-white bg-orange-500 px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"><RefreshCw size={12} /> Renew</button>)}
                            {room.listingType !== 'service' && !room.isPromoted && !isExpired && (<button onClick={() => openRenewModal(room, '7')} className="text-[11px] font-black text-white bg-brand px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"><Star size={12} fill="currentColor" /> Promote</button>)}
                            {/* 🚨 EDIT BUTTON */}
                            <button onClick={() => openEditModal(room)} className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1 transition-colors hover:bg-blue-100"><Edit3 size={14}/> Edit</button>
                            <button onClick={() => deleteRoom(room._id)} className="text-[11px] font-black text-red-600 bg-red-50 p-1.5 px-3 rounded-lg active:scale-95 flex items-center gap-1 transition-colors hover:bg-red-100"><Trash2 size={14}/> Delete</button>
                          </div>
                        </div>
                    </div>
                );
            })}
        </div>
        )}

        {/* ❤️ SAVED ADS — P2 #47: ab scrollable area ke ANDAR (pehle viewport ke bahar clip rehta tha) */}
        {savedRooms.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><Heart size={20} className="text-pink-500" fill="currentColor" /> Saved Ads</h2>
              <span className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-xs font-black">{savedRooms.length} Total</span>
            </div>
            <div className="grid gap-3 pb-10">
              {savedRooms.map(room => (
                <div key={room._id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-pink-100 p-3 flex gap-3 items-center">
                  <img src={getImageUrl(room.image)} className="w-16 h-16 rounded-xl object-cover bg-gray-200 shrink-0" alt="Room" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-800 leading-tight truncate">{room.title}</h3>
                    <p className="text-brand font-black text-sm">{room.price}</p>
                    <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {room.landmark || 'Hanumangarh'}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a href={telUrl(room.mobile)} className="bg-brand text-white p-2 rounded-xl flex items-center justify-center active:scale-95"><Phone size={16}/></a>
                    <button onClick={() => unsaveRoom(room._id)} className="bg-red-50 text-red-600 p-2 rounded-xl flex items-center justify-center active:scale-95"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logout ab Settings panel me hai (upar gear button) */}

      {/* 🔗 PURANE AD CLAIM MODAL (mobile match → admin approval) */}
      {claimOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[30px] sm:rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85dvh]">
            <button onClick={() => setClaimOpen(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full active:scale-90"><X size={20}/></button>
            <h2 className="text-xl font-black mb-1 flex items-center gap-2"><Link size={20} className="text-blue-600" /> Purane Ad Claim Karein</h2>
            <p className="text-xs font-bold text-gray-500 mb-4">Jo mobile number us purane ad par tha wahi daliye. Match hone par request admin ko jayegi — approve hote hi ad aapke account me aa jayega. (Ads live rehte hain, kuch delete nahi hota.)</p>
            <div className="flex gap-2 mb-3">
              <input type="tel" inputMode="numeric" value={claimMobile} onChange={(e) => setClaimMobile(e.target.value)} placeholder="10-digit mobile number" className="flex-1 p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
              <button onClick={searchClaimable} disabled={claimBusy} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{claimBusy ? '...' : 'Dhundho'}</button>
            </div>
            <div className="overflow-y-auto">
              {claimSearched && claimResults.length === 0 && (<p className="text-center text-gray-500 font-bold text-sm py-6">Is number se koi purana (unclaimed) ad nahi mila.</p>)}
              {claimResults.map(r => (
                <div key={r._id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl p-3 mb-2">
                  <img src={getImageUrl(r.image)} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-800 text-sm truncate">{r.title}</p>
                    <p className="text-brand font-black text-xs">{r.price}</p>
                  </div>
                  {r.claimByMe ? (<span className="text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg shrink-0">Request Bheji</span>)
                    : r.claimPending ? (<span className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg shrink-0">Kisi Aur Ki Request</span>)
                    : (<button onClick={() => submitClaim(r._id)} disabled={claimBusy} className="bg-green-600 text-white px-3 py-2 rounded-lg font-black text-xs active:scale-95 disabled:opacity-60">Claim</button>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🔄 RENEW MODAL (expired promo → payment → admin verify) */}
      {renewRoom && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[30px] sm:rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setRenewRoom(null)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full active:scale-90"><X size={20}/></button>
            <h2 className="text-xl font-black mb-1 flex items-center gap-2">{renewRoom && renewRoom.promoPlan !== 'regular' ? (<><RefreshCw size={20} /> Renew Promo</>) : (<><Star size={20} className="text-orange-500" fill="currentColor" /> Promote Ad</>)}</h2>
            <p className="text-xs font-bold text-gray-500 mb-4 line-clamp-1">{renewRoom.title}</p>
            <div className="flex gap-2 mb-4">
              {['7', '15', '30'].map(d => (
                <button key={d} onClick={() => setRenewPlan(d)} className={`flex-1 p-2 rounded-xl border text-xs font-bold transition-colors ${renewPlan === d ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-gray-50 border-transparent text-gray-500'}`}>{d} Days<br /><span className="text-lg">₹{renewPrice(d)}</span></button>
              ))}
            </div>
            <a href={upiUrl(renewUpiId, renewPrice(renewPlan), `Renew: ${renewCode}`) || '#'} className="w-full bg-brand text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mb-3 shadow-lg active:scale-95">Pay ₹{renewPrice(renewPlan)} via UPI App</a>
            <input type="text" value={renewRef} onChange={(e) => setRenewRef(e.target.value)} placeholder="UPI Ref / UTR No. (payment ke baad milta hai)" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border mb-3" />
            <button onClick={submitRenew} disabled={isSubmitting} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black active:scale-95">{isSubmitting ? 'Bhej rahe hain...' : 'I have paid — Send for Verification'}</button>
          </div>
        </div>
      )}

      {/* ⚙️ SETTINGS PANEL (profile + password + logout) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[30px] sm:rounded-3xl flex flex-col max-h-[85dvh] shadow-2xl relative">
            <div className="p-5 border-b shrink-0 flex justify-between items-center sticky top-0 bg-white rounded-t-[30px] sm:rounded-t-3xl z-10">
              <h2 className="text-xl font-black flex items-center gap-2"><Settings size={20} /> Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="bg-gray-100 p-2 rounded-full active:scale-90"><X size={20}/></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border">
                {currentUser?.pic ? (<img src={safeImageUrl(currentUser.pic)} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow shrink-0" />) : (<div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center text-brand shrink-0"><User size={28}/></div>)}
                <div className="min-w-0"><p className="font-black text-gray-800 truncate">{currentUser?.name || 'User'}</p><p className="text-xs font-bold text-gray-500 truncate">{currentUser?.email || ''}</p>{currentUser?.phone && (<p className="text-xs font-bold text-gray-400">{currentUser.phone}</p>)}</div>
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 mb-2 uppercase">Profile</p>
                <div className="space-y-2">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Apna naam" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
                  <div className="flex gap-2"><input type="tel" inputMode="numeric" value={editPhone} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setEditPhone((d.length > 10 && d.startsWith('91') ? d.slice(2, 12) : d).slice(0, 10)); }} placeholder="Mobile number (listing me prefill hoga)" className="flex-1 p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /><button onClick={saveProfileName} disabled={savingName} className="bg-slate-900 text-white px-4 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{savingName ? '…' : 'Save'}</button></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 mb-2 uppercase">Password Badlo</p>
                <div className="space-y-2"><input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Puraana password" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Naya password (min 8)" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /><button onClick={saveNewPassword} disabled={savingPw} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{savingPw ? 'Update ho raha hai…' : 'Update Password'}</button></div>
                <p className="text-[11px] font-bold text-gray-400 mt-2">Google se login karte ho? Toh password hai hi nahi — seedha logout/login karo.</p>
                <button onClick={() => { setSettingsOpen(false); navigate(`/forgot-password?email=${encodeURIComponent(currentUser?.email || '')}`); }} className="mt-2 text-xs font-black text-brand hover:underline">Password bhool gaye? Email OTP se reset karein</button>
              </div>
              {/* 📧 Email change — nayi email par OTP verify */}
              <div>
                <p className="text-xs font-black text-gray-500 mb-2 uppercase">Email Badlo</p>
                {emailStep === 'request' ? (
                  <div className="space-y-2">
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Naya email address" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
                    <input type="password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} placeholder="Confirm karne ke liye password" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
                    <button onClick={requestEmailOtp} disabled={savingEmail} className="w-full bg-slate-700 text-white py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{savingEmail ? 'OTP bhej rahe hain…' : 'Nayi Email par OTP Bhejein'}</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">{emailInfo || 'OTP nayi email par bheja gaya hai.'}</p>
                    <input type="text" inputMode="numeric" maxLength={6} value={emailOtp} onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" />
                    <button onClick={verifyEmailChange} disabled={savingEmail} className="w-full bg-slate-700 text-white py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{savingEmail ? 'Verify ho raha hai…' : 'Verify & Update Email'}</button>
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setEmailStep('request'); setEmailOtp(''); setEmailInfo(''); }} className="text-[11px] font-bold text-gray-500 hover:text-brand">Email badlein</button>
                      <button onClick={requestEmailOtp} disabled={emailCooldown > 0 || savingEmail} className="text-[11px] font-bold text-brand hover:underline disabled:text-gray-400 disabled:no-underline">{emailCooldown > 0 ? `Resend ${emailCooldown}s` : 'Resend OTP'}</button>
                    </div>
                  </div>
                )}
              </div>
              {/* 🗑️ P2 #48: Danger zone — account delete (DELETE type + confirm) */}
              <div className="border border-red-100 bg-red-50/60 rounded-2xl p-4">
                <p className="text-xs font-black text-red-600 mb-2 uppercase flex items-center gap-1"><AlertTriangle size={13} /> Danger Zone — Account Delete</p>
                <p className="text-[11px] font-bold text-red-500 mb-3">Account ke saath aapke SAARE ads bhi hamesha ke liye delete ho jayenge. Ye undo nahi hota.</p>
                <div className="space-y-2">
                  <input type="text" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} placeholder='Confirm ke liye "DELETE" likho' className="w-full p-3 bg-white rounded-xl outline-none font-bold text-sm border border-red-200" />
                  <button onClick={requestDeleteOtp} disabled={sendingDelOtp || delOtpSent} className="w-full bg-white text-red-600 border border-red-300 py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{sendingDelOtp ? 'OTP bhej rahe hain…' : delOtpSent ? 'OTP bhej diya gaya' : 'Email par OTP Bhejein'}</button>
                  {delOtpSent && (
                    <>
                      <p className="text-[11px] font-bold text-red-600">{delInfo || 'Current email par OTP bheja gaya hai.'}</p>
                      <input type="text" inputMode="numeric" maxLength={6} value={delOtp} onChange={(e) => setDelOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="w-full p-3 bg-white rounded-xl outline-none font-bold text-sm border border-red-200" />
                      <button onClick={requestDeleteOtp} disabled={delCooldown > 0 || sendingDelOtp} className="text-[11px] font-bold text-red-500 hover:underline disabled:text-gray-400 disabled:no-underline">{delCooldown > 0 ? `Resend ${delCooldown}s` : 'Resend OTP'}</button>
                    </>
                  )}
                  <button onClick={deleteAccount} disabled={deletingAcc || !delOtpSent} className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60">{deletingAcc ? 'Delete ho raha hai…' : 'Account Hamesha Ke Liye Delete Karein'}</button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-white sticky bottom-0 z-10 shrink-0">
              <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95"><LogOut size={20}/> Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 EDIT MODAL (Safe Mode) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[30px] sm:rounded-3xl flex flex-col h-[85dvh] sm:h-auto sm:max-h-[85dvh] shadow-2xl relative animate-slide-up">
            <div className="p-5 border-b shrink-0 flex justify-between items-center sticky top-0 bg-white rounded-t-[30px] sm:rounded-t-3xl z-10">
              <h2 className="text-xl font-black">Edit Your Ad</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="bg-gray-100 p-2 rounded-full active:scale-90"><X size={20}/></button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl flex gap-2 items-start text-xs font-bold">
                <ShieldAlert size={16} className="shrink-0 mt-0.5"/>
                <p>{editForm.listingType === 'service' ? 'Changes save karte hi service listing update ho jayegi. Approval status wahi rahega.' : 'Changes save karte hi aapka regular ad live update ho jayega. Admin approval ka wait nahi karna padega.'}</p>
              </div>

              <div>
                {(editKeep.length + editNew.length) > 0 && (<div className="grid grid-cols-3 gap-2 mb-2">
                  {editKeep.map((u, i) => (<div key={`k-${i}`} className="relative"><img src={getImageUrl(u)} className="w-full h-20 rounded-xl object-cover border border-gray-200" alt={`Photo ${i + 1}`} /><button type="button" onClick={() => setEditKeep(prev => prev.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center shadow">✕</button></div>))}
                  {editNew.map((p, i) => (<div key={`n-${i}`} className="relative"><img src={p.url} className="w-full h-20 rounded-xl object-cover border border-blue-200" alt="New photo" /><button type="button" onClick={() => { URL.revokeObjectURL(p.url); setEditNew(prev => prev.filter((_, j) => j !== i)); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center shadow">✕</button></div>))}
                </div>)}
                <label className="bg-brand/5 h-16 rounded-xl border-2 border-dashed border-brand/30 flex items-center justify-center gap-2 text-brand cursor-pointer"><Camera size={20}/><span className="font-bold text-[10px]">{(editKeep.length + editNew.length) > 0 ? `${editKeep.length + editNew.length}/6 Photos (tap to add)` : 'Tap to add Photos (max 6)'}</span><input type="file" className="hidden" multiple accept="image/*" onChange={addEditPhotos} /></label>
              </div>
              
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-500 ml-1">{editForm.listingType === 'service' ? 'Service / Business Name' : 'Title'}</label><input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} placeholder={editForm.listingType === 'service' ? 'Business / Service name' : 'Title'} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /></div>
                <div><label className="text-xs font-bold text-gray-500 ml-1">Aapka Name (listing par yahi dikhega)</label><input type="text" value={editForm.ownerName} onChange={(e) => setEditForm({...editForm, ownerName: e.target.value})} placeholder="Owner / Aapka naam" maxLength={60} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /></div>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0"><label className="text-xs font-bold text-gray-500 ml-1">{editForm.listingType === 'service' ? 'Price (₹)' : 'Rent (₹)'}</label><input type="text" value={editForm.price} onChange={(e) => setEditForm({...editForm, price: e.target.value})} maxLength={40} placeholder="3000 ya Contact for price" className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border"/></div>
                  <div className="flex-1 min-w-0"><label className="text-xs font-bold text-gray-500 ml-1">Mobile No.</label><input type="number" value={editForm.mobile} onChange={(e) => setEditForm({...editForm, mobile: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border"/></div>
                </div>
                <div className="flex gap-2">
                  {['Contact for price', 'Negotiable'].map(opt => (<button type="button" key={opt} onClick={() => setEditForm({...editForm, price: editForm.price === opt ? '' : opt})} className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-colors ${editForm.price === opt ? 'bg-brand text-white border-brand shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 active:scale-95'}`}>{opt}</button>))}
                </div>
                <div><label className="text-xs font-bold text-gray-500 ml-1">Landmark</label><input type="text" value={editForm.landmark} onChange={(e) => setEditForm({...editForm, landmark: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /></div>
                <div><label className="text-xs font-bold text-gray-500 ml-1">Google Maps Link (optional)</label><input type="url" value={editForm.googleMapUrl || ''} onChange={(e) => setEditForm({...editForm, googleMapUrl: e.target.value})} placeholder="https://maps.app.goo.gl/..." className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border" /></div>
              </div>

              <div>
                <p className="text-xs font-black text-gray-500 mb-2 uppercase">{editForm.listingType === 'service' ? 'Service Details' : 'Update Facilities'}</p>
                {editForm.listingType === 'service' ? (
                  <textarea rows={3} value={editForm.description[0] || ''} onChange={(e) => setEditForm({...editForm, description: [e.target.value]})} placeholder="Kya service dete hain, timing, rate, delivery area..." className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold text-sm border resize-none" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(sysSettings.facilities || []).map(fac => (
                      <button type="button" key={fac} onClick={() => setEditForm({...editForm, description: editForm.description.includes(fac) ? editForm.description.filter(f => f !== fac) : [...editForm.description, fac]})} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${editForm.description.includes(fac) ? 'bg-brand text-white border-brand shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {fac}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-white sticky bottom-0 z-10 shrink-0">
              <button onClick={submitEdit} disabled={isSubmitting || isCompressingEdit} className="w-full bg-brand text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                {isCompressingEdit ? 'Photos optimize ho rahi hain...' : isSubmitting ? (<><Loader2 size={18} className="animate-spin" /> Saving Changes…</>) : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[10000] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-xs font-bold text-white shadow-xl rk-fade-in">
          {notice}
        </div>
      )}
    </div>
  );
}
