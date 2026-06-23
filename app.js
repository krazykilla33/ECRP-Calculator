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
const DEFAULT_OPEN_LABS = ['Island', 'Galilee (Right Lake)', 'Quarry', 'Paleto Train', 'Cement', '', '', ''];
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
function productLabel(product) { return product === 'XTC' ? 'Ecstasy' : product; }

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
          <div class="mini-stat"><span>Total drugs</span><strong>${batches.toLocaleString()}</strong></div>
          <div class="mini-stat"><span>Weight</span><strong>${rowWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>
          <div class="mini-stat"><span>Time</span><strong>${compactTime(rowTime)}</strong></div>
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
  }

  input.addEventListener('input', e => {
    const rowKey = e.target.closest('.cook-card').dataset.row;
    const field = e.target.dataset.field;

    state.setRows[rowKey][field] = field === 'fullTables'
      ? num(e.target.value)
      : e.target.value;

    save();
    buildFixedSetRows();
    calculateSetTotals();
  });
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

document.getElementById('bonusEnabled').addEventListener('change', e => {
  state.bonusEnabled = e.target.checked;
  save();
  calculateProducts();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  state.quantities = zeroQuantities();
  save();
  buildQuantityGrid();
  calculateProducts();
});

document.getElementById('resetFullTablesBtn').addEventListener('click', resetFullTablesToZero);

buildQuantityGrid();
buildSetCalculator();
calculateProducts();
