/* ORBIT 2.1: habit and activity logic; pure helpers also used by Node tests. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ORBITHabitCore=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const ALL=[0,1,2,3,4,5,6];
 const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const CATEGORIES=Object.freeze({hygiene:'Hygiene',health:'Health',movement:'Movement',home:'Home',creative:'Creativity',leisure:'Leisure',social:'Social',learning:'Learning',other:'Other'});
 // Templates prefill the editor only. Never create records without user confirmation.
 const PRESETS=Object.freeze([
  {key:'brush-teeth',title:'Brush teeth',category:'hygiene',entry_type:'count',unit_label:'times',goal_enabled:true,daily_target:2,cadence:'daily'},
  {key:'gaming',title:'Gaming',category:'leisure',entry_type:'duration',unit_label:'minutes',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'tv',title:'Watch TV',category:'leisure',entry_type:'duration',unit_label:'minutes',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'read',title:'Reading',category:'learning',entry_type:'duration',unit_label:'minutes',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'art',title:'Make art',category:'creative',entry_type:'duration',unit_label:'minutes',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'exercise',title:'Exercise',category:'movement',entry_type:'checkoff',unit_label:'times',goal_enabled:true,daily_target:1,cadence:'weekly',weekly_target:3},
  {key:'water',title:'Drink water',category:'health',entry_type:'count',unit_label:'glasses',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'go-outside',title:'Go outside',category:'movement',entry_type:'checkoff',unit_label:'times',goal_enabled:true,daily_target:1,cadence:'daily'},
  {key:'social',title:'Time with friends',category:'social',entry_type:'duration',unit_label:'minutes',goal_enabled:false,daily_target:1,cadence:'daily'},
  {key:'cook',title:'Cook a meal',category:'home',entry_type:'checkoff',unit_label:'times',goal_enabled:false,daily_target:1,cadence:'daily'}
 ]);
 const dayKey=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const dayFromKey=key=>new Date(key+'T12:00:00');
 const weekStart=key=>{const d=dayFromKey(key);d.setDate(d.getDate()-(d.getDay()+6)%7);return dayKey(d);};
 const isTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 const days=value=>Array.isArray(value)?[...new Set(value.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort((a,b)=>a-b):ALL;
 const scheduled=(habit,key)=>!habit.archived_at&&days(habit.days_of_week).includes(dayFromKey(key).getDay());
 const row=(logs,habit,key)=>logs.find(x=>x.habit_id===habit.id&&x.log_date===key);
 const isGoal=habit=>habit.goal_enabled!==false;
 const type=habit=>['count','duration'].includes(habit.entry_type)?habit.entry_type:'checkoff';
 const dailyTarget=habit=>Number(habit.daily_target)||1;
 const attained=(habit,log)=>!!(log&&log.status==='done'&&(type(habit)==='checkoff'||Number(log.amount??1)>=dailyTarget(habit)));
 const completedWeek=(habit,logs,key)=>logs.filter(x=>x.habit_id===habit.id&&x.log_date>=weekStart(key)&&x.log_date<=key&&attained(habit,x)).length;
 const completed=(habit,logs,key)=>isGoal(habit)&&(
   habit.cadence==='weekly'?completedWeek(habit,logs,key)>=Number(habit.weekly_target):attained(habit,row(logs,habit,key)));
 const reminderDue=(habit,logs,key)=>Boolean(habit.reminder_enabled&&habit.reminder_time&&scheduled(habit,key)&&!row(logs,habit,key)&&(!isGoal(habit)||!completed(habit,logs,key)));
 const formattedAmount=(habit,amount)=>{
   if(type(habit)==='checkoff')return 'Done';
   const value=Number(amount)||0;
   if(type(habit)==='duration'){
     const whole=Math.round(value);
     return whole>=60?Math.floor(whole/60)+'h'+(whole%60?' '+(whole%60)+'m':''):whole+' min';
   }
   return value.toLocaleString(undefined,{maximumFractionDigits:2})+' '+(habit.unit_label||'times');
 };
 const validAmount=(habit,value)=>{
   const n=Number(value);
   return String(value).trim()!==''&&Number.isFinite(n)&&n>0&&n<=100000&&
     (type(habit)==='duration'||type(habit)==='count'?Number.isInteger(n):true);
 };
 return Object.freeze({ALL,DAY_NAMES,CATEGORIES,PRESETS,dayKey,dayFromKey,weekStart,isTime,days,scheduled,row,isGoal,type,dailyTarget,attained,completedWeek,completed,reminderDue,formattedAmount,validAmount});
});