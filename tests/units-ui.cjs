const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5175/');
 await page.locator('#classic').click();
 await page.locator('#splitMode').click();
 await page.locator('#amount').fill('18000');
 await page.locator('#description').fill('Empanadas');
 await page.locator('#expenseSplit').selectOption('individual');
 await page.locator('#consumptionEntry').selectOption('units');
 await page.setViewportSize({width:320,height:844});
 await page.locator('.split-selectors.is-individual').first().evaluate(async el=>{
   await Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished));
 });
 const layout=await page.locator('#participantsField .split-selectors').evaluate(el=>{
   const a=el.querySelector('.split-primary').getBoundingClientRect(),b=el.querySelector('.split-secondary').getBoundingClientRect();
   return {sameRow:Math.abs(a.bottom-b.bottom)<2,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.equal(layout.sameRow,true);assert.equal(layout.overflow,false);
 await page.setViewportSize({width:390,height:844});
 const units=page.locator('#unitFields');
 await units.locator('[data-unit-name]').fill('comunes');
 await units.locator('[data-unit-quantity]').fill('12');
 await units.locator('[data-unit-person]').nth(1).fill('3');
 await units.locator('[data-unit-person]').nth(2).fill('5');
 await units.locator('[data-unit-person]').nth(3).fill('4');
 await page.locator('#expenseSplit').selectOption('shared');
 await page.locator('#expenseSplit').selectOption('individual');
 assert.equal(await units.locator('[data-unit-quantity]').inputValue(),'12');
 assert.match(await units.locator('[data-unit-status]').innerText(),/7.500/);
 await page.locator('#participantsField').scrollIntoViewIfNeeded();
 await page.screenshot({path:'../reparto-unidades.png'});
 await page.locator('#expenseForm .expense-submit').click();
 assert.equal(await page.locator('.expense-card').count(),1);
 assert.match(await page.locator('.expense-card summary').innerText(),/12 comunes/);
 await page.locator('.expense-card summary').click();
 const field=page.locator('[data-sharing]');
 await field.locator('[data-unit-person]').nth(1).fill('2');
 await field.locator('[data-save-allocations]').click();
 assert.match(await page.locator('#message').innerText(),/Revisá las unidades/);
 await field.locator('[data-unit-person]').nth(1).fill('3');
 await field.locator('[data-unit-add]').click();
 const varieties=field.locator('.unit-variety');
 await varieties.nth(0).locator('[data-unit-quantity]').fill('8');
 await varieties.nth(0).locator('[data-unit-price]').fill('1000');
 await varieties.nth(0).locator('[data-unit-person]').nth(2).fill('1');
 await varieties.nth(1).locator('[data-unit-name]').fill('especiales');
 await varieties.nth(1).locator('[data-unit-quantity]').fill('4');
 await varieties.nth(1).locator('[data-unit-price]').fill('2500');
 await varieties.nth(1).locator('[data-unit-person]').nth(2).fill('4');
 await field.locator('[data-save-allocations]').click();
 assert.equal(await page.locator('#message').innerText(),'');
 await page.locator('#calculate').click();
 await page.locator('#generateQr').click();
 const url=await page.locator('#shareUrl').inputValue();
 assert.match(url,/#r=/);
 assert.match(decodeURIComponent(await page.locator('#shareActions a').first().getAttribute('href')),/especiales/);
 await page.goto(url);
 assert.match(await page.locator('#viewerConsumption').innerText(),/4 especiales/);
 assert.equal(await page.locator('#viewerError').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('UI units: creation, draft toggles, validation, variety editing, WhatsApp and shared report passed at 390px.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});

