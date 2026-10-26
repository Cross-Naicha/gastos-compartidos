"use strict";
(function(root) {
  const esc = s => String(s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function controls(individual, units, main = false) {
    return `<div class="split-selectors ${individual ? 'is-individual' : ''}"><label class="split-primary">Cómo repartir<select ${main ? 'id="expenseSplit"' : 'data-expense-split'}><option value="shared" ${!individual?'selected':''}>Partes iguales</option><option value="individual" ${individual?'selected':''}>Individual</option></select></label><div class="split-secondary" ${!individual?'inert aria-hidden="true"':''}><label>Consumo<select ${main ? 'id="consumptionEntry"' : 'data-entry-mode'}><option value="amount" ${!units?'selected':''}>Por importe</option><option value="units" ${units?'selected':''}>Por unidades</option></select></label></div></div>`;
  }
  function variety(people, v = {}) {
    return `<div class="unit-variety"><div class="unit-variety-heading"><label>Variedad<input data-unit-name maxlength="60" value="${esc(v.name || 'Unidades')}" placeholder="Ej.: comunes"></label><button type="button" data-unit-remove aria-label="Quitar variedad">✕</button></div><div class="unit-purchase"><label>Unidades compradas<input data-unit-quantity type="number" min="1" step="1" inputmode="numeric" value="${v.quantity || ''}" placeholder="12"></label><label>Precio por unidad<input data-unit-price inputmode="decimal" value="${v.cents && v.quantity && v.cents % v.quantity === 0 ? (v.cents/v.quantity/100).toFixed(2).replace('.',',') : ''}" placeholder="Auto"></label></div><div class="unit-counters">${people.map(p => `<label class="unit-counter"><span>${esc(p.name)}</span><span class="unit-stepper"><button type="button" data-unit-step="-1" aria-label="Quitar una unidad a ${esc(p.name)}">−</button><input data-unit-person="${esc(p.id)}" type="number" min="0" step="1" inputmode="numeric" value="${v.counts?.find(a=>a.id===p.id)?.quantity || 0}" aria-label="Unidades de ${esc(p.name)}"><button type="button" data-unit-step="1" aria-label="Sumar una unidad a ${esc(p.name)}">+</button></span></label>`).join('')}</div><p data-unit-progress class="share-help" aria-live="polite"></p></div>`;
  }
  function fields(people, units) {
    return `<div data-unit-list>${(units || [{}]).map(v => variety(people,v)).join('')}</div><button type="button" class="secondary unit-add" data-unit-add>+ Agregar variedad</button><p class="share-help">Una variedad: el precio se calcula con el importe total. Para precios diferentes, agregá variedades e indicá el precio por unidad de cada una. Dejá en cero a quien no consumió.</p><p data-unit-status class="share-help" role="status" aria-live="polite"></p>`;
  }
  function read(container, total, parseAmount) {
    const cards = Array.from(container.querySelectorAll('.unit-variety'));
    return cards.map(card => {
      const quantity = Number(card.querySelector('[data-unit-quantity]').value);
      const priceText = card.querySelector('[data-unit-price]').value.trim();
      const price = priceText ? parseAmount(priceText) : null;
      if ((priceText && price === null) || (cards.length > 1 && !price)) throw new Error('Indicá el precio por unidad de cada variedad.');
      const counts = Array.from(card.querySelectorAll('[data-unit-person]')).map(input => {
        const quantity = Number(input.value);
        if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Usá cantidades enteras, desde cero.');
        return {id:input.dataset.unitPerson,quantity};
      }).filter(a=>a.quantity > 0);
      return {name:card.querySelector('[data-unit-name]').value.trim(),quantity,cents:price ? price*quantity : total,counts};
    });
  }
  function update(container, state, total, parseAmount, money) {
    for (const card of container.querySelectorAll('.unit-variety')) {
      const quantity = Number(card.querySelector('[data-unit-quantity]').value);
      const assigned = Array.from(card.querySelectorAll('[data-unit-person]')).reduce((s,input)=>s+Number(input.value),0);
      const target = card.querySelector('[data-unit-progress]');
      target.textContent = `${assigned} de ${quantity || 0} unidades asignadas`;
      target.classList.toggle('allocation-valid',quantity > 0 && quantity === assigned);
    }
    const target = container.querySelector('[data-unit-status]');
    try {
      const units = read(container,total,parseAmount);
      const allocations = GastosCore.unitAllocations(state,units,total);
      target.textContent = allocations.map(a=>`${state.people.find(p=>p.id===a.id).name}: ${money(a.cents)}`).join(' · ');
      target.classList.add('allocation-valid');
    } catch (error) { target.textContent = error.message; target.classList.remove('allocation-valid'); }
  }
  function click(event, container, people) {
    const add = event.target.closest('[data-unit-add]');
    const remove = event.target.closest('[data-unit-remove]');
    const step = event.target.closest('[data-unit-step]');
    if (add) {
      if(container.querySelectorAll('.unit-variety').length >= 50) return false;
      container.querySelector('[data-unit-list]').insertAdjacentHTML('beforeend',variety(people));
    } else if (remove) {
      if(container.querySelectorAll('.unit-variety').length <= 1) return false;
      remove.closest('.unit-variety').remove();
    } else if (step) {
      const input = step.parentElement.querySelector('input');
      input.value = Math.max(0,(Number(input.value)||0)+Number(step.dataset.unitStep));
    } else return false;
    return true;
  }
  function animate(wrapper, individual) {
    wrapper.classList.toggle('is-individual',individual);
    const secondary = wrapper.querySelector('.split-secondary');
    secondary.inert = !individual;
    secondary.setAttribute('aria-hidden',String(!individual));
  }
  root.GastosUnitsUI = {controls,fields,read,update,click,animate};
})(globalThis);
