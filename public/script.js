/* ==================== State ==================== */
let currentData = null;
let summaryMode = 'bullets';
let currentUserEmail = '';

/* ==================== Content Filter ==================== */
const EXPLICIT_PATTERNS = [
  /セックス/, /性交/, /性行為/, /射精/, /オナニー/, /マスターベーション/,
  /フェラ[チオ]?/, /クンニ/, /手マン/, /アナル.*性/, /性器/, /陰茎/, /陰部/,
  /まんこ/, /ちんこ/, /ちんぽ/, /おちんちん/, /おまんこ/, /膣内/,
  /挿入.*性/, /性的.*挿入/, /エロ動画/, /ポルノ/, /AV女優/, /風俗.*体験/,
  /淫乱/, /淫靡/, /淫行/, /強姦/, /レイプ/, /痴漢.*行為/,
];
function checkExplicitContent(text) {
  return EXPLICIT_PATTERNS.some(p => p.test(text));
}

/* ==================== Profile ==================== */
const PROFILE_KEY = 'nagabun_profile';
const AVATARS = ['🪐','🌍','🌙','🌟','🚀','🛸','☄️','🌌','👨‍🚀','🌠','⭐','🌑','🔭','🌞','💫'];

/* ==================== Tickets ==================== */
const TICKET_KEY = 'nagabun_tickets';
let usingTicket = false;

function getTickets() {
  try { return parseInt(localStorage.getItem(TICKET_KEY) || '0', 10); } catch { return 0; }
}
function useTicket() {
  const t = getTickets();
  if (t <= 0) return false;
  localStorage.setItem(TICKET_KEY, String(t - 1));
  updateUsageBadge();
  return true;
}
function addTickets(n) {
  localStorage.setItem(TICKET_KEY, String(getTickets() + n));
  updateUsageBadge();
}

function resizeImageToDataURL(file, maxPx, quality, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ==================== Usage ==================== */
// サブスク: 1日10回 / 無料: 1ヶ月3回
const USAGE_KEY         = 'nagabun_usage';
const MONTHLY_USAGE_KEY = 'nagabun_monthly_usage';
const DAILY_LIMIT_PRO   = 10;
const MONTHLY_LIMIT_FREE = 3;

function getToday() {
  return new Date().toLocaleDateString('ja-JP');
}
function getThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// サブスク用（日次）
function getTodayUsage() {
  try {
    const d = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
    return d.date === getToday() ? (d.count || 0) : 0;
  } catch { return 0; }
}
function incrementDailyUsage() {
  const count = getTodayUsage() + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify({ date: getToday(), count }));
  updateUsageBadge();
}

// 無料用（月次）
function getMonthUsage() {
  try {
    const d = JSON.parse(localStorage.getItem(MONTHLY_USAGE_KEY) || '{}');
    return d.month === getThisMonth() ? (d.count || 0) : 0;
  } catch { return 0; }
}
function incrementMonthUsage() {
  const count = getMonthUsage() + 1;
  localStorage.setItem(MONTHLY_USAGE_KEY, JSON.stringify({ month: getThisMonth(), count }));
  updateUsageBadge();
}

// 統一インターフェース
function getEffectiveUsage() { return isSubscribed ? getTodayUsage() : getMonthUsage(); }
function getEffectiveLimit() { return isSubscribed ? DAILY_LIMIT_PRO : MONTHLY_LIMIT_FREE; }
function incrementUsage()    { if (isSubscribed) incrementDailyUsage(); else incrementMonthUsage(); }

function updateUsageBadge() {
  const badge = document.getElementById('usage-badge');
  if (!badge) return;
  const used    = getEffectiveUsage();
  const limit   = getEffectiveLimit();
  const left    = Math.max(0, limit - used);
  const tickets = getTickets();
  const period  = isSubscribed ? '本日' : '今月';
  if (left > 0) {
    badge.textContent = `${period}あと ${left} 回`;
    badge.className = 'usage-badge';
  } else if (tickets > 0) {
    badge.textContent = `🎫 回数券 ${tickets} 枚`;
    badge.className = 'usage-badge usage-ticket';
  } else {
    badge.textContent = `${period}あと 0 回`;
    badge.className = 'usage-badge usage-zero';
  }
}

