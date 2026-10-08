"use strict";
(function(root) {
  const PUBLIC_URL = 'https://cross-naicha.github.io/gastos-compartidos/consulta.html';
  function pack(state, transfers, method) {
    const index = new Map(state.people.map((p,i) => [p.id,i]));
    return { v: 2, m: state.mode, k: method, p: state.people.map(p => p.name),
      e: state.expenses.map(e => [e.description,e.cents,index.get(e.payer),e.participants ? e.participants.map(id => index.get(id)) : null,e.allocations ? e.allocations.map(a => [index.get(a.id),a.cents]) : null]),
      t: transfers.map(t => [index.get(t.from), index.get(t.to), t.amount]) };
  }
  function unpack(data) {
    const fail = () => { throw new Error('El enlace no contiene una reunión válida.'); };
    if (!data || ![1,2].includes(data.v) || !['equal','consumption'].includes(data.m) || !['greedy','optimal','distribution'].includes(data.k) ||
      !Array.isArray(data.p) || !data.p.length || data.p.length > 100 ||
      !data.p.every(n => typeof n === 'string' && n.trim() && n.length <= 60) ||
      !Array.isArray(data.e) || data.e.length > 500 || !Array.isArray(data.t) || data.t.length > 200) fail();
    const validIndex = i => Number.isInteger(i) && i >= 0 && i < data.p.length;
    let total = 0;
    const expenses = data.e.map((e,i) => {
      if (!Array.isArray(e) || e.length !== (data.v === 1 ? 4 : 5) || typeof e[0] !== 'string' || !e[0].trim() || e[0].length > 100 ||
        !Number.isSafeInteger(e[1]) || e[1] <= 0 || !validIndex(e[2]) ||
        (e[3] !== null && (!Array.isArray(e[3]) || !e[3].length || !e[3].every(validIndex) || new Set(e[3]).size !== e[3].length))) fail();
      total += e[1]; if (!Number.isSafeInteger(total)) fail();
      const allocations = data.v === 1 || e[4] === null ? null : e[4];
      if (allocations !== null && (!Array.isArray(allocations) || !allocations.length || !allocations.every(a => Array.isArray(a) && a.length === 2 && validIndex(a[0]) && Number.isSafeInteger(a[1]) && a[1] > 0) || new Set(allocations.map(a => a[0])).size !== allocations.length || allocations.reduce((sum,a) => sum+a[1],0) !== e[1])) fail();
      return { id: String(i), description: e[0], cents: e[1], payer: String(e[2]), participants: e[3] === null ? null : e[3].map(String), allocations: allocations === null ? null : allocations.map(a => ({id:String(a[0]),cents:a[1]})) };
    });
    const state = { mode: data.m, people: data.p.map((name,i) => ({id:String(i),name})), expenses };
    const transfers = data.t.map(t => {
      if (!Array.isArray(t) || t.length !== 3 || !validIndex(t[0]) || !validIndex(t[1]) || t[0] === t[1] || !Number.isSafeInteger(t[2]) || t[2] <= 0 || t[2] > total) fail();
      return { from: String(t[0]), to: String(t[1]), amount: t[2] };
    });
    const balances = new Map(GastosCore.balance(state).rows.map(p => [p.id,p.balance]));
    for (const t of transfers) {
      balances.set(t.from, balances.get(t.from) + t.amount);
      balances.set(t.to, balances.get(t.to) - t.amount);
      if (!Number.isSafeInteger(balances.get(t.from)) || !Number.isSafeInteger(balances.get(t.to))) fail();
    }
    if (Array.from(balances.values()).some(n => n !== 0)) fail();
    return { state, transfers, method: data.k };
  }
  function encode(state, transfers, method) {
    const data = pack(state, transfers, method);
    unpack(data);
    const token = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    if (token.length > 12000) throw new Error('Hay demasiados datos para compartir en un enlace. Dividí la reunión en cuentas más pequeñas.');
    return token;
  }
  function decode(token) {
    if (!token || token.length > 12000 || !/^[A-Za-z0-9+$-]+$/.test(token)) throw new Error('El enlace está incompleto o dañado.');
    const json = LZString.decompressFromEncodedURIComponent(token);
    if (!json || json.length > 150000) throw new Error('El enlace está incompleto o contiene demasiados datos.');
    return unpack(JSON.parse(json));
  }
  function link(state, transfers, method) {
    const base = root.location && /^https?:$/.test(root.location.protocol) ? new URL('consulta.html', root.location.href).href.split('#')[0] : PUBLIC_URL;
    return base + '#r=' + encodeURIComponent(encode(state, transfers, method));
  }
  root.GastosShare = { pack, unpack, encode, decode, link, PUBLIC_URL };
})(globalThis);
