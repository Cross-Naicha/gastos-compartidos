"use strict";
(function(root) {
function consumers(state, expense) {
  if (state.mode === 'consumption' && expense.allocations) return state.people.filter(p => expense.allocations.some(a => a.id === p.id && a.cents > 0));
  return state.people.filter(p => state.mode !== "consumption" || !expense.participants || expense.participants.includes(p.id));
}
function validAllocations(state, expense) {
  if (expense.units != null) {
    try {
      const expected = unitAllocations(state, expense.units, expense.cents);
      if (!Array.isArray(expense.allocations) || expected.length !== expense.allocations.length || expected.some(a => !expense.allocations.some(b => b.id === a.id && b.cents === a.cents))) return false;
    } catch { return false; }
  }
  if (expense.allocations == null) return true;
  const a = expense.allocations;
  return Array.isArray(a) && a.length > 0 && new Set(a.map(x => x?.id)).size === a.length &&
    a.every(x => x && state.people.some(p => p.id === x.id) && Number.isSafeInteger(x.cents) && x.cents > 0) &&
    Number.isSafeInteger(a.reduce((sum,x) => sum+x.cents,0)) && a.reduce((sum,x) => sum+x.cents,0) === expense.cents;
}
function unitAllocations(state, units, total) {
  const fail = () => { throw new Error('Revisá las unidades: asigná todas las compradas y verificá que las variedades sumen el importe del gasto.'); };
  if (!Array.isArray(units) || !units.length || units.length > 50) fail();
  const amounts = new Map(state.people.map(p => [p.id, 0]));
  let spent = 0;
  for (const v of units) {
    if (!v || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60 || !Number.isSafeInteger(v.quantity) || v.quantity < 1 || !Number.isSafeInteger(v.cents) || v.cents < 1 || !Array.isArray(v.counts) || !v.counts.length || new Set(v.counts.map(a => a?.id)).size !== v.counts.length) fail();
    let assigned = 0;
    for (const a of v.counts) {
      if (!amounts.has(a.id) || !Number.isSafeInteger(a.quantity) || a.quantity < 1) fail();
      assigned += a.quantity;
      if (!Number.isSafeInteger(assigned)) fail();
    }
    if (assigned !== v.quantity) fail();
    spent += v.cents;
    if (!Number.isSafeInteger(spent)) fail();
    const rows = state.people.filter(p => v.counts.some(a => a.id === p.id)).map(p => {
      const numerator = BigInt(v.cents) * BigInt(v.counts.find(a => a.id === p.id).quantity);
      return {id:p.id, cents:Number(numerator / BigInt(v.quantity)), remainder:numerator % BigInt(v.quantity)};
    });
    let extra = v.cents - rows.reduce((sum,a) => sum + a.cents,0);
    rows.sort((a,b) => a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1);
    for (const a of rows) { amounts.set(a.id, amounts.get(a.id) + a.cents + (extra-- > 0 ? 1 : 0)); }
  }
  if (spent !== total) fail();
  return Array.from(amounts,([id,cents]) => ({id,cents})).filter(a => a.cents > 0);
}
function unitDescription(expense, id) {
  return (expense.units || []).map(v => {
    const quantity = id == null ? v.quantity : (v.counts.find(a => a.id === id)?.quantity || 0);
    return quantity ? `${quantity} ${v.name}` : '';
  }).filter(Boolean).join(' + ');
}
function expenseShares(state, expense) {
  if (state.mode === 'consumption' && expense.allocations) {
    if (!validAllocations(state, expense)) throw new Error('Los importes individuales deben sumar el total del gasto.');
    return expense.allocations;
  }
  const group = consumers(state, expense);
  return group.map((p,i) => ({id:p.id, cents:Math.floor(expense.cents/group.length)+(i<expense.cents%group.length?1:0)}));
}
function consumptionDetails(state) {
  const rows = state.people.map(p => ({ ...p, items: [], total: 0 }));
  const byId = new Map(rows.map(p => [p.id, p]));
  for (const expense of state.expenses) {
    expenseShares(state, expense).forEach(({id, cents}) => {
      const row = byId.get(id);
      const units = state.mode === 'consumption' ? unitDescription(expense,id) : '';
      row.items.push({ description: expense.description + (units ? ' · ' + units : ''), cents });
      row.total += cents;
    });
  }
  return rows;
}
function balance(state) {
  const total = state.expenses.reduce((s, e) => s + e.cents, 0),
    n = state.people.length;
  const paid = new Map(state.people.map((p) => [p.id, 0]));
  const shares = new Map(state.people.map(p => [p.id, 0]));
  for (const e of state.expenses)
    paid.set(e.payer, paid.get(e.payer) + e.cents);
  if (state.mode === "consumption") {
    for (const e of state.expenses) {
      expenseShares(state, e).forEach(a => shares.set(a.id, shares.get(a.id) + a.cents));
    }
  } else state.people.forEach((p,i) => shares.set(p.id, Math.floor(total/n) + (i < total%n ? 1 : 0)));
  return {
    total,
    rows: state.people.map((p, i) => ({
      ...p,
      paid: paid.get(p.id),
      share: shares.get(p.id),
      balance: paid.get(p.id) - shares.get(p.id),
    })),
  };
}
function greedy(rows) {
  const d = rows
      .filter((p) => p.balance < 0)
      .map((p) => ({ ...p }))
      .sort((a, b) => a.balance - b.balance),
    c = rows
      .filter((p) => p.balance > 0)
      .map((p) => ({ ...p }))
      .sort((a, b) => b.paid - a.paid);
  let i = 0,
    j = 0;
  const out = [];
  while (i < d.length && j < c.length) {
    const amount = Math.min(-d[i].balance, c[j].balance);
    out.push({ from: d[i].id, to: c[j].id, amount });
    d[i].balance += amount;
    c[j].balance -= amount;
    if (!d[i].balance) i++;
    if (!c[j].balance) j++;
  }
  return out;
}
function efficient(rows, initial) {
  const people = rows.filter((p) => p.balance !== 0),
    v = people.map((p) => p.balance);
  let best = initial.slice(),
    visits = 0,
    complete = true;
  const path = [];
  function search(start) {
    if (++visits > 250000) {
      complete = false;
      return;
    }
    while (start < v.length && v[start] === 0) start++;
    if (start === v.length) {
      if (path.length < best.length) best = path.slice();
      return;
    }
    if (
      path.length +
        Math.ceil(v.slice(start).filter((x) => x !== 0).length / 2) >=
      best.length
    )
      return;
    const seen = new Set();
    for (let j = start + 1; j < v.length; j++) {
      if (v[start] * v[j] >= 0 || seen.has(v[j])) continue;
      seen.add(v[j]);
      const a = v[start],
        b = v[j];
      v[start] = 0;
      v[j] = a + b;
      path.push({
        from: a < 0 ? people[start].id : people[j].id,
        to: a < 0 ? people[j].id : people[start].id,
        amount: Math.abs(a),
      });
      search(start + 1);
      path.pop();
      v[start] = a;
      v[j] = b;
      if (!complete) return;
      if (a + b === 0) break;
    }
  }
  search(0);
  return { transfers: best, complete };
}
root.GastosCore = { consumers, consumptionDetails, balance, greedy, efficient, expenseShares, validAllocations, unitAllocations, unitDescription };
})(globalThis);
