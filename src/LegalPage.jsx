import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, FileText, Shield, Lock, ExternalLink, Heart } from 'lucide-react';

// =============================================
// LANGUAGE SUPPORT (Hinglish / English / हिंदी)
// =============================================
const LANGS = [
  { id: 'hinglish', label: 'Hinglish' },
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'हिंदी' },
];
const LANG_KEY = 'roomkhojo_legal_lang'; // user ki language choice yaad rehti hai

// P2 #60: legal content aakhri baar kab revise hua (hardcoded stale "May 2025" hata diya)
const LAST_UPDATED = { hinglish: 'October 2026', english: 'October 2026', hindi: 'अक्टूबर 2026' };
const UPDATED_PREFIX = { hinglish: 'Last updated', english: 'Last updated', hindi: 'अंतिम अपडेट' };
const BACK_LABEL = { hinglish: 'Back', english: 'Back', hindi: 'वापस' };

// =============================================
// PAGE DATA (har page 3 bhashaon me)
// =============================================
const pages = {
  about: {
    icon: <Info size={28} className="text-white" />,
    gradient: 'from-brand to-blue-600',
    content: {
      hinglish: {
        title: 'About Us',
        sections: [
          {
            heading: 'Hamari Kahani',
            body: 'Har saal hazaron students, professionals aur coaching aane wale log ek naye shehar mein aate hain, aur unki sabse badi pareshani hoti hai — ek sahi, safe aur budget-friendly room dhoondhna. Maine khud Hanumangarh mein is pareshani ko qareeb se dekha aur jhela hai.',
          },
          {
            heading: 'Hamara Maqsad',
            body: 'Room dhoondhne ke is thaka dene wale process ko ekdum transparent aur digital banana hai. RoomKhojo ek aisa platform hai jahan owners apne rooms asaani se list kar sakein aur dhoondhne wale asaani se sahi room khoj sakein.',
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
      english: {
        title: 'About Us',
        sections: [
          {
            heading: 'Our Story',
            body: 'Every year, thousands of students, professionals and people moving for coaching arrive in a new city, and their biggest struggle is finding the right, safe and budget-friendly room. I have personally seen and faced this problem in Hanumangarh.',
          },
          {
            heading: 'Our Mission',
            body: 'We want to make the tiring process of finding a room completely transparent and digital. RoomKhojo is a platform where owners can easily list their rooms and seekers can easily find the right room.',
          },
          {
            heading: 'Why RoomKhojo?',
            body: '• Real listings — no fake ads\n• Map-based search — see rooms nearby\n• Direct contact — no middleman\n• Free listing — completely free for owners',
          },
          {
            heading: 'Your Information, Your Safety',
            body: 'On RoomKhojo, your mobile number is never shown directly on the public listing. A user must log in to view a number, and can see only a limited number of contacts per day — every reveal is recorded in the system. This means only people who genuinely need a room can see your information; spammers and bulk-scrapers cannot reach your number at all. This is our biggest trust feature.',
          },
        ],
      },
      hindi: {
        title: 'हमारे बारे में',
        sections: [
          {
            heading: 'हमारी कहानी',
            body: 'हर साल हज़ारों विद्यार्थी, पेशेवर और कोचिंग के लिए आने वाले लोग एक नए शहर में पहुँचते हैं, और उनकी सबसे बड़ी परेशानी होती है — सही, सुरक्षित और किफ़ायती कमरा ढूँढना। मैंने खुद हनुमानगढ़ में इस परेशानी को नज़दीक से देखा और सहा है।',
          },
          {
            heading: 'हमारा उद्देश्य',
            body: 'कमरा ढूँढने की इस थकाऊ प्रक्रिया को पूरी तरह पारदर्शी और डिजिटल बनाना है। RoomKhojo एक ऐसा प्लेटफ़ॉर्म है जहाँ मकान मालिक अपने कमरे आसानी से लिस्ट कर सकें और कमरा ढूँढने वाले आसानी से सही कमरा खोज सकें।',
          },
          {
            heading: 'क्यों RoomKhojo?',
            body: '• असली लिस्टिंग — कोई फ़र्ज़ी विज्ञापन नहीं\n• मैप-आधारित खोज — आस-पास के कमरे देखें\n• सीधा संपर्क — कोई बिचौलिया नहीं\n• मुफ़्त लिस्टिंग — मकान मालिकों के लिए बिल्कुल मुफ़्त',
          },
          {
            heading: 'आपकी जानकारी, आपकी सुरक्षा',
            body: 'RoomKhojo पर आपका मोबाइल नंबर सार्वजनिक लिस्टिंग पर कभी सीधे नहीं दिखता। नंबर देखने के लिए यूज़र को लॉगिन करना ज़रूरी है — वह भी प्रतिदिन सीमित संख्या में, और हर reveal का रिकॉर्ड सिस्टम में रहता है। यानी आपकी जानकारी सिर्फ़ वही लोग देखते हैं जिन्हें सच में कमरा चाहिए; स्पैम और बल्क-स्क्रैपिंग करने वाले आपके नंबर तक पहुँच ही नहीं सकते। यही हमारी सबसे बड़ी भरोसे की सुविधा है।',
          },
        ],
      },
    },
  },
  terms: {
    icon: <FileText size={28} className="text-white" />,
    gradient: 'from-purple-500 to-indigo-600',
    content: {
      hinglish: {
        title: 'Terms & Conditions',
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
      english: {
        title: 'Terms & Conditions',
        sections: [
          {
            heading: '1. Ad Approval Process',
            body: 'For platform quality and security, no new room ad goes live instantly. Every ad is first reviewed by the RoomKhojo admin team. Approval may take 24-48 hours.',
          },
          {
            heading: '2. Platform Responsibility (Zero Liability)',
            body: 'RoomKhojo is only a digital bridge. RoomKhojo holds no responsibility for any conversation or financial deal between the two parties (owner and tenant). Verify everything before any deal.',
          },
          {
            heading: '3. Room Data Edit Rule',
            body: 'To prevent fraud, once a room is published the owner cannot change its key details (price, location). They must delete the ad and post a new one.',
          },
          {
            heading: '4. Account Suspension',
            body: 'If any user posts fake information, spam or engages in any illegal activity, the admin may suspend their account without notice.',
          },
          {
            heading: '5. Mobile Number Usage Rules',
            body: 'These rules are strictly enforced to protect your number:\n\n• You may view any owner number only for a genuine room enquiry.\n• Collecting numbers in bulk, saving them in lists, reselling or forwarding them, or using them for spam/promotion is strictly prohibited.\n• Every number-reveal is recorded in the system. On any complaint of misuse (spam calls, harassment, scam, number resale), the account will be terminated immediately and legal action may follow.\n\nFull responsibility for such activity lies with the user — not RoomKhojo.',
          },
          {
            heading: '6. Verification Disclaimer',
            body: 'Every listing on RoomKhojo goes live only after admin review, but we do not verify the owner identity or property ownership against government records. Therefore:\n\n• Visit the property yourself before finalizing.\n• Check the owner identity and documents (registry / rent agreement / ID).\n• Make any large payment only after the agreement.',
          },
          {
            heading: '7. Fraud Warning',
            body: 'Never send a token / advance / booking amount without visiting the property.\n\nIf any user pressures you for an advance booking without a visit, report them immediately using the Report button on the ad. RoomKhojo holds no responsibility in any such fraud — always verify before paying.',
          },
          {
            heading: '8. Third-Party Services',
            body: 'The app includes services such as Google Sign-In, Google Maps links and OpenStreetMap map tiles. Their own policies also apply to their use. Open any external link at your own responsibility.',
          },
          {
            heading: '9. Terms Update & Governing Law',
            body: 'These terms may be updated from time to time; significant changes will be notified in the app. These terms are governed by the laws of India, and any dispute will fall under the jurisdiction of the courts at Hanumangarh (Rajasthan).',
          },
        ],
      },
      hindi: {
        title: 'नियम और शर्तें',
        sections: [
          {
            heading: '1. विज्ञापन स्वीकृति प्रक्रिया',
            body: 'प्लेटफ़ॉर्म की गुणवत्ता और सुरक्षा के लिए, कोई भी नया रूम विज्ञापन तुरंत लाइव नहीं होता। हर विज्ञापन की समीक्षा पहले RoomKhojo की एडमिन टीम करती है। स्वीकृति में 24-48 घंटे लग सकते हैं।',
          },
          {
            heading: '2. प्लेटफ़ॉर्म की ज़िम्मेदारी (शून्य दायित्व)',
            body: 'RoomKhojo केवल एक डिजिटल पुल है। दोनों पक्षों (मकान मालिक और किरायेदार) के बीच होने वाली किसी भी बातचीत या वित्तीय सौदे के लिए RoomKhojo ज़िम्मेदार नहीं होगा। किसी भी सौदे से पहले सब कुछ खुद सत्यापित करें।',
          },
          {
            heading: '3. रूम डेटा संपादन नियम',
            body: 'धोखाधड़ी रोकने के लिए, विज्ञापन प्रकाशित होने के बाद मालिक मुख्य जानकारी (कीमत, स्थान) नहीं बदल सकते। उन्हें विज्ञापन हटाकर नया पोस्ट करना होगा।',
          },
          {
            heading: '4. अकाउंट निलंबन',
            body: 'यदि कोई यूज़र फ़र्ज़ी जानकारी, स्पैम या किसी भी प्रकार की अवैध गतिविधि करता है, तो एडमिन उसका अकाउंट बिना सूचना के निलंबित कर सकता है।',
          },
          {
            heading: '5. मोबाइल नंबर उपयोग के नियम',
            body: 'आपके नंबर की सुरक्षा के लिए ये नियम कड़ाई से लागू हैं:\n\n• आप किसी भी मालिक का नंबर केवल सही रूम पूछताछ के लिए देख सकते हैं।\n• नंबर बड़ी संख्या में इकट्ठा करना, सूची बनाकर सहेजना, आगे बेचना या फ़ॉरवर्ड करना, या स्पैम/प्रचार के लिए उपयोग करना — पूरी तरह मना है।\n• हर नंबर-reveal का रिकॉर्ड सिस्टम में रहता है। दुरुपयोग (स्पैम कॉल, उत्पीड़न, ठगी, नंबर रीसेल) की किसी भी शिकायत पर अकाउंट तुरंत बंद कर दिया जाएगा और ज़रूरत पड़ने पर कानूनी कार्रवाई भी होगी।\n\nऐसी हर गतिविधि की पूरी ज़िम्मेदारी उस यूज़र की होगी — RoomKhojo की नहीं।',
          },
          {
            heading: '6. सत्यापन अस्वीकरण',
            body: 'RoomKhojo पर हर लिस्टिंग एडमिन समीक्षा के बाद ही लाइव होती है, लेकिन हम मालिक की पहचान या संपत्ति के स्वामित्व को सरकारी रिकॉर्ड से सत्यापित नहीं करते। इसलिए:\n\n• कमरा तय करने से पहले खुद प्रॉपर्टी देखने जाएँ।\n• मालिक की पहचान और दस्तावेज़ (रजिस्ट्री / रेंट एग्रीमेंट / आईडी) जाँचें।\n• कोई भी बड़ा भुगतान सिर्फ़ एग्रीमेंट के बाद ही करें।',
          },
          {
            heading: '7. धोखाधड़ी चेतावनी',
            body: 'प्रॉपर्टी देखे बिना कभी भी टोकन / एडवांस / बुकिंग राशि न भेजें।\n\nयदि कोई यूज़र बिना विज़िट किए एडवांस बुकिंग के लिए दबाव बना रहा है, तो विज्ञापन के Report बटन से तुरंत हमें बताएँ। ऐसी किसी भी ठगी की स्थिति में RoomKhojo की कोई ज़िम्मेदारी नहीं होगी — हमेशा खुद सत्यापित करके ही पैसा दें।',
          },
          {
            heading: '8. तृतीय-पक्ष सेवाएँ',
            body: 'ऐप में Google Sign-In, Google Maps लिंक और OpenStreetMap मैप टाइल्स जैसी सेवाएँ शामिल हैं। इनके उपयोग पर उनकी अपनी नीतियाँ भी लागू होती हैं। किसी भी बाहरी लिंक को अपनी ज़िम्मेदारी पर खोलें।',
          },
          {
            heading: '9. नियम अपडेट और कानून',
            body: 'ये नियम समय-समय पर अपडेट हो सकते हैं; बड़े बदलाव पर ऐप में सूचना दी जाएगी। ये नियम भारत के कानूनों के अधीन हैं, और कोई भी विवाद हनुमानगढ़ (राजस्थान) के न्यायालयों के क्षेत्राधिकार में होगा।',
          },
        ],
      },
    },
  },
  privacy: {
    icon: <Lock size={28} className="text-white" />,
    gradient: 'from-emerald-500 to-teal-600',
    content: {
      hinglish: {
        title: 'Privacy Policy',
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
      english: {
        title: 'Privacy Policy',
        sections: [
          {
            heading: '1. What Information We Collect',
            body: 'When you create an account: name, email, password (encrypted). When you post an ad: mobile number, room details, photos and location. When you log in with Google: name, email and profile photo. In addition, basic technical records (device/browser type, error logs) purely for safety and debugging.\n\nWe do not collect any extra personal information without your consent.',
          },
          {
            heading: '2. Your Mobile Number — How We Protect It',
            body: 'This is the most important privacy feature of RoomKhojo:\n\n• Your number is NEVER shown directly on the public listing — it stays masked.\n• A user must log in before viewing any number.\n• Each user sees only a limited number of contacts per day (default 15/day, controlled by admin) — so no one can bulk-collect or scrape your numbers.\n• Every number view — which number, when, and by whom — is recorded in the system. On any misuse complaint (spam, scam, harassment), we trace the culprit through this record and suspend their account immediately.\n\nYour number is meant only for a genuine room enquiry.',
          },
          {
            heading: '3. Password & Account Security',
            body: 'Your password is always stored in encrypted (bcrypt hash) form — even we cannot see it in plain text. Login sessions run on secure JWT tokens and OTP verification is sent by email. The entire website and API run over HTTPS (encrypted connection).',
          },
          {
            heading: '4. Where Your Information Is Stored',
            body: 'Data is kept on trusted cloud services:\n\n• Room listings and account details — in a secure cloud database (MongoDB Atlas) over an encrypted connection.\n• Photos — on Cloudinary (secure image hosting).\n• Server access is limited to the authorised admin, with strong credentials and secret keys.\n\nWe keep your information only in secured systems under our control.',
          },
          {
            heading: '5. How We Use Your Information',
            body: 'Only for these purposes:\n\n• Running your account and providing login\n• Displaying your ads and reaching interested users\n• Safety and moderation — stopping fake ads, spam and fraud\n• Sending OTP and essential service emails\n• Meeting legal requirements\n\nWe never sell your data, never give it to any third party for advertising, and never share it without your consent.',
          },
          {
            heading: '6. Who We Share Information With',
            body: 'Only with essential service partners, and only for that specific purpose:\n\n• Cloud hosting / database / image services (to keep data safe)\n• Google Sign-In (only when you choose to log in with Google)\n• On a valid legal order from a court / police\n\nBeyond this, your personal information is never given to anyone under any circumstances.',
          },
          {
            heading: '7. Your Rights Over Your Information',
            body: 'You have the full right to:\n\n• Change your name, photo and password anytime from Settings\n• Delete your account — all your listings, favorites and personal details are removed permanently\n• Send any privacy question or complaint via the Support section — we reply within 48 hours',
          },
          {
            heading: '8. Other Important Points',
            body: '• This platform is not for people under 18 years of age.\n• This policy may be updated from time to time — major changes are notified in the app.\n• Continuing to use the app means you agree to this policy.',
          },
        ],
      },
      hindi: {
        title: 'प्राइवेसी पॉलिसी',
        sections: [
          {
            heading: '1. हम कौन-सी जानकारी लेते हैं',
            body: 'अकाउंट बनाने पर: नाम, ईमेल, पासवर्ड (एन्क्रिप्टेड)। विज्ञापन पोस्ट करने पर: मोबाइल नंबर, कमरे की जानकारी, फ़ोटो और लोकेशन। Google से लॉगिन करने पर: नाम, ईमेल और प्रोफ़ाइल फ़ोटो। इसके अलावा बुनियादी तकनीकी रिकॉर्ड (डिवाइस/ब्राउज़र प्रकार, एरर लॉग) सिर्फ़ सुरक्षा और डिबगिंग के लिए।\n\nआपकी सहमति के बिना हम कोई अतिरिक्त व्यक्तिगत जानकारी नहीं लेते।',
          },
          {
            heading: '2. आपका मोबाइल नंबर — हम इसे कैसे सुरक्षित रखते हैं',
            body: 'यह RoomKhojo की सबसे अहम प्राइवेसी सुविधा है:\n\n• आपका नंबर सार्वजनिक लिस्टिंग पर कभी सीधे नहीं दिखता — masked रहता है।\n• नंबर देखने के लिए यूज़र को पहले लॉगिन करना ज़रूरी है।\n• हर यूज़र को एक दिन में सीमित नंबर ही दिखते हैं (डिफ़ॉल्ट 15/दिन, एडमिन इसे नियंत्रित करता है) — इससे कोई आपके नंबर बड़ी संख्या में इकट्ठा या स्क्रैप नहीं कर सकता।\n• कौन-सा नंबर, कब, और किसने देखा — सब सिस्टम में दर्ज होता है। दुरुपयोग (स्पैम, ठगी, उत्पीड़न) की किसी भी शिकायत पर हम इसी रिकॉर्ड से अपराधी तक पहुँचते हैं और उसका अकाउंट तुरंत बंद करते हैं।\n\nआपका नंबर सिर्फ़ असली रूम पूछताछ के लिए देखने वाले के लिए है।',
          },
          {
            heading: '3. पासवर्ड और अकाउंट सुरक्षा',
            body: 'आपका पासवर्ड हमेशा एन्क्रिप्टेड (bcrypt hash) रूप में सेव होता है — हम खुद भी उसे plain text में नहीं देख सकते। लॉगिन सेशन सुरक्षित JWT टोकन से चलते हैं और OTP सत्यापन ईमेल पर होता है। पूरी वेबसाइट और API HTTPS (एन्क्रिप्टेड कनेक्शन) पर चलती हैं।',
          },
          {
            heading: '4. जानकारी कहाँ सेव होती है',
            body: 'डेटा भरोसेमंद क्लाउड सेवाओं पर रखा जाता है:\n\n• रूम लिस्टिंग और अकाउंट जानकारी — सुरक्षित क्लाउड डेटाबेस (MongoDB Atlas) में, एन्क्रिप्टेड कनेक्शन के साथ।\n• फ़ोटो — Cloudinary (सुरक्षित इमेज होस्टिंग) पर।\n• सर्वर एक्सेस सिर्फ़ अधिकृत एडमिन के पास है, मज़बूत क्रेडेंशियल्स और सीक्रेट कीज़ के साथ।\n\nहम आपकी जानकारी अपने नियंत्रण वाले सुरक्षित सिस्टम में ही रखते हैं।',
          },
          {
            heading: '5. आपकी जानकारी का उपयोग कैसे होता है',
            body: 'सिर्फ़ इन कामों के लिए:\n\n• अकाउंट चलाना और लॉगिन देना\n• आपके विज्ञापन दिखाना और इच्छुक यूज़र्स तक पहुँचाना\n• सुरक्षा और मॉडरेशन — फ़र्ज़ी विज्ञापन, स्पैम और ठगी रोकना\n• OTP और ज़रूरी सर्विस ईमेल भेजना\n• कानूनी आवश्यकताएँ पूरी करना\n\nहम आपका डेटा कभी नहीं बेचते, किसी तीसरे पक्ष को विज्ञापन के लिए नहीं देते, और आपकी मर्ज़ी के बिना किसी के साथ साझा नहीं करते।',
          },
          {
            heading: '6. जानकारी किसके साथ साझा होती है',
            body: 'सिर्फ़ ज़रूरी सर्विस पार्टनर्स के साथ, और सिर्फ़ उतने ही काम के लिए:\n\n• क्लाउड होस्टिंग / डेटाबेस / इमेज सेवाएँ (डेटा सुरक्षित रखने के लिए)\n• Google Sign-In (सिर्फ़ तब जब आप खुद Google से लॉगिन करें)\n• अदालत / पुलिस के वैध कानूनी आदेश पर\n\nइसके अलावा किसी भी हालत में आपकी व्यक्तिगत जानकारी किसी को नहीं दी जाती।',
          },
          {
            heading: '7. अपनी जानकारी पर आपके अधिकार',
            body: 'आपको पूरा हक़ है:\n\n• नाम, फ़ोटो, पासवर्ड — Settings से कभी भी बदल सकते हैं\n• अकाउंट डिलीट कर सकते हैं — आपकी सारी लिस्टिंग, फ़ेवरिट और व्यक्तिगत जानकारी हमेशा के लिए हटा दी जाएगी\n• कोई भी प्राइवेसी सवाल या शिकायत हो तो Support सेक्शन से लिखें — हम 48 घंटे के अंदर जवाब देते हैं',
          },
          {
            heading: '8. बाकी ज़रूरी बातें',
            body: '• यह प्लेटफ़ॉर्म 18 साल से कम उम्र के लोगों के लिए नहीं है।\n• यह पॉलिसी समय-समय पर अपडेट हो सकती है — बड़े बदलाव पर ऐप में सूचना मिलती है।\n• आगे बढ़कर उपयोग करते रहने का मतलब है कि आप इस पॉलिसी से सहमत हैं।',
          },
        ],
      },
    },
  },
  refund: {
    icon: <Shield size={28} className="text-white" />,
    gradient: 'from-orange-500 to-red-500',
    content: {
      hinglish: {
        title: 'Refund Policy',
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
      english: {
        title: 'Refund Policy',
        sections: [
          {
            heading: '1. Strict No-Refund Policy',
            body: 'RoomKhojo follows a strict No-Refund policy for Promotional Ads and Listing Fees. Once the payment is successful, no refund will be given under any condition.',
          },
          {
            heading: '2. Early Rent-Out Scenario',
            body: 'If your room gets rented out before your plan ends, no refund will be given for the remaining days. You can mark your ad as Inactive.',
          },
          {
            heading: '3. Lifetime Access',
            body: 'A Regular Ad, once approved, stays in your dashboard forever. You can activate or deactivate it anytime — there is no time limit.',
          },
          {
            heading: '4. Payment Dispute',
            body: 'If the payment was deducted but you did not receive confirmation, contact the admin with your payment screenshot. We will respond within 48 hours.',
          },
          {
            heading: '5. Payment Gateway Note',
            body: 'All payments are collected through UPI / secure payment gateways. Ad processing starts only after the payment is confirmed. If a gateway error deducts money without activating your ad, the amount is automatically returned within 5-7 working days — this is the bank/gateway process.',
          },
          {
            heading: '6. Misuse & Chargeback',
            body: 'Misusing the service, or attempting a chargeback (reversing the payment) after paying for a fake listing, may lead to account suspension and, if needed, legal action.',
          },
        ],
      },
      hindi: {
        title: 'रिफ़ंड पॉलिसी',
        sections: [
          {
            heading: '1. सख़्त नो-रिफ़ंड नीति',
            body: 'RoomKhojo पर प्रोमोशनल विज्ञापन या लिस्टिंग फ़ीस के लिए सख़्त No-Refund नीति लागू है। भुगतान सफल होने के बाद किसी भी स्थिति में रिफ़ंड नहीं मिलेगा।',
          },
          {
            heading: '2. जल्दी किराये पर चले जाने की स्थिति',
            body: 'यदि आपका कमरा प्लान खत्म होने से पहले किराये पर चला जाए, तो बचे हुए दिनों का रिफ़ंड नहीं मिलेगा। आप अपना विज्ञापन Inactive कर सकते हैं।',
          },
          {
            heading: '3. लाइफ़टाइम एक्सेस',
            body: 'एक बार स्वीकृत होने वाला Regular Ad आपके डैशबोर्ड में हमेशा रहता है। आप उसे कभी भी Inactive या Active कर सकते हैं — कोई समय-सीमा नहीं।',
          },
          {
            heading: '4. भुगतान विवाद',
            body: 'यदि भुगतान कट गया लेकिन पुष्टि नहीं मिली, तो भुगतान का स्क्रीनशॉट लेकर एडमिन से संपर्क करें। हम 48 घंटे में जवाब देंगे।',
          },
          {
            heading: '5. पेमेंट गेटवे नोट',
            body: 'सभी भुगतान UPI / सुरक्षित पेमेंट गेटवे से लिए जाते हैं। भुगतान की पुष्टि के बाद ही विज्ञापन प्रोसेसिंग शुरू होती है। यदि गेटवे की तकनीकी गड़बड़ी से पैसा कट जाए और विज्ञापन एक्टिवेट न हो, तो राशि 5-7 कार्यदिवसों में अपने आप वापस आ जाती है — यह बैंक/गेटवे की प्रक्रिया है।',
          },
          {
            heading: '6. दुरुपयोग और चार्जबैक',
            body: 'सेवा का गलत फ़ायदा उठाना या फ़र्ज़ी लिस्टिंग के लिए भुगतान करके बाद में चार्जबैक (भुगतान वापस कराने) की कोशिश करना — इस पर हम अकाउंट सस्पेंड कर सकते हैं और ज़रूरत पड़ने पर कानूनी कार्रवाई भी कर सकते हैं।',
          },
        ],
      },
    },
  },
};

// =============================================
// MAIN COMPONENT
// =============================================
export default function LegalPage({ type }) {
  const navigate = useNavigate();

  // Language choice — pehle user ki saved choice, warna Hinglish (default)
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && LANGS.some((l) => l.id === saved)) return saved;
    } catch { /* storage blocked: default chalega */ }
    return 'hinglish';
  });
  const changeLang = (id) => {
    setLang(id);
    try { localStorage.setItem(LANG_KEY, id); } catch { /* ignore */ }
  };

  const page = pages[type];
  if (!page) return null;
  const content = page.content[lang] || page.content.hinglish;

  // P2 #60: direct URL se aaye ho toh navigate(-1) site se bahar le jata tha — fallback home
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col font-sans overflow-y-auto">

      {/* ── HEADER ── */}
      <div className={`bg-gradient-to-br ${page.gradient} px-4 pt-12 pb-8 relative overflow-hidden`}>
        {/* decorative blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/10 rounded-full" />

        <button
          onClick={goBack}
          className="relative z-10 mb-6 flex items-center gap-2 text-white/80 font-bold text-sm active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} /> {BACK_LABEL[lang]}
        </button>

        <div className={`relative z-10 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4`}>
          {page.icon}
        </div>
        <h1 className="relative z-10 text-3xl font-black text-white leading-tight">
          {content.title}
        </h1>
        <p className="relative z-10 text-white/70 font-bold text-sm mt-1">
          RoomKhojo • {UPDATED_PREFIX[lang]}: {LAST_UPDATED[lang]}
        </p>

        {/* Language switcher — jaisa professional apps me hota hai */}
        <div className="relative z-10 mt-4 inline-flex items-center gap-0.5 bg-black/15 rounded-full p-1">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => changeLang(l.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-black transition-all active:scale-95 ${lang === l.id ? 'bg-white text-gray-800 shadow-sm' : 'text-white/85'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {content.sections.map((sec, i) => (
          <div key={`${lang}-${i}`} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
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
