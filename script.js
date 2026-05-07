// ═══════════════════════════════════════════════════════════════════════════════
// POINTAGE GPS - FRONTEND (PWA)
// Version avec openShift / closeShift côté backend
// ═══════════════════════════════════════════════════════════════════════════════

// ⚙️ CONFIGURATION
const API_URL = 'https://script.google.com/macros/s/AKfycbyw4sHgjtbMzRxy1swvqt0J4QrBNIyvwflqiuQN-K1NJn2KULcAHX_gWk0N3APJhdS71w/exec';
const STORAGE_KEY_SESSION = 'pointage_session';
const STORAGE_KEY_SHIFT = 'pointage_current_shift';
const STORAGE_KEY_BIOMETRIC = 'pointage_biometric_';
const STORAGE_KEY_DEVICE = 'pointage_device_id';

// State
let currentSession = null;
let timerInterval = null;
let clockInterval = null;
let currentPin = null;
let currentEmployee = null;
let currentDeviceId = null;

// Employees list (sync avec Apps Script)
const EMPLOYEES = {
  '0001': { name: 'Yann Test1', email: 'yannphonne72@gmail.com' },
  '0002': { name: 'Laure test2', email: 'millebulle@gmail.com' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initializeDeviceId();
  initializePWA();
  startClock();
  setupEventListeners();

  const savedSession = localStorage.getItem(STORAGE_KEY_SESSION);
  const savedShift = localStorage.getItem(STORAGE_KEY_SHIFT);

  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      currentPin = session.pin;
      currentEmployee = EMPLOYEES[currentPin] || session.employee || null;
      if (!currentEmployee) {
        hardReset();
        return;
      }
      if (savedShift) {
        currentSession = JSON.parse(savedShift);
      }
      loadMainScreen();
    } catch (e) {
      console.error('Restore error:', e);
      hardReset();
    }
  }
});

function initializeDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY_DEVICE);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY_DEVICE, id);
  }
  currentDeviceId = id;
}

function initializePWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('Service Worker not available:', err);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  // LOGIN SCREEN
  const pinInputs = document.querySelectorAll('.pin-digit');
  pinInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => handlePinInput(e, index, pinInputs));
    input.addEventListener('keydown', (e) => handlePinKeydown(e, index, pinInputs));
  });

  document.getElementById('btnLogin').addEventListener('click', handleLogin);
  document.getElementById('btnClear').addEventListener('click', handlePinClear);
  document.getElementById('btnBiometric').addEventListener('click', handleBiometricAuth);

  // MAIN SCREEN
  document.getElementById('btnArrive').addEventListener('click', handleArrive);
  document.getElementById('btnDepart').addEventListener('click', handleDepart);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIN INPUT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

function getPinFromInputs() {
  return Array.from(document.querySelectorAll('.pin-digit')).map(i => i.value).join('');
}

function handlePinInput(e, index, allInputs) {
  const value = e.target.value;
  if (!/^\d*$/.test(value)) {
    e.target.value = '';
    return;
  }
  if (value && index < allInputs.length - 1) {
    allInputs[index + 1].focus();
  }
  updatePinDisplay(allInputs);
}

function handlePinKeydown(e, index, allInputs) {
  if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
    allInputs[index - 1].focus();
    allInputs[index - 1].value = '';
    updatePinDisplay(allInputs);
  }
  if (e.key === 'Enter') {
    const fullPin = getPinFromInputs();
    if (fullPin.length === 4) {
      handleLogin();
    }
  }
}

function updatePinDisplay(allInputs) {
  const fullPin = getPinFromInputs();
  const btnLogin = document.getElementById('btnLogin');
  const btnBiometric = document.getElementById('btnBiometric');

  btnLogin.disabled = fullPin.length < 4;

  allInputs.forEach((input, i) => {
    if (i < fullPin.length) {
      input.classList.add('filled');
    } else {
      input.classList.remove('filled');
    }
  });

  if (fullPin.length === 4 && isBiometricAvailable() && isBiometricEnrolled(fullPin)) {
    btnBiometric.hidden = false;
  } else {
    btnBiometric.hidden = true;
  }
}

function handlePinClear() {
  document.querySelectorAll('.pin-digit').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  document.getElementById('btnLogin').disabled = true;
  document.getElementById('btnBiometric').hidden = true;
  document.getElementById('pin0').focus();
}

