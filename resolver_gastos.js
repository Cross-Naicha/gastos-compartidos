"use strict";
const $ = (id) => document.getElementById(id),
  KEY = "gastos-compartidos-v1";
let state = { people: [], expenses: [] };
let calculatedDistributions = null;
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (
    s &&
    Array.isArray(s.people) &&
    Array.isArray(s.expenses) &&
    s.people.every(
      (p) => typeof p.id === "string" && typeof p.name === "string",
    ) &&
    new Set(s.people.map((p) => p.id)).size === s.people.length &&
    s.expenses.every(
      (e) =>
        typeof e.id === "string" &&
        typeof e.description === "string" &&
        Number.isSafeInteger(e.cents) &&
        e.cents > 0 &&
        s.people.some((p) => p.id === e.payer) && GastosCore.validAllocations(s, e),
    )
  )
    state = s;
} catch {}
state.mode = state.mode === "consumption" ? "consumption" : "equal";
for (const e of state.expenses) {
  if (Array.isArray(e.participants)) {
    e.participants = state.people.filter(p => e.participants.includes(p.id)).map(p => p.id);
    if (!e.participants.length) e.participants = null;
  } else e.participants = null;
}
function consumers(expense) { return GastosCore.consumers(state, expense); }
function consumptionDetails() { return GastosCore.consumptionDetails(state); }
function expenseReport() {
  const name = id => state.people.find(p => p.id === id).name;
  return '<section class="report-section"><h4>Detalle de gastos</h4>' +
    (state.expenses.map(e => `<div class="report-line"><span>${escape(e.description)}<small>Pagó ${escape(name(e.payer))}${e.units ? ' · ' + escape(GastosCore.unitDescription(e)) : ''}</small></span><b>${money(e.cents)}</b></div>`).join('') || '<p>No hay gastos cargados.</p>') +
    `<p class="report-total">Total gastado: ${money(balance().total)}</p></section>`;
}
function consumptionReport() {
  if (state.mode !== 'consumption') return '';
  return '<section class="report-section"><h4>Consumo por persona</h4>' + consumptionDetails().map(p =>
    `<div class="person-consumption"><h5>${escape(p.name)}</h5>${p.items.map(item => `<div class="report-line"><span>${escape(item.description)}</span><b>${money(item.cents)}</b></div>`).join('') || '<p class="empty">Sin consumos.</p>'}<p class="report-total">Total consumido: ${money(p.total)}</p></div>`
  ).join('') + '<p class="muted">Los importes corresponden al consumo de cada persona. En unidades, los centavos se ajustan proporcionalmente para conservar el total.</p></section>';
}
function participantOptions(selected = null) {
  return `<label class="participant-option"><input type="checkbox" data-all ${selected === null ? 'checked' : ''}>Todos</label><div class="participant-members" ${selected === null ? 'hidden' : ''}>` + state.people.map(p => `<label class="participant-option"><input type="checkbox" data-member value="${escape(p.id)}" ${selected === null || selected.includes(p.id) ? 'checked' : ''}>${escape(p.name)}</label>`).join('') + '</div>';
}
function selection(container) {
  return container.querySelector('[data-all]').checked ? null : Array.from(container.querySelectorAll('[data-member]:checked')).map(input => input.value);
}
function individualFields(allocations = []) {
  return state.people.map(p => {
    const amount = allocations?.find(a => a.id === p.id)?.cents || 0;
    return `<label class="individual-amount">${escape(p.name)}<input data-allocation="${escape(p.id)}" value="${amount ? (amount/100).toFixed(2).replace('.',',') : ''}" inputmode="decimal" autocomplete="off" placeholder="0,00" aria-label="Consumo de ${escape(p.name)}"></label>`;
  }).join('');
}
function readAllocations(container) {
  const allocations = [];
  for (const input of container.querySelectorAll('[data-allocation]')) {
    const value = input.value.trim();
    if (!value || /^0+(?:[.,]0{1,2})?$/.test(value)) continue;
    const cents = parseAmount(value);
    if (cents === null) throw new Error('Ingresá importes válidos, sin separadores de miles y con hasta dos decimales. Dejá vacío a quien no consumió.');
    allocations.push({id:input.dataset.allocation,cents});
  }
  return allocations;
}
function allocationSummary(container, total, target) {
  try {
    const assigned = readAllocations(container).reduce((sum,a) => sum+a.cents,0);
    if (!Number.isSafeInteger(assigned)) throw new Error('Los importes superan el máximo admitido.');
    const difference = total-assigned;
    target.textContent = `Asignado: ${money(assigned)} · ` + (difference > 0 ? `Falta asignar ${money(difference)}` : difference < 0 ? `Sobran ${money(-difference)}` : 'Coincide con el total.');
    target.classList.toggle('allocation-valid', difference === 0 && total > 0);
  } catch (error) { target.textContent = error.message; target.classList.remove('allocation-valid'); }
}
function expenseEditor(e) {
  const individual = !!e.allocations;
  const suggested = e.allocations || GastosCore.expenseShares(state,e);
  return `<div class="expense-participants"><fieldset data-sharing="${escape(e.id)}"><legend>Reparto del gasto</legend>${GastosUnitsUI.controls(individual,!!e.units)}<div data-shared ${individual?'hidden':''}>${participantOptions(e.participants)}</div><div data-individual ${!individual?'hidden':''}><div data-amount-fields ${e.units?'hidden':''}>${individualFields(suggested)}<p class="share-help">Dejá vacío a quien no consumió.</p><p data-allocation-status class="share-help" role="status" aria-live="polite"></p></div><div data-units ${!e.units?'hidden':''}>${GastosUnitsUI.fields(state.people,e.units)}</div></div><button type="button" data-save-allocations>Guardar reparto</button></fieldset></div>`;
}
function reopenExpense(id) {
  const field = Array.from($("expenses").querySelectorAll('[data-sharing]')).find(e => e.dataset.sharing === id);
  if (field) field.closest('details').open = true;
}
const money = (n) =>
  "$ " +
  (n / 100).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);
