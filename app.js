import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const DATA = window.ECRP_DATA;

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

const money = n => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(Number(n) || 0);
const num = n => Number(n) || 0;
const storeKey = 'ecrp-calculator-state-v2';

const TABLES = {
  crackTables: {
    label: 'Crack',
    labField: 'crackTables',
    allowedProducts: ['Crack', 'Heroin', 'XTC']
  },
  cokeTables: {
    label: 'Coke',
    labField: 'cokeTables',
    allowedProducts: ['Cocaine', 'LSD', 'Meth']
  },
  plantTables: {
    label: 'Plant',
    labField: 'plantTables',
    allowedProducts: ['Joint', 'Seeds']
  }
};

const SET_PRODUCTS = {
  Crack:   { costPerBatch: 200, valuePerBatch: 745, weight: 2,   timeSeconds: 180, recipe: { Plant: 1, Acid: 1, Lime: 1, Sodium: 1 } },
  Heroin:  { costPerBatch: 255, valuePerBatch: 895, weight: 2.5, timeSeconds: 225, recipe: { Plant: 1, Sodium: 1, Muriatic: 1, Ammonia: 1, Acetone: 1 } },
  XTC:     { costPerBatch: 155, valuePerBatch: 695, weight: 1.5, timeSeconds: 135, recipe: { Plant: 1, Muriatic: 1, Ammonia: 1 } },
  Cocaine: { costPerBatch: 200, valuePerBatch: 745, weight: 1.5, timeSeconds: 135, recipe: { Plant: 1, Acid: 1, Lime: 1 } },
  LSD:     { costPerBatch: 255, valuePerBatch: 770, weight: 1.5, timeSeconds: 135, recipe: { Lysergic: 1, Ammonia: 1, Phosphorus: 1 } },
  Meth:    { costPerBatch: 255, valuePerBatch: 745, weight: 2,   timeSeconds: 180, recipe: { Pseudo: 1, Toluene: 1, Lithium: 1, Ammonia: 1 } },
  Joint:   { costPerBatch: 0,   valuePerBatch: 570, weight: 1,   timeSeconds: 72,  recipe: { Plant: 2 } },
  Seeds:   { costPerBatch: 0,   valuePerBatch: 0,   weight: 0.5, timeSeconds: 1,   recipe: { Plant: 1 } }
};

const INGREDIENTS = ['Plant', 'Acid', 'Lime', 'Sodium', 'Muriatic', 'Toluene', 'Lysergic', 'Ammonia', 'Acetone', 'Lithium', 'Phosphorus', 'Pseudo'];
const DEFAULT_OPEN_LABS = DATA.openLabs || ['', '', '', '', '', '', '', ''];
const LAB_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function zeroQuantities() {
  const quantities = {};
  for (const tier of DATA.tiers) {
    quantities[tier.name] = {};
    for (const product of DATA.products) {
      quantities[tier.name][product] = 0;
    }
  }
  return quantities;
}

function resetFullTablesToZero() {
  for (const key of Object.keys(TABLES)) {
    if (!state.setRows[key]) state.setRows[key] = { product: TABLES[key].allowedProducts[0], fullTables: 0 };
    state.setRows[key].fullTables = 0;
  }
  save();
  buildFixedSetRows();
  calculateSetTotals();
}

function defaultState() {
  return {
    quantities: structuredClone(DATA.defaultQuantities),
    bonusEnabled: DATA.bonus.enabledDefault,
    openLabs: structuredClone(DEFAULT_OPEN_LABS),
    activeLab: 'Cement',
    lastUpdate: new Date().toISOString(),
    setRows: {
      crackTables: { product: 'Heroin', fullTables: 0 },
      cokeTables: { product: 'LSD', fullTables: 0 },
      plantTables: { product: 'Joint', fullTables: 0 }
    }
  };
}

let state = JSON.parse(localStorage.getItem(storeKey) || 'null') || defaultState();
if (!state.openLabs) state.openLabs = structuredClone(DEFAULT_OPEN_LABS);
if (!state.setRows || Array.isArray(state.setRows)) state.setRows = defaultState().setRows;
if (!state.lastUpdate) state.lastUpdate = new Date().toISOString();

