import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const CSS = `
  #svc29-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
    background: rgba(0,0,0,0.72);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .svc29-wrap {
    min-height: 100%;
    box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    padding: 24px 16px;
  }
  .svc29-poster {
    position: relative;
    width: 100%; max-width: 400px;
    margin: auto;
    background: #fff; border-radius: 22px; overflow: hidden;
    box-shadow: 0 24px 70px rgba(0,0,0,.45);
    text-align: center;
  }
  .svc29-close {
    position: absolute; top: 10px; right: 10px; z-index: 2;
    width: 38px; height: 38px; border-radius: 50%;
    background: rgba(0,0,0,.6); color: #fff; border: 2px solid rgba(255,255,255,.85);
    font-size: 18px; line-height: 1; cursor: pointer;
  }
  .svc29-head {
    background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
    color: #fff; padding: 34px 20px 24px;
  }
  .svc29-brand { font-size: 13px; letter-spacing: 3px; opacity: .85; margin-bottom: 8px; }
  .svc29-title { font-size: 25px; font-weight: 800; line-height: 1.35; margin: 0 0 8px; }
  .svc29-sub { font-size: 14px; opacity: .92; margin: 0; }
  .svc29-badge {
    display: inline-block; margin-top: 12px;
    background: #ffcf3f; color: #5a3c00;
    font-size: 13px; font-weight: 700;
    padding: 6px 16px; border-radius: 999px;
  }
  .svc29-offers { padding: 18px 20px 4px; text-align: left; }
  .svc29-offer {
    display: flex; align-items: center; gap: 12px;
    background: #f4f6ff; border-radius: 12px;
    padding: 10px 14px; margin-bottom: 10px; font-size: 15px; font-weight: 600; color: #222;
  }
  .svc29-offer span:first-child { font-size: 22px; }
  .svc29-cta { padding: 8px 20px 22px; }
  .svc29-btn {
    display: block; width: 100%; box-sizing: border-box;
    background: #25d366; color: #fff;
    font-size: 16px; font-weight: 800;
    padding: 15px 10px; border-radius: 14px;
    text-decoration: none; margin-bottom: 10px;
    box-shadow: 0 8px 20px rgba(37,211,102,.4);
  }
  .svc29-phone { font-size: 15px; color: #444; font-weight: 700; margin: 0; }
  .svc29-phone a { color: #2575fc; text-decoration: none; }
  .svc29-dismiss {
    display: block; width: 100%; background: none; border: none;
    color: #999; font-size: 13px; font-weight: 700;
    padding: 8px 0 2px; cursor: pointer; text-decoration: underline;
  }
`;

// P2 #64: namespaced key (purana svc29Popup orphan) + multi-tab safe writes
const KEY = 'roomkhojo_promo_popup';
const LEGACY_KEY = 'svc29Popup';
const MAX_PER_DAY = 3;
const FIRST_DELAY_MS = 7000;
const RETRY_MS = 20000;

const readData = () => {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch { return {}; }
};
const writeData = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode */ } };

export default function PromoPopup({ adminPath }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false); // ek page-load me max 1 baar
  const closeBtnRef = useRef(null);
  const posterRef = useRef(null);

  // P2 #62: admin panel / dashboard / support / legal pages par popup NAHI
  const excluded =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/verify-signup') ||
    pathname === adminPath ||
    ['/about', '/terms', '/refund'].includes(pathname);

  // P2 #64: purani key ek baar clear
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }, []);

  // P2 #61/#63: show sirf jab tab visible ho + koi critical modal na khula ho
  useEffect(() => {
    if (excluded || shownRef.current) return;
    let timer = null;
    const tryShow = () => {
      if (shownRef.current) return;
      if (document.hidden) { timer = setTimeout(tryShow, RETRY_MS); return; } // #63: background tab me count nahi
      if (window.__rkModalOpen) { timer = setTimeout(tryShow, RETRY_MS); return; } // #61: payment/auth/form ke dauran nahi
      const today = new Date().toDateString();
      // #64: multi-tab race — write se turant pehle fresh read + re-check
      const fresh = readData();
      const day = fresh.date === today ? fresh : { date: today, count: 0 };
      if (day.dismissed) return; // #65: "dobara mat dikhao"
      if (day.count >= MAX_PER_DAY) return;
      day.count += 1; // count sirf ACTUAL show par (#63)
      writeData(day);
      shownRef.current = true;
      setOpen(true);
    };
    timer = setTimeout(tryShow, FIRST_DELAY_MS);
    const onVis = () => { if (!document.hidden && !shownRef.current) { clearTimeout(timer); tryShow(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [excluded]);

  // P2 #66: a11y — body scroll lock + ESC close + initial focus
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => { if (closeBtnRef.current) closeBtnRef.current.focus(); }, 50);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // P2 #66: focus trap (Tab poster ke andar hi ghoome)
  const trapTab = (e) => {
    if (e.key !== 'Tab') return;
    const nodes = posterRef.current ? posterRef.current.querySelectorAll('a[href], button') : [];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // P2 #65: "Dobara mat dikhao" — hamesha ke liye band
  const dismissForever = () => {
    const today = new Date().toDateString();
    const fresh = readData();
    const day = fresh.date === today ? fresh : { date: today, count: fresh.count || 0 };
    day.dismissed = true;
    writeData(day);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      <style>{CSS}</style>
      <div id="svc29-overlay" onKeyDown={trapTab} onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('svc29-wrap')) setOpen(false); }}>
        <div className="svc29-wrap">
          <div className="svc29-poster" ref={posterRef} role="dialog" aria-modal="true" aria-label="29 Developer website offer">
            <button ref={closeBtnRef} className="svc29-close" onClick={() => setOpen(false)} aria-label="Band karein">✕</button>
            <div className="svc29-head">
              <div className="svc29-brand">29 DEVELOPER</div>
              <div className="svc29-title">Apne Business ke Liye<br />Website Banwayein!</div>
              <p className="svc29-sub">Professional • Mobile-Friendly • Jaldi Delivery</p>
              <div className="svc29-badge">🎉 Limited Time Offer</div>
            </div>
            <div className="svc29-offers">
              <div className="svc29-offer"><span>🌐</span> Business Website</div>
              <div className="svc29-offer"><span>⚡</span> Landing Page</div>
              <div className="svc29-offer"><span>📍</span> Google Business Profile Setup</div>
              <div className="svc29-offer"><span>💬</span> WhatsApp Business Setup</div>
            </div>
            <div className="svc29-cta">
              <a className="svc29-btn" href="https://wa.me/919145891108?text=Hi!%20Mujhe%20apne%20business%20ke%20liye%20website%20banwani%20hai." target="_blank" rel="noreferrer">Contact Karne Ke Liye Yahan Click Karein</a>
              <p className="svc29-phone">📞 <a href="tel:+919145891108">+91 91458 91108</a></p>
              <button className="svc29-dismiss" onClick={dismissForever}>Dobara mat dikhao</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