function hardReset() {
  currentSession = null;
  currentPin = null;
  currentEmployee = null;
  localStorage.removeItem(STORAGE_KEY_SESSION);
  localStorage.removeItem(STORAGE_KEY_SHIFT);
  stopTimer();
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('loginScreen').classList.add('active');
  handlePinClear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIOMETRIC AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

function isBiometricAvailable() {
  return window.PublicKeyCredential !== undefined && navigator.credentials !== undefined;
}

function isBiometricEnrolled(pin) {
  return localStorage.getItem(STORAGE_KEY_BIOMETRIC + pin) !== null;
}

async function enrollBiometric(pin) {
  if (!isBiometricAvailable()) {
    showToast('info', 'ℹ️', 'Biométrie non disponible sur cet appareil');
    return;
  }
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        name: 'PointageGPS Restaurant',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(pin),
        name: pin,
        displayName: `Employé ${pin}`,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
      },
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    if (credential) {
      localStorage.setItem(STORAGE_KEY_BIOMETRIC + pin, JSON.stringify({
        id: credential.id,
        pin: pin,
        enrolled: new Date().toISOString(),
      }));
      showToast('success', '✅', 'Empreinte enregistrée !');
    }
  } catch (err) {
    console.log('Biometric enrollment error:', err);
    showToast('error', '❌', "Erreur lors de l'enregistrement");
  }
}

async function handleBiometricAuth() {
  const pin = getPinFromInputs();
  if (!isBiometricAvailable()) {
    showToast('error', '❌', 'Biométrie non disponible');
    return;
  }

  const btnBio = document.getElementById('btnBiometric');
  btnBio.disabled = true;
  btnBio.innerHTML = '... Vérification...';

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        userVerification: 'preferred',
      },
    });

    if (assertion) {
      currentPin = pin;
      currentEmployee = EMPLOYEES[pin];
      if (!currentEmployee) {
        showToast('error', '❌', 'PIN invalide');
        btnBio.disabled = false;
        btnBio.innerHTML = '👆Utiliser empreinte';
        return;
      }
      loadMainScreen();
    }
  } catch (err) {
    console.log('Biometric auth error:', err);
    showToast('error', '❌', 'Authentification biométrique échouée');
    btnBio.disabled = false;
    btnBio.innerHTML = '👆Utiliser empreinte';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

async function handleLogin() {
  const pin = getPinFromInputs();

  if (pin.length !== 4) {
    showToast('error', '❌', 'PIN incomplet');
    return;
  }

  if (!EMPLOYEES[pin]) {
    showToast('error', '❌', 'PIN invalide');
    handlePinClear();
    return;
  }

  currentPin = pin;
  currentEmployee = EMPLOYEES[pin];

  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
    pin: currentPin,
    employee: currentEmployee,
    loginTime: new Date().toISOString(),
  }));

  if (isBiometricAvailable() && !isBiometricEnrolled(pin)) {
    setTimeout(() => {
      if (confirm(`Enregistrer votre empreinte pour ${currentEmployee.name} ?`)) {
        enrollBiometric(pin);
      }
    }, 500);
  }

  loadMainScreen();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════

function loadMainScreen() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');

  document.getElementById('userName').textContent = currentEmployee.name;
  document.getElementById('userPin').textContent = `PIN: ${currentPin}`;

  updateMainScreenUI();
}

