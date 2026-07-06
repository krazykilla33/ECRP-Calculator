import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1z0raLG33koiCkqxVIYzmJs1UX9_1se4",
  authDomain: "ecrp-calculator.firebaseapp.com",
  projectId: "ecrp-calculator",
  storageBucket: "ecrp-calculator.firebasestorage.app",
  messagingSenderId: "661571891282",
  appId: "1:661571891282:web:410cd9c70bf313e9d52f8b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const openLabsDocRef = doc(db, "shared", "openLabs");

const mapImage = "assets/map/satellite-map-final.jpg";
const imageWidth = 1280;
const imageHeight = 1280;

let selectedLabId = null;
let currentFilter = "all";
let openLabSet = new Set();

const labs = (window.ECRP_DATA?.labs || []).map(lab => ({
  ...lab,
  tables: {
    coke: Number(lab.cokeTables) || 0,
    crack: Number(lab.crackTables) || 0,
    plant: Number(lab.plantTables) || 0
  }
}));

const map = L.map("labMap", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 5,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 90,
  attributionControl: false
});

const bounds = [[0, 0], [imageHeight, imageWidth]];

L.imageOverlay(mapImage, bounds).addTo(map);
map.fitBounds(bounds);

const markerLayer = L.layerGroup().addTo(map);
const markerMap = {};

function hasCoords(lab) {
  return lab.map && lab.map.x !== null && lab.map.y !== null;
}

function isOpen(lab) {
  return openLabSet.has(lab.name);
}

function createLabIcon(lab) {
  const statusClass = isOpen(lab) ? "marker-open" : "marker-closed";

  return L.divIcon({
    className: "",
    html: `<div class="marker-dot ${statusClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function getVisibleLabs() {
  const search = document.getElementById("labSearch").value.toLowerCase().trim();

  return labs.filter(lab => {
    if (!hasCoords(lab)) return false;

    const matchesSearch = lab.name.toLowerCase().includes(search);
    const status = isOpen(lab) ? "open" : "closed";

    const matchesFilter =
      currentFilter === "all" ||
      status === currentFilter;

    return matchesSearch && matchesFilter;
  });
}

function renderLabs() {
  markerLayer.clearLayers();

  Object.keys(markerMap).forEach(key => {
    delete markerMap[key];
  });

  const labList = document.getElementById("labList");
  labList.innerHTML = "";

  const visibleLabs = getVisibleLabs();

  visibleLabs.forEach(lab => {
    const open = isOpen(lab);
    const statusText = open ? "OPEN" : "CLOSED";
    const statusClass = open ? "status-open" : "status-closed";
    const popupStatusClass = open ? "popup-open" : "popup-closed";

    const marker = L.marker([lab.map.y, lab.map.x], {
      icon: createLabIcon(lab)
    }).addTo(markerLayer);

    marker.bindPopup(`
      <div class="lab-popup">
        <div class="lab-popup-title">${lab.name}</div>

        <div class="lab-popup-row">
          <span>Coke:</span>
          <strong>${lab.tables.coke}</strong>
        </div>

        <div class="lab-popup-row">
          <span>Crack:</span>
          <strong>${lab.tables.crack}</strong>
        </div>

        <div class="lab-popup-row">
          <span>Plant:</span>
          <strong>${lab.tables.plant}</strong>
        </div>

        <div class="lab-popup-status ${popupStatusClass}">
          ${statusText}
        </div>
      </div>
    `);

    marker.on("click", () => {
      selectLab(lab.id);
      focusLab(lab.id);
    });

    markerMap[lab.id] = marker;

    const item = document.createElement("div");
    item.className = "lab-item";
    item.id = `list-${lab.id}`;

    item.innerHTML = `
      <div class="lab-name">${lab.name}</div>

      <div class="lab-meta">
        Coke: ${lab.tables.coke} • Crack: ${lab.tables.crack} • Plant: ${lab.tables.plant}
      </div>

      <div class="lab-meta">
        Status: <span class="${statusClass}">${statusText}</span>
      </div>
    `;

    item.addEventListener("click", () => {
      selectLab(lab.id);
      focusLab(lab.id);
    });

    labList.appendChild(item);
  });
}

function selectLab(id) {
  const lab = labs.find(l => l.id === id);
  if (!lab) return;

  selectedLabId = id;

  const statusText = isOpen(lab) ? "OPEN" : "CLOSED";
  const statusClass = isOpen(lab) ? "status-open" : "status-closed";

  document.getElementById("selectedLabBox").innerHTML = `
    Selected: <strong>${lab.name}</strong><br>
    Status: <span class="${statusClass}">${statusText}</span>
  `;

  highlightLab(id);
}

function focusLab(id) {
  const lab = labs.find(l => l.id === id);
  const marker = markerMap[id];

  if (!lab || !marker) return;

  const target = [lab.map.y, lab.map.x];
  const targetZoom = 1.75;

  map.stop();
  map.closePopup();

  map.flyTo(target, targetZoom, {
    animate: true,
    duration: 0.5
  });

  setTimeout(() => {
    marker.openPopup();
  }, 550);

  highlightLab(id);
}

function highlightLab(id) {
  document.querySelectorAll(".lab-item").forEach(item => {
    item.classList.remove("active");
  });

  const item = document.getElementById(`list-${id}`);

  if (item) {
    item.classList.add("active");
    item.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}

document.getElementById("showAllBtn").addEventListener("click", () => {
  currentFilter = "all";
  renderLabs();
});

document.getElementById("showOpenBtn").addEventListener("click", () => {
  currentFilter = "open";
  renderLabs();
});

document.getElementById("showClosedBtn").addEventListener("click", () => {
  currentFilter = "closed";
  renderLabs();
});

document.getElementById("labSearch").addEventListener("input", renderLabs);

renderLabs();

onSnapshot(openLabsDocRef, snapshot => {
  const data = snapshot.exists() ? snapshot.data() : {};
  const slots = Array.isArray(data.slots) ? data.slots.filter(Boolean) : [];

  openLabSet = new Set(slots);
  renderLabs();

  if (selectedLabId) {
    selectLab(selectedLabId);
  }
}, error => {
  console.error("Lab map Firebase watch failed:", error);
});

const params = new URLSearchParams(window.location.search);
const startingLabId = params.get("lab");

if (startingLabId) {
  setTimeout(() => {
    selectLab(startingLabId);
    focusLab(startingLabId);
  }, 500);
}
