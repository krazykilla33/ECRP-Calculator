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
    { regex: /mari(?:j|ju|jua|juana)?|marijuana|weed|blunt/gi, appProduct: 'Blunt' },
    { regex: /lsd|1sd|l5d/gi, appProduct: 'LSD' },
    { regex: /ecstasy|extasy|xtc|xte/gi, appProduct: 'XTC' },
    { regex: /meth/gi, appProduct: 'Meth' },
    { regex: /cocaine|coke/gi, appProduct: 'Coke' },
    { regex: /crack/gi, appProduct: 'Crack' },
    { regex: /heroin/gi, appProduct: 'Heroin' }
  ];

  function detectTierHint(textBetweenProductAndQty) {
    const hint = String(textBetweenProductAndQty || '').toLowerCase();

    // Full or partial tier words
    if (/\blo(?:w)?\b/.test(hint) || /\(\s*l/.test(hint)) return 'Low';
    if (/\bme(?:d|di|diu|dium)?\b/.test(hint) || /\(\s*m/.test(hint)) return 'Medium';
    if (/\bhi(?:g|gh)?\b/.test(hint) || /\(\s*h/.test(hint)) return 'High';
    if (/\bto(?:p)?\b/.test(hint) || /\(\s*t/.test(hint)) return 'Top';

    // Single-letter fallback if OCR only catches L / M / H / T
    if (/\b l \b/.test(` ${hint} `)) return 'Low';
    if (/\b m \b/.test(` ${hint} `)) return 'Medium';
    if (/\b h \b/.test(` ${hint} `)) return 'High';
    if (/\b t \b/.test(` ${hint} `)) return 'Top';

    return null;
  }

  const detectedItems = [];

  for (const productPattern of productPatterns) {
    const matches = [...text.matchAll(productPattern.regex)];

    for (const match of matches) {
      const productStart = match.index;
      const productEnd = productStart + match[0].length;
      const afterProduct = text.slice(productEnd, productEnd + 100);

      const qtyMatch = afterProduct.match(/(\d{1,5})\s*x/i);
      if (!qtyMatch) continue;

      const qty = num(qtyMatch[1]);
      const beforeQty = afterProduct.slice(0, qtyMatch.index);
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

    // First pass: keep any tier OCR could clearly read
    for (const item of items) {
      if (!item.tier) continue;

      if (!found[item.tier]) found[item.tier] = {};
      found[item.tier][appProduct] = item.qty;
      usedTiers.add(item.tier);
    }

    // Second pass: infer missing/cut-off tiers by item order
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.tier) continue;

      let inferredTier = tierOrder[i];

      // If the position tier is already used, pick the first missing tier
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

  for (const tier of DATA.tiers.map(t => t.name)) {
    if (!values[tier]) continue;

    for (const product of DATA.products) {
      if (values[tier][product] === undefined) continue;
      lines.push(`${productLabel(product)} ${tier}: ${values[tier][product]}`);
    }
  }

  return lines.length ? lines.join('\n') : 'No matching drug values found yet.';
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

    const result = await window.Tesseract.recognize(file, 'eng');
    console.log('OCR RAW TEXT:', result.data.text);

    const values = parseDrugScreenshotText(result.data.text);

    pendingOcrValues = values;

    if (preview) {
      preview.textContent = ocrValuesToPreview(values);
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

function buildQuantityGrid() {
  const el = document.getElementById('quantityGrid');
  let html = '<table><thead><tr><th>Tier</th>' + DATA.products.map(p => `<th>${p}</th>`).join('') + '<th>Tier Total</th></tr></thead><tbody>';
  for (const tier of DATA.tiers) {
    html += `<tr><th>${tier.name}</th>`;
    for (const p of DATA.products) {
      const v = state.quantities?.[tier.name]?.[p] ?? 0;
      html += `<td><input type="number" min="0" step="1" value="${v}" data-tier="${tier.name}" data-product="${p}"></td>`;
    }
    html += `<td id="tier-${tier.name}">$0</td></tr>`;
  }
  html += '</tbody></table>';
  el.innerHTML = html;

el.querySelectorAll('input').forEach(i => {
  i.addEventListener('focus', e => {
    e.target.select();
  });

  i.addEventListener('click', e => {
    e.target.select();
  });

  i.addEventListener('input', e => {
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
    <div class="quantity-breakdown-item">
      <span>${productLabel(product)}</span>
      <strong>${totals[product].toLocaleString()}</strong>
    </div>
  `).join('');
}

function calculateProducts() {
  document.getElementById('bonusEnabled').checked = !!state.bonusEnabled;
  let grand = 0, byProduct = {};
  DATA.products.forEach(p => byProduct[p] = 0);
  for (const tier of DATA.tiers) {
    let tierTotal = 0;
    for (const p of DATA.products) {
      const total = num(state.quantities[tier.name]?.[p]) * productPrice(tier.name, p);
      tierTotal += total;
      byProduct[p] += total;
    }
    const cell = document.getElementById(`tier-${tier.name}`);
    if (cell) cell.textContent = money(tierTotal);
    grand += tierTotal;
  }
  const bonusTotal = state.bonusEnabled ? ['Meth', 'Heroin', 'Crack'].reduce((sum, p) => sum + (byProduct[p] || 0) * (DATA.bonus[p] || 0), 0) : 0;
  document.getElementById('grandTotal').textContent = money(grand);
  document.getElementById('bonusTotal').textContent = money(bonusTotal);
  document.getElementById('totalWithBonus').textContent = money(grand + bonusTotal);
  
  document.getElementById('productBreakdown').innerHTML = `
  <div class="breakdown-title-row product-value-title">
    <h3>Detailed Value Breakdown</h3>
    <span>Total value by product</span>
  </div>
  <div class="quantity-breakdown-grid">
    ${DATA.products.map(product => `
      <div class="quantity-breakdown-item">
        <span>${productLabel(product)}</span>
        <strong>${money(byProduct[product])}</strong>
      </div>
    `).join('')}
  </div>
`;

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

  document.getElementById('ingredientsTable').innerHTML = '<table><tbody>' + INGREDIENTS.map(i => `<tr><td>${i}</td><td>${ingredients[i].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`).join('') + '</tbody></table>';

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

const drugScreenshotInputEl = document.getElementById('drugScreenshotInput');
if (drugScreenshotInputEl) {
  drugScreenshotInputEl.addEventListener('change', e => {
    pendingOcrImageFile = e.target.files?.[0] || null;

    const status = document.getElementById('ocrStatus');
    if (status && pendingOcrImageFile) {
      status.textContent = `Screenshot selected: ${pendingOcrImageFile.name}`;
    }
  });
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

if (document.getElementById('drugScreenshotInput')) {
  document.addEventListener('paste', e => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (!imageItem) return;

    pendingOcrImageFile = imageItem.getAsFile();

    const status = document.getElementById('ocrStatus');
    if (status) {
      status.textContent = 'Screenshot pasted. Click Scan Screenshot.';
    }
  });
}

if (document.getElementById('quantityGrid')) {
  buildQuantityGrid();
  calculateProducts();
}

if (document.getElementById('setCalculator')) {
  buildSetCalculator();
  loadOpenLabsFromFirebaseOnce();
  watchOpenLabsFromFirebase();
}
