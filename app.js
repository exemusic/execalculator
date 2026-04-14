// =============================================
// EXEREVERS CALCULATOR — app.js
// Firebase Auth + Realtime DB + Calculator Logic
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js";

// ── FIREBASE INIT ──
const firebaseConfig = {
  apiKey: "AIzaSyBmQTAmey1i6L0YYP2eoRYHFds3D2OnimI",
  authDomain: "exereversdb.firebaseapp.com",
  databaseURL: "https://exereversdb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "exereversdb",
  storageBucket: "exereversdb.firebasestorage.app",
  messagingSenderId: "864680081163",
  appId: "1:864680081163:web:1e1d743e607d0852df940e",
  measurementId: "G-YTW0JFGG7X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// ── DOM REFS ──
const $  = id => document.getElementById(id);
const authArea    = $('authArea');
const userArea    = $('userArea');
const userAvatar  = $('userAvatar');
const userEmail   = $('userEmail');
const loginBtn    = $('loginBtn');
const signupBtn   = $('signupBtn');
const logoutBtn   = $('logoutBtn');

const authModal   = $('authModal');
const modalClose  = $('modalClose');
const tabLogin    = $('tabLogin');
const tabSignup   = $('tabSignup');
const loginPanel  = $('loginPanel');
const signupPanel = $('signupPanel');

const doLogin     = $('doLogin');
const doSignup    = $('doSignup');
const googleLoginBtn  = $('googleLoginBtn');
const googleSignupBtn = $('googleSignupBtn');
const loginError  = $('loginError');
const signupError = $('signupError');

const feedbackGate = $('feedbackGate');
const feedbackForm = $('feedbackForm');
const feedbackText = $('feedbackText');
const submitFeedback = $('submitFeedback');
const feedbackMsg  = $('feedbackMsg');
const formAvatar   = $('formAvatar');
const formUsername = $('formUsername');
const gateLoginBtn = $('gateLoginBtn');
const starRating   = $('starRating');
const ratingLabel  = $('ratingLabel');
const commentsList = $('commentsList');

let currentUser = null;
let selectedRating = 0;

// ── FORMAT CURRENCY ──
function formatRupiah(num) {
  if (num === 0) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// ── CALCULATOR CORE ──
const PRICES = {
  // Base rank score (Rp)
  rank: {
    'Warrior':          0,
    'Mythic':           100000,
    'Mythical Honor':   250000,
    'Mythical Glory':   500000,
    'Mythical Immortal': 850000
  },
  // Historical rank bonus
  highestRank: {
    'Dibawah Glory':    0,
    'Glory Biasa':      150000,
    'Immortal Biasa':   350000,
    'Immortal Dewa':    700000
  },
  // Skin per-unit price
  skinRareLim:    2500000,  // Unobtainable
  skinLegendLim:  700000,   // Supreme 4000 limited
  skinLegend:     500000,   // Supreme 4000 magic wheel
  skinGrand:      300000,   // Grand 3000
  skinExquisite:  120000,   // Exquisite 2000
  skinDeluxe:     30000,    // Deluxe 400
  recallEffect:   60000,
  borderLimited:  25000,
  emblemLevel60:  40000     // per max emblem
};

function calculate() {
  const tier         = $('tier').value;
  const highestTier  = $('highestTier').value;
  const winRate      = parseFloat($('winRate').value) || 0;
  const totalMatches = parseInt($('totalRankMatches').value) || 0;
  const emblems      = Math.min(parseInt($('emblemLevel60').value) || 0, 7);

  const skinRareLim   = parseInt($('skinRareLim').value)   || 0;
  const skinLegendLim = parseInt($('skinLegendLim').value) || 0;
  const skinLegend    = parseInt($('skinLegend').value)    || 0;
  const skinGrand     = parseInt($('skinGrand').value)     || 0;
  const skinExquisite = parseInt($('skinExquisite').value) || 0;
  const skinDeluxe    = parseInt($('skinDeluxe').value)    || 0;
  const recallEffect  = parseInt($('recallEffect').value)  || 0;
  const borderLimited = parseInt($('borderLimited').value) || 0;

  // Component values
  const rankVal    = PRICES.rank[tier] || 0;
  const histVal    = PRICES.highestRank[highestTier] || 0;
  const emblemVal  = emblems * PRICES.emblemLevel60;

  const skinVal =
    skinRareLim   * PRICES.skinRareLim   +
    skinLegendLim * PRICES.skinLegendLim +
    skinLegend    * PRICES.skinLegend    +
    skinGrand     * PRICES.skinGrand     +
    skinExquisite * PRICES.skinExquisite +
    skinDeluxe    * PRICES.skinDeluxe    +
    recallEffect  * PRICES.recallEffect  +
    borderLimited * PRICES.borderLimited;

  // Win rate / pro bonus
  let bonusVal = 0;
  if (winRate > 70 && totalMatches >= 5000) {
    bonusVal = (rankVal + histVal + skinVal) * 0.15;
  } else if (winRate > 65 && totalMatches >= 3000) {
    bonusVal = (rankVal + histVal + skinVal) * 0.08;
  }

  const total = rankVal + histVal + emblemVal + skinVal + bonusVal;

  // Score for meter (0-100)
  const maxScore = 15000000;
  const score = Math.min((total / maxScore) * 100, 100);

  // Grade
  let grade, gradeStyle;
  if (total === 0)             { grade = '—';         gradeStyle = ''; }
  else if (total < 200000)     { grade = 'Starter';   gradeStyle = 'background:#F1F5F9;color:#64748B;'; }
  else if (total < 600000)     { grade = 'Casual';    gradeStyle = 'background:#DCFCE7;color:#166534;border-color:#BBF7D0;'; }
  else if (total < 1500000)    { grade = 'Solid';     gradeStyle = 'background:#DBEAFE;color:#1D4ED8;border-color:#BFDBFE;'; }
  else if (total < 3000000)    { grade = 'Premium';   gradeStyle = 'background:#EDE9FE;color:#6D28D9;border-color:#DDD6FE;'; }
  else if (total < 7000000)    { grade = 'Elite';     gradeStyle = 'background:#FEF3C7;color:#92400E;border-color:#FDE68A;'; }
  else                         { grade = 'Rare';      gradeStyle = 'background:#FEE2E2;color:#991B1B;border-color:#FECACA;'; }

  return {
    total, rankVal, histVal, emblemVal, skinVal, bonusVal,
    score, grade, gradeStyle,
    min: total * 0.75,
    max: total * 1.3
  };
}

function applyResult(res) {
  const { total, rankVal, histVal, emblemVal, skinVal, bonusVal, score, grade, gradeStyle, min, max } = res;

  // Update main result
  $('resultPrice').textContent = formatRupiah(total);
  $('heroLivePrice').textContent = formatRupiah(total);
  $('resultGrade').textContent = grade;
  $('resultGrade').style.cssText = gradeStyle + 'padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid;';
  $('meterFill').style.width = score + '%';

  if (total > 0) {
    $('resultRange').textContent = `Estimasi pasar: ${formatRupiah(min)} — ${formatRupiah(max)}`;
  } else {
    $('resultRange').textContent = '';
  }

  // Breakdown
  const bd = $('priceBreakdown');
  bd.innerHTML = '';
  const items = [
    { label: 'Rank Saat Ini',   val: rankVal,   color: '#2563EB' },
    { label: 'Riwayat Rank',    val: histVal,   color: '#7C3AED' },
    { label: 'Koleksi Skin',    val: skinVal,   color: '#DC2626' },
    { label: 'Emblem Max',      val: emblemVal, color: '#D97706' },
    { label: 'Bonus Pro WR',    val: bonusVal,  color: '#16A34A' }
  ];
  items.forEach(item => {
    if (item.val <= 0) return;
    const el = document.createElement('div');
    el.className = 'breakdown-item';
    el.innerHTML = `
      <span class="bd-label">
        <span class="bd-dot" style="background:${item.color}"></span>
        ${item.label}
      </span>
      <span class="bd-val">${formatRupiah(item.val)}</span>
    `;
    bd.appendChild(el);
  });

  // Hero bars
  const maxBar = Math.max(rankVal + histVal, skinVal, emblemVal, bonusVal, 1);
  $('barRank').style.width  = Math.min(((rankVal + histVal) / maxBar) * 100, 100) + '%';
  $('barSkin').style.width  = Math.min((skinVal / maxBar) * 100, 100) + '%';
  $('barEmblem').style.width = Math.min((emblemVal / maxBar) * 100, 100) + '%';
  $('barBonus').style.width = Math.min((bonusVal / maxBar) * 100, 100) + '%';

  // Share link
  const msg = `Estimasi akun MLBB saya: ${formatRupiah(total)} (Grade: ${grade}) — dihitung pakai ExeRevers Calculator`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  $('shareWa').href = waUrl;
}

// Live update on any input change
function setupLiveUpdate() {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    el.addEventListener('input', () => applyResult(calculate()));
    el.addEventListener('change', () => applyResult(calculate()));
  });
}

