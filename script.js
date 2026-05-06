// ─── STATE ───────────────────────────────────────────────
const KEY_RECORDS = 'pointage_records';
const KEY_SESSION = 'pointage_session';

let records = JSON.parse(localStorage.getItem(KEY_RECORDS) || '[]');
let session = JSON.parse(localStorage.getItem(KEY_SESSION) || 'null');
let timerInterval = null;
let clockInterval = null;

// ─── CLOCK ───────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    document.getElementById('clockTime').textContent =
      now.toLocaleTimeString('fr-FR');
    document.getElementById('clockDate').textContent =
      `${days[now.getDay()]} ${String(now.getDate()).padStart(2,'0')}/${months[now.getMonth()]}/${now.getFullYear()}`;
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}

// ─── GEOLOCATION ─────────────────────────────────────────
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        accuracy: Math.round(pos.coords.accuracy)
      }),
      err => {
        const msgs = {
          1: 'Permission refusée',
          2: 'Position indisponible',
          3: 'Délai dépassé'
        };
        reject(new Error(msgs[err.code] || 'Erreur GPS'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`);
    const d = await r.json();
    const a = d.address || {};
    const parts = [a.road, a.city || a.town || a.village || a.municipality].filter(Boolean);
    return parts.join(', ') || `${lat}, ${lng}`;
  } catch {
    return `${lat}, ${lng}`;
  }
}

// ─── TIMER ───────────────────────────────────────────────
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function formatDurationShort(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}

function startTimer() {
  const timerEl = document.getElementById('timerDisplay');
  timerEl.classList.add('visible');
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - new Date(session.arriveTime).getTime();
    timerEl.textContent = formatDuration(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('timerDisplay').classList.remove('visible');
}

// ─── UI UPDATE ────────────────────────────────────────────
function updateUI() {
  const card = document.getElementById('statusCard');
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  const btnA = document.getElementById('btnArrive');
  const btnD = document.getElementById('btnDepart');

  if (session) {
    card.classList.add('active-shift');
    dot.classList.add('active');
    txt.textContent = 'En service';
    btnA.disabled = true;
    btnD.disabled = false;
    updateLocationDisplay(session.arriveLocation, session.arriveAddress);
  } else {
    card.classList.remove('active-shift');
    dot.classList.remove('active');
    txt.textContent = 'Hors service';
    btnA.disabled = false;
    btnD.disabled = true;
    document.getElementById('locationText').innerHTML = 'Position GPS non acquise';
  }

  renderHistory();
  renderStats();
}

function updateLocationDisplay(loc, addr) {
  const el = document.getElementById('locationText');
  el.innerHTML = `<strong>${addr || 'Adresse en cours...'}</strong><br>${loc.lat}, ${loc.lng} · ±${loc.accuracy}m`;
}

// ─── ARRIVE ──────────────────────────────────────────────
async function handleArrive(e) {
  addRipple(e);
  const btn = document.getElementById('btnArrive');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span>GPS...</span>';

  try {
    const pos = await getPosition();
    const now = new Date().toISOString();
    const addr = await reverseGeocode(pos.lat, pos.lng);

    session = {
      arriveTime: now,
      arriveLocation: pos,
      arriveAddress: addr
    };
    localStorage.setItem(KEY_SESSION, JSON.stringify(session));

    startTimer();
    updateUI();
    showToast('success', '🟢', `Arrivée pointée à ${new Date(now).toLocaleTimeString('fr-FR')}`);
  } catch (err) {
    showToast('error', '❌', err.message);
    btn.disabled = false;
  }

  btn.innerHTML = '<div class="btn-icon">🟢</div><span>Arrivée</span>';
}

// ─── DEPART ──────────────────────────────────────────────
async function handleDepart(e) {
  addRipple(e);
  const btn = document.getElementById('btnDepart');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span>GPS...</span>';

  try {
    const pos = await getPosition();
    const now = new Date().toISOString();
    const addr = await reverseGeocode(pos.lat, pos.lng);

    const duration = new Date(now) - new Date(session.arriveTime);

    const record = {
      id: Date.now(),
      date: new Date(session.arriveTime).toLocaleDateString('fr-FR'),
      arriveTime: session.arriveTime,
      departTime: now,
      arriveLat: session.arriveLocation.lat,
      arriveLng: session.arriveLocation.lng,
      arriveAccuracy: session.arriveLocation.accuracy,
      arriveAddress: session.arriveAddress,
      departLat: pos.lat,
      departLng: pos.lng,
      departAccuracy: pos.accuracy,
      departAddress: addr,
      durationMs: duration
    };

    records.unshift(record);
    localStorage.setItem(KEY_RECORDS, JSON.stringify(records));

    session = null;
    localStorage.removeItem(KEY_SESSION);
    stopTimer();
    updateUI();
    showToast('success', '🔴', `Départ pointé · ${formatDurationShort(duration)} travaillé`);
  } catch (err) {
    showToast('error', '❌', err.message);
    btn.disabled = false;
  }

  btn.innerHTML = '<div class="btn-icon">🔴</div><span>Départ</span>';
}

// ─── RENDER HISTORY ───────────────────────────────────────
function renderHistory() {
  const list = document.getElementById('historyList');
  const count = document.getElementById('historyCount');
  count.textContent = `${records.length} entrée${records.length !== 1 ? 's' : ''}`;

  if (records.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Aucune entrée pour l'instant.<br>Pointez votre arrivée pour commencer.</p>
      </div>`;
    return;
  }

  const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  list.innerHTML = records.slice(0, 20).map(r => {
    const arriveDate = new Date(r.arriveTime);
    const departDate = r.departTime ? new Date(r.departTime) : null;
    return `
      <div class="history-item">
        <div class="history-date">
          <div class="history-day">${String(arriveDate.getDate()).padStart(2,'0')}</div>
          <div class="history-month">${months[arriveDate.getMonth()]}</div>
        </div>
        <div class="history-times">
          <div class="time-row">
            <span class="time-tag tag-arrive">Arrivée</span>
            <span class="time-value">${arriveDate.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
          </div>
          <div class="time-row">
            <span class="time-tag tag-depart">Départ</span>
            <span class="time-value">${departDate ? departDate.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;font-family:'Space Mono',monospace">${r.arriveAddress || `${r.arriveLat},${r.arriveLng}`}</div>
        </div>
        <div class="history-duration">
          <div class="duration-value">${r.durationMs ? formatDurationShort(r.durationMs) : '—'}</div>
          <div class="duration-label">durée</div>
        </div>
      </div>`;
  }).join('');
}

// ─── STATS ────────────────────────────────────────────────
function renderStats() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const weekRecords = records.filter(r => new Date(r.arriveTime) >= startOfWeek && r.durationMs);
  const uniqueDays = new Set(weekRecords.map(r => new Date(r.arriveTime).toDateString())).size;
  const totalMs = weekRecords.reduce((acc, r) => acc + r.durationMs, 0);
  const avgMs = uniqueDays > 0 ? totalMs / uniqueDays : 0;

  document.getElementById('statDays').textContent = uniqueDays;
  document.getElementById('statHours').textContent = totalMs > 0 ? formatDurationShort(totalMs) : '0h';
  document.getElementById('statAvg').textContent = avgMs > 0 ? formatDurationShort(avgMs) : '-';
}

