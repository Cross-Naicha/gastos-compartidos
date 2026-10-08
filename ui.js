"use strict";
(function() {
  const panels = [];
  function setPanel(panel, button, open, returnFocus = false) {
    panel.classList.toggle('is-open', open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    if (!open && returnFocus) button.focus();
  }
  function setupPanel(panelId, buttonId) {
    const panel = document.getElementById(panelId), button = document.getElementById(buttonId);
    if (!panel || !button) return;
    panel.hidden = false;
    panel.classList.add('floating-panel');
    setPanel(panel, button, false);
    panels.push({panel,button});
    button.addEventListener('click', () => {
      const open = !panel.classList.contains('is-open');
      panels.forEach(other => setPanel(other.panel,other.button,false));
      setPanel(panel,button,open);
    });
    panel.addEventListener('click', event => {
      if (event.target.closest('a')) setPanel(panel,button,false);
    });
  }
  for (const [index, section] of Array.from(document.querySelectorAll('section.card')).entries()) {
    const heading = section.querySelector('h2');
    if (!heading) continue;
    const title = heading.textContent.trim();
    const header = document.createElement('div'); header.className = 'section-heading';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collapse-section';
    const body = document.createElement('div'); body.className = 'section-body'; body.id = 'section-body-' + index;
    const inner = document.createElement('div'); inner.className = 'section-body-inner';
    heading.remove();
    while (section.firstChild) inner.append(section.firstChild);
    const emptyRow = inner.querySelector('.comparison-heading');
    if (emptyRow) emptyRow.classList.add('calculation-actions');
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.setAttribute('aria-controls',body.id);
    header.append(heading,button); body.append(inner); section.append(header,body);
    section.classList.add('collapsible-section');
    function setExpanded(open) {
      section.classList.toggle('is-collapsed',!open);
      body.inert = !open;
      body.setAttribute('aria-hidden',String(!open));
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',(open ? 'Colapsar ' : 'Expandir ') + title);
      button.title = (open ? 'Colapsar' : 'Expandir') + ' sección';
    }
    section.expandSection = () => setExpanded(true);
    setExpanded(true);
    button.addEventListener('click',event => {event.stopPropagation();setExpanded(section.classList.contains('is-collapsed'));});
    header.addEventListener('click',event => {event.stopPropagation();setExpanded(section.classList.contains('is-collapsed'));});
    section.addEventListener('click',() => {if(section.classList.contains('is-collapsed'))setExpanded(true);});
  }
  setupPanel('sectionMenu','sectionToggle');
  setupPanel('optionsMenu','optionsToggle');
  document.addEventListener('click',event => {
    for(const {panel,button} of panels) if(!panel.contains(event.target)&&!button.contains(event.target))setPanel(panel,button,false);
    const link = event.target.closest('a[href^="#"]');
    if(link) document.getElementById(link.getAttribute('href').slice(1))?.expandSection?.();
  });
  document.addEventListener('keydown',event => {
    if(event.key==='Escape')for(const {panel,button} of panels)if(panel.classList.contains('is-open'))setPanel(panel,button,false,true);
  });
  document.getElementById('refreshPage')?.addEventListener('click', async event => {
    const button=event.currentTarget;
    button.disabled=true;button.textContent='Actualizando…';
    const status=document.getElementById('updateStatus');
    try {
      const url=new URL(location.href);
      url.searchParams.set('actualizar',String(Date.now()));
      if(/^https?:$/.test(url.protocol)) {
        const response=await fetch(url.href.split('#')[0],{cache:'no-store'});
        if(!response.ok)throw new Error('No se pudo obtener la última versión.');
      }
      location.replace(url.href);
    } catch {
      button.disabled=false;button.textContent='Actualizar página';
      if(status)status.textContent='No se pudo actualizar. Revisá tu conexión e intentá de nuevo.';
    }
  });
})();
