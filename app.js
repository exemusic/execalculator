
import { initializeApp }               from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup,
         GoogleAuthProvider, signOut, updateProfile }
                                        from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getDatabase, ref, get, set, push, update, remove,
         onValue, query, orderByChild, limitToLast, serverTimestamp }
                                        from "https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAH6XpWZdI3civ3V4zzVzJeh7MWnx-S8PA",
  authDomain:        "exeinthedata.firebaseapp.com",
  databaseURL:       "https://exeinthedata-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId:         "exeinthedata",
  storageBucket:     "exeinthedata.firebasestorage.app",
  messagingSenderId: "458648274992",
  appId:             "1:458648274992:web:606fc651121e33dbcd45f5",
  measurementId:     "G-ZV9QMEG05M"
};

const app           = initializeApp(firebaseConfig);
const auth          = getAuth(app);
const db            = getDatabase(app);
const googleProvider= new GoogleAuthProvider();

const $  = id => document.getElementById(id);
const qs = s  => document.querySelector(s);

const PAGES = ['home','login','register','welcome','allfeedback'];
function showPage(id) {
  PAGES.forEach(p => {
    const el = $(`page-${p}`);
    if (el) el.classList.toggle('active', p === id);
    if (el) el.classList.toggle('hidden', p !== id);
  });
  window.location.hash = id;
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#','') || 'home';
  if (PAGES.includes(hash)) {
    const user = auth.currentUser;
    if (hash === 'login' && user) { showPage('home'); return; }
    if (hash === 'register') return;
    showPage(hash);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('js-ready');
  const hash = window.location.hash.replace('#','') || 'home';
  showPage(PAGES.includes(hash) ? hash : 'home');
  setupScrollAnimations();
  setupCalculator();
  setupFeedback();
  setupAdminConsole();
  loadComments();
  loadAllComments();
  setupAnnouncement();
});

let currentUser     = null;
let currentUserData = null;
let selectedRating  = 0;
let calcResult      = null;
let animRunning     = false;

function formatRp(n) {
  if (!n || n === 0) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (d > 0) return d + ' hari lalu';
  if (h > 0) return h + ' jam lalu';
  if (m > 0) return m + ' mnt lalu';
  return 'baru saja';
}

const URL_PATTERN = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;
const PHONE_PATTERN = /(\+62|08)[0-9]{8,12}/g;
const PROMO_WORDS = ['jual','beli','discount','promo','wa di','hubungi','contact','telegram','t\.me','discord\.gg','bit\.ly','tinyurl','shorturl'];

function sanitizeAndValidate(text) {
  const errors = [];
  if (!text || text.trim().length === 0) { errors.push('Pesan tidak boleh kosong.'); return { ok: false, errors }; }
  if (text.length > 500) { errors.push('Pesan melebihi 500 karakter.'); return { ok: false, errors }; }
  if (URL_PATTERN.test(text)) { URL_PATTERN.lastIndex=0; errors.push('Dilarang menyertakan link/URL.'); }
  if (PHONE_PATTERN.test(text)) { PHONE_PATTERN.lastIndex=0; errors.push('Dilarang menyertakan nomor telepon.'); }
  const lower = text.toLowerCase();
  for (const w of PROMO_WORDS) {
    if (lower.includes(w)) { errors.push('Dilarang konten promosi atau kontak eksternal.'); break; }
  }
  if (errors.length) return { ok: false, errors };
  const clean = text.replace(URL_PATTERN,'[link]').trim();
  return { ok: true, clean };
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    await handleUserLogin(user);
  } else {
    currentUserData = null;
    $('authArea').classList.remove('hidden');
    $('userArea').classList.add('hidden');
    $('feedbackGate').classList.remove('hidden');
    $('feedbackFormWrap').classList.add('hidden');
    $('adminConsole').classList.add('hidden');
  }
});

async function handleUserLogin(user) {
 
  const snap = await get(ref(db, `users/${user.uid}`));
  const userData = snap.val() || {};
  currentUserData = userData;

 
  if (userData.banned) {
    showBanned(userData);
    return;
  }

 
  if (!userData.username) {
    showPage('register');
    setupRegisterPage(user);
    return;
  }

 
  $('authArea').classList.add('hidden');
  $('userArea').classList.remove('hidden');
  const usernameText = userData.username || user.displayName || 'User';
  $('navUsername').textContent = usernameText;
  $('popupUsername').textContent = usernameText;
  const initial = (userData.username || user.email || '?')[0].toUpperCase();
  $('userAvatar').textContent = initial;
  $('popupAvatar').textContent = initial;

 
  if (userData.owner) {
    $('navRoleBadge').textContent = 'OWNER';
    $('navRoleBadge').classList.remove('hidden');
    $('adminConsole').classList.remove('hidden');
  } else if (userData.staff) {
    $('navRoleBadge').textContent = 'STAFF';
    $('navRoleBadge').classList.remove('hidden');
    $('adminConsole').classList.remove('hidden');
  }

 
  $('feedbackGate').classList.add('hidden');
  $('feedbackFormWrap').classList.remove('hidden');
  $('formAvatar').textContent = initial;
  $('formUsername').textContent = userData.username || user.displayName || 'User';

 
  onValue(ref(db, `users/${user.uid}/banned`), snap => {
    if (snap.val() === true) {
      get(ref(db, `users/${user.uid}`)).then(s => showBanned(s.val() || {}));
    }
  });
}

