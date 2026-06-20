const DATA = window.ECRP_DATA;

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
const DEFAULT_OPEN_LABS = ['Island', 'Galilee', 'Quarry', 'Paleto Train', 'Cement', '', '', ''];
const LAB_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function defaultState() {
  return {
    quantities: structuredClone(DATA.defaultQuantities),
    bonusEnabled: DATA.bonus.enabledDefault,
    openLabs: structuredClone(DEFAULT_OPEN_LABS),
    activeLab: 'Cement',
    setRows: {
      crackTables: { product: 'Heroin', fullTables: 16 },
      cokeTables: { product: 'LSD', fullTables: 27 },
      plantTables: { product: 'Joint', fullTables: 50 }
    }
  };
}

let state = JSON.parse(localStorage.getItem(storeKey) || 'null') || defaultState();
if (!state.openLabs) state.openLabs = structuredClone(DEFAULT_OPEN_LABS);
if (!state.setRows || Array.isArray(state.setRows)) state.setRows = defaultState().setRows;

function save() { localStorage.setItem(storeKey, JSON.stringify(state)); }
function productPrice(tier, product) { return DATA.tiers.find(t => t.name === tier)?.prices?.[product] || 0; }
function labByName(name) { return DATA.labs.find(l => l.name === name); }
function openLabNames() { return state.openLabs.filter(Boolean); }
function productLabel(product) { return product === 'XTC' ? 'XTC / Ecstasy' : product; }
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
  const blank = includeBlank ? optionHtml('', '', selected) : '';
  return blank + DATA.labs.map(l => optionHtml(l.name, l.name, selected)).join('');
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
  el.querySelectorAll('input').forEach(i => i.addEventListener('input', e => {
    const { tier, product } = e.target.dataset;
    state.quantities[tier][product] = num(e.target.value);
    save();
    calculateProducts();
  }));
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
  document.getElementById('productBreakdown').innerHTML = '<table><thead><tr><th>Product</th><th>Total Value</th></tr></thead><tbody>' + DATA.products.map(p => `<tr><td>${p}</td><td>${money(byProduct[p])}</td></tr>`).join('') + '</tbody></table>';
}

function buildOpenLabs() {
  const el = document.getElementById('openLabsList');
  el.innerHTML = state.openLabs.map((lab, idx) => `
    <div class="open-lab-row ${lab ? 'filled' : 'empty'}">
      <select data-open-index="${idx}">${labOptions(lab, true)}</select>
      <div class="lab-letter">${LAB_LETTERS[idx]}</div>
    </div>
  `).join('');

  el.querySelectorAll('select').forEach(sel => sel.addEventListener('change', e => {
    const idx = Number(e.target.dataset.openIndex);
    state.openLabs[idx] = e.target.value;
    if (!openLabNames().includes(state.activeLab)) state.activeLab = openLabNames()[0] || DATA.labs[0].name;
    save();
    buildSetCalculator();
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
  };
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
    const rowTime = fullTables * product.timeSeconds;
    const rowWeight = tableCount * fullTables * product.weight;
    const options = cfg.allowedProducts.map(p => optionHtml(p, productLabel(p), row.product)).join('');
    return `
      <div class="calc-row" data-row="${key}">
        <div class="mini-cell table-name">${cfg.label}</div>
        <div class="mini-cell readonly">${tableCount}</div>
        <select data-field="product">${options}</select>
        <input data-field="fullTables" type="number" min="0" step="1" value="${fullTables}">
        <div class="mini-cell readonly">${formatTime(rowTime)}</div>
        <div class="mini-cell readonly row-weight">${rowWeight ? rowWeight.toLocaleString(undefined, { maximumFractionDigits: 1 }) : ''}</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('select,input').forEach(input => input.addEventListener('input', e => {
    const rowKey = e.target.closest('.calc-row').dataset.row;
    const field = e.target.dataset.field;
    state.setRows[rowKey][field] = field === 'fullTables' ? num(e.target.value) : e.target.value;
    save();
    calculateSetTotals();
    buildFixedSetRows();
  }));
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

  document.querySelector('.top-calc-row .heading:last-child').innerHTML = `Total Weight<br><strong>${weight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>`;

  document.getElementById('ingredientsTable').innerHTML = '<table class="sheet-table compact"><tbody>' + INGREDIENTS.map(i => `<tr><td>${i}</td><td>${ingredients[i].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>`).join('') + '</tbody></table>';

  document.getElementById('totalDrugsTable').innerHTML = `
    <table class="sheet-table compact total-drugs">
      <thead><tr><th colspan="2">Total Drugs</th></tr></thead>
      <tbody>
        ${totalDrugs.map(d => `<tr><td>${d.product}</td><td>${d.qty.toLocaleString()}</td></tr>`).join('')}
        <tr class="total-line"><td></td><td>${totalDrugs.reduce((s, d) => s + d.qty, 0).toLocaleString()}</td></tr>
      </tbody>
    </table>`;

  document.getElementById('perBatchTable').innerHTML = `
    <table class="sheet-table compact money-table">
      <thead><tr><th></th><th>Per Batch</th></tr></thead>
      <tbody>
        <tr><td>Cost</td><td>${money(cost)}</td></tr>
        <tr><td>Value</td><td>${money(value)}</td></tr>
        <tr class="total-line"><td>Profit</td><td>${money(profit)}</td></tr>
      </tbody>
    </table>`;

  document.getElementById('perHourTable').innerHTML = `
    <table class="sheet-table compact money-table">
      <thead><tr><th></th><th>Per Hour</th></tr></thead>
      <tbody>
        <tr><td>Cost</td><td>${money(cost * perHourMultiplier)}</td></tr>
        <tr><td>Value</td><td>${money(value * perHourMultiplier)}</td></tr>
        <tr class="total-line"><td>Profit</td><td>${money(profit * perHourMultiplier)}</td></tr>
      </tbody>
    </table>`;
}

function buildSetCalculator() {
  document.getElementById('lastUpdate').textContent = '20-6-2026';
  buildOpenLabs();
  buildActiveLabSelect();
  buildFixedSetRows();
  calculateSetTotals();
}

document.getElementById('bonusEnabled').addEventListener('change', e => {
  state.bonusEnabled = e.target.checked;
  save();
  calculateProducts();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  localStorage.removeItem(storeKey);
  location.reload();
});

buildQuantityGrid();
buildSetCalculator();
calculateProducts();
