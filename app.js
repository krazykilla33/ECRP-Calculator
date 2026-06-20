const DATA = window.ECRP_DATA;
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const num = n => Number(n)||0;
const storeKey = 'ecrp-calculator-state-v1';
let state = JSON.parse(localStorage.getItem(storeKey) || 'null') || {
  quantities: structuredClone(DATA.defaultQuantities),
  bonusEnabled: DATA.bonus.enabledDefault,
  setRows: [{ lab: 'Island', product: 'Heroin', fullTables: 16, tableType: 'crackTables' }]
};
function save(){ localStorage.setItem(storeKey, JSON.stringify(state)); }
function productPrice(tier, product){ return DATA.tiers.find(t=>t.name===tier)?.prices?.[product] || 0; }
function buildQuantityGrid(){
  const el=document.getElementById('quantityGrid');
  let html='<table><thead><tr><th>Tier</th>'+DATA.products.map(p=>`<th>${p}</th>`).join('')+'<th>Tier Total</th></tr></thead><tbody>';
  for(const tier of DATA.tiers){
    html += `<tr><th>${tier.name}</th>`;
    for(const p of DATA.products){
      const v=state.quantities?.[tier.name]?.[p] ?? 0;
      html += `<td><input type="number" min="0" step="1" value="${v}" data-tier="${tier.name}" data-product="${p}"></td>`;
    }
    html += `<td id="tier-${tier.name}">$0</td></tr>`;
  }
  html+='</tbody></table>'; el.innerHTML=html;
  el.querySelectorAll('input').forEach(i=>i.addEventListener('input', e=>{ const {tier,product}=e.target.dataset; state.quantities[tier][product]=num(e.target.value); save(); calculateProducts(); }));
}
function calculateProducts(){
  document.getElementById('bonusEnabled').checked=!!state.bonusEnabled;
  let grand=0, byProduct={}; DATA.products.forEach(p=>byProduct[p]=0);
  for(const tier of DATA.tiers){
    let tierTotal=0;
    for(const p of DATA.products){ const total=num(state.quantities[tier.name]?.[p])*productPrice(tier.name,p); tierTotal+=total; byProduct[p]+=total; }
    const cell=document.getElementById(`tier-${tier.name}`); if(cell) cell.textContent=money(tierTotal); grand+=tierTotal;
  }
  const bonusTotal = state.bonusEnabled ? ['Meth','Heroin','Crack'].reduce((sum,p)=>sum+(byProduct[p]||0)*(DATA.bonus[p]||0),0) : 0;
  document.getElementById('grandTotal').textContent=money(grand);
  document.getElementById('bonusTotal').textContent=money(bonusTotal);
  document.getElementById('totalWithBonus').textContent=money(grand+bonusTotal);
  document.getElementById('productBreakdown').innerHTML='<table><thead><tr><th>Product</th><th>Total Value</th></tr></thead><tbody>'+DATA.products.map(p=>`<tr><td>${p}</td><td>${money(byProduct[p])}</td></tr>`).join('')+'</tbody></table>';
}
function tableOptions(selected){return [['cokeTables','Coke'],['crackTables','Crack'],['plantTables','Plant']].map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('')}
function options(list, selected, label='name'){return list.map(x=>`<option value="${x[label]}" ${x[label]===selected?'selected':''}>${x[label]}</option>`).join('')}
function buildSetRows(){
  const el=document.getElementById('setRows'); el.innerHTML='';
  state.setRows.forEach((row,idx)=>{
    const div=document.createElement('div'); div.className='set-row';
    div.innerHTML=`<div><label>Open Lab</label><select data-field="lab">${options(DATA.labs,row.lab)}</select></div><div><label>Cooking</label><select data-field="product">${options(DATA.setProducts,row.product)}</select></div><div><label>Table Type</label><select data-field="tableType">${tableOptions(row.tableType)}</select></div><div><label>Full Tables</label><input data-field="fullTables" type="number" min="0" step="1" value="${row.fullTables||0}"></div><button class="secondary" data-remove="${idx}">Remove</button>`;
    div.querySelectorAll('select,input').forEach(x=>x.addEventListener('input',e=>{ state.setRows[idx][e.target.dataset.field]=e.target.dataset.field==='fullTables'?num(e.target.value):e.target.value; save(); calculateSets(); }));
    div.querySelector('button').addEventListener('click',()=>{ state.setRows.splice(idx,1); save(); buildSetRows(); calculateSets(); });
    el.appendChild(div);
  });
}
function calculateSets(){
  let cost=0,value=0,profit=0,weight=0,seconds=0;
  for(const row of state.setRows){
    const lab=DATA.labs.find(l=>l.name===row.lab); const product=DATA.setProducts.find(p=>p.name===row.product); if(!lab||!product) continue;
    const tables=num(lab[row.tableType]); const full=num(row.fullTables); const batches=tables*full;
    cost += batches*num(product.costPerBatch); value += batches*num(product.valuePerBatch); profit += batches*num(product.profitPerBatch);
    weight += batches*num(DATA.weights[row.product] || DATA.weights[row.product+'s'] || 0);
    seconds += batches*num(DATA.cookTimesSecondsPerBatch[row.product] || 0);
  }
  document.getElementById('setCost').textContent=money(cost); document.getElementById('setValue').textContent=money(value); document.getElementById('setProfit').textContent=money(profit); document.getElementById('setWeight').textContent=weight.toLocaleString();
  const h=Math.floor(seconds/3600), m=Math.round((seconds%3600)/60); document.getElementById('setTime').textContent=(h?`${h}h `:'')+`${m}m`;
}
document.getElementById('bonusEnabled').addEventListener('change',e=>{state.bonusEnabled=e.target.checked;save();calculateProducts();});
document.getElementById('addSetRow').addEventListener('click',()=>{state.setRows.push({lab:DATA.labs[0].name, product:DATA.setProducts[0].name, tableType:'crackTables', fullTables:1});save();buildSetRows();calculateSets();});
document.getElementById('resetBtn').addEventListener('click',()=>{localStorage.removeItem(storeKey);location.reload();});
buildQuantityGrid(); buildSetRows(); calculateProducts(); calculateSets();