function showBanned(userData) {
  $('bannedOverlay').classList.remove('hidden');
  $('bannedReason').textContent = userData.banReason || 'Pelanggaran kebijakan komunitas.';
  if (userData.banUntil) {
    const until = new Date(userData.banUntil);
    $('bannedUntil').textContent = `Ban berakhir: ${until.toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric'})}`;
  }
  $('authArea').classList.add('hidden');
  $('userArea').classList.add('hidden');
  $('feedbackFormWrap').classList.add('hidden');
}
export function doLogout() { signOut(auth); }
$('bannedLogoutBtn').addEventListener('click', () => signOut(auth));

async function doGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
   
   
  } catch (err) {
    const errEl = $('loginError');
    if (errEl) {
      errEl.textContent = getAuthError(err.code);
      errEl.classList.remove('hidden');
    }
  }
}

$('loginBtn').addEventListener('click', () => showPage('login'));
$('signupBtn').addEventListener('click', () => showPage('login'));
$('navUserPill').addEventListener('click', () => {
  $('accountPopup').classList.toggle('visible');
  $('accountPopupBackdrop').classList.toggle('visible');
});
$('accountPopupClose').addEventListener('click', closeAccountPopup);
$('popupCancelBtn').addEventListener('click', closeAccountPopup);
$('popupLogoutBtn').addEventListener('click', () => {
  closeAccountPopup();
  signOut(auth);
});
$('accountPopupBackdrop').addEventListener('click', closeAccountPopup);
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAccountPopup(); });
$('loginBackBtn').addEventListener('click', () => showPage('home'));
$('googleLoginBtn').addEventListener('click', doGoogleLogin);
$('gateLoginBtn').addEventListener('click', doGoogleLogin);
$('navBrand').addEventListener('click', e => { e.preventDefault(); showPage('home'); });

function closeAccountPopup() {
  $('accountPopup').classList.remove('visible');
  $('accountPopupBackdrop').classList.remove('visible');
}

function getAuthError(code) {
  const map = {
    'auth/popup-closed-by-user': 'Login dibatalkan.',
    'auth/cancelled-popup-request': 'Login dibatalkan.',
    'auth/network-request-failed': 'Koneksi bermasalah.',
    'auth/user-disabled': 'Akun dinonaktifkan.',
  };
  return map[code] || 'Terjadi kesalahan. Coba lagi.';
}

function setupRegisterPage(user) {
  const initial = (user.displayName || user.email || '?')[0].toUpperCase();
  $('regGoogleAvatar').textContent = initial;
  $('regGoogleEmail').textContent  = user.email;

  const usernameInput = $('regUsername');
  usernameInput.addEventListener('input', () => {
    const val = usernameInput.value;
    $('regCharCount').textContent = `${val.length}/20`;
    const note = $('regNote');
    const status = $('regUsernameStatus');
    if (val.length < 3) {
      note.textContent = 'Minimal 3 karakter';
      status.textContent = '';
    } else if (!/^[a-zA-Z0-9_]+$/.test(val)) {
      note.textContent = '⚠ Hanya huruf, angka, underscore';
      note.style.color = 'var(--error)';
      status.textContent = '✕';
      status.style.color = 'var(--error)';
    } else {
      note.textContent = 'Format valid ✓';
      note.style.color = 'var(--success)';
      status.textContent = '✓';
      status.style.color = 'var(--success)';
    }
  });

  $('doRegister').addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const errEl    = $('registerError');
    errEl.classList.add('hidden');

    if (username.length < 3 || username.length > 20) {
      errEl.textContent = 'Username harus 3–20 karakter.';
      errEl.classList.remove('hidden');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errEl.textContent = 'Hanya huruf, angka, dan underscore.';
      errEl.classList.remove('hidden');
      return;
    }

   
    const usernameSnap = await get(ref(db, `usernames/${username.toLowerCase()}`));
    if (usernameSnap.exists()) {
      errEl.textContent = 'Username sudah dipakai. Pilih lain.';
      errEl.classList.remove('hidden');
      return;
    }

    $('doRegister').disabled = true;
    $('doRegister').textContent = 'Menyimpan...';

    try {
     
      await set(ref(db, `usernames/${username.toLowerCase()}`), user.uid);
     
      await set(ref(db, `users/${user.uid}`), {
        username,
        email:     user.email,
        uid:       user.uid,
        createdAt: Date.now(),
        banned:    false,
        owner:     false,
        staff:     false,
        cdfeedback: null
      });
     
      await updateProfile(user, { displayName: username, photoURL: null });
      currentUserData = { username, email: user.email, uid: user.uid };

     
      showWelcomePage(username);
    } catch (err) {
      errEl.textContent = 'Gagal menyimpan. Coba lagi.';
      errEl.classList.remove('hidden');
      $('doRegister').disabled = false;
      $('doRegister').textContent = 'Selesai & Mulai →';
    }
  });
}