function save() { localStorage.setItem(storeKey, JSON.stringify(state)); }
function productPrice(tier, product) { return DATA.tiers.find(t => t.name === tier)?.prices?.[product] || 0; }
function labByName(name) { return DATA.labs.find(l => l.name === name); }

function labMapUrlByName(name) {
  const lab = labByName(name);
  if (!lab || !lab.id || !lab.map || lab.map.x === null || lab.map.y === null) return '';
  return `lab-map.html?lab=${encodeURIComponent(lab.id)}`;
}

function labMapButtonHtml(name, label = 'Map') {
  const url = labMapUrlByName(name);
  if (!url) return `<span class="map-lab-btn disabled">No Map</span>`;
  return `<a class="map-lab-btn" href="${url}">${label}</a>`;
}
function openLabNames() { return state.openLabs.filter(Boolean); }

function openLabsCopyText() {
  const labs = openLabNames();

  if (!labs.length) {
    return 'Open Labs: None';
  }

  return `Open Labs: ${labs.join(', ')}`;
}

async function copyOpenLabsToClipboard() {
  const text = openLabsCopyText();
  const status = document.getElementById('copyOpenLabsStatus');

  try {
    await navigator.clipboard.writeText(text);

    if (status) {
      status.textContent = 'Copied!';
      setTimeout(() => status.textContent = '', 2000);
    }
  } catch (error) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);

    if (status) {
      status.textContent = 'Copied!';
      setTimeout(() => status.textContent = '', 2000);
    }
  }
}

function productLabel(product) { return product === 'XTC' ? 'Ecstasy' : product; }

function productIcon(product) {
  const icons = {
    Blunt: '🌿',
    XTC: '💊',
    Meth: '⚗️',
    Coke: '☁️',
    LSD: '🎇',
    Crack: '🪨',
    Heroin: '💉'
  };

  return icons[product] || '•';
}

let pendingOcrValues = null;
let pendingOcrImageFile = null;

const OCR_PRODUCT_ALIASES = {
  Marijuana: 'Blunt',
  Weed: 'Blunt',
  Blunt: 'Blunt',
  LSD: 'LSD',
  Ecstasy: 'XTC',
  XTC: 'XTC',
  Meth: 'Meth',
  Cocaine: 'Coke',
  Coke: 'Coke',
  Crack: 'Crack',
  Heroin: 'Heroin'
};

const OCR_TIERS = ['Low', 'Medium', 'High', 'Top'];

