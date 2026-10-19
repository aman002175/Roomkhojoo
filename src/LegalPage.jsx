import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, FileText, Shield, Lock, ExternalLink, Heart } from 'lucide-react';

// =============================================
// PAGE DATA
// =============================================
// P2 #60: legal content aakhri baar kab revise hua (hardcoded stale "May 2025" hata diya)
const LAST_UPDATED = 'October 2026';
const pages = {
  about: {
    title: 'About Us',
    icon: <Info size={28} className="text-white" />,
    gradient: 'from-brand to-blue-600',
    sections: [
      {
        heading: 'Hamari Kahani',
        body: 'Har saal hazaron students, professionals aur coaching aane wale log ek naye shehar mein aate hain, aur unki sabse badi pareshani hoti hai — ek sahi, safe aur budget-friendly room dhoondhna. Maine khud Hanumangarh mein is pareshani ko qareeb se dekha aur jhela hai.',
      },
      {
        heading: 'Hamara Maqsad',
        body: 'Room dhoondhne ke is thaka dene wale process ko ekdum transparent aur digital banana hai. RoomKhojo ek aisa platform hai jahan owners apne rooms asaani se list kar sakein aur seekhne wale asaani se sahi room khoj sakein.',
      },
      {
        heading: 'Kyun RoomKhojo?',
        body: '• Real listings — koi fake ads nahi\n• Map-based search — aas paas ke rooms dekho\n• Direct contact — koi middleman nahi\n• Free listing — owners ke liye bilkul muft',
      },
      {
        heading: 'Aapki Jaankari, Aapki Suraksha',
        body: 'RoomKhojo par aapka mobile number public listing par kabhi seedha nahi dikhta. Number dekhne ke liye user ko login karna zaroori hai — wo bhi per-day limited numbers hi, aur har reveal ka record system me rehta hai. Matlab aapki jaankari sirf wahi log dekhte hain jinhe sach me room chahiye; spam aur bulk-scraping wale aapke number tak pahunch hi nahi sakte. Ye humara sabse bada trust feature hai.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    icon: <FileText size={28} className="text-white" />,
    gradient: 'from-purple-500 to-indigo-600',
    sections: [
      {
        heading: '1. Ad Approval Process',
        body: 'Platform ki quality aur security ke liye, koi bhi naya room ad turant live nahi hota. Har ad ko pehle RoomKhojo ki Admin team review karti hai. Approval mein 24-48 ghante lag sakte hain.',
      },
      {
        heading: '2. Platform Ki Zimmedari (Zero Liability)',
        body: "RoomKhojo sirf ek 'Digital Bridge' hai. Dono parties (Owner aur Tenant) ke beech hone wali kisi bhi baat-cheet ya financial deal mein RoomKhojo ki koi zimmedari nahi hogi. Kisi bhi deal se pehle sab kuch verify kar lein.",
      },
      {
        heading: '3. Room Data Edit Rule',
        body: 'Fraud rokne ke liye, ek baar room publish hone ke baad owner uski mukhya details (price, location) badal nahi sakte. Unhe ad delete karke naya post karna hoga.',
      },
      {
        heading: '4. Account Suspension',
        body: 'Agar koi user fake information, spam ya kisi bhi tarah ki illegal activity karta hai, toh admin uska account bina notice ke suspend kar sakta hai.',
      },
      {
        heading: '5. Mobile Number Use Karne Ke Niyam',
        body: 'Aapke number ki suraksha ke liye ye niyam kadi tarah se laagu hain:\n\n• Aap kisi bhi owner ka number sirf sahi room enquiry ke liye dekh sakte hain.\n• Number ko bulk me collect karna, list bana kar save karna, aage bechna/forward karna, ya spam/promotion ke liye use karna — bilkul mana hai.\n• Har number-reveal ka record system me hota hai. Kisi bhi misuse (spam call, harassment, scam, number resale) ki shikayat par account turant terminate kiya jayega aur zarurat padne par kanooni karyawahi bhi hogi.\n\nAisi har activity ki puri zimmedari us user ki hogi — RoomKhojo nahi.',
      },
      {
        heading: '6. Verification Disclaimer',
        body: 'RoomKhojo par har listing admin review ke baad hi live hoti hai, lekin hum owner ki identity ya property ownership ko government records se verify nahi karte. Isliye:\n\n• Room dekhne se pehle khud property visit karein.\n• Owner ki pehchaan aur papers (registry / rent agreement / ID) check karein.\n• Koi bhi bada payment sirf agreement ke baad hi karein.',
      },
      {
        heading: '7. Fraud Warning',
        body: 'Kabhi bhi bina property visit kiye token / advance / booking amount nahi bhejna chahiye.\n\nAgar koi user bina visit "advance booking" ke liye dabav daal raha hai, turant ad ke Report button se humein batayein. Aisi kisi bhi thagi ki haalat me RoomKhojo ki koi zimmedari nahi hogi — hamesha khud verify karke hi paisa dena chahiye.',
      },
      {
        heading: '8. Third-Party Services',
        body: 'App me Google Sign-In, Google Maps links aur OpenStreetMap map tiles jaisi services shamil hain. Inke use par unki apni policies bhi laagu hoti hain. Kisi bhi external link ko apni zimmedari par kholein.',
      },
      {
        heading: '9. Terms Update Aur Kanoon',
        body: 'Ye terms samay-samay par update ho sakti hain; bade badlaav hone par app par notice diya jayega. Ye terms Bharat ke kanoon ke antargat hain, aur koi bhi vivaad Hanumangarh (Rajasthan) ke nyayalayon ke adhikar-kshetra me hoga.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    icon: <Lock size={28} className="text-white" />,
    gradient: 'from-emerald-500 to-teal-600',
    sections: [
      {
        heading: '1. Kaunsi Jaankari Hum Lete Hain',
        body: 'Account banane par: naam, email, password (encrypted). Ad post karne par: mobile number, room ki details, photos aur location. Google se login karne par: naam, email aur profile photo. Iske alawa basic technical records (device/browser type, error logs) sirf safety aur debugging ke liye.\n\nHum aapki marzi ke bina koi extra personal jaankari collect nahi karte.',
      },
      {
        heading: '2. Aapka Mobile Number — Hum Use Kaise Protect Karte Hain',
        body: 'Ye RoomKhojo ka sabse important privacy feature hai:\n\n• Aapka number public listing par KABHI seedha nahi dikhta — masked rehta hai.\n• Number dekhne ke liye user ko pehle login karna zaroori hai.\n• Har user ko ek din me sirf limited numbers dikhte hain (default 15/din, admin control karta hai) — isse koi bhi aapke numbers bulk me collect/scrape nahi kar sakta.\n• Kaun sa number, kab, aur kisne dekha — system me record rehta hai. Kisi bhi misuse (spam, scam, harassment) ki shikayat par hum isi record se culprit tak pahunchte hain aur uska account turant suspend karte hain.\n\nAapka number sirf ek asli room enquiry ke liye dekhne wale ke liye hai.',
      },
      {
        heading: '3. Password Aur Account Security',
        body: 'Aapka password hamesha encrypted (bcrypt hash) form me save hota hai — hum khud bhi use plain text me nahi dekh sakte. Login sessions secure JWT tokens se chalti hain aur OTP verification email par hota hai. Poori website aur API HTTPS (encrypted connection) par chalti hain.',
      },
      {
        heading: '4. Jaankari Kahan Store Hoti Hai',
        body: 'Data trusted cloud services par rakha jata hai:\n\n• Room listings aur account details — secure cloud database (MongoDB Atlas) me, encrypted connection ke saath.\n• Photos — Cloudinary (secure image hosting) par.\n• Server access sirf authorised admin ke paas hai, strong credentials aur secret keys ke saath.\n\nHum aapki jaankari apne control wale surakshit systems me hi rakhte hain.',
      },
      {
        heading: '5. Aapki Jaankari Ka Use Kaise Hota Hai',
        body: 'Sirf in kaamon ke liye:\n\n• Account chalana aur login dena\n• Aapke ads dikhana aur interested users tak pahunchana\n• Safety aur moderation — fake ads, spam aur fraud rokna\n• OTP aur zaroori service emails bhejna\n• Kanooni requirements poori karna\n\nHum aapka data kabhi bechte nahi, kisi third party ko advertisement ke liye nahi dete, aur aapki marzi ke bina kisi ke saath share nahi karte.',
      },
      {
        heading: '6. Kiske Saath Jaankari Share Hoti Hai',
        body: 'Sirf zaroori service partners ke saath, aur sirf utne hi kaam ke liye:\n\n• Cloud hosting / database / image services (data safe rakhne ke liye)\n• Google Sign-In (sirf jab aap khud Google se login karein)\n• Court / police ke valid kanooni order par\n\nInke alawa kisi bhi haalat me aapki personal jaankari kisi ko nahi di jaati.',
      },
      {
        heading: '7. Apni Jaankari Par Aapke Adhikar',
        body: 'Aapko poora haq hai:\n\n• Naam, photo, password — Settings se kabhi bhi badal sakte hain\n• Account delete kar sakte hain — aapki saari listings, favorites aur personal details hamesha ke liye hata di jayengi\n• Koi bhi privacy sawaal ya shikayat ho toh Support section se likhein — hum 48 ghante ke andar jawab dete hain',
      },
      {
        heading: '8. Baaki Zaroori Baatein',
        body: '• Ye platform 18 saal se kam umar ke logon ke liye nahi hai.\n• Ye policy samay-samay par update ho sakti hai — bade badlaav par app par notice milta hai.\n• Aage badhkar use karte rehne ka matlab hai ki aap is policy se sahmat hain.',
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    icon: <Shield size={28} className="text-white" />,
    gradient: 'from-orange-500 to-red-500',
    sections: [
      {
        heading: '1. Strict No-Refund Policy',
        body: 'RoomKhojo par Promotional Ads ya Listing Fees ke liye No-Refund policy laagoo hai. Payment successful hone ke baad kisi bhi condition mein refund nahi hoga.',
      },
      {
        heading: '2. Early Rent-Out Scenario',
        body: 'Agar aapka room plan khatam hone se pehle rent par chala jata hai, tab bhi bache huye din ke liye refund nahi diya jayega. Aap apna ad "Inactive" kar sakte hain.',
      },
      {
        heading: '3. Lifetime Access',
        body: 'Ek baar approve ho jane wala Regular Ad aapke dashboard mein hamesha rahega. Aap use kabhi bhi Inactive ya Active kar sakte hain — koi time limit nahi.',
      },
      {
        heading: '4. Payment Dispute',
        body: 'Agar payment deduct ho gayi lekin confirmation nahi aayi, toh apna payment screenshot lekar admin se contact karein. Hum 48 ghante mein jawab denge.',
      },
      {
        heading: '5. Payment Gateway Note',
        body: 'Saare payments UPI / secure payment gateway ke zariye liye jate hain. Payment confirm hone ke baad hi ad processing shuru hoti hai. Agar gateway ki technical galti se paisa cut ho jaye aur ad activate na ho, toh wo amount 5-7 working days me khud wapas aa jata hai — ye bank/gateway ka process hai.',
      },
      {
        heading: '6. Misuse Aur Chargeback',
        body: 'Service ka galat faayda uthana, jhooti listing ke liye payment karke baad me chargeback (payment wapas karane) ki koshish karna — is par hum account suspend kar sakte hain aur zarurat padne par kanooni karyawahi bhi kar sakte hain.',
      },
    ],
  },
};

// =============================================
// MAIN COMPONENT
// =============================================
export default function LegalPage({ type }) {
  const navigate = useNavigate();
  const page = pages[type];

  if (!page) return null;

  // P2 #60: direct URL se aaye ho toh navigate(-1) site se bahar le jata tha — fallback home
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col font-sans overflow-y-auto">

      {/* ── HEADER ── */}
      <div className={`bg-gradient-to-br ${page.gradient} px-4 pt-12 pb-10 relative overflow-hidden`}>
        {/* decorative blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/10 rounded-full" />

        <button
          onClick={goBack}
          className="relative z-10 mb-6 flex items-center gap-2 text-white/80 font-bold text-sm active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} /> Back
        </button>

        <div className={`relative z-10 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4`}>
          {page.icon}
        </div>
        <h1 className="relative z-10 text-3xl font-black text-white leading-tight">
          {page.title}
        </h1>
        <p className="relative z-10 text-white/70 font-bold text-sm mt-1">
          RoomKhojo • Last updated: {LAST_UPDATED}
        </p>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {page.sections.map((sec, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-black text-gray-800 text-base mb-2">{sec.heading}</h2>
            <p className="text-gray-600 font-medium text-sm leading-relaxed whitespace-pre-line">
              {sec.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── FOOTER ── */}
      <footer className="px-4 py-8 text-center">
        <div className="inline-flex flex-col items-center gap-1">
          <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">
            RoomKhojo
          </p>
          <a
            href="https://amanbishnoi.oneapp.dev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-brand transition-colors active:scale-95"
          >
            Built with <Heart size={13} fill="currentColor" className="inline text-brand" /> by Aman Bishnoi
            <ExternalLink size={13} className="opacity-60" />
          </a>
          <p className="text-gray-300 text-xs font-bold mt-1">© {new Date().getFullYear()} 29 Dev's. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