// ─── EXPORT CSV ───────────────────────────────────────────
function exportCSV() {
  if (records.length === 0) {
    showToast('error', '⚠️', 'Aucune donnée à exporter');
    return;
  }

  const headers = [
    'Date','Heure Arrivée','Heure Départ','Durée (h)',
    'Lat. Arrivée','Lng. Arrivée','Précision Arrivée (m)','Adresse Arrivée',
    'Lat. Départ','Lng. Départ','Précision Départ (m)','Adresse Départ'
  ];

  const rows = records.map(r => {
    const arrive = new Date(r.arriveTime);
    const depart = r.departTime ? new Date(r.departTime) : null;
    const durationH = r.durationMs ? (r.durationMs / 3600000).toFixed(2) : '';
    return [
      r.date,
      arrive.toLocaleTimeString('fr-FR'),
      depart ? depart.toLocaleTimeString('fr-FR') : '',
      durationH,
      r.arriveLat, r.arriveLng, r.arriveAccuracy,
      `"${(r.arriveAddress || '').replace(/"/g, '""')}"`,
      r.departLat || '', r.departLng || '', r.departAccuracy || '',
      `"${(r.departAddress || '').replace(/"/g, '""')}"`
    ].join(';');
  });

  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `pointage_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('success', '📥', `${records.length} entrée(s) exportée(s)`);
}

// ─── TOAST ────────────────────────────────────────────────
function showToast(type, icon, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ─── RIPPLE ───────────────────────────────────────────────
function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX||rect.left+rect.width/2)-rect.left-size/2}px;top:${(e.clientY||rect.top+rect.height/2)-rect.top-size/2}px`;
  btn.appendChild(r);
  setTimeout(() => r.remove(), 700);
}

// ─── INIT ─────────────────────────────────────────────────
startClock();
updateUI();
if (session) startTimer();
