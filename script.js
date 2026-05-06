// Utilitaires de date/heure
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"
];

function formatDateHuman(date) {
  const dayName = DAYS_FR[date.getDay()];
  const d = String(date.getDate()).padStart(2, "0");
  const monthName = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${d}/${monthName}/${year}`;
}

function diffMinutes(start, end) {
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000)
  );
}

function isoDateOnly(date) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// Gestion stockage local
const STORAGE_KEY = "pointageGPS_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        currentSession: null, // { start: ISO, location: string }
        entries: []           // [{ start, end, durationMinutes, location }]
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Erreur loadState", e);
    return {
      currentSession: null,
      entries: []
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const serviceStatusEl = document.getElementById("service-status");
  const gpsStatusEl = document.getElementById("gps-status");
  const btnArrivee = document.getElementById("btn-arrivee");
  const btnDepart = document.getElementById("btn-depart");
  const historyListEl = document.getElementById("history-list");
  const historyCountEl = document.getElementById("history-count");
  const weekDaysEl = document.getElementById("week-days");
  const weekHoursEl = document.getElementById("week-hours");
  const weekAvgEl = document.getElementById("week-avg");
  const btnExport = document.getElementById("btn-export");

  let state = loadState();
  let lastKnownLocation =
    "Rue Félon, Saint-Denis-d'Oléron"; // valeur par défaut

  // Horloge temps réel
  function tickClock() {
    const now = new Date();
    clockEl.textContent = formatTime(now);
    dateEl.textContent = formatDateHuman(now);
  }
  tickClock();
  setInterval(tickClock, 1000);

  // GPS basique (simulé)
  function initGps() {
    if (!navigator.geolocation) {
      gpsStatusEl.textContent = "Position GPS non acquise";
      gpsStatusEl.classList.remove("status-gps-on");
      gpsStatusEl.classList.add("status-gps-off");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        lastKnownLocation = `Lat ${latitude.toFixed(
          5
        )}, Lon ${longitude.toFixed(5)}`;
        gpsStatusEl.textContent = "Position GPS acquise";
        gpsStatusEl.classList.remove("status-gps-off");
        gpsStatusEl.classList.add("status-gps-on");
      },
      () => {
        gpsStatusEl.textContent = "Position GPS non acquise";
        gpsStatusEl.classList.remove("status-gps-on");
        gpsStatusEl.classList.add("status-gps-off");
      }
    );
  }

  initGps();

  // Rendu des entrées
  function renderHistory() {
    historyListEl.innerHTML = "";
    if (!state.entries.length) {
      historyCountEl.textContent = "0 entrée";
      return;
    }

    historyCountEl.textContent =
      state.entries.length === 1
        ? "1 entrée"
        : `${state.entries.length} entrées`;

    state.entries
      .slice()
      .sort((a, b) => new Date(b.start) - new Date(a.start))
      .forEach((entry) => {
        const start = new Date(entry.start);
        const end = new Date(entry.end);
        const duration = entry.durationMinutes;
        const day = String(start.getDate()).padStart(2, "0");
        const month = MONTHS_FR[start.getMonth()].toUpperCase();
        const startTime =
          String(start.getHours()).padStart(2, "0") +
          ":" +
          String(start.getMinutes()).padStart(2, "0");
        const endTime =
          String(end.getHours()).padStart(2, "0") +
          ":" +
          String(end.getMinutes()).padStart(2, "0");

        const article = document.createElement("article");
        article.className = "history-item";
        article.innerHTML = `
          <div class="history-date-col">
            <div class="history-day">${day}</div>
            <div class="history-month">${month}</div>
          </div>
          <div class="history-detail-col">
            <div class="history-row">
              <span class="history-label">ARRIVÉE</span>
              <span class="history-time">${startTime}</span>
            </div>
            <div class="history-row">
              <span class="history-label">DÉPART</span>
              <span class="history-time">${endTime}</span>
            </div>
            <div class="history-row">
              <span class="history-location">
                ${entry.location || lastKnownLocation}
              </span>
            </div>
            <div class="history-row">
              <span class="history-duration">
                ${duration}min DURÉE
              </span>
            </div>
          </div>
        `;
        historyListEl.appendChild(article);
      });
  }

  // Stats semaine
  function computeWeekStats() {
    const now = new Date();
    const currentWeekStart = new Date(now);
    const day = currentWeekStart.getDay(); // 0 = Dimanche
    const diffToMonday = (day + 6) % 7; // Lundi=0,...,Dimanche=6
    currentWeekStart.setDate(currentWeekStart.getDate() - diffToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    let daySet = new Set();
    let totalMinutes = 0;

    state.entries.forEach((e) => {
      const start = new Date(e.start);
      if (start >= currentWeekStart && start <= now) {
        daySet.add(isoDateOnly(start));
        totalMinutes += e.durationMinutes;
      }
    });

    const daysCount = daySet.size;
    const avgMinutes = daysCount ? Math.round(totalMinutes / daysCount) : 0;

    weekDaysEl.textContent = daysCount || 0;
    weekHoursEl.textContent = `${totalMinutes}min`;
    weekAvgEl.textContent = `${avgMinutes}min`;
  }

  // Statut actuel
  function refreshStatus() {
    if (state.currentSession) {
      serviceStatusEl.textContent = "En service";
      serviceStatusEl.classList.remove("status-off");
      serviceStatusEl.classList.add("status-on");
    } else {
      serviceStatusEl.textContent = "Hors service";
      serviceStatusEl.classList.remove("status-on");
      serviceStatusEl.classList.add("status-off");
    }
  }

  // Export CSV
  function exportCsv() {
    if (!state.entries.length) {
      alert("Aucune entrée à exporter.");
      return;
    }
    const lines = [
      "date_debut;date_fin;duree_minutes;localisation"
    ];
    state.entries.forEach((e) => {
      lines.push(
        [
          e.start,
          e.end,
          e.durationMinutes,
          (e.location || "").replace(/;/g, ",")
        ].join(";")
      );
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    a.download = `pointage_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Gestion des boutons
  btnArrivee.addEventListener("click", () => {
    if (state.currentSession) {
      alert("Une session est déjà en cours (Arrivée déjà enregistrée).");
      return;
    }
    const now = new Date();
    state.currentSession = {
      start: now.toISOString(),
      location: lastKnownLocation
    };
    saveState(state);
    refreshStatus();
  });

  btnDepart.addEventListener("click", () => {
    if (!state.currentSession) {
      alert("Aucune session en cours. Cliquez d'abord sur Arrivée.");
      return;
    }
    const now = new Date();
    const startDate = new Date(state.currentSession.start);
    const duration = diffMinutes(startDate, now);
    state.entries.push({
      start: state.currentSession.start,
      end: now.toISOString(),
      durationMinutes: duration,
      location: state.currentSession.location
    });
    state.currentSession = null;
    saveState(state);
    refreshStatus();
    renderHistory();
    computeWeekStats();
  });

  btnExport.addEventListener("click", exportCsv);

  // Rendu initial
  refreshStatus();
  renderHistory();
  computeWeekStats();
});
