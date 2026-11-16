'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../review-core.js');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Unknown alcohol amount is distinct from explicitly alcohol-free',()=>{
 assert.equal(core.reportedAmount(null),null);
 assert.equal(core.reportedAmount(''),null);
 assert.equal(core.reportedAmount(0),0);
 assert.equal(core.reportedAmount('0'),0);
 assert.equal(core.reportedAmount('2.75'),2.75);
 assert.equal(core.reportedAmount('-1'),null);
 assert.equal(core.reportedAmount('41'),null);
 assert.equal(core.sourceBadges({alcohol:null}).alcohol,false);
 assert.equal(core.sourceBadges({alcohol:0}).alcohol,true);
});

test('Finish and skip never pretend an entry was completed',()=>{
 assert.equal(core.reviewStatus(null),'pending');
 assert.equal(core.reviewStatus({skipped_at:'2026-11-16T23:00:00Z'}),'skipped');
 assert.equal(core.reviewStatus({finished_at:'2026-11-16T23:00:00Z'}),'complete');
});

test('Evening checklist ignores invalid duplicate and oversized steps',()=>{
 const rows=core.normalizeSteps([{id:'one',title:'  Prepare  '},{id:'one',title:'Duplicate'},{id:'two',title:''},{id:'bad id',title:'Bad id'}]);
 assert.deepEqual(rows,[{id:'one',title:'Prepare'}]);
 assert.equal(core.percentComplete([{id:'one',title:'One'},{id:'two',title:'Two'}],['one']),50);
 assert.equal(core.percentComplete([],[]),null);
});

test('Daily review opens directly from Home and notification link',()=>{
 const html=read('index.html'),app=read('app.js'),worker=read('pulse-sw.js');
 assert.match(html,/data-panel="review" id="review-panel"/);
 assert.match(html,/data-view="review"/);
 assert.match(html,/id="review-finish"/);
 assert.match(app,/get\('view'\)==='review'/);
 assert.match(worker,/\["pulse","review","habits"\]/);
 assert.match(worker,/payload\.url/);
});

test('Private schema requires owner and authenticator for reviewing',()=>{
 const sql=read('supabase/migrations/20261116_orbit_evening_review.sql');
 assert.match(sql,/alter table public\.orbit_daily_reviews enable row level security/i);
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/auth\.jwt\(\)->>'aal'\)='aal2'/);
 assert.match(sql,/review_reminders_enabled boolean not null default false/);
 assert.match(sql,/pulse_push_deliveries_kind_check/);
});

test('Scheduler suppresses completed and skipped review pushes',()=>{
 const server=read('supabase/functions/orbit-pulse/index.ts');
 assert.match(server,/review\?\.finished_at\|\|review\?\.skipped_at/);
 assert.match(server,/review_reminders_enabled===true/);
 assert.match(server,/review_snooze/);
 assert.match(server,/view="\+\(isReview\?"review":"pulse"\)/);
});

test('Review form reuses existing PULSE moods and writing',()=>{
 const js=read('review.js');
 assert.match(js,/\.from\('pulse_moods'\)/);
 assert.match(js,/\.from\('pulse_journals'\)/);
 assert.match(js,/if\(!draftDirty\)/);
 assert.match(js,/draftDirty=false/);
});
