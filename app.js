/* Grocery Unit Compare — no account, no server. All data stays in localStorage. */

const UNITS = {
  g:   { label: 'g',    dim: 'w', toBase: 1 },
  kg:  { label: 'kg',   dim: 'w', toBase: 1000 },
  oz:  { label: 'oz',   dim: 'w', toBase: 28.3495 },
  lb:  { label: 'lb',   dim: 'w', toBase: 453.592 },
  ml:  { label: 'mL',   dim: 'v', toBase: 1 },
  L:   { label: 'L',    dim: 'v', toBase: 1000 },
  each:{ label: 'each', dim: 'c', toBase: 1 },
};
const DIM_LABEL = { w: '100g', v: '100mL', c: 'each' };
const MAX_ITEMS = 4;
const LS_KEY = 'guc_history_v1';

let items = [blankItem(), blankItem()];
let history = loadHistory();

function blankItem() {
  return { name: '', store: '', price: '', qty: '', unit: 'g', packOn: false, packN: '2' };
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch (e) { return []; }
}
function saveHistory() {
  localStorage.setItem(LS_KEY, JSON.stringify(history));
}

/* ---- math ---- */
function analyze(item) {
  const u = UNITS[item.unit] || UNITS.g;
  const price = parseFloat(item.price);
  const qty = parseFloat(item.qty);
  let pack = 1;
  if (item.packOn) {
    pack = parseInt(item.packN, 10);
    if (!pack || pack < 1) return null;
  }
  if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return null;
  const totalBase = qty * pack * u.toBase;
  if (totalBase <= 0) return null;
  // per 100g / per 100mL for weight & volume; per 1 for count ("each")
  const per100 = u.dim === 'c' ? price / totalBase : (price / totalBase) * 100;
  return { per100, dim: u.dim, dimLabel: DIM_LABEL[u.dim], unitLabel: u.label };
}

function cheapestSeen(name, dim) {
  const key = name.trim().toLowerCase();
  const matches = history.filter(h => h.name.trim().toLowerCase() === key && h.dim === dim);
  if (!matches.length) return null;
  return Math.min.apply(null, matches.map(h => h.per100));
}

/* ---- compare rendering ---- */
const itemsEl = document.getElementById('items');
const resultsEl = document.getElementById('results');

function unitOptions(selected) {
  return Object.keys(UNITS).map(k =>
    '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + UNITS[k].label + '</option>'
  ).join('');
}

function renderItems() {
  itemsEl.innerHTML = '';
  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'card item';
    card.innerHTML =
      '<div class="card-head">' +
        '<input class="iname" placeholder="Product name (optional)" value="' + esc(item.name) + '">' +
        '<span class="best-badge" hidden>BEST</span>' +
      '</div>' +
      '<input class="istore" placeholder="Store (optional)" value="' + esc(item.store) + '">' +
      '<div class="grid">' +
        '<label>Price ($)<input class="iprice" inputmode="decimal" placeholder="0.00" value="' + esc(item.price) + '"></label>' +
        '<label>Size<input class="iqty" inputmode="decimal" placeholder="0" value="' + esc(item.qty) + '"></label>' +
        '<label>Unit<select class="iunit">' + unitOptions(item.unit) + '</select></label>' +
      '</div>' +
      '<label class="pack"><input type="checkbox" class="ipack"' + (item.packOn ? ' checked' : '') + '> Pack of ' +
        '<input class="ipackn" inputmode="numeric" value="' + esc(item.packN) + '"></label>' +
      '<div class="perunit"></div><div class="insight"></div>';
    wire(card, i);
    itemsEl.appendChild(card);
  });
  document.getElementById('addItem').style.display = items.length >= MAX_ITEMS ? 'none' : 'block';
  updateResults();
}