function normalizeOcrText(text) {
  return String(text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDrugScreenshotText(rawText) {
  const text = normalizeOcrText(rawText);
  const found = {};

  const tierOrder = ['Low', 'Medium', 'High', 'Top'];

  const productPatterns = [
    { regex: /mar\w{0,12}|mari\w{0,12}|weed|blunt/gi, appProduct: 'Blunt' },
    { regex: /lsd|1sd|l5d/gi, appProduct: 'LSD' },
    { regex: /ecstasy|extasy|frdacsv|fr<tacy|frtacy|xtc|xte/gi, appProduct: 'XTC' },
    { regex: /meth/gi, appProduct: 'Meth' },
    { regex: /cocaine|coke/gi, appProduct: 'Coke' },
    { regex: /crack/gi, appProduct: 'Crack' },
    { regex: /heroin/gi, appProduct: 'Heroin' }
  ];

  function detectTierHint(hintText) {
    const hint = String(hintText || '').toLowerCase();

    if (/\blo(?:w)?\b/.test(hint) || /\(\s*l/.test(hint) || /\bion\b/.test(hint)) return 'Low';
    if (/\bme(?:d|di|diu|dium)?\b/.test(hint) || /\(\s*m/.test(hint)) return 'Medium';
    if (/\bhi(?:g|gh|ghy|gh\w*)?\b/.test(hint) || /\(\s*h/.test(hint) || /\bhaoh/.test(hint)) return 'High';
    if (/\bto(?:p|n)?\b/.test(hint) || /\(\s*t/.test(hint) || /\bton\b/.test(hint)) return 'Top';

    return null;
  }

  function findNextProductIndex(text, startIndex) {
    let nextIndex = -1;

    for (const productPattern of productPatterns) {
      const regex = new RegExp(productPattern.regex.source, 'gi');
      regex.lastIndex = startIndex;

      const match = regex.exec(text);
      if (!match) continue;

      if (nextIndex === -1 || match.index < nextIndex) {
        nextIndex = match.index;
      }
    }

    return nextIndex;
  }

  const detectedItems = [];

  for (const productPattern of productPatterns) {
    const regex = new RegExp(productPattern.regex.source, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const productStart = match.index;
      const productEnd = productStart + match[0].length;

      const nextProductIndex = findNextProductIndex(text, productEnd);
      const end = nextProductIndex === -1 ? productEnd + 80 : nextProductIndex;

      const chunk = text.slice(productEnd, end);

      const qtyMatch = chunk.match(/(\d{1,5})\s*x/i);
      if (!qtyMatch) continue;

      const qty = num(qtyMatch[1]);
      const beforeQty = chunk.slice(0, qtyMatch.index);
      const detectedTier = detectTierHint(beforeQty);

      detectedItems.push({
        index: productStart,
        appProduct: productPattern.appProduct,
        tier: detectedTier,
        qty
      });
    }
  }

  const groupedByProduct = {};

  for (const item of detectedItems) {
    if (!groupedByProduct[item.appProduct]) groupedByProduct[item.appProduct] = [];
    groupedByProduct[item.appProduct].push(item);
  }

  for (const [appProduct, items] of Object.entries(groupedByProduct)) {
    items.sort((a, b) => a.index - b.index);

    const usedTiers = new Set();

    for (const item of items) {
      if (!item.tier) continue;

      if (!found[item.tier]) found[item.tier] = {};
      found[item.tier][appProduct] = item.qty;
      usedTiers.add(item.tier);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.tier) continue;

      let inferredTier = tierOrder[i];

      if (usedTiers.has(inferredTier)) {
        inferredTier = tierOrder.find(tier => !usedTiers.has(tier));
      }

      if (!inferredTier) continue;

      if (!found[inferredTier]) found[inferredTier] = {};
      found[inferredTier][appProduct] = item.qty;
      usedTiers.add(inferredTier);
    }
  }

  return found;
}

function ocrValuesToPreview(values) {
  if (!values || !Object.keys(values).length) {
    return 'No matching drug values found yet.';
  }

  const lines = [];
  const productOrder = ['Blunt', 'LSD', 'XTC', 'Meth', 'Coke', 'Crack', 'Heroin'];
  const tierOrder = ['Low', 'Medium', 'High', 'Top'];

  for (const product of productOrder) {
    for (const tier of tierOrder) {
      if (!values[tier]) continue;
      if (values[tier][product] === undefined) continue;

      lines.push(`${productLabel(product)} ${tier}: ${values[tier][product]}`);
    }
  }

  return lines.length ? lines.join('\n') : 'No matching drug values found yet.';
}

function prepareImageForOcr(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = 4;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        let boosted = (gray - 80) * 2.2 + 80;
        boosted = Math.max(0, Math.min(255, boosted));

        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Could not prepare image for OCR.'));
          return;
        }

        resolve(blob);
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };

    img.src = url;
  });
}

async function scanDrugScreenshotFile(file) {
  const status = document.getElementById('ocrStatus');
  const preview = document.getElementById('ocrPreview');

  if (!file) {
    if (status) status.textContent = 'Choose or paste a screenshot first.';
    return;
  }

  if (!window.Tesseract) {
    if (status) status.textContent = 'OCR library did not load. Refresh the page and try again.';
    return;
  }

  try {
    if (status) status.textContent = 'Scanning screenshot... this may take a few seconds.';
    if (preview) preview.textContent = '';

    const preparedImage = await prepareImageForOcr(file);

    const result = await window.Tesseract.recognize(preparedImage, 'eng', {
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789() .x',
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: '6'
    });

    console.log('OCR RAW TEXT:', result.data.text);

    const values = parseDrugScreenshotText(result.data.text);

    pendingOcrValues = values;

    if (preview) {
      preview.textContent = ocrValuesToPreview(values);
      preview.classList.remove('hidden');
    }

    if (status) {
      status.textContent = 'Scan complete. Review the values, then click Apply Found Values.';
    }
  } catch (error) {
    console.error('OCR scan failed:', error);
    if (status) status.textContent = 'Scan failed. Try a clearer screenshot.';
  }
}

function applyOcrValuesToCalculator() {
  const status = document.getElementById('ocrStatus');

  if (!pendingOcrValues || !Object.keys(pendingOcrValues).length) {
    if (status) status.textContent = 'No OCR values to apply yet.';
    return;
  }

  for (const tier of DATA.tiers.map(t => t.name)) {
    if (!pendingOcrValues[tier]) continue;

    for (const product of DATA.products) {
      if (pendingOcrValues[tier][product] === undefined) continue;

      if (!state.quantities[tier]) state.quantities[tier] = {};
      state.quantities[tier][product] = pendingOcrValues[tier][product];
    }
  }

  save();
  buildQuantityGrid();
  calculateProducts();

  if (status) status.textContent = 'Values applied to calculator.';
}

function formatLastUpdate(timestamp) {
  if (!timestamp) return 'Not updated yet';

  const date = new Date(timestamp);

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(date);
}

function touchLastUpdate() {
  state.lastUpdate = new Date().toISOString();
}

async function saveOpenLabsToFirebase() {
  try {
    await setDoc(openLabsDocRef, {
      slots: state.openLabs,
      activeLab: state.activeLab,
      lastUpdate: state.lastUpdate,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Failed to save Open Labs to Firebase:", error);
  }
}

async function loadOpenLabsFromFirebaseOnce() {
  try {
    const snap = await getDoc(openLabsDocRef);

    if (snap.exists()) {
      const data = snap.data();

      if (Array.isArray(data.slots)) {
        state.openLabs = data.slots.slice(0, 8);

        while (state.openLabs.length < 8) {
          state.openLabs.push("");
        }
      }

      if (data.activeLab) {
        state.activeLab = data.activeLab;
      }

      if (data.lastUpdate) {
        state.lastUpdate = data.lastUpdate;
      }

      save();
      buildSetCalculator();
    } else {
      await saveOpenLabsToFirebase();
    }
  } catch (error) {
    console.error("Failed to load Open Labs from Firebase:", error);
  }
}

function watchOpenLabsFromFirebase() {
  onSnapshot(openLabsDocRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();

    if (Array.isArray(data.slots)) {
      state.openLabs = data.slots.slice(0, 8);

      while (state.openLabs.length < 8) {
        state.openLabs.push("");
      }
    }

    if (data.activeLab) {
      state.activeLab = data.activeLab;
    }

    if (data.lastUpdate) {
      state.lastUpdate = data.lastUpdate;
    }

    save();
    buildSetCalculator();
  }, error => {
    console.error("Open Labs Firebase watch failed:", error);
  });
}

function formatTime(seconds) {
  seconds = Math.round(seconds || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function optionHtml(value, label, selected) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label ?? value}</option>`;
}

function labOptions(selected, includeBlank = false) {
  const blank = includeBlank ? optionHtml('', 'UNKNOWN', selected) : '';

  const sortedLabs = [...DATA.labs].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return blank + sortedLabs.map(l => optionHtml(l.name, l.name, selected)).join('');
}

function buildPriceListTable() {
  const el = document.getElementById('priceListTable');
  if (!el) return;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Tier</th>
          ${DATA.products.map(product => `
            <th>
              <span class="product-table-head">
                <span>${productIcon(product)}</span>
                <span>${productLabel(product)}</span>
              </span>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  for (const tier of DATA.tiers) {
    html += `
      <tr>
        <th>${tier.name}</th>
        ${DATA.products.map(product => `
          <td>${Number(tier.prices?.[product] || 0).toLocaleString(undefined, {
            maximumFractionDigits: 2
          })}</td>
        `).join('')}
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  el.innerHTML = html;
}

function buildQuantityGrid() {
  const el = document.getElementById('quantityGrid');
  if (!el) return;

  let html = `
    <table>
      <thead>
        <tr>
          <th>Tier</th>
          ${DATA.products.map(product => `
            <th>
              <span class="product-table-head">
                <span>${productIcon(product)}</span>
                <span>${productLabel(product)}</span>
              </span>
            </th>
          `).join('')}
          <th>Tier Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const tier of DATA.tiers) {
    html += `<tr><th>${tier.name}</th>`;

    for (const product of DATA.products) {
      const value = state.quantities?.[tier.name]?.[product] ?? 0;

      html += `
        <td>
          <input
            type="number"
            min="0"
            step="1"
            value="${value}"
            data-tier="${tier.name}"
            data-product="${product}"
          >
        </td>
      `;
    }

    html += `<td id="tier-${tier.name}">$0</td></tr>`;
  }

  html += `
      </tbody>
    </table>
  `;

  el.innerHTML = html;

  el.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', e => {
      e.target.select();
    });

    input.addEventListener('click', e => {
      e.target.select();
    });

    input.addEventListener('input', e => {
      const { tier, product } = e.target.dataset;
      state.quantities[tier][product] = num(e.target.value);
      save();
      calculateProducts();
    });
  });
}

