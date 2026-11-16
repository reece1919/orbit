/* VITA / Alcohol & Habits
 * Self-reported data, private Supabase tables, AAL2 required.
 * User-set ceilings are UPPER limits, never a prescription to consume alcohol.
 */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const status = message => { if(el('alcohol-status')) el('alcohol-status').textContent = message; };
  const dayKey = date => date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
  const inputTime = date => dayKey(date) + 'T' + String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
  const prettyDay = key => new Date(key+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const daysAgo = n => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return dayKey(d); };
  const oneDecimal = value => Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
  const contextLabel = {cooking:'Cooking',weekend_brunch:'Weekend brunch',meal:'Meal',social:'Social',stress:'Stress',habit:'Habit / automatic',other:'Other'};
  const state={entries:[],checkins:[],goals:null,owner:'',busy:false,ready:false};
  const clear = node => { if(node)node.replaceChildren(); };
  const text = (tag,cls,value) => { const e=document.createElement(tag); if(cls)e.className=cls; e.textContent=value; return e; };
  const todayEntries = () => state.entries.filter(x=>dayKey(new Date(x.occurred_at))===dayKey(new Date()));
  const totalFor = key => state.entries.filter(x=>dayKey(new Date(x.occurred_at))===key).reduce((a,x)=>a+Number(x.standard_drinks),0);
  const checkinFor = key => state.checkins.find(x=>x.checkin_date===key);
  const weekdayCeiling = key => {
    if(!state.goals)return null;
    const day=new Date(key+'T12:00:00').getDay();
    const raw=(day===0||day===6)?state.goals.weekend_ceiling:state.goals.weekday_ceiling;
    return raw===null||raw===undefined?null:Number(raw);
  };
  async function gate(){
    const auth=window.ORBITAuth;
    if(!auth?.client||!auth.user)throw new Error('Sign in to ORBIT to access Alcohol & Habits.');
    const {data,error}=await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error||data?.currentLevel!=='aal2')throw new Error('Verify your authenticator to access this private section.');
    return auth;
  }
  async function load(){
    if(state.busy)return;
    state.busy=true;state.ready=false;status('Loading your private entries…');
    if(el('alcohol-refresh'))el('alcohol-refresh').disabled=true;
    try{
      const auth=await gate();state.owner=auth.user.id;
      const cutoff=new Date();cutoff.setDate(cutoff.getDate()-75);
      const [entries,checkins,goals]=await Promise.all([
        auth.client.from('orbit_alcohol_entries').select('id,occurred_at,standard_drinks,context,beverage,notes').gte('occurred_at',cutoff.toISOString()).order('occurred_at',{ascending:false}).limit(500),
        auth.client.from('orbit_alcohol_checkins').select('checkin_date,no_alcohol,anxiety,urge,notes').gte('checkin_date',daysAgo(75)).order('checkin_date',{ascending:false}).limit(90),
        auth.client.from('orbit_alcohol_goals').select('weekday_ceiling,weekend_ceiling').eq('owner_id',auth.user.id).maybeSingle()
      ]);
      if(entries.error||checkins.error||goals.error)throw entries.error||checkins.error||goals.error;
      state.entries=entries.data||[];state.checkins=checkins.data||[];state.goals=goals.data||null;
      state.ready=true;render();
      status('Private log loaded. Entries are self-reported and may be incomplete.');
    }catch(error){
      state.entries=[];state.checkins=[];state.goals=null;renderLocked();
      status(error.message&&(/Sign in|Verify your authenticator/.test(error.message))?error.message:'Could not load your private log. Check your sign-in and try again.');
    }finally{state.busy=false;if(el('alcohol-refresh'))el('alcohol-refresh').disabled=false;}
  }
  function renderLocked(){
    for(const id of ['alcohol-today','alcohol-week','alcohol-limit','alcohol-known-days','vita-summary-alcohol'])if(el(id))el(id).textContent='—';
    clear(el('alcohol-bars'));clear(el('alcohol-recommendations'));clear(el('alcohol-history'));
    if(el('alcohol-log-form'))el('alcohol-log-form').querySelector('fieldset').disabled=true;
    if(el('alcohol-checkin-form'))el('alcohol-checkin-form').querySelector('fieldset').disabled=true;
    if(el('alcohol-goals-form'))el('alcohol-goals-form').querySelector('fieldset').disabled=true;
  }
  function makeItem(message){
    return text('li','alcohol-tip',message);
  }
  function render(){
    if(!state.ready)return renderLocked();
    for(const id of ['alcohol-log-form','alcohol-checkin-form','alcohol-goals-form'])el(id).querySelector('fieldset').disabled=false;
    const today=dayKey(new Date());
    const todayTotal=totalFor(today);
    const weekDays=Array.from({length:7},(_,i)=>daysAgo(6-i));
    const weekTotal=weekDays.reduce((n,d)=>n+totalFor(d),0);
    const known=weekDays.filter(d=>totalFor(d)>0||checkinFor(d)?.no_alcohol).length;
    const cap=weekdayCeiling(today);
    el('alcohol-today').textContent=oneDecimal(todayTotal);
    el('alcohol-week').textContent=oneDecimal(weekTotal);
    el('alcohol-limit').textContent=cap===null?'Not set':oneDecimal(cap);
    el('alcohol-known-days').textContent=known+' / 7';
    if(el('vita-summary-alcohol'))el('vita-summary-alcohol').textContent=oneDecimal(weekTotal)+' logged in 7 days';
    if(el('alcohol-cap-note'))el('alcohol-cap-note').textContent=cap===null?
      'No ceiling set. Your ceiling is optional and never a drinking target.':
      todayTotal>cap?'Above your personal ceiling by '+oneDecimal(todayTotal-cap)+' standard drinks. Record what happened without judgment.':
      'Personal ceiling: '+oneDecimal(cap)+' • remaining allowance '+oneDecimal(Math.max(0,cap-todayTotal))+'. This is an upper limit, not a target or withdrawal plan.';
    const goals=el('alcohol-goals-form');
    if(document.activeElement!==goals.elements.weekday_ceiling)goals.elements.weekday_ceiling.value=state.goals?.weekday_ceiling??'';
    if(document.activeElement!==goals.elements.weekend_ceiling)goals.elements.weekend_ceiling.value=state.goals?.weekend_ceiling??'';
    const ci=checkinFor(today);
    const checkin=el('alcohol-checkin-form');
    if(document.activeElement!==checkin.elements.anxiety)checkin.elements.anxiety.value=ci?.anxiety??'';
    if(document.activeElement!==checkin.elements.urge)checkin.elements.urge.value=ci?.urge??'';
    if(document.activeElement!==checkin.elements.notes)checkin.elements.notes.value=ci?.notes||'';
    const noAlcohol=checkin.elements.no_alcohol;
    noAlcohol.disabled=todayTotal>0;
    noAlcohol.checked=todayTotal>0?false:!!ci?.no_alcohol;
    el('alcohol-zero-note').textContent=todayTotal>0?'A drink is already logged today, so this cannot be marked alcohol-free.':'Check this only after a day without alcohol. Blank days are treated as unknown.';
    renderBars();renderRecommendations();renderHistory();
  }
  function renderBars(){
    const holder=el('alcohol-bars');clear(holder);
    const days=Array.from({length:14},(_,i)=>daysAgo(13-i));
    const maximum=Math.max(1,...days.map(d=>totalFor(d)),...days.map(d=>weekdayCeiling(d)||0));
    for(const day of days){
      const amount=totalFor(day),known=amount>0||!!checkinFor(day)?.no_alcohol;
      const cap=weekdayCeiling(day);
      const cell=text('div','alcohol-day', '');
      cell.setAttribute('aria-label',prettyDay(day)+': '+(known?oneDecimal(amount)+' standard drinks':'not logged')+(cap!==null?', personal ceiling '+oneDecimal(cap):''));
      cell.appendChild(text('small','alcohol-day-total',known?oneDecimal(amount):'·'));
      const track=text('div','alcohol-day-track','');
      const bar=text('div','alcohol-day-bar'+(cap!==null&&amount>cap?' alcohol-day-over':'')+(known&&amount===0?' alcohol-day-zero':''),'');
      bar.style.height=(amount>0?Math.max(4,amount/maximum*100):0)+'%';
      track.appendChild(bar);
      cell.appendChild(track);
      cell.appendChild(text('small','alcohol-day-label',day.slice(5).replace('-','/')));
      holder.appendChild(cell);
    }
  }
  function renderRecommendations(){
    const holder=el('alcohol-recommendations');clear(holder);
    const messages=[];
    if(!state.entries.length&&!state.checkins.length){
      messages.push('Begin with observation: log drinks as they happen, and mark alcohol-free days explicitly. Missing days stay unknown.');
    }else{
      const last14=state.entries.filter(x=>dayKey(new Date(x.occurred_at))>=daysAgo(13));
      const pattern=key=>last14.filter(x=>x.context===key).length;
      if(pattern('weekend_brunch'))messages.push('Weekend brunch shows up in your log. Try nonalcoholic sparkling wine and skip opening a full bottle.');
      if(pattern('cooking'))messages.push('Cooking is a recurring context. Keep hop water or another flavorful alcohol-free drink within reach before starting dinner.');
      if(pattern('habit'))messages.push('Automatic drinking appears in your entries. Before refilling, put the glass down, change activities and choose deliberately.');
      if(pattern('stress'))messages.push('You have logged drinking around stress. Make a separate plan for stress relief, without relying on alcohol to manage work or anxiety.');
      const over=Array.from({length:14},(_,i)=>daysAgo(i)).filter(d=>weekdayCeiling(d)!==null && totalFor(d)>weekdayCeiling(d));
      if(over.length)messages.push('You exceeded your personal ceiling on '+over.length+' logged day(s) in the last 14. Consider changing availability, serving size or the situation that led to refills.');
      if(!messages.length)messages.push('Your entries are building a useful picture. Watch for automatic refills, especially while cooking and during weekend mornings.');
    }
    messages.push('A ceiling is a personal upper limit, never a minimum. Do not drink extra to reach it. This tracker cannot determine safe withdrawal quantities.');
    for(const m of messages)holder.appendChild(makeItem(m));
  }
  function renderHistory(){
    const holder=el('alcohol-history');clear(holder);
    if(!state.entries.length){holder.appendChild(text('p','alcohol-muted','No drinks logged yet. Zero-drink days are recorded separately.'));return;}
    for(const row of state.entries.slice(0,20)){
      const wrap=text('div','alcohol-entry','');
      const date=new Date(row.occurred_at);
      const left=document.createElement('div');
      left.append(text('strong','',oneDecimal(row.standard_drinks)+' standard drinks'));
      left.append(text('small','alcohol-muted',date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' · '+(contextLabel[row.context]||'Other')));
      if(row.beverage||row.notes)left.append(text('small','alcohol-muted',((row.beverage||'')+(row.notes?' · '+row.notes:'')).slice(0,620)));
      const remove=text('button','quiet-pill alcohol-delete','Delete');
      remove.type='button';remove.setAttribute('aria-label','Delete entry from '+date.toLocaleString());
      remove.addEventListener('click',()=>void deleteEntry(row.id));
      wrap.append(left,remove);holder.append(wrap);
    }
  }
  async function mutate(work,success){
    if(state.busy)return;
    state.busy=true;status('Saving…');
    try{const auth=await gate();await work(auth.client,auth.user.id);status(success);}
    catch(error){status('Could not save: '+(error.message||'Please try again.'));}
    finally{state.busy=false;void load();}
  }
  el('alcohol-log-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;const data=new FormData(form);
    const amount=Number(data.get('standard_drinks'));
    const when=new Date(String(data.get('occurred_at')));
    if(!Number.isFinite(amount)||amount<=0||amount>20||!Number.isFinite(when.getTime())){status('Enter a valid drink amount and time.');return;}
    const ctx=String(data.get('context')||'other');
    void mutate(async(client,owner_id)=>{
      const {error}=await client.from('orbit_alcohol_entries').insert({owner_id,occurred_at:when.toISOString(),standard_drinks:amount,context:contextLabel[ctx]?ctx:'other',beverage:String(data.get('beverage')||'').slice(0,120),notes:String(data.get('notes')||'').slice(0,500)});
      if(error)throw error;
      const key=dayKey(when);
      const saved=state.checkins.find(x=>x.checkin_date===key);
      if(saved?.no_alcohol){const r=await client.from('orbit_alcohol_checkins').update({no_alcohol:false,updated_at:new Date().toISOString()}).eq('owner_id',owner_id).eq('checkin_date',key);if(r.error)throw r.error;}
      form.elements.standard_drinks.value='1';form.elements.beverage.value='';form.elements.notes.value='';
    },'Drink saved.');
  });
  el('alcohol-checkin-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;const data=new FormData(form);
    const anxiety=data.get('anxiety')===''?null:Number(data.get('anxiety'));
    const urge=data.get('urge')===''?null:Number(data.get('urge'));
    const no_alcohol=!!data.get('no_alcohol')&&todayEntries().length===0;
    void mutate(async(client,owner_id)=>{
      const {error}=await client.from('orbit_alcohol_checkins').upsert({owner_id,checkin_date:dayKey(new Date()),no_alcohol,anxiety,urge,notes:String(data.get('notes')||'').slice(0,500),updated_at:new Date().toISOString()},{onConflict:'owner_id,checkin_date'});
      if(error)throw error;
    },'Daily check-in saved.');
  });
  el('alcohol-goals-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const parsed=key=>{const value=String(data.get(key)||'').trim();return value===''?null:Number(value);};
    const weekday_ceiling=parsed('weekday_ceiling'),weekend_ceiling=parsed('weekend_ceiling');
    if([weekday_ceiling,weekend_ceiling].some(x=>x!==null&&(!Number.isFinite(x)||x<0||x>20))){status('Ceilings must be blank or between 0 and 20.');return;}
    void mutate(async(client,owner_id)=>{
      const {error}=await client.from('orbit_alcohol_goals').upsert({owner_id,weekday_ceiling,weekend_ceiling,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
      if(error)throw error;
    },'Personal ceilings saved.');
  });
  async function deleteEntry(id){
    if(!window.confirm('Delete this logged drink? This cannot be undone.'))return;
    void mutate(async(client,owner_id)=>{
      const {error}=await client.from('orbit_alcohol_entries').delete().eq('owner_id',owner_id).eq('id',id);
      if(error)throw error;
    },'Entry deleted.');
  }
  el('alcohol-refresh')?.addEventListener('click',()=>void load());
  if(el('alcohol-log-form'))el('alcohol-log-form').elements.occurred_at.value=inputTime(new Date());
  document.addEventListener('orbit:auth-changed',()=>void load());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!el('vita-dashboard')?.hidden&& !el('alcohol-panel')?.hidden)void load();});
  if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load());
})();
