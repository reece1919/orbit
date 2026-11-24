const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ingredient,step,filter,shopping}=require('../hearth-cookbook.js');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const rows=[{id:'1',title:'Focaccia',status:'favorite',tags:['Italian','bread'],ingredients:[{quantity:500,unit:'g',name:'flour'},{quantity:2,unit:'tsp',ingredient:'salt'}]},{id:'2',title:'Bean soup',status:'untested',tags:['soup'],ingredients:[{amount:2,unit:'cups',name:'beans'}]}];
test('Ingredient and step formatting accept text and structured records',()=>{
  assert.equal(ingredient(rows[0].ingredients[0]),'500 g flour');
  assert.equal(ingredient(rows[0].ingredients[1]),'2 tsp salt');
  assert.equal(ingredient('Olive oil'),'Olive oil');
  assert.equal(ingredient(null),'');
  assert.equal(step({instruction:'Bake.'}),'Bake.');
  assert.equal(step('Cool.'),'Cool.');
  assert.equal(shopping(rows[0]),'500 g flour\n2 tsp salt');
});
test('Search title, ingredient, cuisine tags and status without editing records',()=>{
  assert.deepEqual(filter(rows,' FLOUR ','','').map(r=>r.id),['1']);
  assert.deepEqual(filter(rows,'italian','favorite','bread').map(r=>r.id),['1']);
  assert.deepEqual(filter(rows,'','untested','bread'),[]);
  assert.equal(filter(rows,'','','').length,2);
});
test('Reader is owner-scoped, paginated, and cleared on close or auth change',()=>{
  const js=read('hearth-cookbook.js'),html=read('index.html');
  assert.ok(js.includes(".from('hearth_recipes')"));
  assert.ok(js.includes(".eq('owner_id',account)"));
  assert.ok(js.includes('.range(offset,offset+99)'));
  assert.ok(js.includes('auth.user?.id!==account'));
  assert.ok(js.includes("dialog.addEventListener('close'"));
  assert.ok(js.includes("document.addEventListener('orbit:auth-changed'"));
  assert.doesNotMatch(js,/\.(insert|update|upsert)\(/);
  assert.doesNotMatch(js,/innerHTML|localStorage|sessionStorage/);
  for(const id of ['hearth-dialog','hearth-open','hearth-close','hearth-list','hearth-recipe','hearth-refresh','hearth-search','hearth-status-filter','hearth-tag-filter','hearth-state'])assert.equal(html.split('id="'+id+'"').length,2);
});
