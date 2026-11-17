/* ORBIT 2.1 Habits & Activities.
   Private self-reported records. No-goal leisure is observational, not a chore. */
(()=>{
 'use strict';
 const core=window.ORBITHabitCore,$=id=>document.getElementById(id);
 let state={owner:'',habits:[],logs:[],editing:null,busy:false,loading:false,request:0,notifs:false};
 const day=()=>core.dayKey();
 const note=(value,bad=false)=>{const el=$('habits-status');if(el){el.textContent=value;el.classList.toggle('review-error',bad);}};
 const make=(tag,klass,value)=>{const el=document.createElement(tag);if(klass)el.className=klass;if(value!==undefined)el.textContent=value;return el;};
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
   $('review-activity-list').replaceChildren();
   $('habits-history').replaceChildren(make('p','review-source-note','Sign in to view history.'));
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
     render();note('Private activity tracking connected. Unrecorded days stay unknown.');
   }catch(error){
     if(req!==state.request)return;
     state.owner='';state.habits=[];state.logs=[];locked();note(error.message||'Could not load habits.',true);
   }finally{state.loading=false;}
 }
 function description(h,key){
   const scheduled=core.scheduled(h,key);
   if(!core.isGoal(h))return 'Activity log · no target'+(scheduled?'':' · optional today');
   if(h.cadence==='weekly')return core.completedWeek(h,state.logs,key)+' of '+h.weekly_target+' days this week';
   const amount=core.type(h)==='checkoff'?'':(' · goal '+core.formattedAmount(h,h.daily_target||1));
   return scheduled?'Scheduled today'+amount:'Not scheduled today';
 }
 function button(label,onClick,klass='quiet-pill'){
   const b=make('button',klass,label);b.type='button';b.disabled=state.busy;b.addEventListener('click',onClick);return b;
 }
 function renderCard(h,key,compact=false){
   const saved=core.row(state.logs,h,key),status=saved?.status||'missing',type=core.type(h);
   const met=core.attained(h,saved),goal=core.isGoal(h);
   const card=make('div','habit-row'+(status==='done'?' habit-done':'')+(goal?' habit-goal':' habit-activity'));
   const info=make('div','habit-row-info');
   const category=core.CATEGORIES[h.category]||'Other';
   info.append(make('strong','habit-row-title',h.title));
   info.append(make('small','habit-row-caption',category+' · '+description(h,key)));
   let statusText;
   if(status==='skipped')statusText='Skipped today';
   else if(status==='done'){
     statusText=type==='checkoff'?'Recorded today':core.formattedAmount(h,saved.amount);
     if(goal&&h.cadence==='daily'&&!met)statusText+=' · below your optional goal';
   }else if(goal&&core.completed(h,state.logs,key))statusText='Weekly goal met';
   else statusText=goal&&core.scheduled(h,key)?'Not recorded':'Record whenever you like';
   info.append(make('small','habit-row-status',statusText));
   card.append(info);
   const actions=make('div','habit-row-actions');
   let quantity=null,details=null;
   if(type!=='checkoff'){
     const fields=make('div','habit-quantity-fields');
     const qtyLabel=make('label','habit-quantity-label',type==='duration'?'Minutes today':(h.unit_label||'times')+' today');
     quantity=make('input','habit-amount');
     quantity.type='number';quantity.min='1';quantity.max='100000';quantity.step='1';quantity.inputMode='numeric';
     quantity.value=status==='done'?String(saved.amount??1):'';
     quantity.placeholder=type==='duration'?'e.g. 60':(h.unit_label||'times')+'…';
     qtyLabel.append(quantity);
     const extraLabel=make('label','habit-quantity-label','Note (optional)');
     details=make('input','habit-note');details.type='text';details.maxLength=500;
     details.value=saved?.note||'';details.placeholder=type==='duration'?'Game, show, book, or activity…':'Anything to remember…';
     extraLabel.append(details);fields.append(qtyLabel,extraLabel);card.append(fields);
     actions.append(button(status==='done'?'Update':'Record',()=>{
       const val=quantity.value.trim();
       if(!core.validAmount(h,val)){note('Enter a positive whole-number '+(type==='duration'?'minute':'count')+' amount.',true);quantity.focus();return;}
       void log(h.id,'done',{amount:Number(val),note:details.value.trim().slice(0,500)});
     },'outline-button'));
     actions.append(button(type==='duration'?'+30 min':'+1',()=>{
       const next=(Number(quantity.value)||0)+(type==='duration'?30:1);
       if(!core.validAmount(h,next)){note('Activity total must stay within the allowed range.',true);return;}
       void log(h.id,'done',{amount:next,note:details.value.trim().slice(0,500)});
     }));
   }else if(status!=='done'){
     actions.append(button('Done',()=>void log(h.id,'done',{amount:1,note:''}),'outline-button'));
   }
   if(status==='missing'&&goal&&core.scheduled(h,key))actions.append(button('Skip',()=>void log(h.id,'skipped',{amount:0,note:''})));
   if(status!=='missing')actions.append(button('Undo',()=>void log(h.id,'undo')));
   if(!compact)actions.append(button('Edit',()=>editHabit(h.id)));
   card.append(actions);return card;
 }
 function renderHistory(){
   const holder=$('habits-history');holder.replaceChildren();
   const items=state.logs.slice().sort((a,b)=>b.log_date.localeCompare(a.log_date)).slice(0,35);
   if(!items.length){holder.append(make('p','review-source-note','No recorded activities yet. Your entries will appear here.'));return;}
   for(const entry of items){
     const habit=state.habits.find(h=>h.id===entry.habit_id);if(!habit)continue;
     const date=new Date(entry.log_date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
     const line=make('div','habit-history-row');
     const left=make('div','habit-row-info');
     left.append(make('strong','habit-row-title',habit.title));
     left.append(make('small','habit-row-caption',date+' · '+(core.CATEGORIES[habit.category]||'Other')));
     if(entry.note)left.append(make('small','habit-row-caption',entry.note));
     line.append(left,make('span','habit-history-value',entry.status==='skipped'?'Skipped':core.formattedAmount(habit,entry.amount)));
     holder.append(line);
   }
 }
 function render(){
   if(!state.owner)return locked();
   const t=day(),list=enabled();
   const goals=list.filter(h=>core.isGoal(h)&&core.scheduled(h,t));
   const completed=goals.filter(h=>core.completed(h,state.logs,t)).length;
   const activityCount=list.filter(h=>!core.isGoal(h)&&core.row(state.logs,h,t)?.status==='done').length;
   $('habits-day-count').textContent=completed+' / '+goals.length+' goals';
   $('habits-home-summary').textContent=list.length?
     completed+' of '+goals.length+' scheduled goals met · '+activityCount+' other activities logged':
     'Nothing to record yet. Choose a template or create your own.';
   $('habits-reminder-note').textContent=state.notifs?
     'Account notifications are on. Your device also needs Web Push enabled in VITA → Mind. Lock-screen reminders never include activity names.':
     'Reminders are off for your account. Enable Web Push in VITA → Mind if you want alerts; new activities never enable them automatically.';
   const main=$('habits-list'),review=$('review-habit-list'),optional=$('review-activity-list');main.replaceChildren();review.replaceChildren();optional.replaceChildren();
   if(!list.length){
     main.append(make('p','review-source-note','Select a template above or create any habit or activity.'));
     review.append(make('p','review-source-note','Create habits and activities in the Habits section.'));
     optional.append(make('p','review-source-note','No optional activities yet.'));
     renderHistory();return;
   }
   for(const [key,label] of Object.entries(core.CATEGORIES)){
     const group=list.filter(h=>(h.category||'other')===key);if(!group.length)continue;
     const heading=make('h3','habit-category-heading',label);main.append(heading);
     for(const h of group)main.append(renderCard(h,t));
   }
   for(const h of list){
     if(core.isGoal(h)&&core.scheduled(h,t))review.append(renderCard(h,t,true));
     else if(!core.isGoal(h))optional.append(renderCard(h,t,true));
   }
   if(!review.childElementCount)review.append(make('p','review-source-note','No scheduled goals today.'));
   if(!optional.childElementCount)optional.append(make('p','review-source-note','Add any hobby or activity in Habits to record it here.'));
   renderHistory();
 }
 async function log(id,status,entry={}){
   if(!state.owner||state.busy)return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   if(a.user.id!==state.owner)return;
   const habit=state.habits.find(x=>x.id===id);if(!habit)return;
   state.busy=true;note('Saving activity…');
   const t=day();
   try{
     const payload={owner_id:state.owner,habit_id:id,log_date:t,status,
       amount:status==='done'?Number(entry.amount||1):0,
       note:status==='done'?String(entry.note||'').slice(0,500):'',
       updated_at:new Date().toISOString()};
     const q=status==='undo'?
       await a.client.from('orbit_habit_logs').delete().eq('owner_id',state.owner).eq('habit_id',id).eq('log_date',t):
       await a.client.from('orbit_habit_logs').upsert(payload,{onConflict:'habit_id,log_date'});
     if(q.error)throw q.error;
     if(status==='undo')state.logs=state.logs.filter(x=>!(x.habit_id===id&&x.log_date===t));
     else state.logs=[...state.logs.filter(x=>!(x.habit_id===id&&x.log_date===t)),payload];
     note(status==='done'?'Activity recorded.':status==='skipped'?'Skipped without counting as done.':'Entry undone.');
   }catch(error){note('Could not save: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 function updateFormFields(){
   const f=$('habit-form'),type=f.elements.entry_type.value,goal=f.elements.goal_enabled.checked;
   f.querySelector('.habit-goal-field').hidden=!goal||f.elements.cadence.value!=='weekly';
   f.querySelector('.habit-daily-target').hidden=!goal||type==='checkoff';
   f.querySelector('.habit-unit-field').hidden=type!=='count';
 }
 function resetForm(){
   state.editing=null;const f=$('habit-form');f.reset();
   f.elements.cadence.value='daily';f.elements.weekly_target.value='1';
   f.elements.category.value='other';f.elements.entry_type.value='checkoff';f.elements.goal_enabled.checked=true;
   f.elements.daily_target.value='1';f.elements.unit_label.value='times';
   for(const c of f.querySelectorAll('input[name="days"]'))c.checked=true;
   f.elements.reminder_time.value='09:00';f.elements.reminder_enabled.checked=false;
   $('habit-form-title').textContent='Create a habit';
   $('habit-save').textContent='Save habit';
   $('habit-edit-cancel').hidden=true;$('habit-archive').hidden=true;
   updateFormFields();
 }
 function fillForm(h){
   const f=$('habit-form');
   f.elements.title.value=h.title||'';
   f.elements.category.value=h.category||'other';
   f.elements.entry_type.value=core.type(h);
   f.elements.goal_enabled.checked=core.isGoal(h);
   f.elements.daily_target.value=String(h.daily_target||1);
   f.elements.unit_label.value=h.unit_label||'times';
   f.elements.cadence.value=h.cadence||'daily';
   f.elements.weekly_target.value=String(h.weekly_target||1);
   f.elements.reminder_time.value=h.reminder_time||'09:00';
   f.elements.reminder_enabled.checked=!!h.reminder_enabled;
   const selected=core.days(h.days_of_week);
   for(const c of f.querySelectorAll('input[name="days"]'))c.checked=selected.includes(Number(c.value));
   updateFormFields();
 }
 function editHabit(id){
   const h=state.habits.find(x=>x.id===id);if(!h)return;
   state.editing=id;fillForm(h);
   $('habit-form-title').textContent='Edit activity';
   $('habit-save').textContent='Save changes';
   $('habit-edit-cancel').hidden=false;$('habit-archive').hidden=false;
   $('habits-panel').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderPresets(){
   const holder=$('habit-presets');holder.replaceChildren();
   for(const preset of core.PRESETS){
     const b=button(preset.title,()=>{
       if(!state.owner){note('Sign in to add an activity.',true);return;}
       resetForm();
       fillForm({...preset,days_of_week:core.ALL,weekly_target:preset.weekly_target||1,
         reminder_time:'09:00',reminder_enabled:false});
       $('habit-form-title').textContent='Create '+preset.title;
       $('habit-form').scrollIntoView({behavior:'smooth',block:'center'});
       $('habit-form').elements.title.focus();
     },'quiet-pill habit-preset');
     holder.append(b);
   }
 }
 async function save(event){
   event.preventDefault();if(!state.owner||state.busy)return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   if(a.user.id!==state.owner)return;
   const f=event.currentTarget;
   const title=f.elements.title.value.trim().slice(0,100);
   const selectedDays=[...f.querySelectorAll('input[name="days"]:checked')].map(x=>Number(x.value));
   const category=f.elements.category.value;
   const entry_type=f.elements.entry_type.value;
   const goal_enabled=f.elements.goal_enabled.checked;
   const cadence=f.elements.cadence.value;
   const weekly_target=Number(f.elements.weekly_target.value);
   const daily_target=Number(f.elements.daily_target.value);
   const unit_label=(f.elements.unit_label.value.trim()||'times').slice(0,24);
   const reminder_enabled=f.elements.reminder_enabled.checked;
   const reminder_time=f.elements.reminder_time.value||null;
   if(!title||!selectedDays.length||!Object.hasOwn(core.CATEGORIES,category)||
     !['checkoff','count','duration'].includes(entry_type)||!['daily','weekly'].includes(cadence)||
     !Number.isInteger(weekly_target)||weekly_target<1||weekly_target>7||
     !Number.isFinite(daily_target)||daily_target<=0||daily_target>100000||
     ((entry_type==='count'||entry_type==='duration')&&!Number.isInteger(daily_target))||
     (reminder_time&&!core.isTime(reminder_time))){
       note('Please check the name, schedule, amount, and tracking type.',true);return;
   }
   if(reminder_enabled&&!reminder_time){note('Choose a time before enabling reminders.',true);return;}
   const data={owner_id:state.owner,title,category,entry_type,goal_enabled,daily_target,unit_label,
     cadence,days_of_week:selectedDays,weekly_target,reminder_time,reminder_enabled,updated_at:new Date().toISOString()};
   state.busy=true;note('Saving habit or activity…');
   try{
     const q=state.editing?
       await a.client.from('orbit_habits').update(data).eq('owner_id',state.owner).eq('id',state.editing).select().single():
       await a.client.from('orbit_habits').insert(data).select().single();
     if(q.error)throw q.error;
     state.habits=state.editing?state.habits.map(h=>h.id===state.editing?q.data:h):[...state.habits,q.data];
     resetForm();note('Saved. You can record it now, and reminders are optional.');
   }catch(error){note('Could not save: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 async function archive(){
   if(!state.editing||state.busy)return;
   const h=state.habits.find(x=>x.id===state.editing);
   if(!h||!window.confirm('Archive this activity? Recorded history stays saved.'))return;
   const a=await session().catch(e=>{note(e.message,true);return null;});if(!a)return;
   if(a.user.id!==state.owner)return;
   state.busy=true;
   try{
     const q=await a.client.from('orbit_habits').update({archived_at:new Date().toISOString(),reminder_enabled:false,updated_at:new Date().toISOString()})
       .eq('owner_id',state.owner).eq('id',state.editing).select().single();
     if(q.error)throw q.error;
     state.habits=state.habits.map(x=>x.id===h.id?q.data:x);
     resetForm();note('Archived; past records remain.');
   }catch(error){note('Archive failed: '+(error.message||'Try again.'),true);}
   finally{state.busy=false;render();}
 }
 $('habit-form')?.addEventListener('submit',e=>void save(e));
 for(const name of ['cadence','entry_type','goal_enabled'])
   $('habit-form')?.elements[name]?.addEventListener('change',updateFormFields);
 $('habit-edit-cancel')?.addEventListener('click',resetForm);
 $('habit-archive')?.addEventListener('click',()=>void archive());
 $('habits-reload')?.addEventListener('click',()=>void load());
 document.addEventListener('orbit:auth-changed',()=>{state.request++;state.loading=false;state.owner='';resetForm();locked();void load();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
 document.addEventListener('orbit:habit-changed',()=>void load());
 window.ORBITHabits={refresh:()=>void load()};
 resetForm();renderPresets();locked();
 if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load());
})();