function showWelcomePage(username) {
  showPage('welcome');
  const greeting  = $('welcomeGreeting');
  const sub       = $('welcomeSub');
  const steps     = $('welcomeSteps');
  const startBtn  = $('welcomeStartBtn');
  const wsItems   = ['ws1','ws2','ws3','ws4'].map(id => $(id));

 
  const fullText = `Welcome, ${username}!! 👋`;
  greeting.textContent = '';
  let i = 0;
  function typeChar() {
    if (i < fullText.length) {
      greeting.textContent += fullText[i++];
      setTimeout(typeChar, 55);
    } else {
     
      setTimeout(() => {
        sub.classList.remove('hidden');
        steps.classList.remove('hidden');
        wsItems.forEach((el, idx) => {
          setTimeout(() => el.classList.add('visible'), idx * 150);
        });
        setTimeout(() => startBtn.classList.remove('hidden'), 700);
      }, 400);
    }
  }
  setTimeout(typeChar, 500);

  startBtn.onclick = () => {
    showPage('home');
    handleUserLogin(auth.currentUser);
  };
}

const PRICES = {
  rank: {
    'Warrior':           0,
    'Mythic':            100000,
    'Mythical Honor':    250000,
    'Mythical Glory':    500000,
    'Mythical Immortal': 850000
  },
  highestRank: {
    'Dibawah Glory':    0,
    'Glory Biasa':      150000,
    'Immortal Biasa':   350000,
    'Immortal Dewa':    700000
  },
  skinRareLim:   2500000,
  skinLegendLim: 700000,
  skinLegend:    500000,
  skinGrand:     300000,
  skinExquisite: 120000,
  skinDeluxe:    30000,
  recallEffect:  60000,
  borderLimited: 25000,
  emblemLevel60: 40000
};

function calcCore() {
  const get_n = id => parseInt($(id)?.value) || 0;
  const get_f = id => parseFloat($(id)?.value) || 0;

  const tier        = $('tier').value;
  const highestTier = $('highestTier').value;
  const winRate     = get_f('winRate');
  const totalMatch  = get_n('totalRankMatches');
  const emblems     = Math.min(get_n('emblemLevel60'), 7);

  const skinRareLim   = get_n('skinRareLim');
  const skinLegendLim = get_n('skinLegendLim');
  const skinLegend    = get_n('skinLegend');
  const skinGrand     = get_n('skinGrand');
  const skinExquisite = get_n('skinExquisite');
  const skinDeluxe    = get_n('skinDeluxe');
  const recallEffect  = get_n('recallEffect');
  const borderLimited = get_n('borderLimited');

  const rankVal   = PRICES.rank[tier] || 0;
  const histVal   = PRICES.highestRank[highestTier] || 0;
  const emblemVal = emblems * PRICES.emblemLevel60;
  const skinVal   =
    skinRareLim   * PRICES.skinRareLim   +
    skinLegendLim * PRICES.skinLegendLim +
    skinLegend    * PRICES.skinLegend    +
    skinGrand     * PRICES.skinGrand     +
    skinExquisite * PRICES.skinExquisite +
    skinDeluxe    * PRICES.skinDeluxe    +
    recallEffect  * PRICES.recallEffect  +
    borderLimited * PRICES.borderLimited;

  let bonusVal = 0;
  if (winRate > 70 && totalMatch >= 5000)       bonusVal = (rankVal+histVal+skinVal)*0.15;
  else if (winRate > 65 && totalMatch >= 3000)  bonusVal = (rankVal+histVal+skinVal)*0.08;

  const total = rankVal + histVal + emblemVal + skinVal + bonusVal;
  const score = Math.min((total / 15000000) * 100, 100);

  let grade, gradeStyle;
  if      (total === 0)        { grade='—';       gradeStyle=''; }
  else if (total < 200000)     { grade='Starter'; gradeStyle='background:rgba(168,164,158,0.1);color:#A8A49E;border-color:rgba(168,164,158,0.2)'; }
  else if (total < 600000)     { grade='Casual';  gradeStyle='background:rgba(74,222,128,0.1);color:#4ADE80;border-color:rgba(74,222,128,0.25)'; }
  else if (total < 1500000)    { grade='Solid';   gradeStyle='background:rgba(96,165,250,0.1);color:#60A5FA;border-color:rgba(96,165,250,0.25)'; }
  else if (total < 3000000)    { grade='Premium'; gradeStyle='background:rgba(139,92,246,0.1);color:#A78BFA;border-color:rgba(139,92,246,0.25)'; }
  else if (total < 7000000)    { grade='Elite';   gradeStyle='background:rgba(232,184,75,0.1);color:#E8B84B;border-color:rgba(232,184,75,0.25)'; }
  else                         { grade='Rare';    gradeStyle='background:rgba(248,113,113,0.1);color:#F87171;border-color:rgba(248,113,113,0.25)'; }

  return { total, rankVal, histVal, emblemVal, skinVal, bonusVal, score, grade, gradeStyle, min: total*0.75, max: total*1.3 };
}