function buildQuantityBreakdown() {
  const el = document.getElementById('quantityBreakdown');
  if (!el) return;

  const totals = {};
  DATA.products.forEach(product => totals[product] = 0);

  for (const tier of DATA.tiers) {
    for (const product of DATA.products) {
      totals[product] += num(state.quantities?.[tier.name]?.[product]);
    }
  }

  el.innerHTML = DATA.products.map(product => `
    <div class="quantity-breakdown-item dashboard-product-card">
      <span>
        <span class="product-icon">${productIcon(product)}</span>
        ${productLabel(product)}
      </span>
      <strong>${totals[product].toLocaleString()}</strong>
    </div>
  `).join('');
}

function calculateProducts() {
  const bonusEnabledEl = document.getElementById('bonusEnabled');
  if (bonusEnabledEl) {
    bonusEnabledEl.checked = !!state.bonusEnabled;
  }

  let grand = 0;
  const byProduct = {};

  DATA.products.forEach(product => {
    byProduct[product] = 0;
  });

  for (const tier of DATA.tiers) {
    let tierTotal = 0;

    for (const product of DATA.products) {
      const total = num(state.quantities[tier.name]?.[product]) * productPrice(tier.name, product);
      tierTotal += total;
      byProduct[product] += total;
    }

    const cell = document.getElementById(`tier-${tier.name}`);
    if (cell) cell.textContent = money(tierTotal);

    grand += tierTotal;
  }

  const bonusTotal = state.bonusEnabled
    ? ['Meth', 'Heroin', 'Crack'].reduce((sum, product) => {
        return sum + (byProduct[product] || 0) * (DATA.bonus[product] || 0);
      }, 0)
    : 0;

  const grandTotalEl = document.getElementById('grandTotal');
  const bonusTotalEl = document.getElementById('bonusTotal');
  const totalWithBonusEl = document.getElementById('totalWithBonus');

  if (grandTotalEl) grandTotalEl.textContent = money(grand);
  if (bonusTotalEl) bonusTotalEl.textContent = money(bonusTotal);
  if (totalWithBonusEl) totalWithBonusEl.textContent = money(grand + bonusTotal);

  const maxProductValue = Math.max(...Object.values(byProduct), 1);

  const productBreakdownEl = document.getElementById('productBreakdown');
  if (productBreakdownEl) {
    productBreakdownEl.innerHTML = `
      <div class="breakdown-title-row product-value-title">
        <h3>Product Value Breakdown</h3>
        <span>Total value by product</span>
      </div>

      <div class="quantity-breakdown-grid dashboard-breakdown-grid value-breakdown-grid">
        ${DATA.products.map(product => {
          const value = byProduct[product] || 0;
          const percent = Math.round((value / maxProductValue) * 100);

          return `
            <div class="quantity-breakdown-item dashboard-product-card value-product-card">
              <span>
                <span class="product-icon">${productIcon(product)}</span>
                ${productLabel(product)}
              </span>

              <strong>${money(value)}</strong>

              <div class="value-bar-track">
                <div class="value-bar-fill" style="width:${percent}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  buildQuantityBreakdown();
}

function compactTime(seconds) {
  seconds = Math.round(seconds || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function updateCookCardStats(rowKey) {
  const cfg = TABLES[rowKey];
  const lab = labByName(state.activeLab) || DATA.labs[0];
  const row = state.setRows[rowKey];
  const product = SET_PRODUCTS[row.product];

  const tableCount = num(lab[cfg.labField]);
  const fullTables = num(row.fullTables);
  const batches = tableCount * fullTables;
  const rowTime = fullTables * product.timeSeconds;
  const rowWeight = batches * product.weight;

  const card = document.querySelector(`.cook-card[data-row="${rowKey}"]`);
  if (!card) return;

  const drugsEl = card.querySelector('[data-mini="drugs"]');
  const weightEl = card.querySelector('[data-mini="weight"]');
  const timeEl = card.querySelector('[data-mini="time"]');

  if (drugsEl) drugsEl.textContent = batches.toLocaleString();
  if (weightEl) weightEl.textContent = rowWeight.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (timeEl) timeEl.textContent = compactTime(rowTime);
}

function buildOpenLabs() {
  const el = document.getElementById('openLabsList');
  el.innerHTML = state.openLabs.map((lab, idx) => `
    <div class="open-lab-row ${lab ? 'filled' : 'empty'}">
      <div class="lab-letter">${LAB_LETTERS[idx]}</div>
      <select data-open-index="${idx}">${labOptions(lab, true)}</select>
      ${lab ? labMapButtonHtml(lab, 'Map') : '<span class="map-lab-btn disabled">Map</span>'}
    </div>
  `).join('');

  el.querySelectorAll('select').forEach(sel => sel.addEventListener('change', e => {
    const idx = Number(e.target.dataset.openIndex);
    state.openLabs[idx] = e.target.value;

    touchLastUpdate();

    if (!openLabNames().includes(state.activeLab)) {
      state.activeLab = openLabNames()[0] || DATA.labs[0].name;
    }

    save();
    buildSetCalculator();
    saveOpenLabsToFirebase();
  }));
}

function buildActiveLabSelect() {
  const select = document.getElementById('activeLabSelect');
  const labs = openLabNames();
  if (labs.length && !labs.includes(state.activeLab)) state.activeLab = labs[0];
  const source = labs.length ? labs : DATA.labs.map(l => l.name);
  select.innerHTML = source.map(name => optionHtml(name, name, state.activeLab)).join('');
  select.value = state.activeLab;
  select.onchange = e => {
  state.activeLab = e.target.value;

  save();
  buildSetCalculator();
  saveOpenLabsToFirebase();
};

  const lab = labByName(state.activeLab) || DATA.labs[0];
  document.getElementById('activeLabStats').innerHTML = `
    <div class="stat-pill"><span>Crack Tables</span><strong>${num(lab.crackTables)}</strong></div>
    <div class="stat-pill"><span>Coke Tables</span><strong>${num(lab.cokeTables)}</strong></div>
    <div class="stat-pill"><span>Plant Tables</span><strong>${num(lab.plantTables)}</strong></div>
    <div class="stat-pill map-stat-pill"><span>Location</span><strong>${labMapButtonHtml(lab.name, 'Show Map')}</strong></div>
  `;
}

function buildFixedSetRows() {
  const el = document.getElementById('fixedSetRows');
  const lab = labByName(state.activeLab) || DATA.labs[0];
  el.innerHTML = Object.entries(TABLES).map(([key, cfg]) => {
    const row = state.setRows[key] || { product: cfg.allowedProducts[0], fullTables: 0 };
    if (!cfg.allowedProducts.includes(row.product)) row.product = cfg.allowedProducts[0];
    const tableCount = num(lab[cfg.labField]);
    const product = SET_PRODUCTS[row.product];
    const fullTables = num(row.fullTables);
    const batches = tableCount * fullTables;
    const rowTime = fullTables * product.timeSeconds;
    const rowWeight = batches * product.weight;
    const disabled = tableCount <= 0;
    const options = cfg.allowedProducts.map(p => optionHtml(p, productLabel(p), row.product)).join('');
    return `
      <div class="cook-card ${disabled ? 'disabled' : ''}" data-row="${key}">
        <div class="cook-head">
          <h4>${cfg.label} Tables</h4>
          <span class="badge">${tableCount} available</span>
        </div>
        <div class="field">
          <label>Cooking</label>
          <select data-field="product">${options}</select>
        </div>
        <div class="field">
          <label>Full Tables</label>
          <input data-field="fullTables" type="number" min="0" step="1" value="${fullTables}">
        </div>
        <div class="cook-meta">
          <div class="mini-stat"><span>Total drugs</span><strong data-mini="drugs">${batches.toLocaleString()}</strong></div>
          <div class="mini-stat"><span>Weight</span><strong data-mini="weight">${rowWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>
          <div class="mini-stat"><span>Time</span><strong data-mini="time">${compactTime(rowTime)}</strong></div>
          <div class="mini-stat"><span>Allowed</span><strong>${cfg.allowedProducts.map(productLabel).join(', ')}</strong></div>
       </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('select,input').forEach(input => {
    if (input.type === 'number') {
      input.addEventListener('focus', e => {
        e.target.select();
      });

      input.addEventListener('click', e => {
        e.target.select();
      });

      input.addEventListener('input', e => {
        const rowKey = e.target.closest('.cook-card').dataset.row;
        const field = e.target.dataset.field;

        state.setRows[rowKey][field] = num(e.target.value);

        save();
        updateCookCardStats(rowKey);
        calculateSetTotals();
      });
    } else {
      input.addEventListener('change', e => {
        const rowKey = e.target.closest('.cook-card').dataset.row;
        const field = e.target.dataset.field;

        state.setRows[rowKey][field] = e.target.value;

        save();
        buildFixedSetRows();
        calculateSetTotals();
      });
    }
  });
}

function calculateSetTotals() {
  const lab = labByName(state.activeLab) || DATA.labs[0];
  const ingredients = Object.fromEntries(INGREDIENTS.map(i => [i, 0]));
  const totalDrugs = [];
  let cost = 0, value = 0, weight = 0, maxTime = 0;

  for (const [key, cfg] of Object.entries(TABLES)) {
    const row = state.setRows[key];
    const product = SET_PRODUCTS[row.product];
    const tableCount = num(lab[cfg.labField]);
    const fullTables = num(row.fullTables);
    const batches = tableCount * fullTables;
    const rowTime = fullTables * product.timeSeconds;
    maxTime = Math.max(maxTime, rowTime);

    cost += batches * product.costPerBatch;
    value += batches * product.valuePerBatch;
    weight += batches * product.weight;

    if (batches > 0) totalDrugs.push({ product: productLabel(row.product), qty: batches });
    for (const [ing, qty] of Object.entries(product.recipe)) {
      ingredients[ing] = (ingredients[ing] || 0) + batches * qty;
    }
  }

  const profit = value - cost;
  const perHourMultiplier = maxTime ? 3600 / maxTime : 0;

  document.getElementById('setTotalCost').textContent = money(cost);
  document.getElementById('setTotalValue').textContent = money(value);
  document.getElementById('setTotalProfit').textContent = money(profit);
  document.getElementById('setTotalWeight').textContent = weight.toLocaleString(undefined, { maximumFractionDigits: 1 });
  document.getElementById('setTotalTime').textContent = compactTime(maxTime);

  const usedIngredients = INGREDIENTS.filter(i => num(ingredients[i]) > 0);

  document.getElementById('ingredientsTable').innerHTML = `
    <table>
      <tbody>
        ${
          usedIngredients.length
            ? usedIngredients.map(i => `
                <tr>
                  <td>${i}</td>
                  <td>${ingredients[i].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              `).join('')
            : '<tr><td>No ingredients required</td><td>0</td></tr>'
        }
      </tbody>
    </table>
  `;

  document.getElementById('totalDrugsTable').innerHTML = `
    <table>
      <tbody>
        ${totalDrugs.map(d => `<tr><td>${d.product}</td><td>${d.qty.toLocaleString()}</td></tr>`).join('') || '<tr><td>No products</td><td>0</td></tr>'}
        <tr class="total-line"><td>Total</td><td>${totalDrugs.reduce((s, d) => s + d.qty, 0).toLocaleString()}</td></tr>
      </tbody>
    </table>`;

  document.getElementById('perBatchTable').innerHTML = `
    <table>
      <tbody>
        <tr><td>Cost</td><td>${money(cost)}</td></tr>
        <tr><td>Value</td><td>${money(value)}</td></tr>
        <tr class="total-line"><td>Profit</td><td>${money(profit)}</td></tr>
      </tbody>
    </table>`;

  document.getElementById('perHourTable').innerHTML = `
    <table>
      <tbody>
        <tr><td>Cost</td><td>${money(cost * perHourMultiplier)}</td></tr>
        <tr><td>Value</td><td>${money(value * perHourMultiplier)}</td></tr>
        <tr class="total-line"><td>Profit</td><td>${money(profit * perHourMultiplier)}</td></tr>
      </tbody>
    </table>`;
}

function buildSetCalculator() {
  document.getElementById('lastUpdate').textContent = formatLastUpdate(state.lastUpdate);
  buildOpenLabs();
  buildActiveLabSelect();
  buildFixedSetRows();
  calculateSetTotals();
}

const bonusEnabledEl = document.getElementById('bonusEnabled');
if (bonusEnabledEl) {
  bonusEnabledEl.addEventListener('change', e => {
    state.bonusEnabled = e.target.checked;
    save();
    calculateProducts();
  });
}

const resetBtnEl = document.getElementById('resetBtn');
if (resetBtnEl) {
  resetBtnEl.addEventListener('click', () => {
    state.quantities = zeroQuantities();
    save();
    buildQuantityGrid();
    calculateProducts();
  });
}

const resetFullTablesBtnEl = document.getElementById('resetFullTablesBtn');
if (resetFullTablesBtnEl) {
  resetFullTablesBtnEl.addEventListener('click', resetFullTablesToZero);
}

const copyOpenLabsBtnEl = document.getElementById('copyOpenLabsBtn');
if (copyOpenLabsBtnEl) {
  copyOpenLabsBtnEl.addEventListener('click', copyOpenLabsToClipboard);
}

const scanScreenshotBtnEl = document.getElementById('scanScreenshotBtn');
if (scanScreenshotBtnEl) {
  scanScreenshotBtnEl.addEventListener('click', () => {
    scanDrugScreenshotFile(pendingOcrImageFile);
  });
}

const applyOcrBtnEl = document.getElementById('applyOcrBtn');
if (applyOcrBtnEl) {
  applyOcrBtnEl.addEventListener('click', applyOcrValuesToCalculator);
}

const togglePriceListBtnEl = document.getElementById('togglePriceListBtn');
if (togglePriceListBtnEl) {
  togglePriceListBtnEl.addEventListener('click', () => {
    const panel = document.getElementById('priceListPanel');
    if (!panel) return;

    panel.classList.toggle('hidden');

    if (!panel.classList.contains('hidden')) {
      buildPriceListTable();
      togglePriceListBtnEl.textContent = 'Hide Prices';
    } else {
      togglePriceListBtnEl.textContent = 'Price List';
    }
  });
}

const ocrPasteBoxEl = document.getElementById('ocrPasteBox');
if (ocrPasteBoxEl) {
  ocrPasteBoxEl.addEventListener('click', () => {
    ocrPasteBoxEl.focus();
  });

  document.addEventListener('paste', e => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (!imageItem) return;

    pendingOcrImageFile = imageItem.getAsFile();

    const status = document.getElementById('ocrStatus');
    const preview = document.getElementById('ocrPreview');

    if (status) {
      status.textContent = 'Screenshot pasted. Click Scan Screenshot.';
    }

    if (preview) {
      preview.textContent = '';
      preview.classList.add('hidden');
    }

    ocrPasteBoxEl.textContent = 'Pasted ✓';
  });
}

if (document.getElementById('quantityGrid')) {
  buildPriceListTable();
  buildQuantityGrid();
  calculateProducts();
}

if (document.getElementById('setCalculator')) {
  buildSetCalculator();
  loadOpenLabsFromFirebaseOnce();
  watchOpenLabsFromFirebase();
}
