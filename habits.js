/* ORBIT 2.0 private habits. One log per habit/day; optional, discreet reminders. */
(()=>{
 'use strict';
 const core=window.ORBITHabitCore,$=id=>document.getElementById(id);
 let state={owner:'',habits:[],logs:[],editing:null,busy:false,loading:false,request:0,notifs:false};
 const day=()=>core.dayKey();
 const note=(value,bad=false)=>{const el=$('habits-status');if(el){el.textContent=value;el.classList.toggle('review-error',bad);}};
 const make=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;};
 const enabled=()=>state.habits.filter(h=>!h.archived_at);
 async function session(){
   const a=window.ORBITAuth;
   if(!a?.client||!a.user)throw Error('Sign in to record habits.');
   const {data,error}=await a.client.auth.mfa.getAuthenticatorAssuranceLevel();
   if(error||data?.currentLevel!=='aal2')throw Error('Verify your authenticator to access your private habits.');
   return a;
 }
 function locked(){
   $('habit-form').querySelector('fieldset').disabled=true;
   $('habits-list').replaceChildren(make('p','review-source-note','Sign in and verify your authenticator to manage habits.'));
   $('review-habit-list').replaceChildren(make('p','review-source-note','Sign in to see today’s habits.'));
   $('habits-home-summary').textContent='Sign in to see habits.';
   $('habits-day-count').textContent='—';
 }
 async function load(){
   if(state.loading||state.busy)return;
   const req=++state.request;state.loading=true;note('Loading private habit records…');
   try{
     const a=await session(),old=new Date();old.setDate(old.getDate()-50);
     const results=await Promise.all([
       a.client.from('orbit_habits').select('*').eq('owner_id',a.user.id).order('created_at',{ascending:true}).limit(100),
       a.client.from('orbit_habit_logs').select('*').eq('owner_id',a.user.id).gte('log_date',core.dayKey(old)).order('log_date',{ascending:false}).limit(2000),
       a.client.from('pulse_settings').select('time_zone,notifications_enabled').eq('owner_id',a.user.id).maybeSingle()
     ]);
     if(req!==state.request||window.ORBITAuth?.user?.id!==a.user.id)return;
     const failure=results.find(x=>x.error)?.error;if(failure)throw failure;
     state.owner=a.user.id;state.habits=results[0].data||[];state.logs=results[1].data||[];
     state.notifs=results[2].data?.notifications_enabled===true;
     $('habit-form').querySelector('fieldset').disabled=false;
     render();note('Private habit tracking connected. Unlogged days remain unknown.');
   }catch(error){
     if(req!==state.request)return;
     state.owner='';state.habits=[];state.logs=[];locked();note(error.message||'Could not load habits.',true);
   }finally{state.loading=false;}
 }
 function description(h,key){
   if(h.cadence==='weekly'){
     const n=core.completedWeek(h,state.logs,key);
     return n+' of '+h.weekly_target+' this week'+(core.scheduled(h,key)?' · Reminder day':'');
   }
   return core.scheduled(h,key)?'Scheduled today':'Not scheduled today';
 }
 function renderCard(h,key,compact=false){
   const status=core.row(state.logs,h,key)?.status||'missing';
   const card=make('div','habit-row'+(status==='done'?' habit-done':''));
   const info=make('div','habit-row-info');
   info.append(make('strong','habit-row-title',h.title),make('small','habit-row-caption',description(h,key)));
   const statusTag=make('small','habit-row-status',
     status==='done'?'Done today':status==='skipped'?'Skipped today':core.completed(h,state.logs,key)?'Weekly goal met':core.scheduled(h,key)?'Not recorded':'Optional today');
   info.append(statusTag);card.append(info);
   const actions=make('div','habit-row-actions');
   function button(label,action,klass='quiet-pill'){
     const b=make('button',klass,label);b.type='button';b.disabled=state.busy;
     b.addEventListener('click',()=>void log(h.id,action));return b;
   }
   if(status!=='done')actions.append(button('Done','done','outline-button'));
   if(status==='missing'&&core.scheduled(h,key))actions.append(button('Skip','skipped'));
   if(status!=='missing')actions.append(button('Undo','undo'));
   if(!compact){
     const edit=make('button','quiet-pill','Edit');edit.type='button';edit.addEventListener('click',()=>editHabit(h.id));
     actions.append(edit);
   }
   card.append(actions);return card;
 }
 function render(){
   if(!state.owner)return locked();
   const t=day(),list=enabled();
   const active=list.filter(h=>core.scheduled(h,t));
   const completed=active.filter(h=>core.row(state.logs,h,t)?.status==='done'||core.completed(h,state.logs,t)).length;
   const planned=active.length;
   $('habits-day-count').textContent=completed+' / '+planned+' scheduled';
   $('habits-home-summary').textContent=list.length?
     completed+' of '+planned+' scheduled habits completed today · '+list.length+' active':
     'No habits configured yet. Create one in Habits.';
   $('habits-reminder-note').textContent=state.notifs?
     'Account notifications are enabled. Each device still needs a working Web Push subscription in VITA → Mind. Reminder notifications never reveal habit names.':
     'Account notifications are off. Enable and test Web Push in VITA → Mind if you want habit alerts. Creating habits does not enable notifications automatically.';
   const main=$('habits-list'),review=$('review-habit-list');main.replaceChildren();review.replaceChildren();
   if(!list.length){
     main.append(make('p','review-source-note','Add your first habit to start recording.'));
     review.append(make('p','review-source-note','Create your habits in the Habits section.'));return;
   }
   for(const h of list){main.append(renderCard(h,t));if(core.scheduled(h,t))review.append(renderCard(h,t,true));}
   if(!active.length)review.append(make('p','review-source-note','No habits scheduled today.'));
 }
 async function log(id,status){
   if(!state.owner||state.busy)return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   if(a.user.id!==state.owner)return;
   state.busy=true;note('Saving habit check-in…');
   const t=day();
   try{
     const q=status==='undo'?
       await a.client.from('orbit_habit_logs').delete().eq('owner_id',state.owner).eq('habit_id',id).eq('log_date',t):
       await a.client.from('orbit_habit_logs').upsert({owner_id:state.owner,habit_id:id,log_date:t,status,updated_at:new Date().toISOString()},{onConflict:'habit_id,log_date'});
     if(q.error)throw q.error;
     if(status==='undo')state.logs=state.logs.filter(x=>!(x.habit_id===id&&x.log_date===t));
     else state.logs=[...state.logs.filter(x=>!(x.habit_id===id&&x.log_date===t)),{owner_id:state.owner,habit_id:id,log_date:t,status}];
     note(status==='done'?'Habit recorded.':status==='skipped'?'Skipped, without counting as complete.':'Check-in undone.');
   }catch(error){note('Could not save: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 function resetForm(){
   state.editing=null;const f=$('habit-form');f.reset();
   f.elements.cadence.value='daily';f.elements.weekly_target.value='1';
   for(const c of f.querySelectorAll('input[name="days"]'))c.checked=true;
   f.elements.reminder_time.value='09:00';
   $('habit-form-title').textContent='Create a habit';
   $('habit-save').textContent='Save habit';
   $('habit-edit-cancel').hidden=true;$('habit-archive').hidden=true;
   showCadence();
 }
 function showCadence(){
   const f=$('habit-form');
   f.querySelector('.habit-goal-field').hidden=f.elements.cadence.value!=='weekly';
 }
 function editHabit(id){
   const h=state.habits.find(x=>x.id===id);if(!h)return;
   state.editing=id;const f=$('habit-form');
   f.elements.title.value=h.title;
   f.elements.cadence.value=h.cadence;
   f.elements.weekly_target.value=String(h.weekly_target||1);
   f.elements.reminder_time.value=h.reminder_time||'09:00';
   f.elements.reminder_enabled.checked=!!h.reminder_enabled;
   const days=core.days(h.days_of_week);for(const c of f.querySelectorAll('input[name="days"]'))c.checked=days.includes(Number(c.value));
   $('habit-form-title').textContent='Edit habit';
   $('habit-save').textContent='Save changes';
   $('habit-edit-cancel').hidden=false;$('habit-archive').hidden=false;
   showCadence();$('habits-panel').scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function save(event){
   event.preventDefault();if(!state.owner||state.busy)return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   const f=event.currentTarget;
   const title=f.elements.title.value.trim().slice(0,100);
   const days=[...f.querySelectorAll('input[name="days"]:checked')].map(x=>Number(x.value));
   const cadence=f.elements.cadence.value;
   const reminder_enabled=f.elements.reminder_enabled.checked;
   const reminder_time=f.elements.reminder_time.value||null;
   const weekly_target=Number(f.elements.weekly_target.value);
   if(!title||!days.length||!['daily','weekly'].includes(cadence)||(reminder_time&&!core.isTime(reminder_time))){
     note('Enter a habit name, choose at least one day, and use a valid reminder time.',true);return;
   }
   if(reminder_enabled&&!reminder_time){note('Choose a reminder time before enabling reminders.',true);return;}
   state.busy=true;note('Saving habit…');
   const data={owner_id:state.owner,title,cadence,days_of_week:days,weekly_target,
     reminder_time,reminder_enabled,updated_at:new Date().toISOString()};
   try{
     const q=state.editing?await a.client.from('orbit_habits').update(data).eq('owner_id',state.owner).eq('id',state.editing).select().single():
       await a.client.from('orbit_habits').insert(data).select().single();
     if(q.error)throw q.error;
     state.habits=state.editing?state.habits.map(h=>h.id===state.editing?q.data:h):[...state.habits,q.data];
     resetForm();note('Habit saved. Reminders are optional and require push registration.');
   }catch(error){note('Could not save habit: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 async function archive(){
   if(!state.editing||state.busy)return;
   const h=state.habits.find(x=>x.id===state.editing);
   if(!h||!window.confirm('Archive this habit? Recorded history will be kept.'))return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   state.busy=true;
   try{
     const q=await a.client.from('orbit_habits').update({archived_at:new Date().toISOString(),reminder_enabled:false,updated_at:new Date().toISOString()}).eq('owner_id',state.owner).eq('id',state.editing).select().single();
     if(q.error)throw q.error;
     state.habits=state.habits.map(x=>x.id===h.id?q.data:x);
     resetForm();note('Habit archived; history kept.');
   }catch(error){note('Archive failed: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 $('habit-form')?.addEventListener('submit',e=>void save(e));
 $('habit-form')?.elements.cadence?.addEventListener('change',showCadence);
 $('habit-edit-cancel')?.addEventListener('click',resetForm);
 $('habit-archive')?.addEventListener('click',()=>void archive());
 $('habits-reload')?.addEventListener('click',()=>void load());
 document.addEventListener('orbit:auth-changed',()=>{state.request++;state.loading=false;state.owner='';resetForm();locked();void load();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
 document.addEventListener('orbit:habit-changed',()=>void load());
 window.ORBITHabits={refresh:()=>void load()};
 resetForm();locked();
 if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load());
})();