// Manual calculate button
$('calculateBtn').addEventListener('click', () => {
  applyResult(calculate());
  // Scroll to result on mobile
  if (window.innerWidth < 900) {
    document.querySelector('.result-col').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// Reset
$('resetBtn').addEventListener('click', () => {
  document.querySelectorAll('input[type="number"]').forEach(el => {
    el.value = el.min || '0';
    if (el.closest('.tier-input')) el.value = '0';
  });
  $('tier').value = 'Warrior';
  $('highestTier').value = 'Dibawah Glory';
  $('winRate').value = '';
  $('totalRankMatches').value = '';
  $('emblemLevel60').value = '';
  $('winRateBar').style.width = '0%';
  $('winRateNote').textContent = 'Isi win rate keseluruhan akun';
  $('emblemCount').textContent = '0/7';
  applyResult(calculate());
});

// Win rate progress bar
$('winRate').addEventListener('input', function() {
  const val = Math.min(parseFloat(this.value) || 0, 100);
  $('winRateBar').style.width = val + '%';
  if (val > 70) $('winRateNote').textContent = '🔥 Pro player! Bonus valuasi aktif jika match ≥ 5000';
  else if (val > 55) $('winRateNote').textContent = '✅ Win rate bagus';
  else $('winRateNote').textContent = 'Win rate standar pasar';
});

// Emblem counter display
$('emblemLevel60').addEventListener('input', function() {
  const val = Math.min(parseInt(this.value) || 0, 7);
  $('emblemCount').textContent = val + '/7';
  if (val > 7) this.value = 7;
});

// Qty buttons
document.querySelectorAll('.qty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const action   = btn.dataset.action;
    const input    = $(targetId);
    let val = parseInt(input.value) || 0;
    if (action === 'plus')  val = Math.max(0, val + 1);
    if (action === 'minus') val = Math.max(0, val - 1);
    input.value = val;
    applyResult(calculate());
  });
});

