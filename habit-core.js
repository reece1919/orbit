/* ORBIT 2.0 habit helpers, portable to Node tests. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ORBITHabitCore=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const ALL=[0,1,2,3,4,5,6];
 const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 const dayKey=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const dayFromKey=key=>new Date(key+'T12:00:00');
 const weekStart=key=>{const d=dayFromKey(key);d.setDate(d.getDate()-(d.getDay()+6)%7);return dayKey(d);};
 const isTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 const days=value=>Array.isArray(value)?[...new Set(value.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort((a,b)=>a-b):ALL;
 const scheduled=(habit,key)=>!habit.archived_at&&days(habit.days_of_week).includes(dayFromKey(key).getDay());
 const row=(logs,habit,key)=>logs.find(x=>x.habit_id===habit.id&&x.log_date===key);
 const completedWeek=(habit,logs,key)=>logs.filter(x=>x.habit_id===habit.id&&x.status==='done'&&x.log_date>=weekStart(key)&&x.log_date<=key).length;
 const completed=(habit,logs,key)=>habit.cadence==='weekly'?completedWeek(habit,logs,key)>=Number(habit.weekly_target):row(logs,habit,key)?.status==='done';
 const reminderDue=(habit,logs,key)=>Boolean(habit.reminder_enabled&&habit.reminder_time&&scheduled(habit,key)&&!row(logs,habit,key)&&!completed(habit,logs,key));
 return Object.freeze({ALL,DAY_NAMES,dayKey,dayFromKey,weekStart,isTime,days,scheduled,row,completedWeek,completed,reminderDue});
});