function applyResultUI(res) {
  $('resultPrice').textContent  = formatRp(res.total);
  $('heroLivePrice').textContent= formatRp(res.total);
  const gradeEl = $('resultGrade');
  gradeEl.textContent = res.grade;
  gradeEl.style.cssText = res.gradeStyle + ';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid;';
  $('meterFill').style.width = res.score + '%';
  $('resultRange').textContent = res.total > 0
    ? `Estimasi pasar: ${formatRp(res.min)} — ${formatRp(res.max)}`
    : '';

 
  const bd = $('priceBreakdown');
  bd.innerHTML = '';
  const items = [
    { label:'Rank Saat Ini',  val:res.rankVal,   color:'#60A5FA' },
    { label:'Riwayat Rank',   val:res.histVal,   color:'#A78BFA' },
    { label:'Koleksi Skin',   val:res.skinVal,   color:'#F05A5A' },
    { label:'Emblem Max',     val:res.emblemVal, color:'#EAB308' },
    { label:'Bonus Pro WR',   val:res.bonusVal,  color:'#4ADE80' },
  ];
  items.forEach(item => {
    if (item.val <= 0) return;
    const el = document.createElement('div');
    el.className = 'breakdown-item';
    el.innerHTML = `<span class="bd-label"><span class="bd-dot" style="background:${item.color}"></span>${item.label}</span><span class="bd-val">${formatRp(item.val)}</span>`;
    bd.appendChild(el);
  });

 
  const maxB = Math.max(res.rankVal+res.histVal, res.skinVal, res.emblemVal, res.bonusVal, 1);
  $('barRank').style.width   = Math.min(((res.rankVal+res.histVal)/maxB)*100,100)+'%';
  $('barSkin').style.width   = Math.min((res.skinVal/maxB)*100,100)+'%';
  $('barEmblem').style.width = Math.min((res.emblemVal/maxB)*100,100)+'%';
  $('barBonus').style.width  = Math.min((res.bonusVal/maxB)*100,100)+'%';

 
  const msg = `Estimasi akun MLBB saya: ${formatRp(res.total)} (Grade: ${res.grade}) — dihitung di ExeRevers Calculator`;
  $('shareWa').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

async function runResultAnimation(res) {
  if (animRunning) { finishAnim(res); return; }
  animRunning = true;
  document.body.classList.add('is-calculating');
  $('resultCard')?.classList.add('is-updating');

  const overlay = $('resultAnimOverlay');
  const phase1  = $('animPhase1');
  const phase2  = $('animPhase2');
  const phase3  = $('animPhase3');
  const animPriceEl = $('animPrice');
  const animGradeEl = $('animGrade');
  const checklist   = $('animChecklist');

  overlay.classList.remove('hidden');
  phase1.classList.remove('hidden');
  phase2.classList.add('hidden');
  phase3.classList.add('hidden');

  const skip = $('animSkipBtn');
  let skipped = false;
  skip.onclick = () => { skipped = true; finishAnim(res); };

 
  await delay(1200);
  if (skipped) return;

 
  phase1.classList.add('hidden');
  phase2.classList.remove('hidden');
  checklist.innerHTML = '';

  const checkItems = [
    { label:'Rank & Riwayat',  val: formatRp(res.rankVal + res.histVal), icon:'🏆' },
    { label:'Koleksi Skin',    val: formatRp(res.skinVal),               icon:'💎' },
    { label:'Emblem Max',      val: formatRp(res.emblemVal),             icon:'🔮' },
    { label:'Bonus Win Rate',  val: formatRp(res.bonusVal),              icon:'⚡' },
  ];

  for (const item of checkItems) {
    if (skipped) return;
    const el = document.createElement('div');
    el.className = 'anim-check-item';
    el.innerHTML = `<span class="anim-check-icon">${item.icon}</span><span>${item.label}</span><span class="anim-check-val">${item.val}</span>`;
    checklist.appendChild(el);
    await delay(30);
    el.classList.add('visible');
    await delay(380);
    if (skipped) return;
  }

  await delay(400);
  if (skipped) return;

 
  phase2.classList.add('hidden');
  phase3.classList.remove('hidden');
  animGradeEl.textContent = res.grade;
  animGradeEl.style.cssText = res.gradeStyle + ';padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid;';

 
  const target = res.total;
  const duration = 1200;
  const steps = 40;
  const stepTime = duration / steps;
  let current = 0;
  for (let s = 0; s <= steps; s++) {
    if (skipped) return;
    current = Math.round((target / steps) * s);
    animPriceEl.textContent = formatRp(current);
    await delay(stepTime);
  }

  await delay(800);
  if (skipped) return;

  finishAnim(res);
}

function finishAnim(res) {
  animRunning = false;
  document.body.classList.remove('is-calculating');
  $('resultCard')?.classList.remove('is-updating');
  $('resultAnimOverlay').classList.add('hidden');
  applyResultUI(res);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function setupScrollAnimations() {
  const elements = Array.from(document.querySelectorAll('.reveal-on-scroll'));
  if (!elements.length) return;

  let ticking = false;
  const reveal = () => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    elements.forEach((el) => {
      if (el.classList.contains('is-visible')) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight * 0.9 && rect.bottom > 0) {
        el.classList.add('is-visible');
      }
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      reveal();
      ticking = false;
    });
  };

  reveal();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}