// Copy result
$('copyResult').addEventListener('click', () => {
  const res = calculate();
  const text = `Estimasi Akun MLBB — ExeRevers Calculator\nHarga: ${formatRupiah(res.total)}\nGrade: ${res.grade}\nRange: ${formatRupiah(res.min)} – ${formatRupiah(res.max)}`;
  navigator.clipboard.writeText(text).then(() => {
    $('copyResult').textContent = '✓ Tersalin!';
    setTimeout(() => $('copyResult').textContent = 'Salin Hasil', 2000);
  });
});

// ── AUTH MODAL ──
function openModal(tab = 'login') {
  authModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (tab === 'signup') switchTab('signup');
  else switchTab('login');
}
function closeModal() {
  authModal.classList.add('hidden');
  document.body.style.overflow = '';
  loginError.classList.add('hidden');
  signupError.classList.add('hidden');
}
function switchTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginPanel.classList.remove('hidden');
    signupPanel.classList.add('hidden');
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
  }
}

loginBtn.addEventListener('click', () => openModal('login'));
signupBtn.addEventListener('click', () => openModal('signup'));
gateLoginBtn.addEventListener('click', () => openModal('login'));
modalClose.addEventListener('click', closeModal);
authModal.addEventListener('click', e => { if (e.target === authModal) closeModal(); });
tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));

// Email/pass login
doLogin.addEventListener('click', async () => {
  loginError.classList.add('hidden');
  const email = $('loginEmail').value.trim();
  const pass  = $('loginPass').value;
  if (!email || !pass) { showError(loginError, 'Email dan password wajib diisi.'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal();
  } catch (err) {
    showError(loginError, getAuthError(err.code));
  }
});

// Email/pass signup
doSignup.addEventListener('click', async () => {
  signupError.classList.add('hidden');
  const name  = $('signupName').value.trim();
  const email = $('signupEmail').value.trim();
  const pass  = $('signupPass').value;
  if (!name || !email || !pass) { showError(signupError, 'Semua field wajib diisi.'); return; }
  if (pass.length < 6) { showError(signupError, 'Password minimal 6 karakter.'); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    closeModal();
  } catch (err) {
    showError(signupError, getAuthError(err.code));
  }
});

// Google login
async function googleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
    closeModal();
  } catch (err) {
    console.error(err);
  }
}
googleLoginBtn.addEventListener('click', googleLogin);
googleSignupBtn.addEventListener('click', googleLogin);

