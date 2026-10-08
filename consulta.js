"use strict";
const $ = id => document.getElementById(id);
const money = n => '$ ' + (n/100).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const escape = s => String(s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let meeting = null;
function grouped(transfers, key) {
  const groups = new Map();
  for (const t of transfers) {
    const id = t[key];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(t);
  }
  return groups;
}
function renderMeeting() {
  const {state, transfers, method} = meeting;
  const name = id => state.people.find(p => p.id === id).name;
  $('identity').innerHTML = '<option value="">Elegí tu nombre</option>' + state.people.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('');
  $('identity').value = '';
  $('bankAlias').value = '';
  $('viewerMethod').textContent = method === 'distribution' ? 'Distribución' : method === 'greedy' ? 'Distribución · Greedy' : 'Distribución · Eficiente';
  $('viewerTransfers').innerHTML = Array.from(grouped(transfers,'from')).map(([id,payments]) =>
    `<div class="transfer"><h4>${escape(name(id))}</h4>${payments.map(t => `<div class="payment"><span>→ ${escape(name(t.to))}</span><strong>${money(t.amount)}</strong></div>`).join('')}</div>`
  ).join('') || '<p>Todos los balances están saldados.</p>';
  $('viewerExpenses').innerHTML = state.expenses.map(e => `<div class="report-line"><span>${escape(e.description)}<small>Pagó ${escape(name(e.payer))}</small></span><b>${money(e.cents)}</b></div>`).join('') || '<p>No hay gastos cargados.</p>';
  $('viewerTotal').textContent = 'Total gastado: ' + money(GastosCore.balance(state).total);
  $('viewerConsumptionCard').hidden = state.mode !== 'consumption';
  if (state.mode === 'consumption') $('viewerConsumption').innerHTML = GastosCore.consumptionDetails(state).map(p =>
    `<div class="person-consumption"><h5>${escape(p.name)}</h5>${p.items.map(e => `<div class="report-line"><span>${escape(e.description)}</span><b>${money(e.cents)}</b></div>`).join('') || '<p class="empty">Sin consumos.</p>'}<p class="report-total">Total consumido: ${money(p.total)}</p></div>`
  ).join('');
  $('viewerContent').hidden = false;
  renderIdentity();
}
function requestMessage(debtorName, ownName, cents, alias) {
  return `Hola ${debtorName}, de la reunión te toca transferirme ${money(cents)}.\n\nMi alias bancario es:\n${alias}\n\n¡Gracias!\n${ownName}`;
}
function renderIdentity() {
  $('mySummary').innerHTML = '';
  $('myRequests').innerHTML = '';
  $('aliasField').hidden = true;
  if (!meeting) return;
  const me = GastosCore.balance(meeting.state).rows.find(p => p.id === $('identity').value);
  if (!me) return;
  const name = id => meeting.state.people.find(p => p.id === id).name;
  const outgoing = meeting.transfers.filter(t => t.from === me.id);
  const incoming = meeting.transfers.filter(t => t.to === me.id);
  $('mySummary').innerHTML = `<p>Pagaste <b>${money(me.paid)}</b>. Te corresponde <b>${money(me.share)}</b>.</p>` +
    (outgoing.length ? '<h3>Tenés que transferir</h3>' + outgoing.map(t => `<div class="payment"><span>→ ${escape(name(t.to))}</span><strong>${money(t.amount)}</strong></div>`).join('') : '') +
    (incoming.length ? '<h3>Tenés que recibir</h3>' + incoming.map(t => `<div class="payment"><span>${escape(name(t.from))}</span><strong>${money(t.amount)}</strong></div>`).join('') : '') +
    (!outgoing.length && !incoming.length ? '<p>Tu cuenta está saldada.</p>' : '');
  $('aliasField').hidden = !incoming.length;
  if (!incoming.length) return;
  const alias = $('bankAlias').value.trim();
  if (!alias) { $('myRequests').innerHTML = '<p class="muted">Escribí tu alias para preparar los mensajes individuales.</p>'; return; }
  const amounts = new Map();
  for (const t of incoming) amounts.set(t.from, (amounts.get(t.from) || 0) + t.amount);
  $('myRequests').innerHTML = Array.from(amounts).map(([id,cents]) => `<a class="whatsapp-share" href="${escape('https://wa.me/?text=' + encodeURIComponent(requestMessage(name(id),me.name,cents,alias)))}" target="_blank" rel="noopener noreferrer">Pedir a ${escape(name(id))} · ${money(cents)}</a>`).join('') + '<p class="share-help">Elegí a la persona correspondiente en WhatsApp y revisá el mensaje antes de enviarlo.</p>';
}
$('identity').addEventListener('change', () => { $('bankAlias').value = ''; renderIdentity(); });
$('bankAlias').addEventListener('input', renderIdentity);
function loadMeeting() {
  meeting = null;
  $('identity').value = ''; $('bankAlias').value = '';
  $('viewerContent').hidden = true;
  $('viewerError').hidden = true;
  try {
    const token = new URLSearchParams(location.hash.slice(1)).get('r');
    meeting = GastosShare.decode(token);
    renderMeeting();
  } catch {
    $('viewerError').textContent = 'Este enlace no contiene una cuenta válida o está incompleto. Pedí a quien organizó la reunión que genere un nuevo QR o enlace.';
    $('viewerError').hidden = false;
  }
}
window.addEventListener('hashchange', loadMeeting);
window.addEventListener('pageshow', () => {
  $('identity').value = ''; $('bankAlias').value = ''; renderIdentity();
});
window.addEventListener('pagehide', () => {
  $('identity').value = ''; $('bankAlias').value = ''; renderIdentity();
});
loadMeeting();
