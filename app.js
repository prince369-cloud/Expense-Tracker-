// JS content trimmed for brevity
// Simple Expense Tracker - Separate JS file
// Data structure: [{id, title, amount, date, category, notes}]

const $ = id => document.getElementById(id);
let expenses = JSON.parse(localStorage.getItem('expenses_v1') || '[]');
let editingId = null;

// init
function init(){
  // default date to today
  const today = new Date().toISOString().slice(0,10);
  $('date').value = today;
  renderList();
  populateFilter();
  updateSummary();
  drawChart();
}

// Save / Add
$('saveBtn').addEventListener('click', ()=>{
  const title = $('title').value.trim();
  const amount = parseFloat($('amount').value);
  const date = $('date').value;
  const category = $('category').value;
  const notes = $('notes').value.trim();

  if(!title || !date || isNaN(amount)){
    alert('Please enter valid title, date and amount.');
    return;
  }

  if(editingId){
    // update
    const idx = expenses.findIndex(e=>e.id===editingId);
    if(idx>-1){
      expenses[idx] = {...expenses[idx], title, amount, date, category, notes};
      editingId = null;
      $('saveBtn').textContent = 'Add Expense';
    }
  } else {
    const item = {id:Date.now().toString(36), title, amount, date, category, notes};
    expenses.push(item);
  }

  persist();
  clearForm();
  renderList();
  updateSummary();
  populateFilter();
  drawChart();
});

$('clearBtn').addEventListener('click', ()=>{ clearForm(); });

function clearForm(){
  $('title').value=''; $('amount').value=''; $('notes').value='';
  $('date').value=new Date().toISOString().slice(0,10);
  $('category').value='Food';
  editingId = null;
  $('saveBtn').textContent = 'Add Expense';
}

function persist(){
  localStorage.setItem('expenses_v1', JSON.stringify(expenses));
}

function renderList(){
  const el = $('list');
  el.innerHTML='';
  if(expenses.length===0){
    el.innerHTML='<div style="padding:18px;color:var(--muted)">No expenses yet — add one from the left.</div>';
    return;
  }
  // sort desc by date
  const sorted = [...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));
  sorted.forEach(item=>{
    const node = document.createElement('div');
    node.className='expense-item';
    const color = colorForCategory(item.category);
    node.innerHTML = `
      <div class="left">
        <div class="tag" style="background:${color};color:#1b2130">${item.category[0] || 'X'}</div>
        <div>
          <div class="meta">${escapeHtml(item.title)} <small>${formatDate(item.date)} • ${escapeHtml(item.category)}</small></div>
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <div style="text-align:right;margin-right:6px">₹ ${formatNumber(item.amount)}</div>
        <div class="actions">
          <button class="icon-btn" onclick="editItem('${item.id}')" title="Edit">✏️</button>
          <button class="icon-btn" onclick="deleteItem('${item.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
    el.appendChild(node);
  });
}

function editItem(id){
  const item = expenses.find(e=>e.id===id);
  if(!item) return;
  $('title').value=item.title; $('amount').value=item.amount; $('date').value=item.date; $('category').value=item.category; $('notes').value=item.notes;
  editingId = id;
  $('saveBtn').textContent = 'Update';
  window.scrollTo({top:0,behavior:'smooth'});
}

function deleteItem(id){
  if(!confirm('Delete this expense?')) return;
  expenses = expenses.filter(e=>e.id!==id);
  persist(); renderList(); updateSummary(); populateFilter(); drawChart();
}

function updateSummary(){
  const total = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  $('total').textContent = '₹ ' + formatNumber(total);
  $('count').textContent = expenses.length;

  // monthly: current month
  const now = new Date();
  const monthSum = expenses.filter(e=>{
    const d = new Date(e.date);
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  }).reduce((s,e)=>s+Number(e.amount||0),0);
  $('monthly').textContent = '₹ ' + formatNumber(monthSum);
}

// Filter & Export
function populateFilter(){
  const sel = $('monthFilter');
  const months = new Map();
  expenses.forEach(e=>{
    const d=new Date(e.date);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const label = d.toLocaleString(undefined,{month:'short',year:'numeric'});
    months.set(key,label);
  });
  sel.innerHTML = '<option value="all">All</option>' + [...months.entries()].map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
}

document.getElementById('monthFilter').addEventListener('change', ()=>{ drawChart(); });

document.getElementById('exportBtn').addEventListener('click', ()=>{
  if(expenses.length===0){ alert('No expenses to export'); return; }
  const rows = [['Title','Amount','Date','Category','Notes']].concat(expenses.map(e=>[e.title,e.amount,e.date,e.category,e.notes]));
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='expenses.csv'; a.click(); URL.revokeObjectURL(url);
});

// Chart: simple bar chart using canvas
function drawChart(){
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');
  // size
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = 160 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // group by month
  const counts = {};
  const now = new Date();
  // 6 months keys
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    months.push({key,label:d.toLocaleString(undefined,{month:'short'})});
    counts[key]=0;
  }

  const filter = document.getElementById('monthFilter').value;
  expenses.forEach(e=>{
    const d=new Date(e.date); const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if(counts[key]!==undefined) counts[key]+=Number(e.amount||0);
  });

  const values = months.map(m=>counts[m.key]||0);
  const max = Math.max(...values,10);

  // draw axes
  const w = canvas.clientWidth; const h = 140;
  const padding=28; const barW = (w - padding*2) / values.length * 0.7;
  values.forEach((val,i)=>{
    const x = padding + i * ((w - padding*2) / values.length) + (( (w - padding*2) / values.length) - barW)/2;
    const height = (val / max) * (h - 40);
    const y = h - height + 10;
    // gradient
    const g = ctx.createLinearGradient(x, y, x, y+height);
    g.addColorStop(0, 'rgba(255,214,230,0.95)');
    g.addColorStop(1, 'rgba(168,213,226,0.95)');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, barW, height, 8, true, false);
    // label
    ctx.fillStyle = '#6e7288';
    ctx.font = '12px system-ui';
    ctx.fillText(months[i].label, x, h + 26);
    // value
    ctx.fillStyle = '#2b2f4a'; ctx.font='12px system-ui';
    ctx.fillText('₹' + formatNumber(values[i]), x, y - 6);
  });
}

// small utilities
function formatNumber(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:2}); }
function formatDate(s){ const d=new Date(s); return d.toLocaleDateString(); }
function colorForCategory(c){
  const map = {Food:'linear-gradient(135deg,var(--accent2),var(--accent1))', Transport:'linear-gradient(135deg,var(--accent3),var(--accent1))', Shopping:'linear-gradient(135deg,#ffe1f0,#cfeef7)', Bills:'linear-gradient(135deg,#fff2d6,#d5f3e3)', Health:'linear-gradient(135deg,#ffe6f0,#fff7d9)'};
  return map[c] || 'linear-gradient(135deg,var(--accent1),var(--accent2))';
}
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// rounded rect helper for canvas
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == 'undefined') stroke = true;
  if (typeof radius === 'undefined') radius = 5;
  if (typeof radius === 'number') radius = {tl: radius, tr: radius, br: radius, bl: radius};
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// initialise
init();

// redraw chart on resize
window.addEventListener('resize', ()=>{ drawChart(); });