function setupCalculator() {
 
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input',  () => { calcResult = calcCore(); applyResultUI(calcResult); });
    el.addEventListener('change', () => { calcResult = calcCore(); applyResultUI(calcResult); });
  });

 
  $('winRate').addEventListener('input', function() {
    const val = Math.min(parseFloat(this.value)||0, 100);
    $('winRateBar').style.width = val+'%';
    const note = $('winRateNote');
    if (val > 70) note.textContent = '🔥 Pro player! Bonus aktif jika match ≥ 5000';
    else if (val > 55) note.textContent = '✅ Win rate bagus';
    else note.textContent = 'Win rate standar pasar';
  });

 
  $('emblemLevel60').addEventListener('input', function() {
    const val = Math.min(parseInt(this.value)||0, 7);
    $('emblemCount').textContent = val+'/7';
    if (val > 7) this.value = 7;
  });

 
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input  = $(btn.dataset.target);
      const action = btn.dataset.action;
      let val = parseInt(input.value)||0;
      val = action === 'plus' ? val+1 : Math.max(0, val-1);
      input.value = val;
      calcResult = calcCore(); applyResultUI(calcResult);
    });
  });

 
  $('calculateBtn').addEventListener('click', () => {
    calcResult = calcCore();
    runResultAnimation(calcResult);
    const resultCol = qs('.result-col');
    const resultCard = $('resultCard');

    if (window.innerWidth < 900) {
      resultCol?.scrollIntoView({ behavior:'smooth', block:'start' });
      resultCard?.classList.remove('highlight');
      void resultCard?.offsetWidth;
      resultCard?.classList.add('highlight');
      setTimeout(() => resultCard?.classList.remove('highlight'), 1200);
    } else {
      resultCol?.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  });

 
  $('resetBtn').addEventListener('click', () => {
    document.querySelectorAll('.section-card input[type="number"]').forEach(el => el.value='0');
    document.querySelectorAll('.tier-input input').forEach(el => el.value='0');
    $('tier').value        = 'Warrior';
    $('highestTier').value = 'Dibawah Glory';
    $('winRate').value     = '';
    $('totalRankMatches').value = '';
    $('emblemLevel60').value    = '';
    $('winRateBar').style.width  = '0%';
    $('winRateNote').textContent = 'Isi win rate keseluruhan akun';
    $('emblemCount').textContent = '0/7';
    calcResult = calcCore(); applyResultUI(calcResult);
  });

 
  $('copyResult').addEventListener('click', () => {
    const r = calcResult || calcCore();
    const text = `Estimasi Akun MLBB — ExeRevers Calculator\nHarga: ${formatRp(r.total)}\nGrade: ${r.grade}\nRange: ${formatRp(r.min)} – ${formatRp(r.max)}`;
    navigator.clipboard.writeText(text).then(() => {
      $('copyResult').textContent = '✓ Tersalin!';
      setTimeout(() => $('copyResult').textContent = 'Salin Hasil', 2000);
    });
  });
}

function setupFeedback() {
 
  $('feedbackText').addEventListener('input', function() {
    const len = this.value.length;
    const counter   = $('charCounter');
    const barFill   = $('charBarFill');
    const pct       = (len/500)*100;

    counter.textContent = `${len} / 500`;
    barFill.style.width = pct+'%';

    if (pct > 90)      { counter.className='char-counter danger'; barFill.className='char-bar-fill danger'; }
    else if (pct > 70) { counter.className='char-counter warn';   barFill.className='char-bar-fill warn'; }
    else               { counter.className='char-counter';        barFill.className='char-bar-fill'; }
  });

 
  const stars = $('starRating').querySelectorAll('span');
  stars.forEach(star => {
    star.addEventListener('mouseover', () => {
      const v = +star.dataset.val;
      stars.forEach((s,i) => s.classList.toggle('active', i < v));
    });
    star.addEventListener('click', () => {
      selectedRating = +star.dataset.val;
      const labels = ['','Kurang Akurat','Cukup','Akurat','Bagus!','Sangat Akurat!'];
      $('ratingLabel').textContent = labels[selectedRating];
      stars.forEach((s,i) => s.classList.toggle('active', i < selectedRating));
    });
  });
  $('starRating').addEventListener('mouseleave', () => {
    stars.forEach((s,i) => s.classList.toggle('active', i < selectedRating));
  });

 
  $('submitFeedback').addEventListener('click', submitFeedback);
}

