/* ORBIT 2.0 Daily Review.
   Owner-only, AAL2 private journal data. No synthetic health completion.
   Historical PULSE mood and journal remain the source of truth. */
(() => {
  'use strict';
  const core=window.ORBITReviewCore;
  const $=id=>document.getElementById(id);
  const defaults={review_time:'20:30',review_reminders_enabled:false,pulse_reminders_enabled:true,notifications_enabled:false,time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Los_Angeles'};
  let state={owner:'',date:'',review:null,settings:{evening_steps:core.DEFAULT_STEPS},push:{...defaults},moods:[],journal:null,health:null,loading:false,busy:false};
  let moodDirty=false,journalDirty=false,draftDirty=false;
  let loadGeneration=0;
  const now=()=>new Date();
  const today=()=>core.dayKey();
  const msg=(text,error=false)=>{const el=$('review-status');if(el){el.textContent=text;el.classList.toggle('review-error',error)}};
  const ago=t=>{if(!t)return 'No record';return new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
  const select=el=>el?.value||'';
  const checked=el=>!!el?.checked;
  function canSnooze(){
    if(core.reviewStatus(state.review)!=='pending')return false;
    try{
      const parts=new Intl.DateTimeFormat('en-US',{timeZone:state.push.time_zone||'America/Los_Angeles',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const pick=t=>Number(parts.find(x=>x.type===t)?.value||0);
      const minute=pick('hour')*60+pick('minute');
      const planned=String(state.push.review_time||'20:30').split(':').map(Number);
      return minute>=planned[0]*60+planned[1]&&minute<23*60+30;
    }catch{return false;}
  }
  function statusText(){
    const kind=core.reviewStatus(state.review);
    $('review-home-state').textContent=kind==='complete'?'Completed today':kind==='skipped'?'Skipped today':'Ready to record';
    $('review-progress').textContent=kind==='complete'?'Review complete':kind==='skipped'?'Skipped for today':'Review not finished';
  }
  async function account(){
    const auth=window.ORBITAuth;
    if(!auth?.client||!auth.user)throw Error('Sign in to use the daily review.');
    const {data,error}=await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error||data?.currentLevel!=='aal2')throw Error('Verify your authenticator in ORBIT before viewing your private review.');
    return auth;
  }
  async function load(){
    if(state.loading||state.busy)return;
    state.loading=true;const generation=++loadGeneration;msg('Loading your private daily review…');
    try{
      const auth=await account(),day=today();
      if(state.date&&state.date!==day)draftDirty=false;
      const queries=await Promise.all([
        auth.client.from('orbit_daily_reviews').select('*').eq('owner_id',auth.user.id).eq('review_date',day).maybeSingle(),
        auth.client.from('orbit_review_settings').select('*').eq('owner_id',auth.user.id).maybeSingle(),
        auth.client.from('pulse_settings').select('*').eq('owner_id',auth.user.id).maybeSingle(),
        auth.client.from('pulse_moods').select('*').eq('owner_id',auth.user.id).eq('entry_date',day).order('updated_at',{ascending:false}).limit(3),
        auth.client.from('pulse_journals').select('*').eq('owner_id',auth.user.id).eq('entry_date',day).maybeSingle(),
        auth.client.from('wellness_daily').select('metric_date,steps,sleep_minutes,weight_lb,synced_at').order('metric_date',{ascending:false}).limit(1)
      ]);
      if(generation!==loadGeneration||window.ORBITAuth?.user?.id!==auth.user.id)return;
      const error=queries.find(q=>q.error)?.error;if(error)throw error;
      state={...state,owner:auth.user.id,date:day,review:queries[0].data||null,
        settings:queries[1].data||{evening_steps:core.DEFAULT_STEPS},
        push:{...defaults,...(queries[2].data||{})},
        moods:queries[3].data||[],journal:queries[4].data||null,health:queries[5].data?.[0]||null};
      render();msg('Saved privately with your existing ORBIT account.');
    }catch(error){
      if(generation!==loadGeneration)return;
      state.owner='';state.review=null;state.moods=[];state.journal=null;state.health=null;
      $('review-form').reset();$('review-evening-steps').replaceChildren();
      $('review-home-state').textContent='Sign in to record';
      $('review-progress').textContent='Unavailable';
      msg(error.message||'Could not load review data.',true);
      $('review-form').querySelector('fieldset').disabled=true;
      $('review-settings-form').querySelector('fieldset').disabled=true;
      $('review-add-step').disabled=true;
      $('review-finish').disabled=true;
      $('review-skip').disabled=true;
      $('review-snooze').disabled=true;
    }finally{state.loading=false;}
  }
  function render(){
    if(!state.owner)return;
    const day=state.date,review=state.review||{};
    $('review-date').textContent=new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    const form=$('review-form');
    form.querySelector('fieldset').disabled=false;
    $('review-settings-form').querySelector('fieldset').disabled=false;
    const mood=state.moods.find(x=>x.slot==='evening')||state.moods[0]||null;
    if(!draftDirty){
      form.elements.mood.value=mood?.mood||'';
      form.elements.energy.value=mood?.energy||'';
      form.elements.stress.value=mood?.stress||'';
      form.elements.alcohol.value=review.alcohol_standard_drinks===null||review.alcohol_standard_drinks===undefined?'':review.alcohol_standard_drinks;
      form.elements.journal.value=state.journal?.body||'';
      form.elements.tomorrow.checked=!!review.tomorrow_reviewed;
      moodDirty=false;journalDirty=false;
    }
    const badge=core.sourceBadges({mood,journal:state.journal,health:state.health,alcohol:review.alcohol_standard_drinks});
    $('review-mood-source').textContent=badge.mood?'Already logged in Mind':'Not recorded';
    $('review-journal-source').textContent=badge.journal?'Already logged in Mind':'Optional';
    $('review-alcohol-source').textContent=badge.alcohol?(Number(review.alcohol_standard_drinks)===0?'Explicitly alcohol-free':'Recorded today'):'Not recorded';
    const health=state.health;
    $('review-health-source').textContent=health?'Latest Apple Health summary: '+health.metric_date+' (synced '+ago(health.synced_at)+')':'No synced health snapshot';
    $('review-time').value=state.push.review_time||'20:30';
    $('review-notifications-enabled').checked=!!state.push.review_reminders_enabled;
    $('review-pulse-reminders').checked=state.push.pulse_reminders_enabled!==false;
    $('review-push-status').textContent=state.push.notifications_enabled?'Account notifications are enabled. This device must also be subscribed in VITA → Mind.':'Notifications are not enabled for this account. Enable device Web Push in VITA → Mind first.';
    const completed=core.normalizeSteps(state.settings.evening_steps);
    const count=completed.filter(x=>(review.completed_steps||[]).includes(x.id)).length;
    $('review-evening-summary').textContent=count+' of '+completed.length+' steps complete';
    const holder=$('review-evening-steps');holder.replaceChildren();
    for(const step of completed){
      const row=document.createElement('div');row.className='review-evening-step';
      const input=document.createElement('input');input.type='checkbox';input.id='review-step-'+step.id;
      input.checked=(review.completed_steps||[]).includes(step.id);
      const label=document.createElement('label');label.htmlFor=input.id;label.textContent=step.title;
      const remove=document.createElement('button');remove.type='button';remove.className='quiet-pill';remove.textContent='Remove';remove.title='Remove this routine step';remove.addEventListener('click',()=>void removeStep(step.id));
      input.addEventListener('change',()=>void toggleStep(step.id,input.checked));
      row.append(input,label,remove);holder.append(row);
    }
    $('review-add-step').disabled=completed.length>=20;
    $('review-finish').disabled=false;$('review-skip').disabled=false;$('review-snooze').disabled=!canSnooze();
    const kind=core.reviewStatus(review);
    $('review-finish').textContent=kind==='complete'?'Update completed review':'Finish daily review';
    $('review-skip').textContent=kind==='skipped'?'Review skipped':'Skip tonight';
    $('review-complete-label').textContent=kind==='complete'?'Review finished '+ago(review.finished_at):kind==='skipped'?'Skipped, not counted as completed.':'Nothing needs to be perfect. Save only what you want to record.';
    statusText();
  }
  async function upsertReview(changes){
    const auth=await account();
    if(auth.user.id!==state.owner)throw Error('Account changed. Reload the page.');
    const base=state.review||{};
    const payload={owner_id:state.owner,review_date:state.date,
      alcohol_standard_drinks:base.alcohol_standard_drinks??null,
      tomorrow_reviewed:!!base.tomorrow_reviewed,completed_steps:base.completed_steps||[],
      finished_at:base.finished_at||null,skipped_at:base.skipped_at||null,
      snoozed_until:base.snoozed_until||null,...changes,updated_at:now().toISOString()};
    const {data,error}=await auth.client.from('orbit_daily_reviews').upsert(payload,{onConflict:'owner_id,review_date'}).select('*').single();
    if(error)throw error;state.review=data;return data;
  }
  async function action(fn,message){
    if(!state.owner||state.busy)return;
    state.busy=true;msg('Saving…');
    for(const id of ['review-save','review-finish','review-skip','review-snooze','review-add-step'])$(id).disabled=true;
    try{await fn();render();msg(message);}
    catch(error){msg('Save failed: '+(error.message||'Please retry.'),true);}
    finally{
      state.busy=false;
      for(const id of ['review-save','review-finish','review-skip','review-snooze'])$(id).disabled=false;
      $('review-add-step').disabled=core.normalizeSteps(state.settings.evening_steps).length>=20;
      $('review-snooze').disabled=!canSnooze();
    }
  }
  async function saveDraft(finish=false){
    const form=$('review-form'),f=form.elements;
    const raw=f.alcohol.value.trim();
    const alcohol=raw===''?null:core.reportedAmount(raw);
    if(raw!==''&&alcohol===null)throw Error('Alcohol must be 0 to 40 standard drinks, or left blank if unknown.');
    const future=!!f.tomorrow.checked;
    // Values only propagate to PULSE when they are newly selected or intentionally changed.
    const updates={alcohol_standard_drinks:alcohol,tomorrow_reviewed:future,
      skipped_at:null,...(finish?{finished_at:now().toISOString(),snoozed_until:null}:{})};
    if(moodDirty&&f.mood.value){
      const existing=state.moods.find(x=>x.slot==='evening');
      const {error}=await (await account()).client.from('pulse_moods').upsert({
        owner_id:state.owner,entry_date:state.date,slot:'evening',mood:Number(f.mood.value),
        energy:f.energy.value?Number(f.energy.value):null,
        stress:f.stress.value?Number(f.stress.value):null,
        note:existing?.note||'',updated_at:now().toISOString()
      },{onConflict:'owner_id,entry_date,slot'});
      if(error)throw error;
    }
    if(journalDirty&&f.journal.value.trim()){
      const {error}=await (await account()).client.from('pulse_journals').upsert({
        owner_id:state.owner,entry_date:state.date,prompt_index:state.journal?.prompt_index??0,
        body:f.journal.value.trim().slice(0,12000),updated_at:now().toISOString()
      },{onConflict:'owner_id,entry_date'});
      if(error)throw error;
    }
    // A blank journal field never deletes an earlier entry.
    await upsertReview(updates);
    // Refresh source data, preserving its authoritative PULSE status.
    const auth=await account();
    const [m,j]=await Promise.all([
      auth.client.from('pulse_moods').select('*').eq('owner_id',state.owner).eq('entry_date',state.date).order('updated_at',{ascending:false}).limit(3),
      auth.client.from('pulse_journals').select('*').eq('owner_id',state.owner).eq('entry_date',state.date).maybeSingle()
    ]);
    if(!m.error)state.moods=m.data||[];
    if(!j.error)state.journal=j.data;
    draftDirty=false;
  }
  async function toggleStep(id,done){
    if(state.busy)return;
    await action(async()=>{
      const current=new Set(state.review?.completed_steps||[]);
      if(done)current.add(id);else current.delete(id);
      await upsertReview({completed_steps:[...current]});
    },'Evening routine updated.');
  }
  async function saveEveningSteps(steps){
    const auth=await account();const clean=core.normalizeSteps(steps);
    const {data,error}=await auth.client.from('orbit_review_settings').upsert({
      owner_id:state.owner,evening_steps:clean,updated_at:now().toISOString()
    },{onConflict:'owner_id'}).select('*').single();
    if(error)throw error;state.settings=data;
  }
  function removeStep(id){
    if(state.busy)return;
    void action(()=>saveEveningSteps(core.normalizeSteps(state.settings.evening_steps).filter(x=>x.id!==id)),'Routine step removed. Past check-ins remain unchanged.');
  }
  $('review-add-step')?.addEventListener('click',()=>{
    const input=$('review-new-step'),title=input.value.trim().slice(0,90);
    if(!title){msg('Enter a routine step first.',true);return;}
    const existing=core.normalizeSteps(state.settings.evening_steps);
    const id='s'+(crypto?.randomUUID?.()||String(Date.now())).replace(/-/g,'');
    void action(async()=>{await saveEveningSteps([...existing,{id,title}]);input.value='';},'Routine step added.');
  });
  $('review-form')?.addEventListener('input',()=>{draftDirty=true;});
  $('review-form')?.addEventListener('change',()=>{draftDirty=true;});
  $('review-form')?.elements.mood?.addEventListener('change',()=>{moodDirty=true;});
  for(const name of ['energy','stress'])$('review-form')?.elements[name]?.addEventListener('change',()=>{moodDirty=true;});
  $('review-form')?.elements.journal?.addEventListener('input',()=>{journalDirty=true;});
  $('review-form')?.addEventListener('submit',e=>{e.preventDefault();void action(()=>saveDraft(false),'Daily review saved.');});
  $('review-finish')?.addEventListener('click',()=>void action(()=>saveDraft(true),'Daily review finished. You can continue your evening routine.'));
  $('review-skip')?.addEventListener('click',()=>void action(async()=>{await upsertReview({skipped_at:now().toISOString(),finished_at:null,snoozed_until:null});},'Tonight was skipped, not marked complete.'));
  $('review-snooze')?.addEventListener('click',()=>{
    if(!canSnooze()){msg('Snooze is available after your scheduled review time, before 11:30 PM.',true);return;}
    void action(async()=>{
    const inThirty=new Date(Date.now()+30*60*1000);
    await upsertReview({snoozed_until:inThirty.toISOString(),skipped_at:null});
  },'Reminder snoozed once for 30 minutes. Push delivery requires device permission.');
  });
  $('review-settings-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const f=e.currentTarget.elements,time=f.review_time.value,enable=f.notifications.checked,pulse=!!f.pulse_reminders.checked;
    if(!core.validClock(time)){msg('Enter a valid reminder time.',true);return;}
    void action(async()=>{
      const auth=await account();
      const next={owner_id:state.owner,review_time:time,review_reminders_enabled:enable,
        pulse_reminders_enabled:pulse,updated_at:now().toISOString()};
      const {data,error}=await auth.client.from('pulse_settings').upsert(next,{onConflict:'owner_id'}).select('*').single();
      if(error)throw error;
      state.push={...defaults,...data};
    },'Reminder preferences saved. Verify push delivery from VITA → Mind.');
  });
  $('review-reload')?.addEventListener('click',()=>void load());
  document.addEventListener('orbit:auth-changed',()=>{loadGeneration++;state.loading=false;state.owner='';draftDirty=false;void load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('review-panel')?.hidden)void load();});
  window.ORBITDailyReview={refresh:()=>void load()};
  if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load());
})();