logoutBtn.addEventListener('click', () => signOut(auth));

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function getAuthError(code) {
  const map = {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/user-not-found': 'Akun tidak ditemukan.',
    'auth/wrong-password': 'Password salah.',
    'auth/email-already-in-use': 'Email sudah terdaftar.',
    'auth/weak-password': 'Password terlalu lemah.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/popup-closed-by-user': 'Login dibatalkan.'
  };
  return map[code] || 'Terjadi kesalahan. Coba lagi.';
}

// ── AUTH STATE ──
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    // Show user area
    authArea.classList.add('hidden');
    userArea.classList.remove('hidden');
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    userAvatar.textContent = initial;
    userEmail.textContent = user.displayName || user.email;

    // Show feedback form
    feedbackGate.classList.add('hidden');
    feedbackForm.classList.remove('hidden');
    formAvatar.textContent = initial;
    formUsername.textContent = user.displayName || user.email;
  } else {
    authArea.classList.remove('hidden');
    userArea.classList.add('hidden');
    feedbackGate.classList.remove('hidden');
    feedbackForm.classList.add('hidden');
  }
});

// ── STAR RATING ──
const stars = starRating.querySelectorAll('span');
stars.forEach(star => {
  star.addEventListener('mouseover', () => {
    const val = parseInt(star.dataset.val);
    stars.forEach((s, i) => s.classList.toggle('active', i < val));
  });
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.val);
    const labels = ['', 'Kurang Akurat', 'Cukup', 'Akurat', 'Bagus!', 'Sangat Akurat!'];
    ratingLabel.textContent = labels[selectedRating];
    stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
  });
});
starRating.addEventListener('mouseleave', () => {
  stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
});

// ── SUBMIT FEEDBACK ──
submitFeedback.addEventListener('click', async () => {
  if (!currentUser) return;
  const text = feedbackText.value.trim();
  if (!text) {
    showFeedbackMsg('Tulis dulu pesanmu sebelum mengirim.', 'error');
    return;
  }

  submitFeedback.disabled = true;
  submitFeedback.textContent = 'Mengirim...';

  try {
    await push(ref(db, 'feedbacks'), {
      uid:       currentUser.uid,
      name:      currentUser.displayName || currentUser.email.split('@')[0],
      email:     currentUser.email,
      text:      text,
      rating:    selectedRating,
      timestamp: Date.now()
    });

    feedbackText.value = '';
    selectedRating = 0;
    stars.forEach(s => s.classList.remove('active'));
    ratingLabel.textContent = '';
    showFeedbackMsg('✓ Feedback berhasil dikirim! Terima kasih.', 'success');
  } catch (err) {
    showFeedbackMsg('Gagal mengirim. Coba lagi.', 'error');
    console.error(err);
  }

  submitFeedback.disabled = false;
  submitFeedback.textContent = 'Kirim Feedback';
});

function showFeedbackMsg(msg, type) {
  feedbackMsg.textContent = msg;
  feedbackMsg.className = `feedback-msg ${type}`;
  feedbackMsg.classList.remove('hidden');
  setTimeout(() => feedbackMsg.classList.add('hidden'), 4000);
}

// ── LOAD COMMENTS ──
function loadComments() {
  const q = query(ref(db, 'feedbacks'), orderByChild('timestamp'), limitToLast(20));
  onValue(q, snapshot => {
    commentsList.innerHTML = '';
    if (!snapshot.exists()) {
      commentsList.innerHTML = '<div class="loading-indicator">Belum ada komentar. Jadilah yang pertama!</div>';
      return;
    }

    const items = [];
    snapshot.forEach(child => items.push({ id: child.key, ...child.val() }));
    items.reverse().forEach(item => {
      const el = document.createElement('div');
      el.className = 'comment-item';
      const date = new Date(item.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      const initial = (item.name || '?')[0].toUpperCase();
      const stars = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '';
      el.innerHTML = `
        <div class="comment-header">
          <div class="comment-user">
            <div class="avatar small" style="background:#334155">${initial}</div>
            <div>
              <div class="comment-name">${escapeHtml(item.name)}</div>
              <div class="comment-time">${date}</div>
            </div>
          </div>
          ${stars ? `<div class="comment-stars">${stars}</div>` : ''}
        </div>
        <div class="comment-text">${escapeHtml(item.text)}</div>
      `;
      commentsList.appendChild(el);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──
setupLiveUpdate();
loadComments();
applyResult(calculate());
