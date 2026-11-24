const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('Home shows catalog flags and private recommendations separately',()=>{
  const html=read('index.html'), js=read('integrations.js');
  for(const id of ['gaia-home-note','gaia-home-flags','gaia-home-review-status','gaia-home-recommendations']){
    assert.equal(html.split('id="'+id+'"').length,2);
    assert.ok(js.includes('#'+id));
  }
  assert.ok(js.includes('orderedFlags.slice(0,3)'));
  assert.ok(js.includes('catalog care flags'));
  assert.ok(js.includes('date unknown'));
  assert.ok(js.includes('older review; recheck conditions'));
});
test('Private preview verifies owner and MFA, does not write records, and clears on account changes',()=>{
  const js=read('integrations.js');
  const fn=js.split('async function refreshGaiaHomeReview(){')[1].split('function renderGaiaPrivate(){')[0];
  assert.ok(fn.includes('seq===gaiaReviewSequence&&gaiaUser?.id===owner'));
  assert.ok(fn.includes("currentLevel!=='aal2'"));
  assert.equal(fn.split(".eq('user_id',owner)").length,3);
  assert.ok(fn.includes("['dismissed','todoist']"));
  assert.ok(fn.includes('list.replaceChildren();list.hidden=true;'));
  assert.doesNotMatch(fn,/\.(?:insert|update|upsert|delete)\(/);
  assert.doesNotMatch(fn,/innerHTML/);
  assert.ok(js.includes('void refreshGaiaHomeReview();'));
});