function say(s) {
  $("message").textContent = s;
}
function parseAmount(raw) {
  const s = raw.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(s)) return null;
  const parts = s.split(/[.,]/),
    n = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function balance() { return GastosCore.balance(state); }
function saveRender() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    say(
      "El navegador no pudo guardar los datos. Podés seguir usándolos mientras esta página esté abierta.",
    );
  }
  render();
}
function render() {
  calculatedDistributions = null;
  $("qrShare").hidden = true;
  $("qrOutput").hidden = true;
  $("qrImage").innerHTML = "";
  $("shareUrl").value = "";
  $("openShared").removeAttribute('href');
  const consumption = state.mode === "consumption";
  $("splitMode").setAttribute("aria-checked", String(consumption));
  updateParticipantVisibility();
  $("participants").innerHTML = participantOptions();
  $("individualAmounts").innerHTML = individualFields();
  $("unitFields").innerHTML = GastosUnitsUI.fields(state.people);
  updateExpenseSplit();
  $("modeHelp").textContent = consumption ? "Dividí cada gasto entre quienes participaron o asigná importes individuales. También podés ajustar los gastos ya cargados." : "Todos los gastos se dividen entre todas las personas. Las selecciones e importes individuales se conservan si cambiás de modo.";
  $("balanceHelp").textContent = consumption ? "Cada gasto usa el reparto elegido: partes iguales entre sus participantes o importes individuales. Los centavos sobrantes de los gastos divididos se asignan en el orden de la lista." : "Todos los gastos se reparten por igual entre todas las personas. Los centavos sobrantes se asignan en el orden de la lista.";
  const selected = $("payer").value;
  $("people").innerHTML =
    state.people
      .map(
        (p) =>
          `<div class="person-chip"><span>${escape(p.name)}</span><button type="button" class="remove" data-person="${escape(p.id)}" aria-label="Eliminar a ${escape(p.name)}">✕</button></div>`,
      )
      .join("") ||
    '<p class="empty">Agregá también a quienes no hicieron gastos.</p>';
  $("payer").innerHTML =
    state.people
      .map(
        (p) =>
          `<option value="${escape(p.id)}">${escape(p.name)}</option>`,
      )
      .join("");
  if (state.people.some((p) => p.id === selected))
    $("payer").value = selected;
  $("expenses").innerHTML =
    state.expenses
      .map(
        (e) =>
          `<details class="expense-card" data-tone="${state.people.findIndex(p => p.id === e.payer) % 4}"><summary><span class="expense-card-title">${escape(e.description)}<small>Pagó ${escape(state.people.find((p) => p.id === e.payer).name)} · ${consumption ? (e.units ? GastosCore.unitDescription(e) : e.allocations ? 'Importes individuales' : 'Repartido entre ' + consumers(e).length) : 'Partes iguales'}</small></span><strong class="amount">${money(e.cents)}</strong><span class="expense-chevron" aria-hidden="true">⌄</span></summary><div class="expense-card-body">${consumption ? expenseEditor(e) : '<p class="share-help">Este gasto se divide por igual entre todas las personas.</p>'}<button type="button" class="remove expense-delete" data-expense="${escape(e.id)}" aria-label="Eliminar gasto ${escape(e.description)}">Eliminar gasto</button></div></details>`,
      )
      .join("") || '<p class="empty">Todavía no hay gastos.</p>';
  const b = balance();
  $("totals").innerHTML =
    `<div><small>Total gastado</small><strong>${money(b.total)}</strong></div><div><small>Personas</small><strong>${b.rows.length}</strong></div><div><small>${consumption ? 'Costo promedio' : 'Costo por persona'}</small><strong>${money(b.rows.length ? Math.floor(b.total / b.rows.length) : 0)}${!consumption && b.rows.length && b.total % b.rows.length ? '–' + money(Math.floor(b.total / b.rows.length) + 1) : ''}</strong></div>`;
  $("balances").innerHTML = b.rows
    .map(
      (p) =>
        `<div class="item"><span>${escape(p.name)}<br><small>Pagó ${money(p.paid)} · Le corresponde ${money(p.share)}</small></span><span class="amount ${p.balance < 0 ? "debt" : "credit"}">${p.balance < 0 ? "Debe" : p.balance > 0 ? "Recibe" : "Saldado"}${p.balance ? " " + money(Math.abs(p.balance)) : ""}</span></div>`,
    )
    .join("");
  for (const id of ["greedy", "optimal"]) {
    $(id).className = "empty";
    $(id).textContent = "Volvé a calcular para ver las transferencias.";
  }
  $("optimalCard").hidden = false;
  $("distributionTitle").textContent = "Greedy: mayor aportante primero";
  $("greedyDescription").hidden = false;
  $("shareActions").hidden = true;
  $("shareActions").innerHTML = "";
  $("personalMessages").hidden = true;
  $("personalMessages").innerHTML = "";
  $("sharedReport").innerHTML = expenseReport() + consumptionReport();
}
function greedy(rows) { return GastosCore.greedy(rows); }
function efficient(rows, initial) { return GastosCore.efficient(rows, initial); }
function shareMessage(id, transfers, note) {
  const name = personId => state.people.find(p => p.id === personId).name;
  const lines = ['*Distribución*'];
  for (const [from, payments] of groupTransfers(transfers)) {
    lines.push('', name(from));
    for (const t of payments) lines.push(`→ ${name(t.to)}: ${money(t.amount)}`);
  }
  if (!transfers.length) lines.push('Todos los balances están saldados.');
  lines.push('', '*Detalle de gastos*');
  for (const e of state.expenses) lines.push(`• ${e.description}: ${money(e.cents)} — pagó ${name(e.payer)}${e.units ? ' · ' + GastosCore.unitDescription(e) : ''}`);
  if (!state.expenses.length) lines.push('No hay gastos cargados.');
  lines.push('', `*Total: ${money(balance().total)}*`);
  if (state.mode === 'consumption') {
    lines.push('', '*Consumo por persona*');
    for (const p of consumptionDetails()) {
      lines.push('', `*${p.name}*`);
      for (const item of p.items) lines.push(`• ${item.description}: ${money(item.cents)}`);
      if (!p.items.length) lines.push('Sin consumos.');
      lines.push(`Total consumido: ${money(p.total)}`);
    }
  } else lines.push('Repartido por igual entre todas las personas.');
  return lines.join('\n');
}
function groupTransfers(transfers) {
  const groups = new Map();
  for (const t of transfers) {
    if (!groups.has(t.from)) groups.set(t.from, []);
    groups.get(t.from).push(t);
  }
  return groups;
}
function individualMessage(person, cents) {
  return `Hola ${person.name}, de la reunión te toca transferirme ${money(cents)}.\n\nMi alias bancario es:\nmeta.historia.gen\n\n¡Gracias!\nNicolás`;
}
function personalPaymentLinks(transfers, label) {
  const nicolas = state.people.find(p => p.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'nicolas');
  if (!nicolas) return '';
  const amounts = new Map();
  for (const t of transfers) if (t.to === nicolas.id) amounts.set(t.from, (amounts.get(t.from) || 0) + t.amount);
  if (!amounts.size) return '';
  return `<div class="personal-method"><h4>${escape(label)}</h4>` + Array.from(amounts).map(([id, cents]) => {
    const person = state.people.find(p => p.id === id);
    return `<a class="whatsapp-share" href="${escape('https://wa.me/?text=' + encodeURIComponent(individualMessage(person, cents)))}" target="_blank" rel="noopener noreferrer">Pedir a ${escape(person.name)} · ${money(cents)}</a>`;
  }).join('') + '</div>';
}
function show(id, transfers, note) {
  $(id).className = "";
  $(id).innerHTML =
    `<h4 class="report-heading">Distribución</h4><span class="badge">${transfers.length} transferencia${transfers.length === 1 ? "" : "s"}</span>${note ? `<p class="notice">${escape(note)}</p>` : ""}` +
    (Array.from(groupTransfers(transfers))
      .map(([from, payments]) =>
        `<div class="transfer"><h4>${escape(state.people.find(p => p.id === from).name)}</h4>${payments.map(t => `<div class="payment"><span>→ ${escape(state.people.find(p => p.id === t.to).name)}</span><strong>${money(t.amount)}</strong></div>`).join("")}</div>`
      )
      .join("") || "<p>Todos los balances están saldados.</p>");
}
$("personForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (!name) return say("Ingresá un nombre.");
  if (
    state.people.some(
      (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    return say(
      "Ese nombre ya existe. Agregá un apellido o apodo para distinguirlo.",
    );
  state.people.push({ id: uid(), name });
  $("name").value = "";
  say("");
  saveRender();
  $("name").focus();
});
$("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const cents = parseAmount($("amount").value),
    description = $("description").value.trim(),
    payer = $("payer").value;
  if (!payer) return say("Elegí quién pagó.");
  if (cents === null)
    return say(
      "Ingresá un importe positivo, sin separadores de miles y con hasta dos decimales.",
    );
  if (!description) return say("Ingresá un detalle del gasto.");
  if (!Number.isSafeInteger(balance().total + cents))
    return say("El importe supera el máximo admitido.");
  const individual = state.mode === 'consumption' && $("expenseSplit").value === 'individual';
  let allocations = null, units = null;
  if (individual) {
    try {
      if ($("consumptionEntry").value === 'units') {
        units = GastosUnitsUI.read($("unitFields"),cents,parseAmount);
        allocations = GastosCore.unitAllocations(state,units,cents);
      } else allocations = readAllocations($("individualAmounts"));
    } catch (error) { return say(error.message); }
    if (!GastosCore.validAllocations(state,{cents,allocations})) return say('Los importes individuales deben sumar exactamente ' + money(cents) + '.');
  }
  const participants = state.mode === 'consumption' && !individual ? selection($("participants")) : null;
  if (participants && !participants.length) return say("Elegí al menos una persona que comparta el gasto.");
  state.expenses.push({ id: uid(), payer, cents, description, participants, allocations, ...(units ? {units} : {}) });
  $("amount").value = "";
  $("description").value = "";
  $("expenseSplit").value = 'shared';
  say("");
  saveRender();
});
$("people").addEventListener("click", (e) => {
  const b = e.target.closest("[data-person]");
  if (!b) return;
  const id = b.dataset.person;
  if (state.expenses.some(e => e.payer !== id && (e.allocations?.some(a => a.id === id) || e.units?.some(v=>v.counts.some(a=>a.id===id))))) return say('Esta persona tiene consumos individuales. Ajustá o eliminá esos gastos antes de quitarla, para conservar el total pagado.');
  if (
    state.expenses.some((e) => e.payer === id || e.participants?.includes(id)) &&
    !confirm(
      "¿Eliminar esta persona? Se borrarán los gastos que pagó y aquellos en los que sea el único participante. Los demás se repartirán entre los participantes restantes.",
    )
  )
    return;
  state.people = state.people.filter((p) => p.id !== id);
  state.expenses = state.expenses.filter((e) => e.payer !== id);
  for (const e of state.expenses) if (e.participants) e.participants = e.participants.filter(member => member !== id);
  state.expenses = state.expenses.filter(e => !e.participants || e.participants.length);
  say("");
  saveRender();
});
$("expenses").addEventListener("click", (e) => {
  const save = e.target.closest('[data-save-allocations]');
  if (save) {
    const field = save.closest('[data-sharing]');
    const expense = state.expenses.find(x => x.id === field.dataset.sharing);
    let allocations, units = null;
    const individual = field.querySelector('[data-expense-split]').value === 'individual';
    try {
      if (!individual) allocations = null;
      else if (field.querySelector('[data-entry-mode]').value === 'units') {
        units = GastosUnitsUI.read(field.querySelector('[data-units]'),expense.cents,parseAmount);
        allocations = GastosCore.unitAllocations(state,units,expense.cents);
      } else allocations = readAllocations(field.querySelector('[data-amount-fields]'));
    } catch (error) { return say(error.message); }
    if (!GastosCore.validAllocations(state,{...expense,allocations,units})) return say('Los importes individuales deben sumar exactamente ' + money(expense.cents) + '.');
    const participants = individual ? null : selection(field.querySelector('[data-shared]'));
    if(participants && !participants.length) return say('Elegí al menos una persona.');
    expense.allocations = allocations; expense.units = units; expense.participants = participants;
    say(''); saveRender(); reopenExpense(expense.id); return;
  }
  const b = e.target.closest("[data-expense]");
  if (b) {
    state.expenses = state.expenses.filter(
      (e) => e.id !== b.dataset.expense,
    );
    say("");
    saveRender();
  }
});
$("reset").addEventListener("click", () => {
  if (
    (state.people.length || state.expenses.length) &&
    !confirm("¿Borrar las personas y los gastos actuales?")
  )
    return;
  state = { people: [], expenses: [], mode: state.mode };
  say("");
  saveRender();
});
$("calculate").addEventListener("click", () => {
  if (!state.people.length) return say("Agregá al menos una persona.");
  say("");
  const rows = balance().rows,
    g = greedy(rows),
    result = efficient(rows, g);
  const sameCount = g.length === result.transfers.length;
  calculatedDistributions = { greedy: g, optimal: result.transfers, sameCount };
  $("qrMethod").innerHTML = sameCount ? '<option value="greedy">Distribución</option>' : '<option value="greedy">Greedy</option><option value="optimal">Eficiente</option>';
  $("qrMethodLabel").hidden = sameCount;
  $("qrShare").hidden = false;
  $("qrOutput").hidden = true;
  const note = result.complete
    ? "Mínimo comprobado para estos balances. La propuesta puede incluir a alguien que reciba dinero y luego lo transfiera."
    : "Se alcanzó el límite de búsqueda. Esta es la mejor distribución encontrada; no está garantizado que sea el mínimo.";
  show("greedy", g, sameCount && !result.complete ? "La búsqueda llegó a su límite; no se pudo comprobar el mínimo." : "");
  $("optimalCard").hidden = sameCount;
  $("distributionTitle").textContent = sameCount ? "Distribución" : "Greedy: mayor aportante primero";
  $("greedyDescription").hidden = sameCount;
  if (!sameCount) show("optimal", result.transfers, note);
  const shareLink = (id, transfers, label) => `<a class="whatsapp-share" href="${escape('https://wa.me/?text=' + encodeURIComponent(shareMessage(id, transfers, '')))}" target="_blank" rel="noopener noreferrer">${label ? 'WhatsApp · ' + label : 'WhatsApp'}</a>`;
  $("shareActions").innerHTML = (sameCount ? shareLink('greedy', g, '') : '<div class="share-buttons">' + shareLink('greedy', g, 'Greedy') + shareLink('optimal', result.transfers, 'Eficiente') + '</div>') + '<p class="share-help">Elegí el grupo en WhatsApp y revisá el mensaje antes de enviarlo.</p>';
  $("shareActions").hidden = false;
  const personal = sameCount ? personalPaymentLinks(g, 'Distribución') : personalPaymentLinks(g, 'Greedy') + personalPaymentLinks(result.transfers, 'Eficiente');
  $("personalMessages").innerHTML = personal ? '<h3>Transferencias a Nicolás</h3><p class="share-help">Cada mensaje incluye el importe y el alias meta.historia.gen. Seleccioná a la persona correspondiente en WhatsApp.</p>' + personal : '';
  $("personalMessages").hidden = !personal;
  $("sharedReport").innerHTML = expenseReport() + consumptionReport();
  $("sharedReport").hidden = false;
});
$("splitMode").addEventListener("click", () => {
  state.mode = state.mode === 'consumption' ? 'equal' : 'consumption';
  say(''); saveRender();
});
function changeParticipants(event) {
  const input = event.target;
  if (input.matches('[data-expense-split]')) {
    const field = input.closest('[data-sharing]');
    const individual = input.value === 'individual';
    field.querySelector('[data-individual]').hidden = !individual;
    field.querySelector('[data-shared]').hidden = individual;
    const expense = state.expenses.find(e => e.id === field.dataset.sharing);
    GastosUnitsUI.animate(field.querySelector('.split-selectors'),individual);
    if (individual) updateEditorEntry(field,expense);
    return;
  }
  if (input.matches('[data-entry-mode]')) {
    const field = input.closest('[data-sharing]');
    updateEditorEntry(field,state.expenses.find(e => e.id === field.dataset.sharing));
    return;
  }
  if (!input.matches('[data-all], [data-member]')) return;
  const field = input.closest('[data-sharing]');
  const container = input.closest('[data-shared]') || $("participants");
  if (input.matches('[data-all]')) {
    for (const member of container.querySelectorAll('[data-member]')) member.checked = input.checked;
  } else container.querySelector('[data-all]').checked = false;
  container.querySelector('.participant-members').hidden = container.querySelector('[data-all]').checked;
  if (!field) return;
  const participants = selection(container);
  if (participants && !participants.length) {
    say('Cada gasto necesita al menos un participante.');
    container.innerHTML = participantOptions(state.expenses.find(e => e.id === field.dataset.sharing).participants);
    return;
  }
  say('');
}
function updateParticipantVisibility() {
  $("participantsField").hidden = state.mode !== 'consumption' ||
    !$("payer").value || parseAmount($("amount").value) === null || !$("description").value.trim();
  updateExpenseSplit();
}
function updateExpenseSplit() {
  const individual = $("expenseSplit").value === 'individual';
  const units = $("consumptionEntry").value === 'units';
  GastosUnitsUI.animate($("expenseSplit").closest('.split-selectors'),individual);
  $("participants").hidden = individual;
  $("individualAmounts").hidden = !individual || units;
  $("allocationStatus").hidden = !individual || units;
  $("unitFields").hidden = !individual || !units;
  if (individual && !units) allocationSummary($("individualAmounts"),parseAmount($("amount").value)||0,$("allocationStatus"));
  if (individual && units) GastosUnitsUI.update($("unitFields"),state,parseAmount($("amount").value)||0,parseAmount,money);
}
$("expenseSplit").addEventListener('change', updateExpenseSplit);
$("consumptionEntry").addEventListener('change', updateExpenseSplit);
$("individualAmounts").addEventListener('input', updateExpenseSplit);
$("unitFields").addEventListener('input',updateExpenseSplit);
$("unitFields").addEventListener('click',event => { if(GastosUnitsUI.click(event,$("unitFields"),state.people))updateExpenseSplit(); });
function updateEditorEntry(field,expense) {
  const units = field.querySelector('[data-entry-mode]').value === 'units';
  field.querySelector('[data-amount-fields]').hidden = units;
  field.querySelector('[data-units]').hidden = !units;
  if(units) GastosUnitsUI.update(field.querySelector('[data-units]'),state,expense.cents,parseAmount,money);
  else allocationSummary(field,expense.cents,field.querySelector('[data-allocation-status]'));
}
$("expenses").addEventListener('click',event => {
  const container = event.target.closest('[data-units]');
  if(!container) return;
  if(GastosUnitsUI.click(event,container,state.people)) {
    const field = container.closest('[data-sharing]');
    updateEditorEntry(field,state.expenses.find(e => e.id === field.dataset.sharing));
  }
});
$("expenses").addEventListener('input', event => {
  if(event.target.closest('[data-units]')) {
    const field=event.target.closest('[data-sharing]');
    updateEditorEntry(field,state.expenses.find(e=>e.id===field.dataset.sharing)); return;
  }
  if (!event.target.matches('[data-allocation]')) return;
  const field = event.target.closest('[data-sharing]');
  const expense = state.expenses.find(e => e.id === field.dataset.sharing);
  allocationSummary(field,expense.cents,field.querySelector('[data-allocation-status]'));
});
for (const id of ['payer', 'amount', 'description']) {
  $(id).addEventListener('input', updateParticipantVisibility);
  $(id).addEventListener('change', updateParticipantVisibility);
}
$("participants").addEventListener('change', changeParticipants);
$("expenses").addEventListener('change', changeParticipants);
function startMeeting(names) {
  if ((state.people.length || state.expenses.length) && !confirm('¿Empezar otra reunión? Se reemplazarán las personas y los gastos actuales.')) return;
  state = { mode: 'equal', people: names.map(name => ({ id: uid(), name })), expenses: [] };
  $("expenseForm").reset();
  say(''); saveRender();
  $("peopleSection").expandSection?.();
  $("peopleSection").scrollIntoView({ block: 'start' });
}
$("classic").addEventListener('click', () => startMeeting(['Nicolás', 'Emilio', 'Mario', 'Benja']));
$("newMeeting").addEventListener('click', () => startMeeting([]));
$("generateQr").addEventListener('click', () => {
  if (!calculatedDistributions) return say('Calculá las distribuciones primero.');
  try {
    const method = $("qrMethod").value || 'greedy';
    const url = GastosShare.link(state, calculatedDistributions[method], calculatedDistributions.sameCount ? 'distribution' : method);
    $("shareUrl").value = url;
    $("openShared").href = url;
    $("qrImage").innerHTML = '';
    $("qrOutput").hidden = false;
    if (url.length > 2200) {
      $("qrNotice").textContent = 'Esta cuenta tiene demasiados datos para un QR fácil de escanear. Podés compartir el enlace completo.';
    } else {
      const qr = qrcode(0, 'M');
      qr.addData(url, 'Byte'); qr.make();
      $("qrImage").innerHTML = qr.createSvgTag({cellSize:4,margin:16,scalable:true});
      $("qrNotice").textContent = 'Escaneá el QR o compartí el enlace. Al abrirlo, cada persona puede elegir su nombre y escribir su alias.';
    }
    say('');
  } catch (error) { say(error.message || 'No se pudo generar el enlace.'); }
});
$("qrMethod").addEventListener('change', () => { $("qrOutput").hidden = true; });
$("copyShareUrl").addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($("shareUrl").value); $("qrNotice").textContent = 'Enlace copiado.'; }
  catch { $("shareUrl").focus(); $("shareUrl").select(); $("qrNotice").textContent = 'Seleccionamos el enlace para que puedas copiarlo.'; }
});
render();