function wire(card, i) {
  const item = items[i];
  const refresh = () => {
    item.name = card.querySelector('.iname').value;
    item.store = card.querySelector('.istore').value;
    item.price = card.querySelector('.iprice').value;
    item.qty = card.querySelector('.iqty').value;
    item.unit = card.querySelector('.iunit').value;
    item.packOn = card.querySelector('.ipack').checked;
    item.packN = card.querySelector('.ipackn').value;
    updateResults();
  };
  card.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function money(n) { return '$' + n.toFixed(2); }

function updateResults() {
  const cards = itemsEl.querySelectorAll('.card.item');
  const analyzed = items.map((item, i) => ({ i, item, a: analyze(item) }));
  const valid = analyzed.filter(x => x.a);

  // BEST badges: cheapest within each dimension group
  const byDim = {};
  valid.forEach(x => { (byDim[x.a.dim] = byDim[x.a.dim] || []).push(x); });
  const bestIdx = new Set();
  Object.keys(byDim).forEach(dim => {
    const g = byDim[dim];
    if (g.length < 2) return;
    let best = g[0];
    g.forEach(x => { if (x.a.per100 < best.a.per100) best = x; });
    bestIdx.add(best.i);
  });

  cards.forEach((card, i) => {
    const x = analyzed[i];
    const perEl = card.querySelector('.perunit');
    const insEl = card.querySelector('.insight');
    const badge = card.querySelector('.best-badge');
    badge.hidden = !bestIdx.has(i);
    if (!x.a) { perEl.innerHTML = ''; insEl.innerHTML = ''; insEl.className = 'insight'; return; }
    perEl.innerHTML = money(x.a.per100) + ' <span class="dim-note">/ ' + x.a.dimLabel + '</span>';
    // history insight
    const nm = x.item.name.trim();
    insEl.className = 'insight';
    if (nm) {
      const seen = cheapestSeen(nm, x.a.dim);
      if (seen != null) {
        if (x.a.per100 < seen - 1e-9) {
          insEl.className = 'insight good';
          insEl.textContent = 'New best price! Cheapest seen was ' + money(seen) + '/' + x.a.dimLabel + '.';
        } else {
          insEl.className = 'insight warn';
          insEl.textContent = 'Cheapest seen: ' + money(seen) + '/' + x.a.dimLabel + ' — this is NOT a sale.';
        }
      }
    }
  });

  // summary
  resultsEl.innerHTML = '';
  if (valid.length >= 2) {
    const dims = Object.keys(byDim);
    dims.forEach(dim => {
      const g = byDim[dim];
      if (g.length < 2) return;
      const sorted = g.slice().sort((p, q) => p.a.per100 - q.a.per100);
      const cheap = sorted[0], pricey = sorted[sorted.length - 1];
      const pct = ((pricey.a.per100 - cheap.a.per100) / pricey.a.per100 * 100).toFixed(0);
      const nm = cheap.item.name.trim() ? ' <b>' + esc(cheap.item.name.trim()) + '</b>' : 'Item ' + (cheap.i + 1);
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = '<div class="res-line">' + nm + ' wins at <b>' + money(cheap.a.per100) + '/' + cheap.a.dimLabel + '</b> — ' + pct + '% cheaper than the priciest.</div>';
      resultsEl.appendChild(div);
    });
    if (dims.length > 1) {
      const note = document.createElement('div');
      note.className = 'card';
      note.innerHTML = '<div class="res-line" style="color:var(--muted);font-size:13.5px">Weight, volume and count items can\'t be ranked against each other — winners are per group.</div>';
      resultsEl.appendChild(note);
    }
  }
}

/* ---- actions ---- */
document.getElementById('addItem').addEventListener('click', () => {
  if (items.length >= MAX_ITEMS) return;
  items.push(blankItem());
  renderItems();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  items = [blankItem(), blankItem()];
  renderItems();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  let n = 0;
  const now = new Date().toISOString();
  items.forEach((item, i) => {
    const a = analyze(item);
    const nm = item.name.trim();
    if (a && nm) {
      history.unshift({ id: Date.now() + '_' + i, name: nm, store: item.store.trim(), date: now, per100: a.per100, dim: a.dim });
      n++;
    }
  });
  if (!n) { toast('Name at least one item to save it.'); return; }
  saveHistory();
  renderHistory();
  updateResults();
  toast(n === 1 ? 'Saved to history.' : n + ' items saved to history.');
});

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---- history tab ---- */
function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (!history.length) {
    list.innerHTML = '<div class="empty">Nothing saved yet.<br>Compare items, give them names, and tap "Save to history".</div>';
    return;
  }
  const groups = {};
  history.forEach(h => {
    const k = h.name.trim().toLowerCase() + '|' + h.dim;
    (groups[k] = groups[k] || []).push(h);
  });
  Object.keys(groups).forEach(k => {
    const g = groups[k].sort((a, b) => b.date.localeCompare(a.date));
    const cheap = Math.min.apply(null, g.map(h => h.per100));
    const dimLabel = DIM_LABEL[g[0].dim];
    const card = document.createElement('div');
    card.className = 'card hist-product';
    card.innerHTML =
      '<div class="hist-head"><div><div class="hist-name">' + esc(g[0].name) + '</div>' +
      '<div class="hist-meta">' + g.length + (g.length === 1 ? ' entry' : ' entries') + '</div></div>' +
      '<div class="hist-cheap">Best: ' + money(cheap) + '/' + dimLabel + '</div></div>' +
      '<div class="hist-entries"></div>';
    const entries = card.querySelector('.hist-entries');
    g.forEach(h => {
      const row = document.createElement('div');
      row.className = 'hist-entry';
      const d = new Date(h.date);
      const storeTxt = h.store ? ' @ ' + esc(h.store) : '';
      row.innerHTML = '<span>' + d.toLocaleDateString() + storeTxt + ' — <b>' + money(h.per100) + '/' + dimLabel + '</b></span>';
      const del = document.createElement('button');
      del.className = 'del'; del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        history = history.filter(x => x.id !== h.id);
        saveHistory(); renderHistory(); updateResults();
      });
      row.appendChild(del);
      entries.appendChild(row);
    });
    card.addEventListener('click', () => card.classList.toggle('open'));
    list.appendChild(card);
  });
}

/* ---- tabs ---- */
document.querySelectorAll('.bottomnav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bottomnav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-history') renderHistory();
  });
});

renderItems();
renderHistory();
