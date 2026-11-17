'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../habit-core.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Habit templates include hygiene, leisure, creative and home examples',()=>{
 const byKey=Object.fromEntries(core.PRESETS.map(x=>[x.key,x]));
 assert.equal(byKey['brush-teeth'].entry_type,'count');
 assert.equal(byKey['brush-teeth'].daily_target,2);
 assert.equal(byKey['gaming'].entry_type,'duration');
 assert.equal(byKey['gaming'].goal_enabled,false);
 assert.equal(byKey['tv'].goal_enabled,false);
 assert.equal(byKey['tv'].category,'leisure');
 assert.equal(byKey['art'].category,'creative');
 assert.equal(byKey['cook'].category,'home');
 assert.ok(core.PRESETS.every(p=>!p.reminder_enabled));
});

test('A casual leisure log is not a missed goal or goal completion',()=>{
 const hobby={id:'a',entry_type:'duration',goal_enabled:false,cadence:'daily',days_of_week:core.ALL};
 const logs=[{habit_id:'a',log_date:'2026-11-17',status:'done',amount:90}];
 assert.equal(core.attained(hobby,logs[0]),true);
 assert.equal(core.completed(hobby,logs,'2026-11-17'),false);
 assert.equal(core.formattedAmount(hobby,90),'1h 30m');
 assert.equal(core.reminderDue(hobby,[],'2026-11-17'),false);
});

test('Two brushings satisfy count goal but one is only a partial day',()=>{
 const h={id:'t',entry_type:'count',unit_label:'times',daily_target:2,goal_enabled:true,cadence:'daily',days_of_week:core.ALL};
 const one=[{habit_id:'t',log_date:'2026-11-17',status:'done',amount:1}];
 const two=[{habit_id:'t',log_date:'2026-11-17',status:'done',amount:2}];
 assert.equal(core.completed(h,one,'2026-11-17'),false);
 assert.equal(core.completed(h,two,'2026-11-17'),true);
 assert.equal(core.formattedAmount(h,2),'2 times');
 assert.equal(core.validAmount(h,2),true);
 assert.equal(core.validAmount(h,1.5),false);
 assert.equal(core.validAmount(h,0),false);
 assert.equal(core.validAmount(h,'abc'),false);
});

test('Weekly target counts full daily goals, not merely any recording',()=>{
 const h={id:'x',entry_type:'duration',daily_target:30,goal_enabled:true,cadence:'weekly',weekly_target:2,days_of_week:core.ALL};
 const logs=[
  {habit_id:'x',log_date:'2026-11-16',status:'done',amount:10},
  {habit_id:'x',log_date:'2026-11-17',status:'done',amount:30},
  {habit_id:'x',log_date:'2026-11-18',status:'done',amount:45}
 ];
 assert.equal(core.completedWeek(h,logs,'2026-11-17'),1);
 assert.equal(core.completed(h,logs,'2026-11-17'),false);
 assert.equal(core.completedWeek(h,logs,'2026-11-18'),2);
 assert.equal(core.completed(h,logs,'2026-11-18'),true);
});

test('UI supports category, activity quantity, optional goal and recent history',()=>{
 const html=read('index.html');
 const js=read('habits.js');
 for(const id of ['habit-presets','habits-history','review-habit-list'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const name of ['category','entry_type','goal_enabled','daily_target','unit_label'])assert.match(html,new RegExp('name="'+name+'"'));
 assert.match(js,/habit-quantity-fields/);
 assert.match(js,/habit-note/);
 assert.match(js,/renderPresets/);
 assert.match(js,/renderHistory/);
 assert.match(js,/\+30 min/);
 assert.match(js,/review-activity-list/);
 assert.match(html,/Other things I did today \(optional\)/);
 assert.match(js,/const goals=list\.filter\(h=>core\.isGoal\(h\)/);
 assert.match(js,/\.from\('orbit_habit_logs'\)\.upsert\(payload/);
});

test('Migration adds fields without removing existing logs or owner-only RLS',()=>{
 const sql=read('supabase/migrations/20261117_orbit_activity_tracking.sql');
 assert.match(sql,/alter table public\.orbit_habits/);
 assert.match(sql,/alter table public\.orbit_habit_logs/);
 for(const field of ['category','entry_type','goal_enabled','daily_target','unit_label','amount','note'])assert.match(sql,new RegExp(field));
 assert.doesNotMatch(sql,/drop table|delete from|truncate /i);
 assert.match(sql,/Existing owner-only AAL2 RLS policies/);
});

test('Push dispatcher checks amounts when deciding weekly goal completion',()=>{
 const server=read('supabase/functions/orbit-pulse/index.ts');
 assert.match(server,/select\("habit_id,log_date,status,amount"\)/);
 assert.match(server,/goal_enabled!==false/);
 assert.match(server,/Number\(l\.amount\?\?1\)>=Number\(habit\.daily_target\?\?1\)/);
});