async function submitFeedback() {
  if (!currentUser) return;
  const text = $('feedbackText').value;
  const uid  = currentUser.uid;

 
  const banSnap = await get(ref(db, `users/${uid}/banned`));
  if (banSnap.val()) { showFeedbackMsg('Akunmu dibanned dari mengirim feedback.','error'); return; }

 
  const { ok, clean, errors } = sanitizeAndValidate(text);
  if (!ok) { showFeedbackMsg('⚠ ' + errors.join(' '),'error'); return; }

 
  const cdSnap = await get(ref(db, `users/${uid}/cdfeedback`));
  const lastSent = cdSnap.val();
  if (lastSent) {
    const diff = Date.now() - lastSent;
    if (diff < 86400000) {
      const remaining = Math.ceil((86400000 - diff) / 3600000);
      showFeedbackMsg(`⏳ Kamu sudah kirim feedback hari ini. Coba lagi dalam ${remaining} jam.`, 'warn');
      return;
    }
  }

  $('submitFeedback').disabled = true;
  $('submitFeedback').textContent = 'Mengirim...';

  try {
    const username = currentUserData?.username || currentUser.email?.split('@')[0] || 'User';
    const now = Date.now();

   
    await push(ref(db, 'data/feedback'), {
      By:      username,
      Time:    now,
      Text:    clean,
      rating:  selectedRating,
      uid:     uid
    });

   
    await update(ref(db, `users/${uid}`), { cdfeedback: now });

    updateFeedbackList();
    if ($('allCommentsList')) {
      await loadAllComments();
    }

    $('feedbackText').value = '';
    $('charCounter').textContent = '0 / 500';
    $('charBarFill').style.width = '0%';
    selectedRating = 0;
    $('starRating').querySelectorAll('span').forEach(s => s.classList.remove('active'));
    $('ratingLabel').textContent = '';
    showFeedbackMsg('✓ Feedback berhasil dikirim! Terima kasih.', 'success');
  } catch (err) {
    showFeedbackMsg('Gagal mengirim. Coba lagi.', 'error');
    console.error(err);
  }

  $('submitFeedback').disabled = false;
  $('submitFeedback').textContent = 'Kirim Feedback';
}

