const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
function runtime() {
  const elements = {};
  const events = {};
  const context = { location: {protocol:'https:',href:'https://cross-naicha.github.io/gastos-compartidos/index.html',hash:''}, URL, URLSearchParams,
    document: {getElementById(id) {return elements[id] ||= {value:'',innerHTML:'',hidden:false,events:{},addEventListener(t,f){this.events[t]=f;}}; }},
    window: {addEventListener(t,f){events[t]=f;}},
  };
  for (const key of ['localStorage','sessionStorage','indexedDB']) Object.defineProperty(context,key,{get(){throw new Error('Storage access forbidden');}});
  Object.defineProperty(context.document,'cookie',{get(){throw new Error('Cookie access forbidden');},set(){throw new Error('Cookie write forbidden');}});
  vm.createContext(context);
  for (const file of ['vendor/lz-string.min.js','gastos-core.js','gastos-share.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  return {context,elements,events};
}
function fixture(mode='consumption') {
  return {mode,people:[{id:'a',name:'Nicolás'},{id:'b',name:'Emilio'},{id:'c',name:'Mario'}],expenses:[
    {id:'e',description:'Pizza & bebidas',payer:'a',cents:901,participants:null},
    {id:'f',description:'Postre',payer:'b',cents:501,participants:['a','b']}
  ]};
}
test('Both modes round-trip through URL with valid settlements',()=>{
  const {context:c}=runtime();
  for(const mode of ['equal','consumption']) {
    const state=fixture(mode),b=c.GastosCore.balance(state),g=c.GastosCore.greedy(b.rows),o=c.GastosCore.efficient(b.rows,g);
    for(const transfers of [g,o.transfers]) {
      const url=c.GastosShare.link(state,transfers,'distribution');
      const token=new URLSearchParams(new URL(url).hash.slice(1)).get('r');
      const result=c.GastosShare.decode(token);
      assert.deepEqual(Array.from(c.GastosCore.balance(result.state).rows,p=>p.share),Array.from(b.rows,p=>p.share));
      assert.equal(result.state.people[0].name,'Nicolás');
      assert.equal(result.state.expenses[0].description,'Pizza & bebidas');
    }
    assert.equal(b.rows.reduce((s,p)=>s+p.balance,0),0);
  }
});
test('Consumption details use the same cent rounding as balances',()=>{
  const {context:c}=runtime(),state=fixture(),rows=c.GastosCore.balance(state).rows,details=c.GastosCore.consumptionDetails(state);
  rows.forEach((p,i)=>assert.equal(p.share,details[i].total));
  assert.equal(details[2].items.length,1);
});
test('Invalid indices, amounts, empty groups and unsettled payments rejected',()=>{
  const {context:c}=runtime(),s=fixture(),g=c.GastosCore.greedy(c.GastosCore.balance(s).rows);
  const base=c.GastosShare.pack(s,g,'greedy');
  for(const mutate of [d=>d.e[0][2]=999,d=>d.e[0][1]=-1,d=>d.e[0][3]=[],d=>d.t=[],d=>d.t[0][2]++,d=>d.p[0]='',d=>d.v=3]) {
    const data=JSON.parse(JSON.stringify(base));mutate(data);assert.throws(()=>c.GastosShare.unpack(data));
  }
  assert.throws(()=>c.GastosShare.decode('bad'));
  assert.throws(()=>c.GastosShare.decode('x'.repeat(12001)));
});
test('Viewer reads snapshot, prepares alias messages, resets on identity/history changes without storage',()=>{
  const {context:c,elements:e,events}=runtime(),s=fixture(),g=c.GastosCore.greedy(c.GastosCore.balance(s).rows);
  c.location.hash='#r='+encodeURIComponent(c.GastosShare.encode(s,g,'distribution'));
  vm.runInContext(fs.readFileSync(path.join(root,'consulta.js'),'utf8'),c);
  assert.equal(e.viewerContent.hidden,false);
  e.identity.value='0';e.identity.events.change();
  assert.equal(e.aliasField.hidden,false);
  e.bankAlias.value='mi.alias';e.bankAlias.events.input();
  const url=e.myRequests.innerHTML.match(/href="([^"]+)"/)[1];
  const msg=new URL(url).searchParams.get('text');
  assert.match(msg,/mi.alias/);assert.match(msg,/Nicolás/);assert.match(msg,/Emilio|Mario/);
  e.identity.value='2';e.identity.events.change();assert.equal(e.bankAlias.value,'');assert.equal(e.myRequests.innerHTML,'');
  e.bankAlias.value='private';events.pageshow();assert.equal(e.identity.value,'');assert.equal(e.bankAlias.value,'');
  c.location.hash='#r=bad';events.hashchange();assert.equal(e.viewerError.hidden,false);assert.equal(e.viewerContent.hidden,true);
});
test('QR generator handles encoded account link locally',()=>{
  const {context:c}=runtime();vm.runInContext(fs.readFileSync(path.join(root,'vendor/qrcode.js'),'utf8'),c);
  const s=fixture(),g=c.GastosCore.greedy(c.GastosCore.balance(s).rows),url=c.GastosShare.link(s,g,'distribution');
  const qr=c.qrcode(0,'M');qr.addData(url,'Byte');qr.make();assert.match(qr.createSvgTag({scalable:true}),/<svg/);
});
test('Individual amounts and shared expenses use the same exact balances and survive QR encoding',()=>{
  const {context:c}=runtime();
  const s={mode:'consumption',people:['Nicolás','Emilio','Mario','Benja'].map((name,i)=>({id:String(i),name})),expenses:[
    {id:'e',payer:'0',description:'12 empanadas',cents:1800000,participants:null,allocations:[{id:'1',cents:500000},{id:'2',cents:700000},{id:'3',cents:600000}]},
    {id:'f',payer:'1',description:'Bebidas',cents:10001,participants:null}
  ]};
  const b=c.GastosCore.balance(s),d=c.GastosCore.consumptionDetails(s);
  assert.deepEqual(Array.from(b.rows,p=>p.share),[2501,502500,702500,602500]);
  assert.equal(d[0].items.length,1);assert.equal(d[2].items[0].cents,700000);
  assert.equal(b.rows.reduce((sum,p)=>sum+p.balance,0),0);
  const g=c.GastosCore.greedy(b.rows),o=c.GastosCore.efficient(b.rows,g);
  for(const transfers of [g,o.transfers]) {
    const result=c.GastosShare.decode(c.GastosShare.encode(s,transfers,'greedy'));
    assert.deepEqual(Array.from(c.GastosCore.balance(result.state).rows,p=>p.share),Array.from(b.rows,p=>p.share));
    assert.equal(result.state.expenses[0].allocations[1].cents,700000);
  }
  s.mode='equal';assert.deepEqual(Array.from(c.GastosCore.balance(s).rows,p=>p.share),[452501,452500,452500,452500]);
  s.mode='consumption';assert.equal(c.GastosCore.balance(s).rows[2].share,702500);
});
test('Malformed individual allocations rejected and old v1 links remain supported',()=>{
  const {context:c}=runtime(),s=fixture(),g=c.GastosCore.greedy(c.GastosCore.balance(s).rows),base=c.GastosShare.pack(s,g,'greedy');
  for(const allocations of [[],[[0,900]],[[99,901]],[[0,902]],[[0,-1],[1,902]],[[0,500],[0,401]],[[0,0],[1,901]],[[0,900.5]]]) {
    const data=JSON.parse(JSON.stringify(base));data.e[0][4]=allocations;assert.throws(()=>c.GastosShare.unpack(data));
  }
  const old=JSON.parse(JSON.stringify(base));old.v=1;old.e.forEach(e=>e.pop());
  assert.equal(c.GastosShare.unpack(old).state.expenses[0].allocations,null);
});
