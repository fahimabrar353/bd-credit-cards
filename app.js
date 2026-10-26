const { banks, cards, offers, updated } = window.DATA;
const $ = s => document.querySelector(s);
const bankById = Object.fromEntries(banks.map(b => [b.id, b]));
const TODAY = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

// ---------- formatting ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);
const val = v => empty(v) ? '—' : Array.isArray(v) ? v.map(esc).join('<br>') : esc(v);
const bdt = n => empty(n) ? '—' : typeof n === 'number' ? 'BDT ' + n.toLocaleString('en-IN') : esc(n);
const fee = n => n === 0 ? 'Free' : bdt(n);
const yn = v => v == null ? '—' : v ? 'Yes' : 'No';
const safeUrl = u => /^https?:\/\//.test(u || '') ? u : null;
const link = (u, text) => safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${text}</a>` : '—';
const shortBank = name => (name || '').replace(/\s+(PLC|Limited|Ltd\.?)$/i, '');
const num = v => v === '' ? null : +v;
const flat = v => v == null ? '' : typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v);

const TIERS = ['classic', 'silver', 'gold', 'titanium', 'platinum', 'signature', 'world', 'infinite', 'world elite', 'reserve'];
const tierRank = t => TIERS.reduce((r, k, i) => (t || '').toLowerCase().includes(k) ? i : r, 0);

cards.forEach(c => {
  c.bankName = bankById[c.bank]?.name || c.bank;
  c.hay = (flat(c) + ' ' + c.bankName).toLowerCase();
});
offers.forEach(o => {
  o.bankName = bankById[o.bank]?.name || o.bank;
  o.hay = flat(o).toLowerCase() + ' ' + o.bankName.toLowerCase();
});

// ---------- filters ----------
const FEATURES = [
  ['domLounge', 'Domestic lounge', c => !!c.lounge?.domestic],
  ['intlLounge', 'International lounge', c => !!c.lounge?.international],
  ['pickup', 'Airport pickup / drop', c => !!c.airportPickup],
  ['meet', 'Meet & greet', c => !!c.meetGreet],
  ['dual', 'Dual currency', c => !!c.dualCurrency],
  ['emi', 'EMI facility', c => !!c.emi],
  ['cashback', 'Cashback', c => !!c.cashback],
  ['rewards', 'Reward points', c => !!c.rewards],
  ['insurance', 'Insurance', c => !!c.insurance],
  ['waiver', 'Fee waiver possible', c => c.annualFee === 0 || !!c.annualFeeWaiver],
  ['waiveTxn', 'Fee waived by transactions', c => typeof c.waiverTxns === 'number'],
  ['free', 'No annual fee', c => c.annualFee === 0],
];
const GROUPS = {
  fBank: [c => [c.bank], v => shortBank(bankById[v]?.name || v)],
  fNetwork: [c => [c.network]],
  fTier: [c => [c.tier]],
  fProgram: [c => [c.lounge?.program]],
  fEmployment: [c => c.employment || [], v => v[0].toUpperCase() + v.slice(1)],
};

const checkbox = (value, label, count) =>
  `<label class="check"><input type="checkbox" value="${esc(value)}"> ${esc(label)}<span class="count">${count}</span></label>`;

for (const [id, [get, label = v => v]] of Object.entries(GROUPS)) {
  const counts = {};
  cards.forEach(c => get(c).filter(Boolean).forEach(v => counts[v] = (counts[v] || 0) + 1));
  const keys = Object.keys(counts).sort(id === 'fTier'
    ? (a, b) => tierRank(a) - tierRank(b) || a.localeCompare(b)
    : (a, b) => label(a).localeCompare(label(b)));
  const fs = document.getElementById(id);
  fs.insertAdjacentHTML('beforeend', keys.map(k => checkbox(k, label(k), counts[k])).join(''));
  fs.hidden = !keys.length;
}
$('#fFeatures').insertAdjacentHTML('beforeend',
  FEATURES.map(([k, label, f]) => checkbox(k, label, cards.filter(f).length)).join(''));

const checked = id => [...document.querySelectorAll(`#${id} input:checked`)].map(i => i.value);

