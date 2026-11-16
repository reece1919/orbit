'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../habit-core.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Daily habits respect selected weekdays',()=>{
 const habit={id:'a',cadence:'daily',days_of_week:[1,3,5],reminder_enabled:true,reminder_time:'09:00'};
 assert.equal(core.scheduled(habit,'2026-11-16'),true); // Monday.
 assert.equal(core.scheduled(habit,'2026-11-17'),false);
 assert.equal(core.reminderDue(habit,[],'2026-11-16'),true);
 assert.equal(core.reminderDue(habit,[],'2026-11-17'),false);
 assert.equal(core.reminderDue(habit,[{habit_id:'a',log_date:'2026-11-16',status:'skipped'}],'2026-11-16'),false);
 assert.equal(core.reminderDue(habit,[{habit_id:'a',log_date:'2026-11-16',status:'done'}],'2026-11-16'),false);
});

test('Weekly target stops alerts once reached; skip never counts',()=>{
 const habit={id:'a',cadence:'weekly',days_of_week:core.ALL,reminder_enabled:true,reminder_time:'09:00',weekly_target:2};
 const logs=[{habit_id:'a',log_date:'2026-11-16',status:'done'},{habit_id:'a',log_date:'2026-11-17',status:'skipped'}];
 assert.equal(core.weekStart('2026-11-18'),'2026-11-16');
 assert.equal(core.completedWeek(habit,logs,'2026-11-18'),1);
 assert.equal(core.reminderDue(habit,logs,'2026-11-18'),true);
 const completed=[...logs,{habit_id:'a',log_date:'2026-11-18',status:'done'}];
 assert.equal(core.completedWeek(habit,completed,'2026-11-19'),2);
 assert.equal(core.reminderDue(habit,completed,'2026-11-19'),false);
 assert.equal(core.completedWeek(habit,[{habit_id:'a',log_date:'2026-11-15',status:'done'}],'2026-11-16'),0);
});

test('Habit schedule validates days and reminder time',()=>{
 assert.deepEqual(core.days([6,0,6,12,-1,1]),[0,1,6]);
 assert.equal(core.isTime('20:30'),true);
 assert.equal(core.isTime('24:30'),false);
 assert.equal(core.isTime('20:90'),false);
});

test('Habits are accessible as a dedicated panel and inside the Daily Review',()=>{
 const html=read('index.html'),app=read('app.js'),worker=read('pulse-sw.js');
 assert.match(html,/data-panel="habits" id="habits-panel"/);
 assert.match(html,/id="review-habit-list"/);
 assert.match(html,/data-view="habits"/);
 assert.match(app,/habits:'HABITS'/);
 assert.match(app,/setView\(startupView\(\)\)/);
 assert.match(worker,/\["pulse","review","habits"\]/);
 assert.match(read('habits.js'),/\.from\('orbit_habit_logs'\)/);
});

test('Database schema uses owner + MFA and preserves existing routines',()=>{
 const sql=read('supabase/migrations/20261116_orbit_v2_habits.sql');
 assert.match(sql,/alter table public\.orbit_habits enable row level security/);
 assert.match(sql,/alter table public\.orbit_habit_logs enable row level security/);
 assert.match(sql,/foreign key\(habit_id,owner_id\)/);
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/auth\.jwt\(\)->>'aal'/);
 assert.match(sql,/reminder_enabled boolean not null default false/);
 assert.doesNotMatch(sql,/drop table/i);
});

test('Server dispatch is completion-aware and never embeds habit names in notifications',()=>{
 const code=read('supabase/functions/orbit-pulse/index.ts');
 assert.match(code,/\.from\("orbit_habits"\)/);
 assert.match(code,/\.from\("orbit_habit_logs"\)/);
 assert.match(code,/recent\.some\(l=>l\.log_date===clock\.day\)/);
 assert.match(code,/recent\.filter\(l=>l\.status==="done"\)\.length>=habit\.weekly_target/);
 assert.match(code,/title:"ORBIT · Habit check-in"/);
 assert.match(code,/url:LINK\+"\?view=habits"/);
 assert.doesNotMatch(code,/body:.*habit\.title/);
});