function handleLogout() {
  if (confirm('Êtes-vous sûr de vouloir quitter ?')) {
    hardReset();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOLOCATION
// ═══════════════════════════════════════════════════════════════════════════════

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      err => {
        const msgs = {
          1: 'Permission refusée',
          2: 'Position indisponible',
          3: 'Délai dépassé',
        };
        reject(new Error(msgs[err.code] || 'Erreur GPS'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`
    );
    const data = await response.json();
    const address = data.address || {};
    const parts = [
      address.road,
      address.city || address.town || address.village || address.municipality,
    ].filter(Boolean);
    return parts.join(', ') || `${lat}, ${lng}`;
  } catch {
    return `${lat}, ${lng}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARRIVAL / DEPARTURE avec openShift / closeShift
// ═══════════════════════════════════════════════════════════════════════════════

async function handleArrive(e) {
  const btn = document.getElementById('btnArrive');
  btn.disabled = true;
  btn.innerHTML = 'GPS...';

  try {
    if (!currentPin) {
      showToast('error', '❌', 'PIN non connecté');
      return;
    }

    const pos = await getPosition();
    const now = new Date();
    const address = await reverseGeocode(pos.lat, pos.lng);

    const payload = {
      action: 'openShift',
      pin: currentPin,
      deviceId: currentDeviceId,
      time: now.toISOString(),
      latitude: pos.lat,
      longitude: pos.lng,
      accuracy: pos.accuracy,
      address: address,
    };

    const response = await sendToAPI(payload);

    // On log, mais on continue à créer la session locale quoi qu'il arrive
    if (!response.success) {
      console.log('openShift error:', response.message);
      // on pourra améliorer plus tard
    }

    // Utilise la réponse si dispo, sinon fallback local
    const shift = response.data && response.data.activeShift ? response.data.activeShift : {
      pin: currentPin,
      arriveTime: now.toISOString(),
      arriveLat: pos.lat,
      arriveLng: pos.lng,
      arriveAccuracy: pos.accuracy,
      arriveAddress: address,
    };

    currentSession = shift;
    localStorage.setItem(STORAGE_KEY_SHIFT, JSON.stringify(currentSession));

    updateMainScreenUI();
    startTimer();
    showToast('success', '🟢', 'Arrivée pointée');
  } catch (err) {
    showToast('error', '❌', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Arrivée';
  }
}
async function handleDepart(e) {
  const btn = document.getElementById('btnDepart');
  btn.disabled = true;
  btn.innerHTML = 'GPS...';

  try {
    // 🔁 Restaure la session locale si perdue
    if (!currentSession) {
      const savedShift = localStorage.getItem(STORAGE_KEY_SHIFT);
      if (savedShift) {
        currentSession = JSON.parse(savedShift);
      }
    }

    if (!currentPin || !currentSession) {
      showToast('error', '❌', 'Aucune session active');
      return;
    }

    const pos = await getPosition();
    const now = new Date();
    const address = await reverseGeocode(pos.lat, pos.lng);

    const payload = {
      action: 'closeShift',
      pin: currentPin,
      deviceId: currentDeviceId,
      time: now.toISOString(),
      latitude: pos.lat,
      longitude: pos.lng,
      accuracy: pos.accuracy,
      address: address,
    };

    const response = await sendToAPI(payload);

    if (!response.success) {
      showToast('error', '❌', response.message || 'Erreur Départ');
      return;
    }

    const duration = Math.round(
      (now.getTime() - new Date(currentSession.arriveTime).getTime()) / 60000
    );

    currentSession = null;
    localStorage.removeItem(STORAGE_KEY_SHIFT);

    stopTimer();
    updateMainScreenUI();

    showToast('success', '🔴', `Départ pointé · ${duration}min travaillé`);
  } catch (err) {
    showToast('error', '❌', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Départ';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API COMMUNICATION
// ═══════════════════════════════════════════════════════════════════════════════

async function sendToAPI(data) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    showToast('error', '❌', 'Erreur de synchronisation');
    return { success: false, message: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI UPDATE & TIMER & CLOCK
// ═══════════════════════════════════════════════════════════════════════════════

function updateMainScreenUI() {
  const card = document.getElementById('statusCard');
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  const btnArrive = document.getElementById('btnArrive');
  const btnDepart = document.getElementById('btnDepart');
  const locationText = document.getElementById('locationText');

  if (currentSession) {
    card.classList.add('active-shift');
    dot.classList.add('active');
    txt.textContent = 'En service';
    btnArrive.disabled = true;
    btnDepart.disabled = false;

    const address = currentSession.arriveAddress || 'Adresse en cours...';
    const coords = `${currentSession.arriveLat}, ${currentSession.arriveLng}`;
    const accuracy = `±${currentSession.arriveAccuracy}m`;

    locationText.innerHTML = `<strong>${address}</strong><br>${coords} ${accuracy}`;
  } else {
    card.classList.remove('active-shift');
    dot.classList.remove('active');
    txt.textContent = 'Hors service';
    btnArrive.disabled = false;
    btnDepart.disabled = true;
    locationText.innerHTML = 'Position GPS non acquise';
  }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function startTimer() {
  if (!currentSession) return;

  const timerEl = document.getElementById('timerDisplay');
  timerEl.classList.add('visible');

  stopTimer();

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - new Date(currentSession.arriveTime).getTime();
    timerEl.textContent = formatDuration(elapsed);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerEl = document.getElementById('timerDisplay');
  if (timerEl) {
    timerEl.classList.remove('visible');
  }
}

function startClock() {
  function tick() {
    const now = new Date();
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('fr-FR');
    }
    if (dateEl) {
      dateEl.textContent = `${days[now.getDay()]} ${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]}`;
    }
  }

  tick();
  clockInterval = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(type, icon, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