function filteredCards() {
  const words = $('#search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const maxFee = num($('#fMaxFee').value);
  const income = num($('#fIncome').value);
  const txns = num($('#fTxns').value);
  const type = $('#fType').value;
  const feats = checked('fFeatures').map(k => FEATURES.find(f => f[0] === k)[2]);
  const groups = Object.entries(GROUPS).map(([id, [get]]) => [checked(id), get]).filter(([sel]) => sel.length);
  return cards.filter(c =>
    words.every(w => c.hay.includes(w)) &&
    (maxFee == null || (c.annualFee ?? Infinity) <= maxFee) &&
    (income == null || (c.minIncome ?? Infinity) <= income) &&
    (txns == null || c.annualFee === 0 || nz(c.waiverTxns) <= txns) &&
    (!type || (type === 'islamic') === !!c.islamic) &&
    feats.every(f => f(c)) &&
    groups.every(([sel, get]) => get(c).some(v => sel.includes(v))));
}

const nz = v => typeof v === 'number' ? v : Infinity;
const SORTS = {
  fee: (a, b) => nz(a.annualFee) - nz(b.annualFee),
  waiver: (a, b) => nz(a.annualFee === 0 ? 0 : a.waiverTxns) - nz(b.annualFee === 0 ? 0 : b.waiverTxns),
  income: (a, b) => nz(a.minIncome) - nz(b.minIncome),
  tier: (a, b) => tierRank(b.tier) - tierRank(a.tier),
  rate: (a, b) => nz(a.interestRate) - nz(b.interestRate),
  bank: (a, b) => a.bankName.localeCompare(b.bankName) || a.name.localeCompare(b.name),
};

const waiver = c => c.annualFee === 0 ? 'Not needed' :
  [typeof c.waiverTxns === 'number' && `${c.waiverTxns} txns/yr`, typeof c.waiverSpend === 'number' && `${bdt(c.waiverSpend)} spend/yr`]
    .filter(Boolean).join(' or ') || '—';

// ---------- card tile ----------
// Generated tile sits underneath; the official picture covers it and removes itself if it fails to load.
function visual(c) {
  const b = bankById[c.bank] || {};
  return `<div class="cc-visual" style="--c:${esc(b.color || '')}">
      <div class="bank">${esc(shortBank(b.name))}</div>
      <div class="chip"></div>
      <div class="bottom"><span>${esc(c.tier)}</span><span>${esc(c.network)}</span></div>
      ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" onerror="this.remove()">` : ''}
    </div>`;
}

function cardHTML(c) {
  const badges = (c.islamic ? '<span class="badge islamic">Islamic</span>' : '') +
    FEATURES.filter(([k, , f]) => k !== 'waiver' && f(c)).map(([, l]) => `<span class="badge">${l}</span>`).join('');
  return `<article class="cc" data-detail="${esc(c.id)}">
    ${visual(c)}
    <div><h3>${esc(c.name)}</h3><div class="muted small">${esc(c.bankName)}</div></div>
    <dl class="stats">
      <dt>Annual fee</dt><dd>${fee(c.annualFee)}</dd>
      <dt>Fee waived with</dt><dd>${waiver(c)}</dd>
      <dt>Min income</dt><dd>${empty(c.minIncome) ? '—' : bdt(c.minIncome) + '/mo'}</dd>
      <dt>Interest</dt><dd>${empty(c.interestRate) ? '—' : esc(c.interestRate) + '%'}</dd>
      <dt>Limit up to</dt><dd>${bdt(c.creditLimitMax)}</dd>
      <dt>Interest-free</dt><dd>${empty(c.interestFreeDays) ? '—' : esc(c.interestFreeDays) + ' days'}</dd>
    </dl>
    <div class="badges">${badges}</div>
    <div class="cc-actions">
      <button type="button" class="link" data-detail="${esc(c.id)}">Details</button>
      <label class="check"><input type="checkbox" data-compare="${esc(c.id)}" ${compare.has(c.id) ? 'checked' : ''}> Compare</label>
    </div>
  </article>`;
}

function renderCards() {
  const list = filteredCards().sort(SORTS[$('#sort').value]);
  $('#resultCount').textContent = `${list.length} of ${cards.length} cards`;
  const byBank = Map.groupBy(list, c => c.bankName);
  $('#cardGrid').innerHTML = [...byBank].sort(([x], [y]) => x.localeCompare(y))
    .map(([name, cs]) => `<h2 class="bank-head">${esc(name)} <span class="count">${cs.length}</span></h2>${cs.map(cardHTML).join('')}`)
    .join('') || '<p class="empty">No card matches these filters.</p>';
}

$('#filters').addEventListener('input', renderCards);
$('#search').addEventListener('input', renderCards);
$('#sort').addEventListener('change', renderCards);
$('#resetFilters').addEventListener('click', () => {
  document.querySelectorAll('#filters input[type=checkbox]').forEach(i => i.checked = false);
  document.querySelectorAll('#filters input[type=number], #filters select').forEach(i => i.value = '');
  renderCards();
});

// ---------- detail + compare share one field list ----------
const limit = c => empty(c.creditLimitMin) && empty(c.creditLimitMax) ? '—' : `${bdt(c.creditLimitMin)} – ${bdt(c.creditLimitMax)}`;
const age = c => empty(c.minAge) && empty(c.maxAge) ? '—' : `${c.minAge ?? '?'} – ${c.maxAge ?? '?'} years`;
const FIELDS = [
  ['Basics'],
  ['Bank', c => esc(c.bankName)],
  ['Network', c => val(c.network)],
  ['Tier', c => val(c.tier)],
  ['Type', c => c.islamic ? 'Islamic (Shariah)' : 'Conventional'],
  ['Dual currency', c => yn(c.dualCurrency)],
  ['Fees & charges'],
  ['Annual fee', c => fee(c.annualFee)],
  ['Fee waiver rule', c => val(c.annualFeeWaiver)],
  ['Waiver: transactions/yr', c => empty(c.waiverTxns) ? '—' : esc(c.waiverTxns)],
  ['Waiver: spend/yr', c => bdt(c.waiverSpend)],
  ['Issuance fee', c => fee(c.issuanceFee)],
  ['Supplementary card fee', c => fee(c.supplementaryFee)],
  ['Interest rate', c => empty(c.interestRate) ? '—' : esc(c.interestRate) + '% p.a.'],
  ['Interest-free period', c => empty(c.interestFreeDays) ? '—' : `Up to ${esc(c.interestFreeDays)} days`],
  ['Credit limit', limit],
  ['Cash advance fee', c => val(c.cashAdvanceFee)],
  ['Late payment fee', c => bdt(c.lateFee)],
  ['Requirements'],
  ['Min monthly income', c => bdt(c.minIncome)],
  ['Age', age],
  ['Employment', c => val(c.employment)],
  ['Documents', c => val(c.documents)],
  ['Travel'],
  ['Domestic lounge', c => val(c.lounge?.domestic)],
  ['International lounge', c => val(c.lounge?.international)],
  ['Lounge program', c => val(c.lounge?.program)],
  ['Airport pickup / drop', c => val(c.airportPickup)],
  ['Meet & greet', c => val(c.meetGreet)],
  ['Benefits'],
  ['Rewards', c => val(c.rewards)],
  ['Cashback', c => val(c.cashback)],
  ['EMI', c => val(c.emi)],
  ['Insurance', c => val(c.insurance)],
  ['Other perks', c => val(c.otherPerks)],
];
const INFO = [
  ['Info'],
  ['Notes', c => val(c.notes)],
  ['Source', c => link(c.sourceUrl, 'Bank page')],
  ['Schedule of charges', c => link(bankById[c.bank]?.socUrl, 'Official SOC')],
];
// Charge labels differ per card, so build rows from the union of labels in the shown cards.
const chargeRows = list => {
  const keys = [...new Set(list.flatMap(c => Object.keys(c.charges || {})))];
  return keys.length ? [['Schedule of charges'], ...keys.map(k => [k, c => val(c.charges?.[k])])] : [];
};
const rowsHTML = list => [...FIELDS, ...chargeRows(list), ...INFO].map(([label, fn]) => {
  if (!fn) return `<tr class="group"><th colspan="${list.length + 1}">${label}</th></tr>`;
  const cells = list.map(fn);
  const diff = list.length > 1 && new Set(cells).size > 1 ? ' class="diff"' : '';
  return `<tr${diff}><th>${esc(label)}</th>${cells.map(v => `<td>${v}</td>`).join('')}</tr>`;
}).join('');

const cardById = Object.fromEntries(cards.map(c => [c.id, c]));

function openDetail(id) {
  const c = cardById[id];
  $('#detailBody').innerHTML = `<div class="detail-head">${visual(c)}<div class="muted">${esc(c.bankName)}</div></div>
    <h2 class="detail-title">${esc(c.name)}</h2>
    <table class="kv">${rowsHTML([c])}</table>`;
  $('#detail').showModal();
  $('#detailBody').scrollTop = 0;
}

// click on backdrop targets the dialog element itself
$('#detail').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

let compare = new Set();
try { compare = new Set(JSON.parse(localStorage.getItem('compare') || '[]').filter(id => cardById[id])); } catch {}
const saveCompare = () => {
  $('#compareCount').textContent = compare.size;
  try { localStorage.setItem('compare', JSON.stringify([...compare])); } catch {}
};

function toggleCompare(id, on) {
  if (on && compare.size >= 4) alert('Compare up to 4 cards. Remove one first.');
  else if (on) compare.add(id);
  else compare.delete(id);
  document.querySelectorAll(`[data-compare="${CSS.escape(id)}"]`).forEach(i => i.checked = compare.has(id));
  saveCompare();
  if (location.hash === '#compare') renderCompare();
}

function renderCompare() {
  const list = [...compare].map(id => cardById[id]);
  $('#compareTable').innerHTML = list.length
    ? `<table class="cmp"><thead><tr><th></th>${list.map(c => `<th>${visual(c)}${esc(c.name)}<div class="muted small">${esc(shortBank(c.bankName))}</div>
        <button type="button" class="link small" data-uncompare="${esc(c.id)}">Remove</button></th>`).join('')}</tr></thead>
        <tbody>${rowsHTML(list)}</tbody></table>`
    : '<p class="empty">No cards selected yet.</p>';
}

document.addEventListener('click', e => {
  const d = e.target.closest('[data-detail]');
  if (d && !e.target.closest('label, input, a')) openDetail(d.dataset.detail);
  const u = e.target.closest('[data-uncompare]');
  if (u) toggleCompare(u.dataset.uncompare, false);
});
document.addEventListener('change', e => {
  if (e.target.dataset.compare) toggleCompare(e.target.dataset.compare, e.target.checked);
});
$('#clearCompare').addEventListener('click', () => { [...compare].forEach(id => toggleCompare(id, false)); renderCompare(); });

// ---------- eligibility ----------
$('#eligForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const income = +f.get('income'), yrs = +f.get('age'), emp = f.get('employment');
  const base = cards.filter(c =>
    (c.minAge == null || yrs >= c.minAge) && (c.maxAge == null || yrs <= c.maxAge) &&
    (!c.employment?.length || c.employment.includes(emp)));
  const yes = base.filter(c => typeof c.minIncome === 'number' && income >= c.minIncome).sort(SORTS.tier);
  const unknown = base.filter(c => typeof c.minIncome !== 'number');
  $('#eligResult').innerHTML =
    `<h3>You likely qualify for ${yes.length} card${yes.length === 1 ? '' : 's'}</h3>
     <p class="muted small">Premium first. Final approval depends on the bank's checks: CIB credit report, documents, existing loans.</p>
     <div class="grid">${yes.map(cardHTML).join('')}</div>` +
    (unknown.length ? `<h3 style="margin-top:28px">Income requirement not published (${unknown.length})</h3>
     <p class="muted small">Ask the bank for these.</p><div class="grid">${unknown.map(cardHTML).join('')}</div>` : '');
});

// ---------- offers ----------
const CATS = ['All', ...new Set(offers.map(o => o.category).filter(Boolean).sort())];
let cat = 'All';
$('#offerCats').innerHTML = CATS.map(k => `<button type="button" data-cat="${esc(k)}">${esc(k)}</button>`).join('');
$('#offerBank').insertAdjacentHTML('beforeend', banks.filter(b => offers.some(o => o.bank === b.id))
  .map(b => `<option value="${esc(b.id)}">${esc(shortBank(b.name))}</option>`).join(''));

const daysLeft = d => Math.ceil((new Date(d) - new Date(TODAY)) / 864e5);

function renderOffers() {
  const words = $('#offerSearch').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const bank = $('#offerBank').value, showExp = $('#showExpired').checked;
  const list = offers.filter(o =>
    (cat === 'All' || o.category === cat) && (!bank || o.bank === bank) &&
    (showExp || !o.validTill || o.validTill >= TODAY) && words.every(w => o.hay.includes(w)))
    .sort((a, b) => (a.merchant || '').localeCompare(b.merchant || ''));
  document.querySelectorAll('#offerCats button').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  $('#offerCount').textContent = `${list.length} offers`;
  $('#offerGrid').innerHTML = list.map(o => {
    const left = o.validTill ? daysLeft(o.validTill) : null;
    const till = !o.validTill ? 'Ongoing' : left < 0 ? `Expired ${esc(o.validTill)}`
      : `Till ${esc(o.validTill)}${left <= 14 ? ` <span class="soon">(${left}d left)</span>` : ''}`;
    return `<article class="offer${left < 0 ? ' expired' : ''}" style="--c:${esc(bankById[o.bank]?.color || '')}">
      <div class="merchant">${esc(o.merchant)}</div>
      <div class="what">${esc(o.offer)}</div>
      <div class="meta"><span class="dot"></span>${esc(shortBank(o.bankName))} ·${esc(o.cards || 'Credit cards')}</div>
      <div class="meta">${esc(o.category)} · ${till} · ${link(o.sourceUrl, 'Source')}</div>
    </article>`;
  }).join('') || '<p class="empty">No offers match.</p>';
}
$('#offerCats').addEventListener('click', e => { if (e.target.dataset.cat) { cat = e.target.dataset.cat; renderOffers(); } });
['#offerSearch', '#offerBank', '#showExpired'].forEach(s => $(s).addEventListener('input', renderOffers));

// ---------- tabs ----------
function route() {
  let t = location.hash.slice(1);
  if (!document.getElementById('tab-' + t)) t = 'cards';
  document.querySelectorAll('.tab').forEach(s => s.hidden = s.id !== 'tab-' + t);
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.hash === '#' + t));
  if (t === 'compare') renderCompare();
}
window.addEventListener('hashchange', route);

$('#updated').textContent = `Data updated ${updated}`;
saveCompare();
renderCards();
renderOffers();
route();