function showFeedbackMsg(msg, type) {
  const el = $('feedbackMsg');
  el.textContent = msg;
  el.className = `feedback-msg ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

async function renderComments(listEl, limit = null) {
  const pathsToTry = [
    { path: 'data/feedback', childFn: snap => snap },
    { path: 'feedback', childFn: snap => snap },
    { path: 'data', childFn: snap => snap.child('feedback') }
  ];

  listEl.innerHTML = '';
  const itemMap = new Map();

  for (const source of pathsToTry) {
    const snapshot = await get(ref(db, source.path));
    if (!snapshot.exists()) continue;
    const feedbackSnap = source.childFn(snapshot);
    if (!feedbackSnap.exists()) continue;
    feedbackSnap.forEach(child => {
      const key = child.key;
      if (!key) return;
      if (!itemMap.has(key)) {
        itemMap.set(key, { _key: key, ...child.val() });
      }
    });
  }

  let items = Array.from(itemMap.values());
  try {
    const response = await fetch(new URL('data.json', window.location.href).href);
    if (response.ok) {
      const json = await response.json();
      const localFeedback = json?.data?.feedback || json?.feedback || null;
      if (localFeedback && typeof localFeedback === 'object') {
        Object.entries(localFeedback).forEach(([key, value]) => {
          if (!itemMap.has(key) && value && typeof value === 'object') {
            itemMap.set(key, { _key: key, ...value });
          }
        });
        items = Array.from(itemMap.values());
      }
    }
  } catch (_) {
    // ignore local file read errors
  }

  if (!items.length) {
    listEl.innerHTML = '<div class="loading-indicator">Belum ada komentar.</div>';
    return;
  }

  items.sort((a, b) => (Number(a.Time) || 0) - (Number(b.Time) || 0));
  if (limit !== null) {
    const sliceStart = Math.max(items.length - limit, 0);
    items.splice(0, sliceStart);
  }
  items.reverse();

  for (const item of items) {
    let isBanned = false;
    if (item.uid) {
      try {
        const banSnap = await get(ref(db, `users/${item.uid}/banned`));
        isBanned = banSnap.val() === true;
      } catch (_) {}
    }

    const el = document.createElement('div');
    el.className = 'comment-item' + (isBanned ? ' banned-comment' : '');
    const date = timeAgo(item.Time);
    const initial = (item.By || '?')[0].toUpperCase();
    const starsStr = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '';

    el.innerHTML = `
      <div class="comment-header">
        <div class="comment-user">
          <div class="avatar small" style="background:var(--surface-3)">${initial}</div>
          <div>
            <div class="comment-name">${escHtml(item.By || 'Anonim')}</div>
            <div class="comment-time">${date}</div>
          </div>
        </div>
        <div class="comment-meta">
          ${starsStr ? `<div class="comment-stars">${starsStr}</div>` : ''}
          ${isBanned ? `<span class="comment-banned-tag">BANNED</span>` : ''}
        </div>
      </div>
      <div class="comment-text">${escHtml(item.Text || '')}</div>
    `;

    if (item.adminReply) {
      const replyEl = document.createElement('div');
      replyEl.className = 'comment-reply';
      replyEl.innerHTML = `<strong>Balasan Admin:</strong> ${escHtml(item.adminReply)}`;
      el.appendChild(replyEl);
    }

    if (currentUserData?.owner || currentUserData?.staff) {
      const adminActions = document.createElement('div');
      adminActions.className = 'comment-admin-actions';
      adminActions.innerHTML = `
        <button class="btn-ghost tiny" data-action="delete" data-comment="${item._key}">Hapus</button>
        <button class="btn-ghost tiny" data-action="reply" data-comment="${item._key}">Balas</button>
      `;
      adminActions.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!currentUserData?.owner && !currentUserData?.staff) {
          alert('Akses ditolak.');
          return;
        }
        if (!confirm('Hapus komentar ini?')) return;
        await remove(ref(db, `data/feedback/${item._key}`));
        await renderComments(listEl, limit);
      });
      adminActions.querySelector('[data-action="reply"]').addEventListener('click', async () => {
        if (!currentUserData?.owner && !currentUserData?.staff) {
          alert('Akses ditolak.');
          return;
        }
        const reply = prompt('Masukkan balasan admin untuk komentar ini:');
        if (!reply) return;
        await update(ref(db, `data/feedback/${item._key}`), {
          adminReply: reply,
          adminReplyAt: Date.now(),
          adminReplyBy: currentUser.uid
        });
        await renderComments(listEl, limit);
      });
      el.appendChild(adminActions);
    }

    listEl.appendChild(el);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setupAnnouncement() {
  const banner = $('announcementBanner');
  const textEl = $('announcementText');
  const closeBtn = $('announceCloseBtn');
  closeBtn.addEventListener('click', () => banner.classList.add('hidden'));
  onValue(ref(db, 'data/announcement'), snap => {
    const msg = snap.val();
    if (!msg) {
      banner.classList.add('hidden');
      return;
    }
    textEl.textContent = msg;
    banner.classList.remove('hidden');
  });
}

async function loadAllComments() {
  const listEl = $('allCommentsList');
  if (!listEl) return;
  await renderComments(listEl, null);
  const viewBtn = $('viewAllCommentsBtn');
  const backBtn = $('backToHomeBtn');
  if (viewBtn) viewBtn.addEventListener('click', () => showPage('allfeedback'));
  if (backBtn) backBtn.addEventListener('click', () => showPage('home'));
}

async function loadComments() {
  const list = $('commentsList');
  if (!list) return;
  await renderComments(list, 6);
}

function updateFeedbackList() {
  const listEl = $('commentsList');
  if (listEl) renderComments(listEl, 6);
}

function setupAdminConsole() {
  $('consoleClose').addEventListener('click', () => $('adminConsole').classList.add('hidden'));

  const input  = $('consoleInput');
  const send   = $('consoleSend');
  const output = $('consoleOutput');

  function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    addLine(`$ ${trimmed}`, 'cmd');
    const parts = trimmed.split(/\s+/);
    const cmd   = parts[0].toLowerCase();

    switch (cmd) {
      case '/help':
        addLine('/ban [uid] [hari] [alasan]  —  Ban akun user','info');
        addLine('/unban [uid]  —  Hapus ban user','info');
        addLine('/userinfo [uid]  —  Lihat data user','info');
        addLine('/find [username|uid]  —  Cari user berdasarkan username atau UID','info');
        addLine('/announce [pesan]  —  Kirim announcement publik','info');
        addLine('/hapusannounce  —  Hapus announcement','info');
        addLine('/clear  —  Bersihkan console','info');
        break;
      case '/ban':
        cmdBan(parts);
        break;
      case '/unban':
        cmdUnban(parts);
        break;
      case '/userinfo':
        cmdUserInfo(parts);
        break;
      case '/find':
        cmdFind(parts);
        break;
      case '/announce':
        cmdAnnounce(parts);
        break;
      case '/hapusannounce':
        cmdRemoveAnnouncement();
        break;
      case '/clear':
        output.innerHTML = '';
        break;
      default:
        addLine(`Perintah tidak dikenal: ${cmd}. Ketik /help.`, 'error');
    }
    input.value = '';
  }

  send.addEventListener('click', () => runCmd(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') runCmd(input.value); });

  function addLine(text, type='') {
    const el = document.createElement('div');
    el.className = `co-line ${type}`;
    el.textContent = text;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }

  async function cmdBan(parts) {
   
    if (!currentUser) return;
    if (parts.length < 4) { addLine('Format: /ban [uid] [hari] [alasan]','error'); return; }
    const targetUid = parts[1];
    const days      = parseInt(parts[2]);
    const reason    = parts.slice(3).join(' ');

    if (isNaN(days) || days < 1) { addLine('Hari harus angka valid.','error'); return; }

   
    const callerSnap = await get(ref(db, `users/${currentUser.uid}`));
    const caller = callerSnap.val();
    if (!caller?.owner && !caller?.staff) { addLine('Akses ditolak.','error'); return; }

    try {
      const banUntil = Date.now() + days * 86400000;
      await update(ref(db, `users/${targetUid}`), {
        banned:    true,
        banReason: reason,
        banUntil:  banUntil,
        bannedBy:  currentUser.uid,
        bannedAt:  Date.now()
      });
      addLine(`✓ UID ${targetUid} dibanned selama ${days} hari. Alasan: ${reason}`,'success');
    } catch(err) {
      addLine('Gagal ban: ' + err.message,'error');
    }
  }

  async function cmdUnban(parts) {
    if (!currentUser) return;
    if (parts.length < 2) { addLine('Format: /unban [uid]','error'); return; }
    const targetUid = parts[1];

    const callerSnap = await get(ref(db, `users/${currentUser.uid}`));
    const caller = callerSnap.val();
    if (!caller?.owner && !caller?.staff) { addLine('Akses ditolak.','error'); return; }

    try {
      await update(ref(db, `users/${targetUid}`), {
        banned:    false,
        banReason: null,
        banUntil:  null
      });
      addLine(`✓ UID ${targetUid} berhasil diunban.`, 'success');
    } catch(err) {
      addLine('Gagal unban: ' + err.message,'error');
    }
  }

  async function cmdUserInfo(parts) {
    if (parts.length < 2) { addLine('Format: /userinfo [uid]','error'); return; }
    const targetUid = parts[1];
    await showUserInfoByUid(targetUid, addLine);
  }

  async function cmdFind(parts) {
    if (parts.length < 2) { addLine('Format: /find [username|uid]','error'); return; }
    const queryText = parts.slice(1).join(' ').trim();
    if (!queryText) { addLine('Masukkan username atau UID untuk dicari.','error'); return; }
    if (queryText.length === 28 && queryText.startsWith('uid')) {
      await showUserInfoByUid(queryText, addLine);
      return;
    }
    const usernameKey = queryText.toLowerCase();
    const mappingSnap = await get(ref(db, `usernames/${usernameKey}`));
    if (!mappingSnap.exists()) {
      addLine(`User tidak ditemukan: ${queryText}`,'error');
      return;
    }
    const targetUid = mappingSnap.val();
    await showUserInfoByUid(targetUid, addLine);
  }

  async function cmdAnnounce(parts) {
    if (!currentUser) return;
    const callerSnap = await get(ref(db, `users/${currentUser.uid}`));
    const caller = callerSnap.val();
    if (!caller?.owner && !caller?.staff) { addLine('Akses ditolak.','error'); return; }
    const message = parts.slice(1).join(' ').trim();
    if (!message) { addLine('Format: /announce [pesan]','error'); return; }
    try {
      await set(ref(db, 'data/announcement'), message);
      addLine('✓ Announcement dikirim.','success');
    } catch (err) {
      addLine('Gagal kirim announcement: ' + err.message,'error');
    }
  }

  async function cmdRemoveAnnouncement() {
    if (!currentUser) return;
    const callerSnap = await get(ref(db, `users/${currentUser.uid}`));
    const caller = callerSnap.val();
    if (!caller?.owner && !caller?.staff) { addLine('Akses ditolak.','error'); return; }
    try {
      await remove(ref(db, 'data/announcement'));
      addLine('✓ Announcement dihapus.','success');
    } catch (err) {
      addLine('Gagal hapus announcement: ' + err.message,'error');
    }
  }

  async function showUserInfoByUid(targetUid, addLine) {
    try {
      const snap = await get(ref(db, `users/${targetUid}`));
      if (!snap.exists()) { addLine('User tidak ditemukan.','error'); return; }
      const u = snap.val();
      addLine(`── User Info: ${targetUid} ──`,'info');
      addLine(`Username : ${u.username || '-'}`, 'info');
      addLine(`Email    : ${u.email || '-'}`, 'info');
      addLine(`Banned   : ${u.banned ? '✕ YA' : '✓ Tidak'}`, u.banned?'error':'success');
      if (u.banned) {
        addLine(`Alasan   : ${u.banReason || '-'}`, 'info');
        addLine(`Sampai   : ${u.banUntil ? new Date(u.banUntil).toLocaleDateString('id-ID') : '-'}`, 'info');
      }
      addLine(`Owner    : ${u.owner ? 'Ya' : 'Tidak'}`, 'info');
      addLine(`Staff    : ${u.staff ? 'Ya' : 'Tidak'}`, 'info');
      addLine(`Daftar   : ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}`, 'info');
      addLine(`UID      : ${targetUid}`, 'info');
    } catch(err) {
      addLine('Gagal fetch: ' + err.message,'error');
    }
  }
}