/* ==================== DOM Ready ==================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('analyze-btn').addEventListener('click', analyze);
  document.getElementById('history-clear').addEventListener('click', clearHistory);
  renderHistory();

  // ログイン処理
  const ACCOUNTS = [
    { email: 'Rindo22@outlook.com', pass: 'Rinrin22', subscribed: true },
  ];

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; }
  }

  function applyProfileToHeader() {
    const p = loadProfile();
    const avatarEl = document.getElementById('user-avatar');
    if (p.avatarImg) {
      avatarEl.innerHTML = `<img src="${p.avatarImg}" class="user-avatar-img" alt="avatar">`;
    } else {
      avatarEl.textContent = p.avatar || '🚀';
    }
    document.getElementById('user-name').textContent =
      p.username || currentUserEmail.split('@')[0] || 'ユーザー';
  }

  function applyLogin(email, subscribed) {
    isSubscribed = subscribed;
    currentUserEmail = email;
    localStorage.setItem('nagabun_session', JSON.stringify({ email, subscribed }));
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('account-btn').classList.add('hidden');
    if (subscribed) document.getElementById('subscribe-btn').classList.add('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    applyProfileToHeader();
    updateUsageBadge();
    renderHistory();
  }

  function doLogout() {
    isSubscribed = false;
    currentUserEmail = '';
    localStorage.removeItem('nagabun_session');
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('account-btn').classList.remove('hidden');
    document.getElementById('subscribe-btn').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('user-avatar').textContent = '🚀';
    document.getElementById('user-name').textContent = 'ユーザー';
    updateUsageBadge();
    renderHistory();
  }

  // ページ読み込み時にセッション復元
  const savedSession = JSON.parse(localStorage.getItem('nagabun_session') || 'null');
  if (savedSession) applyLogin(savedSession.email, savedSession.subscribed);

  document.getElementById('login-btn').addEventListener('click', () =>
    document.getElementById('modal-login').classList.remove('hidden'));

  document.getElementById('login-submit').addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    const account = ACCOUNTS.find(a => a.email === email && a.pass === pass);
    if (account) {
      errEl.classList.add('hidden');
      document.getElementById('modal-login').classList.add('hidden');
      applyLogin(account.email, account.subscribed);
    } else {
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', doLogout);

  // モーダル開閉
  document.getElementById('account-btn').addEventListener('click', () =>
    document.getElementById('modal-account').classList.remove('hidden'));
  document.getElementById('subscribe-btn').addEventListener('click', () =>
    document.getElementById('modal-subscribe').classList.remove('hidden'));
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () =>
      document.getElementById(btn.dataset.modal).classList.add('hidden'));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    let downOnOverlay = false;
    overlay.addEventListener('mousedown', e => {
      downOnOverlay = e.target === overlay;
    });
    overlay.addEventListener('mouseup', e => {
      if (downOnOverlay && e.target === overlay) overlay.classList.add('hidden');
      downOnOverlay = false;
    });
  });

  // アカウント設定モーダル
  let selectedAvatar = '🚀';
  let selectedAvatarImg = null;

  function setSettingsPreview(img, emoji) {
    const el = document.getElementById('settings-avatar-preview');
    if (img) {
      el.innerHTML = `<img src="${img}" class="avatar-preview-img" alt="avatar">`;
    } else {
      el.innerHTML = '';
      el.textContent = emoji || '🚀';
    }
  }

  document.getElementById('settings-btn').addEventListener('click', () => {
    const p = loadProfile();
    selectedAvatar    = p.avatar    || '🚀';
    selectedAvatarImg = p.avatarImg || null;
    setSettingsPreview(selectedAvatarImg, selectedAvatar);
    document.getElementById('settings-username').value = p.username || '';
    document.getElementById('settings-email-display').textContent = currentUserEmail;

    const grid = document.getElementById('avatar-grid');
    grid.innerHTML = '';
    AVATARS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'avatar-option' + (!selectedAvatarImg && emoji === selectedAvatar ? ' selected' : '');
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        selectedAvatar    = emoji;
        selectedAvatarImg = null;
        setSettingsPreview(null, emoji);
        grid.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });

    document.getElementById('modal-settings').classList.remove('hidden');
  });

  document.getElementById('avatar-upload-btn').addEventListener('click', () => {
    document.getElementById('avatar-upload-input').click();
  });
  document.getElementById('avatar-upload-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImageToDataURL(file, 150, 0.85, dataUrl => {
      selectedAvatarImg = dataUrl;
      setSettingsPreview(dataUrl, null);
      document.querySelectorAll('#avatar-grid .avatar-option').forEach(b => b.classList.remove('selected'));
    });
    e.target.value = '';
  });

  document.getElementById('settings-save').addEventListener('click', () => {
    const username = document.getElementById('settings-username').value.trim();
    const existing  = loadProfile();
    const newProfile = { ...existing, username };
    if (selectedAvatarImg) {
      newProfile.avatarImg = selectedAvatarImg;
      delete newProfile.avatar;
    } else {
      newProfile.avatar = selectedAvatar;
      delete newProfile.avatarImg;
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
    applyProfileToHeader();
    document.getElementById('modal-settings').classList.add('hidden');
  });

  // 回数券購入モーダル
  // 利用規約
  document.getElementById('terms-link').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('modal-terms').classList.remove('hidden');
  });

  // ==================== 決済処理 ====================

  // モーダルを閉じるヘルパー
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
  function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }

  // 決済後の処理（Stripe・PayPay共通）
  function handlePaymentSuccess(type, email) {
    closeModal('modal-paypay');
    closeModal('modal-subscribe');
    closeModal('modal-ticket');
    if (type === 'subscribe') {
      applyLogin(email || currentUserEmail, true);
      alert('🎉 サブスクに登録されました！一日10回まで使えます。');
    } else if (type === 'ticket') {
      addTickets(5);
      updateUsageBadge();
      alert('🎫 回数券5回分が追加されました！');
    }
  }

  // ---- Stripe ----
  async function startStripeCheckout(type) {
    if (!currentUserEmail) {
      closeModal(type === 'subscribe' ? 'modal-subscribe' : 'modal-ticket');
      openModal('modal-login');
      return;
    }
    const btnId = type === 'subscribe' ? 'stripe-subscribe-btn' : 'stripe-ticket-btn';
    const btn = document.getElementById(btnId);
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '処理中...';
    try {
      const endpoint = type === 'subscribe' ? '/api/checkout/subscribe' : '/api/checkout/ticket';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || '決済ページへの接続に失敗しました');
        btn.disabled = false;
        btn.textContent = origText;
      }
    } catch (err) {
      alert('エラー: ' + err.message);
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  document.getElementById('stripe-subscribe-btn').addEventListener('click', () => startStripeCheckout('subscribe'));
  document.getElementById('stripe-ticket-btn').addEventListener('click',    () => startStripeCheckout('ticket'));

  // ---- PayPay ----
  let payPayPollTimer = null;

  async function startPayPay(type) {
    if (!currentUserEmail) {
      closeModal(type === 'subscribe' ? 'modal-subscribe' : 'modal-ticket');
      openModal('modal-login');
      return;
    }
    const btnId = type === 'subscribe' ? 'paypay-subscribe-btn' : 'paypay-ticket-btn';
    const btn = document.getElementById(btnId);
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'QR生成中...';
    try {
      const res = await fetch('/api/paypay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUserEmail, type }),
      });
      const data = await res.json();
      if (data.qrImageDataUrl) {
        closeModal(type === 'subscribe' ? 'modal-subscribe' : 'modal-ticket');
        document.getElementById('paypay-qr-img').src = data.qrImageDataUrl;
        document.getElementById('paypay-direct-link').href = data.qrCodeUrl;
        document.getElementById('paypay-status-msg').textContent = '支払いを待機中...';
        openModal('modal-paypay');
        // 3秒ごとに支払い状態をポーリング
        clearInterval(payPayPollTimer);
        payPayPollTimer = setInterval(async () => {
          try {
            const r = await fetch(`/api/paypay/status?mpid=${data.merchantPaymentId}`);
            const s = await r.json();
            if (s.paid) {
              clearInterval(payPayPollTimer);
              handlePaymentSuccess(type, currentUserEmail);
            }
          } catch { /* ポーリングエラーは無視 */ }
        }, 3000);
      } else {
        alert(data.error || 'PayPay QRコードの取得に失敗しました');
      }
    } catch (err) {
      alert('エラー: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  document.getElementById('paypay-subscribe-btn').addEventListener('click', () => startPayPay('subscribe'));
  document.getElementById('paypay-ticket-btn').addEventListener('click',    () => startPayPay('ticket'));

  // PayPayモーダルを閉じたらポーリング停止
  document.querySelector('#modal-paypay .modal-close').addEventListener('click', () => clearInterval(payPayPollTimer));

  // ---- Stripe リダイレクト戻り処理 ----
  const _params = new URLSearchParams(window.location.search);
  if (_params.get('canceled')) {
    window.history.replaceState({}, '', '/');
  } else if (_params.get('session_id') && _params.get('type')) {
    const sessionId  = _params.get('session_id');
    const returnType = _params.get('type');
    window.history.replaceState({}, '', '/');
    fetch(`/api/checkout/verify?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) handlePaymentSuccess(returnType, d.email);
        else alert('決済の確認に失敗しました。サポートにお問い合わせください。');
      })
      .catch(() => alert('決済確認中にエラーが発生しました'));
  } else if (_params.get('mpid') && _params.get('type')) {
    const mpid       = _params.get('mpid');
    const returnType = _params.get('type');
    window.history.replaceState({}, '', '/');
    fetch(`/api/paypay/status?mpid=${mpid}`)
      .then(r => r.json())
      .then(d => {
        if (d.paid) handlePaymentSuccess(returnType, currentUserEmail);
        else alert('PayPay決済が完了していません。アプリで確認してください。');
      })
      .catch(() => alert('PayPay決済確認中にエラーが発生しました'));
  }

  // BGM
  const AUDIOS = {
    default: document.getElementById('bgm'),
  };
  Object.values(AUDIOS).forEach(a => { a.volume = 0; });
  const musicBtn = document.getElementById('music-btn');
  let musicEnabled = true;
  let currentAudio = AUDIOS.default;

  function fadeOut(audio, cb) {
    const tick = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - 0.04);
      if (audio.volume <= 0) { audio.pause(); clearInterval(tick); if (cb) cb(); }
    }, 40);
  }
  function fadeIn(audio) {
    if (!musicEnabled) return;
    audio.volume = 0;
    audio.play().catch(() => {});
    const tick = setInterval(() => {
      audio.volume = Math.min(0.18, audio.volume + 0.04);
      if (audio.volume >= 0.18) clearInterval(tick);
    }, 40);
  }

  const SFX = {
    positive: document.getElementById('bgm-positive'),
    neutral:  document.getElementById('bgm-neutral'),
    negative: document.getElementById('bgm-negative'),
  };

  window.playSfx = function(key) {
    if (!musicEnabled) return;
    const sfx = SFX[key] || SFX.neutral;
    sfx.currentTime = 0;
    sfx.volume = 1.0;
    sfx.play().catch(() => {});
  };

  function toggleMusic() {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      fadeIn(currentAudio);
      musicBtn.classList.add('playing');
      musicBtn.title = 'BGM オフ';
    } else {
      Object.values(AUDIOS).forEach(a => fadeOut(a));
      musicBtn.classList.remove('playing');
      musicBtn.title = 'BGM オン';
    }
  }
  musicBtn.addEventListener('click', toggleMusic);

  // 初回クリックで自動再生
  const tryAutoplay = () => {
    fadeIn(AUDIOS.default);
    musicBtn.classList.add('playing');
    document.removeEventListener('click', tryAutoplay);
  };
  document.addEventListener('click', tryAutoplay);

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      summaryMode = btn.dataset.mode;
      if (currentData) render(currentData);
    });
  });

  updateUsageBadge();

  // Drag-to-scroll on visualization
  const viz = document.getElementById('visualization');
  let isDragging = false, startX = 0, scrollLeft = 0;
  viz.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX - viz.offsetLeft;
    scrollLeft = viz.scrollLeft;
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
  viz.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    viz.scrollLeft = scrollLeft - (e.pageX - viz.offsetLeft - startX);
  });
});

/* ==================== Analyze ==================== */
async function analyze() {
  const text = document.getElementById('input-text').value.trim();
  if (!text) { alert('長文を入力してください'); return; }

  // コンテンツフィルター（利用回数を消費しない）
  if (checkExplicitContent(text)) {
    showContentWarning();
    return;
  }
  hideContentWarning();

  // 利用回数チェック
  if (getEffectiveUsage() >= getEffectiveLimit()) {
    if (getTickets() > 0) {
      usingTicket = true;
    } else {
      document.getElementById('modal-ticket').classList.remove('hidden');
      return;
    }
  }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = '分析中...';

  showLoading(true);
  hideError();
  document.getElementById('viz-section').classList.add('hidden');

  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    // SSE でない JSON エラーレスポンスを先に処理
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || ct.includes('application/json')) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      showError(err.error || 'サーバーエラーが発生しました');
      showLoading(false);
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = '分析する';
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const ev = JSON.parse(line.slice(6));
            handleEvent(ev);
          } catch (e) {
            console.error('SSEパースエラー:', e, '行:', line);
          }
        }
      }
    }
  } catch (err) {
    showError('通信エラー: ' + err.message);
    console.error(err);
  }

  showLoading(false);
  btn.disabled = false;
  btn.querySelector('.btn-text').textContent = '分析する';
}

function handleEvent(ev) {
  if (ev.type === 'result') {
    currentData = ev.data;
    saveToHistory(currentData, document.getElementById('input-text').value);
    if (usingTicket) { useTicket(); usingTicket = false; } else { incrementUsage(); }
    window.playSfx(currentData.sentiment || 'neutral');
    try {
      render(currentData);
    } catch (e) {
      console.error('描画エラー:', e);
      showError('描画エラー: ' + e.message);
    }
  } else if (ev.type === 'error') {
    showError('エラー: ' + ev.message);
    console.error('サーバーエラー:', ev.message);
  }
}

/* ==================== UI Helpers ==================== */
function showLoading(v) {
  document.getElementById('loading').classList.toggle('hidden', !v);
}
function showError(msg) {
  const box = document.getElementById('error-box');
  document.getElementById('error-msg').textContent = msg;
  box.classList.remove('hidden');
}
function hideError() {
  document.getElementById('error-box').classList.add('hidden');
}
function showContentWarning() {
  document.getElementById('content-warning').classList.remove('hidden');
}
function hideContentWarning() {
  document.getElementById('content-warning').classList.add('hidden');
}

/* ==================== SVG Helpers ==================== */
const NS = 'http://www.w3.org/2000/svg';
const XNS = 'http://www.w3.org/1999/xhtml';

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function addStop(grad, offset, color, opacity = 1) {
  const s = el('stop');
  s.setAttribute('offset', offset);
  s.setAttribute('stop-color', color);
  if (opacity < 1) s.setAttribute('stop-opacity', opacity);
  grad.appendChild(s);
}

function radialGrad(id, stops, cx = '38%', cy = '35%') {
  const g = el('radialGradient', { id, cx, cy, r: '65%' });
  stops.forEach(([off, col, op]) => addStop(g, off, col, op));
  return g;
}

function glowFilter(id, color, stdDev = 10) {
  const f = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' });
  const blur = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: stdDev, result: 'blur' });
  const flood = el('feFlood', { 'flood-color': color, 'flood-opacity': '0.5', result: 'flood' });
  const comp = el('feComposite', { in: 'flood', in2: 'blur', operator: 'in', result: 'glow' });
  const merge = el('feMerge');
  const mn1 = el('feMergeNode', { in: 'glow' });
  const mn2 = el('feMergeNode', { in: 'SourceGraphic' });
  merge.appendChild(mn1);
  merge.appendChild(mn2);
  [blur, flood, comp, merge].forEach(n => f.appendChild(n));
  return f;
}

function arrowMarker(id, color) {
  const m = el('marker', {
    id, markerWidth: '9', markerHeight: '7',
    refX: '9', refY: '3.5', orient: 'auto',
  });
  const p = el('polygon', { points: '0 0, 9 3.5, 0 7', fill: color });
  m.appendChild(p);
  return m;
}

/* ==================== Planet Type Resolver ==================== */
function getBaseType(type) {
  if (type === 'summary') return 'summary';
  if (type === 'conclusion' || type.startsWith('conclusion')) return 'conclusion';
  if (type === 'reason' || type.startsWith('reason')) return 'reason';
  if (type === 'example' || type.startsWith('example')) return 'example';
  return 'topic'; // topic・その他すべて
}

/* ==================== Planet Config ==================== */
const PLANET_CFG = {
  conclusion: {
    stops: [['0%', '#82b1ff'], ['55%', '#1e88e5'], ['100%', '#0d47a1']],
    glow: '#1e88e5', label_bg: '#0d47a1cc', text_col: '#e3f2fd',
    pill: '#1565c0', arrow: 'rgba(100,181,246,0.7)',
  },
  reason: {
    stops: [['0%', '#a5d6a7'], ['55%', '#43a047'], ['100%', '#1b5e20']],
    glow: '#43a047', label_bg: '#1b5e20cc', text_col: '#e8f5e9',
    pill: '#2e7d32', arrow: 'rgba(129,199,132,0.7)',
  },
  example: {
    stops: [['0%', '#ffcc80'], ['55%', '#fb8c00'], ['100%', '#e65100']],
    glow: '#fb8c00', label_bg: '#e65100cc', text_col: '#fff3e0',
    pill: '#e65100', arrow: 'rgba(255,183,77,0.7)',
  },
  summary: {
    stops: [['0%', '#ce93d8'], ['55%', '#8e24aa'], ['100%', '#4a148c']],
    glow: '#8e24aa', label_bg: '#4a148ccc', text_col: '#f3e5f5',
    pill: '#6a1b9a', arrow: 'rgba(186,104,200,0.7)',
  },
  topic: {
    stops: [['0%', '#80deea'], ['55%', '#00acc1'], ['100%', '#006064']],
    glow: '#00acc1', label_bg: '#006064cc', text_col: '#e0f7fa',
    pill: '#00838f', arrow: 'rgba(77,208,225,0.7)',
  },
};

/* ==================== Layout Constants ==================== */
const C = {
  SUN_X: 130, SUN_R: 110,
  PLANET_R: 95, SUMMARY_R: 115,
  SAT_R: 68,
  CENTER_Y: 520,
  SAT_DIST: 255,      // planet center → satellite center
  PLANET_SPACING: 390, // center-to-center gap between planets
  FIRST_GAP: 150,      // sun right edge → planet 1 left edge
  HEIGHT: 1060,
};

/* ==================== Stars (deterministic) ==================== */
function makeStars(svg, width, height) {
  // Simple LCG for deterministic star positions
  let seed = 42;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; };

  for (let i = 0; i < 130; i++) {
    const s = el('circle', {
      cx: (rng() * width).toFixed(1),
      cy: (rng() * height).toFixed(1),
      r: (rng() * 1.3 + 0.3).toFixed(2),
      fill: 'white',
      opacity: (rng() * 0.7 + 0.2).toFixed(2),
    });
    // Every 4th star twinkles
    if (i % 4 === 0) {
      const dur = (rng() * 3 + 2).toFixed(1);
      const delay = (rng() * 4).toFixed(1);
      s.style.animation = `twinkle ${dur}s ease-in-out infinite ${delay}s`;
    }
    svg.appendChild(s);
  }
}

/* ==================== Shooting Stars ==================== */
function makeShootingStars(svg, defs, totalW) {
  const TAIL = 140;

  // グラデーション: 尾(左)→透明、頭(右)→白く輝く
  const sg = el('linearGradient', { id: 'grad-shoot', x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
  addStop(sg, '0%',   'white', 0);
  addStop(sg, '60%',  'white', 0.45);
  addStop(sg, '100%', 'white', 1);
  defs.appendChild(sg);

  [
    { sx: -60,  sy: 100, dur: '6s',   delay: '0s'   },
    { sx: 180,  sy: 30,  dur: '4.5s', delay: '2.8s' },
    { sx: -20,  sy: 230, dur: '7s',   delay: '1.5s' },
    { sx: 350,  sy: 70,  dur: '5.5s', delay: '4.2s' },
    { sx: 60,   sy: 165, dur: '8s',   delay: '3s'   },
  ].forEach(({ sx, sy, dur, delay }) => {
    // 外側グループ: 位置 + 傾き
    const outer = el('g');
    outer.setAttribute('transform', `translate(${sx},${sy}) rotate(28)`);

    // 内側グループ: アニメーション
    const inner = el('g');
    inner.style.animation = `shoot ${dur} linear ${delay} infinite backwards`;

    // 尾(グラデーション付き細矩形)
    inner.appendChild(el('rect', {
      x: -TAIL, y: -1.5, width: TAIL, height: 3,
      fill: 'url(#grad-shoot)', rx: '1.5',
    }));
    // 頭(輝く点)
    inner.appendChild(el('circle', { cx: 0, cy: 0, r: 2.5, fill: 'white', opacity: '0.9' }));

    outer.appendChild(inner);
    svg.appendChild(outer);
  });
}

/* ==================== Draw Sun ==================== */
function drawSun(parent, cx, cy, r, summary) {
  // Glow halo (pulsing)
  const halo = el('circle', { cx, cy, r: r + 22, fill: 'rgba(255,179,0,0.12)' });
  halo.style.cssText = `transform-origin:${cx}px ${cy}px; animation:sun-pulse 4s ease-in-out infinite;`;
  parent.appendChild(halo);
  const halo2 = el('circle', { cx, cy, r: r + 10, fill: 'rgba(255,179,0,0.18)' });
  halo2.style.cssText = `transform-origin:${cx}px ${cy}px; animation:sun-pulse2 4s ease-in-out infinite 0.8s;`;
  parent.appendChild(halo2);

  // Main circle
  const circle = el('circle', {
    cx, cy, r,
    fill: 'url(#grad-sun)',
    filter: 'url(#glow-sun)',
  });
  parent.appendChild(circle);

  // Label
  const lbl = el('text', {
    x: cx, y: cy - r + 20,
    'text-anchor': 'middle',
    fill: 'rgba(255,255,255,0.95)',
    'font-size': '13',
    'font-weight': '700',
    'font-family': "'Noto Sans JP',sans-serif",
  });
  lbl.setAttribute('font-size', '16');
  lbl.textContent = '太陽';
  parent.appendChild(lbl);

  // Summary text via foreignObject
  const foW = r * 2 - 20, foH = r * 2 - 40;
  const fo = el('foreignObject', {
    x: cx - r + 10, y: cy - r + 28,
    width: foW, height: foH,
  });
  const div = document.createElementNS(XNS, 'div');
  div.setAttribute('xmlns', XNS);
  div.style.cssText = `
    width:${foW}px;height:${foH}px;
    display:flex;align-items:center;justify-content:center;
    text-align:center;
    color:rgba(255,255,255,0.92);
    font-size:13px;line-height:1.55;
    font-family:'Noto Sans JP',sans-serif;
    word-break:break-all;overflow:hidden;
    padding:2px;
  `;
  div.textContent = summary || '';
  fo.appendChild(div);
  parent.appendChild(fo);
}

/* ==================== Draw Planet ==================== */
function drawPlanet(parent, cx, cy, r, planet, mode, index = 0) {
  const baseType = getBaseType(planet.type);
  const cfg = PLANET_CFG[baseType];
  const isSummary = planet.type === 'summary';
  const isImportant = isSummary || baseType === 'conclusion';

  // Atmosphere layers (重要惑星のみ)
  if (isImportant) {
    [
      { extra: 42, op: 0.04 },
      { extra: 28, op: 0.08 },
      { extra: 16, op: 0.13 },
    ].forEach(({ extra, op }) => {
      const atmo = el('circle', { cx, cy, r: r + extra, fill: cfg.glow, opacity: op.toFixed(2) });
      parent.appendChild(atmo);
    });
  }

  // Glow halo (breathing animation)
  const halo = el('circle', { cx, cy, r: r + 14, fill: `${cfg.glow}22` });
  halo.style.cssText = `transform-origin:${cx}px ${cy}px; animation:planet-breathe ${3.5 + index * 0.6}s ease-in-out infinite;`;
  parent.appendChild(halo);

  // Orbit ring (subtle)
  const ring = el('ellipse', {
    cx, cy, rx: r + 8, ry: (r + 8) * 0.28,
    fill: 'none',
    stroke: 'rgba(255,255,255,0.07)',
    'stroke-width': '1.2',
  });
  parent.appendChild(ring);

  // Main circle
  const circle = el('circle', {
    cx, cy, r,
    fill: `url(#grad-${baseType})`,
    filter: `url(#glow-${baseType})`,
  });
  parent.appendChild(circle);

  // Rotating symbol (planet type indicator)
  const PLANET_SYMBOLS = { conclusion: '！', reason: '？', example: null, summary: '！？', topic: null };
  const sym = PLANET_SYMBOLS[baseType];
  if (sym) {
    const shineDurations = [11, 14, 9, 16];
    const shineDur = shineDurations[index % shineDurations.length];
    const symFontSize = sym.length === 1 ? r * 1.35 : r * 0.88;
    const symG = el('g');
    symG.style.cssText = `transform-origin:${cx}px ${cy}px; animation:spin-planet ${shineDur}s linear infinite;`;
    const symText = el('text', {
      x: cx,
      y: cy + symFontSize * 0.38,
      'text-anchor': 'middle',
      'font-size': symFontSize.toFixed(0),
      fill: 'rgba(255,255,255,0.15)',
      'font-family': "'Noto Sans JP',sans-serif",
      'font-weight': '700',
    });
    symText.textContent = sym;
    symG.appendChild(symText);
    parent.appendChild(symG);
  }

  // Type label (top strip)
  const lblY = cy - r + 22;
  const lbl = el('text', {
    x: cx, y: lblY,
    'text-anchor': 'middle',
    fill: 'rgba(255,255,255,0.95)',
    'font-size': isSummary ? '17' : '15',
    'font-weight': '700',
    'font-family': "'Noto Sans JP',sans-serif",
  });
  lbl.textContent = planet.label;
  parent.appendChild(lbl);

  // Content area (セパレーター線なし)
  const foX = cx - r + 10;
  const foY = cy - r + 34;
  const foW = r * 2 - 20;
  const foH = cy + r - foY - 8;

  if (isSummary && mode === 'bullets' && planet.bullets && planet.bullets.length > 0) {
    drawBullets(parent, foX, foY, foW, foH, planet.bullets, cfg.text_col);
  } else {
    drawText(parent, foX, foY, foW, foH, planet.text, cfg.text_col, isSummary ? 14 : 13);
  }
}

function drawText(parent, x, y, w, h, text, color, fontSize) {
  const fo = el('foreignObject', { x, y, width: w, height: h });
  const div = document.createElementNS(XNS, 'div');
  div.setAttribute('xmlns', XNS);
  div.style.cssText = `
    width:${w}px;height:${h}px;
    display:flex;align-items:center;justify-content:center;
    text-align:center;color:${color};
    font-size:${fontSize}px;line-height:1.55;
    font-family:'Noto Sans JP',sans-serif;
    word-break:break-all;overflow:hidden;padding:2px;
  `;
  div.textContent = text || '';
  fo.appendChild(div);
  parent.appendChild(fo);
}

function drawBullets(parent, x, y, w, h, bullets, color) {
  const fo = el('foreignObject', { x, y, width: w, height: h });
  const div = document.createElementNS(XNS, 'div');
  div.setAttribute('xmlns', XNS);
  div.style.cssText = `
    width:${w}px;height:${h}px;
    display:flex;flex-direction:column;justify-content:center;
    overflow:hidden;padding:2px 4px;box-sizing:border-box;
  `;
  const ul = document.createElementNS(XNS, 'ul');
  ul.style.cssText = 'list-style:none;padding:0;margin:0;';
  bullets.forEach(b => {
    const li = document.createElementNS(XNS, 'li');
    li.style.cssText = `
      color:${color};font-size:12.5px;line-height:1.45;
      margin-bottom:4px;padding-left:13px;text-indent:-13px;
      font-family:'Noto Sans JP',sans-serif;word-break:break-all;
    `;
    li.textContent = '• ' + b;
    ul.appendChild(li);
  });
  div.appendChild(ul);
  fo.appendChild(div);
  parent.appendChild(fo);
}

/* ==================== Draw Satellite ==================== */
function drawSatellite(parent, cx, cy, r, sat, type) {
  const baseType = getBaseType(type);
  const cfg = PLANET_CFG[baseType];

  // Glow
  const halo = el('circle', { cx, cy, r: r + 8, fill: `${cfg.glow}18` });
  parent.appendChild(halo);

  // Circle
  const circle = el('circle', {
    cx, cy, r,
    fill: `url(#grad-${baseType}-sat)`,
    filter: `url(#glow-${baseType})`,
    opacity: '0.92',
  });
  parent.appendChild(circle);

  // Text
  const foW = r * 2 - 12, foH = r * 2 - 12;
  drawText(parent, cx - r + 6, cy - r + 6, foW, foH, sat.text, cfg.text_col, 12);
}

/* ==================== Draw Arrow ==================== */
function drawArrow(parent, x1, y1, x2, y2, conjunction, arrowColor, pillColor) {
  // Arrow line (in two segments so the pill overlays cleanly)
  const line = el('line', {
    x1, y1, x2, y2,
    stroke: arrowColor || 'rgba(255,255,255,0.45)',
    'stroke-width': '1.5',
    'marker-end': 'url(#arr)',
  });
  parent.appendChild(line);

  if (!conjunction) return;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const chars = conjunction.length;
  const pillW = Math.max(38, chars * 13 + 18);
  const pillH = 21;

  // Pill background
  const pill = el('rect', {
    x: midX - pillW / 2, y: midY - pillH / 2,
    width: pillW, height: pillH, rx: 10.5, ry: 10.5,
    fill: pillColor || '#151b35',
    stroke: arrowColor || 'rgba(255,255,255,0.3)',
    'stroke-width': '1',
  });
  parent.appendChild(pill);

  // Pill text
  const txt = el('text', {
    x: midX, y: midY + 1,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    fill: 'rgba(255,255,255,0.9)',
    'font-size': '11',
    'font-weight': '500',
    'font-family': "'Noto Sans JP',sans-serif",
  });
  txt.textContent = conjunction;
  parent.appendChild(txt);
}

/* ==================== Auto-size Planet Radius ==================== */
function calcRequiredR(planet, mode, baseR) {
  const CHAR_PX  = 13;   // 日本語1文字あたりの幅(px) at 12.5px font
  const LINE_H   = 20;   // 行高(px)
  const OVERHEAD = 44;   // ラベル上部 + 下パディング (foY offset + bottom pad)

  let neededH = 0;
  const innerW = baseR * 2 - 24; // 惑星内の有効幅

  if (planet.type === 'summary' && mode === 'bullets' && planet.bullets?.length) {
    planet.bullets.forEach(b => {
      const cpl   = Math.max(1, Math.floor(innerW / CHAR_PX));
      const lines = Math.ceil((b.length + 2) / cpl); // +2 for "• "
      neededH += lines * LINE_H + 4; // 4px margin between bullets
    });
  } else if (planet.text) {
    const cpl   = Math.max(1, Math.floor(innerW / CHAR_PX));
    const lines = Math.ceil(planet.text.length / cpl);
    neededH = lines * LINE_H;
  }

  if (neededH === 0) return baseR;
  // content_height = 2r - OVERHEAD  →  r = (neededH + OVERHEAD) / 2
  return Math.max(baseR, Math.ceil((neededH + OVERHEAD) / 2) + 8);
}

/* ==================== Main Render ==================== */
function render(data) {
  const container = document.getElementById('visualization');
  container.innerHTML = '';
  document.getElementById('viz-section').classList.remove('hidden');

  const planets = data.planets || [];
  const N = planets.length;
  if (N === 0) return;

  // 各惑星の必要半径を計算（コンテンツに合わせて自動拡大）
  const rArr = planets.map(p => {
    const baseR = p.type === 'summary' ? C.SUMMARY_R : C.PLANET_R;
    return calcRequiredR(p, summaryMode, baseR);
  });

  // エッジ間距離を一定に保ちながら座標を決定
  const EDGE_GAP = C.PLANET_SPACING - 2 * C.PLANET_R; // 惑星間の隙間(固定)
  const pxArr = [];
  let prevEdge = C.SUN_X + C.SUN_R + C.FIRST_GAP;
  planets.forEach((p, i) => {
    pxArr[i]  = prevEdge + rArr[i];
    prevEdge  = pxArr[i] + rArr[i] + EDGE_GAP;
  });

  const totalW = pxArr[N - 1] + rArr[N - 1] + 80;
  const totalH = C.HEIGHT;

  const svg = el('svg', {
    width: totalW,
    height: totalH,
    viewBox: `0 0 ${totalW} ${totalH}`,
    xmlns: NS,
  });
  svg.style.fontFamily = "'Noto Sans JP',sans-serif";
  svg.style.display = 'block';

  /* ---- Defs ---- */
  const defs = el('defs');

  // Background gradient
  const bgGrad = el('linearGradient', { id: 'grad-bg', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  addStop(bgGrad, '0%', '#04060f');
  addStop(bgGrad, '100%', '#080d1e');
  defs.appendChild(bgGrad);

  // Sun gradient
  defs.appendChild(radialGrad('grad-sun', [
    ['0%', '#fff59d'], ['40%', '#ffb300'], ['100%', '#e65100'],
  ]));

  // Planet gradients
  for (const [type, cfg] of Object.entries(PLANET_CFG)) {
    defs.appendChild(radialGrad(`grad-${type}`, cfg.stops));
    // Satellite variant (slightly desaturated)
    const satStops = cfg.stops.map(([off, col]) => [off, col]);
    defs.appendChild(radialGrad(`grad-${type}-sat`, satStops));
  }

  // Glow filters
  defs.appendChild(glowFilter('glow-sun', '#ffb300', 12));
  for (const [type, cfg] of Object.entries(PLANET_CFG)) {
    defs.appendChild(glowFilter(`glow-${type}`, cfg.glow, 8));
  }

  // Arrow marker
  defs.appendChild(arrowMarker('arr', 'rgba(255,255,255,0.55)'));

  svg.appendChild(defs);

  /* ---- Background ---- */
  svg.appendChild(el('rect', { width: totalW, height: totalH, fill: 'url(#grad-bg)' }));

  /* ---- Nebula blobs ---- */
  const nebulaFilter = el('filter', { id: 'nebula-blur' });
  nebulaFilter.appendChild(el('feGaussianBlur', { stdDeviation: '40' }));
  defs.appendChild(nebulaFilter);

  [
    { cx: totalW * 0.3, cy: C.CENTER_Y, rx: 180, ry: 90, fill: 'rgba(50,0,120,0.25)' },
    { cx: totalW * 0.65, cy: C.CENTER_Y, rx: 150, ry: 75, fill: 'rgba(0,60,120,0.2)' },
    { cx: totalW * 0.85, cy: C.CENTER_Y, rx: 120, ry: 60, fill: 'rgba(80,0,100,0.2)' },
  ].forEach(({ cx, cy, rx, ry, fill }) => {
    svg.appendChild(el('ellipse', { cx, cy, rx, ry, fill, filter: 'url(#nebula-blur)' }));
  });

  /* ---- Stars ---- */
  makeStars(svg, totalW, totalH);

  /* ---- Shooting stars ---- */
  makeShootingStars(svg, defs, totalW);

  /* ---- Arrows layer (drawn first so planets appear on top) ---- */
  const arrowLayer = el('g', { id: 'arrow-layer' });
  svg.appendChild(arrowLayer);

  /* ---- Planets & satellites layer ---- */
  const bodyLayer = el('g', { id: 'body-layer' });
  svg.appendChild(bodyLayer);

  /* ---- Conjunction pills layer (on top) ---- */
  const pillLayer = el('g', { id: 'pill-layer' });
  svg.appendChild(pillLayer);

  // Helper: draw arrow + pill into the correct layers
  function addArrow(x1, y1, x2, y2, conjunction, arrowColor, pillBg) {
    const line = el('line', {
      x1, y1, x2, y2,
      stroke: arrowColor || 'rgba(255,255,255,0.4)',
      'stroke-width': '1.5',
      'marker-end': 'url(#arr)',
    });
    arrowLayer.appendChild(line);

    if (!conjunction) return;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const pillW = Math.max(38, conjunction.length * 13 + 18);
    const pillH = 21;

    const pill = el('rect', {
      x: midX - pillW / 2, y: midY - pillH / 2,
      width: pillW, height: pillH, rx: 10.5, ry: 10.5,
      fill: pillBg || '#0e1428',
      stroke: arrowColor || 'rgba(255,255,255,0.3)',
      'stroke-width': '1',
    });
    pillLayer.appendChild(pill);

    const txt = el('text', {
      x: midX, y: midY + 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: 'rgba(255,255,255,0.92)',
      'font-size': '11', 'font-weight': '500',
      'font-family': "'Noto Sans JP',sans-serif",
    });
    txt.textContent = conjunction;
    pillLayer.appendChild(txt);
  }

  /* ---- Clip paths for planet shines (into defs) ---- */
  planets.forEach((planet, i) => {
    const cp = el('clipPath', { id: `clip-planet-${i}` });
    cp.appendChild(el('circle', { cx: pxArr[i], cy: C.CENTER_Y, r: rArr[i] }));
    defs.appendChild(cp);
  });

  /* ---- Sun ---- */
  drawSun(bodyLayer, C.SUN_X, C.CENTER_Y, C.SUN_R, data.sun_summary);

  /* ---- Planets ---- */
  planets.forEach((planet, i) => {
    const px = pxArr[i];
    const py = C.CENTER_Y;
    const r  = rArr[i];
    const cfg = PLANET_CFG[planet.type] || PLANET_CFG.conclusion;

    // Arrow from sun or previous planet
    const fromX = i === 0
      ? C.SUN_X + C.SUN_R
      : pxArr[i - 1] + rArr[i - 1];
    addArrow(fromX, py, px - r, py, planet.conjunction_in, cfg.arrow, cfg.pill);

    // Planet body
    drawPlanet(bodyLayer, px, py, r, planet, summaryMode, i);

    // Satellites
    const sats = planet.satellites || [];
    sats.slice(0, 2).forEach((sat, j) => {
      const above = j === 0;
      const satY = above ? py - C.SAT_DIST : py + C.SAT_DIST;
      const satX = px;

      // Arrow: from planet edge to satellite edge
      const lineY1 = above ? py - r : py + r;
      const lineY2 = above ? satY + C.SAT_R : satY - C.SAT_R;
      addArrow(satX, lineY1, satX, lineY2, sat.conjunction, cfg.arrow, cfg.pill);

      // Satellite body
      drawSatellite(bodyLayer, satX, satY, C.SAT_R, sat, planet.type);
    });
  });

  container.appendChild(svg);
}

/* ==================== Subscription State ==================== */
let isSubscribed = false; // 開発中はtrue、本番はバックエンド連携後にfalseへ

/* ==================== History ==================== */
const HISTORY_KEY = 'nagabun_history';
const MAX_HISTORY_FREE = 2;
const MAX_HISTORY_PRO  = 20;

function saveToHistory(data, inputText = '') {
  const limit = isSubscribed ? MAX_HISTORY_PRO : MAX_HISTORY_FREE;
  const history = getHistory();
  history.unshift({
    id: Date.now(),
    timestamp: new Date().toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }),
    sun_summary: data.sun_summary || '',
    planet_count: (data.planets || []).length,
    inputText,
    data,
  });
  if (history.length > limit) history.splice(limit);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function deleteHistoryItem(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(e => e.id !== id)));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  const section = document.getElementById('history-section');
  const list = document.getElementById('history-list');
  if (!history.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  list.innerHTML = '';

  // 非サブスク向け上限案内
  if (!isSubscribed) {
    const note = document.createElement('div');
    note.className = 'history-limit-note';
    note.innerHTML = `🔒 履歴は最新2件まで。<button class="history-upgrade-btn">¥500/月で無制限に</button>`;
    note.querySelector('.history-upgrade-btn').addEventListener('click', () =>
      document.getElementById('modal-subscribe').classList.remove('hidden'));
    list.appendChild(note);
  }

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-meta">🕐 ${entry.timestamp}　🪐 ${entry.planet_count}惑星</div>
      <div class="history-summary">${entry.sun_summary}</div>
      ${isSubscribed && entry.inputText ? '<button class="history-reedit-btn">✏️ 再編集</button>' : ''}
    `;
    item.addEventListener('click', e => {
      if (e.target.classList.contains('history-reedit-btn') ||
          e.target.classList.contains('history-del')) return;
      currentData = entry.data;
      render(currentData);
      document.getElementById('viz-section').classList.remove('hidden');
      window.scrollTo({ top: document.getElementById('viz-section').offsetTop - 80, behavior: 'smooth' });
    });
    if (isSubscribed && entry.inputText) {
      item.querySelector('.history-reedit-btn').addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('input-text').value = entry.inputText;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('input-text').focus();
      });
    }
    const del = document.createElement('button');
    del.className = 'history-del';
    del.textContent = '×';
    del.addEventListener('click', e => { e.stopPropagation(); deleteHistoryItem(entry.id); });
    item.appendChild(del);
    list.appendChild(item);
  });
}
