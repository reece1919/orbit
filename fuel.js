/* ORBIT v0.5 — FUEL private journal integration. All reads/writes honor Supabase auth and RLS. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const FUEL_URL = 'https://chatgpt.com/g/g-p-6acd6e86e82081919497cb8e044c60bd/project';
  let loading = false;
  let refreshQueued = false;
  let lastSync = 0;
  let currentRows = [];
  const localDay = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const selectedDate = () => $('#fuel-date').value || localDay();
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numeric = v => v === null || v === undefined || v === '' ? null : Number(v);
  const numberText = n => Number(n).toLocaleString(undefined, {maximumFractionDigits:1});
  function put(id,value) { const el=$(id); if(el)el.textContent=value; }
  function setStatus(value){put('#fuel-status',value);}
  function blank(message) {
    currentRows=[];
    put('#fuel-total-calories','—');put('#fuel-total-protein','—');
    put('#fuel-total-carbs','—');put('#fuel-total-fat','—');
    put('#fuel-home-value','Not available');put('#fuel-home-note',message);
    put('#fuel-entry-count','');
    put('#nav-fuel-count','—');
    $('#fuel-entry-list').innerHTML='<p class="watch-detail">'+escapeHtml(message)+'</p>';
    setStatus(message);
  }
  function render(rows) {
    const selected=selectedDate(),today=localDay();
    const total = key => rows.reduce((sum,row)=>sum+(numeric(row[key])??0),0);
    const known = key => rows.every(row => numeric(row[key])!==null);
    const kcals=total('calories_kcal');
    put('#fuel-total-calories',numberText(kcals));
    for(const [key,id] of [['protein_g','#fuel-total-protein'],['carbs_g','#fuel-total-carbs'],['fat_g','#fuel-total-fat']]){
      put(id,rows.length && !known(key) ? numberText(total(key))+'*' : numberText(total(key)));
    }
    put('#fuel-entry-count',rows.length+' recorded');
    if(selected===today){
      put('#fuel-home-value',numberText(kcals)+' kcal');
      put('#fuel-home-note',rows.length+' meal'+(rows.length===1?'':'s')+' logged today · Private Supabase data');
      put('#nav-fuel-count',String(rows.length));
    } else {
      put('#fuel-home-value','Viewing '+selected);
      put('#fuel-home-note','Return to today to see your current daily totals.');
      put('#nav-fuel-count','—');
    }
    if(!rows.length){
      $('#fuel-entry-list').innerHTML='<div class="empty-state"><div><strong>No food entries for this date.</strong><p>Describe a meal in the VITA Food Inbox above; ChatGPT will estimate its nutrition during the hourly sync. You can also use the manual entry form below.</p><a class="quiet-pill" href="'+FUEL_URL+'" target="_blank" rel="noopener noreferrer">Ask FUEL ↗</a></div></div>';
    } else {
      $('#fuel-entry-list').innerHTML=rows.map(row=>{
        const time=new Date(row.consumed_at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
        const macro=[['P',row.protein_g],['C',row.carbs_g],['F',row.fat_g]]
          .filter(pair=>numeric(pair[1])!==null)
          .map(pair=>pair[0]+': '+numberText(pair[1])+'g').join(' · ');
        return '<article class="fuel-entry"><div class="fuel-entry-body"><div class="fuel-entry-meta">'+escapeHtml(row.meal_type)+' · '+escapeHtml(time)+(row.estimated?' · Estimated':' · Label/verified')+'</div><strong>'+escapeHtml(row.food_name)+'</strong>'+
          (row.notes?'<p class="watch-detail">'+escapeHtml(row.notes)+'</p>':'')+
          (macro?'<span class="fuel-entry-macros">'+escapeHtml(macro)+'</span>':'')+'</div><div class="fuel-entry-end"><strong>'+numberText(row.calories_kcal)+' kcal</strong><button type="button" class="quiet-pill" data-fuel-delete="'+escapeHtml(row.id)+'" aria-label="Delete food entry">Delete</button></div></article>';
      }).join('');
    }
    setStatus('Journal updated '+new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+
      (rows.some(row=>[row.protein_g,row.carbs_g,row.fat_g].some(v=>numeric(v)===null))?' · * Macro totals include only values recorded':'')+
      (rows.length>=200?' · Display capped at 200 entries for this date':''));
  }
  async function refresh(force=false){
    if(loading){refreshQueued=true;return;}
    const auth=window.ORBITAuth;
    const user=auth?.user,client=auth?.client;
    if(!user || !client){blank('Sign in to ORBIT to access your private FUEL journal.');return;}
    if(!force && Date.now()-lastSync<15000)return;
    loading=true;$('#fuel-refresh').disabled=true;setStatus('Loading private food journal…');
    const day=selectedDate();
    try{
      const start=new Date(day+'T00:00:00');
      const end=new Date(start);
      end.setDate(end.getDate()+1);
      if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))throw new Error('Choose a valid date.');
      const {data,error}=await client.from('fuel_food_entries')
        .select('id,food_name,meal_type,consumed_at,calories_kcal,protein_g,carbs_g,fat_g,notes,estimated,source')
        .eq('owner_id',user.id).gte('consumed_at',start.toISOString()).lt('consumed_at',end.toISOString())
        .order('consumed_at',{ascending:false}).limit(200);
      if(error)throw error;
      if(window.ORBITAuth?.user?.id!==user.id||selectedDate()!==day)return;
      currentRows=data||[];lastSync=Date.now();render(currentRows);
    }catch(e){
      blank('FUEL could not load right now: '+(e?.message||'Connection failed.'));
    }finally{
      loading=false;$('#fuel-refresh').disabled=false;
      if(refreshQueued){refreshQueued=false;void refresh(true);}
    }
  }
  function setNow(){
    const d=new Date();
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const f=$('#fuel-manual-form');
    f.elements['consumed_at'].value=local;
  }
  async function saveManual(event) {
    event.preventDefault();
    const auth=window.ORBITAuth;
    if(!auth?.user||!auth.client){setStatus('Sign in before saving a food entry.');return;}
    const form=event.currentTarget,data=new FormData(form);
    const food_name=String(data.get('food_name')||'').trim();
    const eaten=new Date(String(data.get('consumed_at')||''));
    const kcal=Number(data.get('calories_kcal'));
    if(!food_name||!Number.isFinite(kcal)||kcal<0||kcal>20000||Number.isNaN(eaten.getTime())){
      setStatus('Please enter a food name, date/time, and valid calories.');return;
    }
    const macros={};
    for(const key of ['protein_g','carbs_g','fat_g']){
      const v=String(data.get(key)||'').trim();
      const n=v===''?null:Number(v);
      if(n!==null&&(!Number.isFinite(n)||n<0||n>2000)){
        setStatus('Enter valid nonnegative macro amounts or leave them blank.');return;
      }
      macros[key]=n;
    }
    const button=$('#fuel-save');
    button.disabled=true;button.textContent='Saving…';setStatus('Saving food entry…');
    try{
      const record={owner_id:auth.user.id,food_name,meal_type:String(data.get('meal_type')||'other'),consumed_at:eaten.toISOString(),
        calories_kcal:kcal,...macros,notes:String(data.get('notes')||'').trim()||null,
        estimated:data.has('estimated'),source:'orbit'};
      const {error}=await auth.client.from('fuel_food_entries').insert(record);
      if(error)throw error;
      const date=new Date(eaten.getTime()-eaten.getTimezoneOffset()*60000).toISOString().slice(0,10);
      $('#fuel-date').value=date;
      form.reset();setNow();lastSync=0;
      await refresh(true);
      setStatus('Food entry saved to your private journal.');
    }catch(e){setStatus('Could not save: '+(e?.message||'Please try again.'));}
    finally{button.disabled=false;button.textContent='Save to private journal';}
  }
  async function deleteEntry(id) {
    if(!/^[0-9a-f-]{36}$/i.test(id)||!window.confirm('Delete this food entry from your private journal?'))return;
    const auth=window.ORBITAuth;
    if(!auth?.user||!auth.client)return;
    try{
      const {error}=await auth.client.from('fuel_food_entries').delete().eq('id',id).eq('owner_id',auth.user.id);
      if(error)throw error;
      lastSync=0;await refresh(true);setStatus('Entry deleted.');
    }catch(e){setStatus('Could not delete entry: '+(e?.message||'Please try again.'));}
  }
  async function copySetup(){
    const auth=window.ORBITAuth;
    if(!auth?.user?.id){setStatus('Sign in to ORBIT to copy your FUEL setup instructions.');return;}
    const instructions=[
      'FUEL — Supabase integration instructions (append these to the existing FUEL Project instructions):',
      'Database: the connected Supabase project named GAIA, project ID zdurujqwhxqrwbhwzzxg.',
      'Table: public.fuel_food_entries. Owner UUID: '+auth.user.id+'. Treat this UUID as an account identifier, not an authentication credential.',
      'Use the Supabase app in ChatGPT only when it is available and authorized. Never ask for a database password, service-role key, or API secret.',
      'For confirmed meal logs only, insert a record with owner_id set to the exact owner UUID above; required food_name, meal_type (breakfast/lunch/dinner/snack/drink/other), consumed_at (ISO timestamp with offset), calories_kcal (nonnegative numeric). Optional protein_g, carbs_g, fat_g (numeric or null), notes, estimated (boolean). Set source=fuel.',
      'Date/time should be in America/Los_Angeles unless the user specifies otherwise. Ask for confirmation before inserting or changing any entry. Mark estimates clearly and do not pretend estimates are lab-verified nutrition data.',
      'When reading, correcting, or deleting entries, ALWAYS filter by the exact owner_id above. Never access or modify another user\'s records. Use an entry UUID to select one meal for edits. Do not duplicate an entry if the user asks for clarification or a summary.',
      'Confirm saved or modified only after the database write returns success. If the Supabase app or a suitable write tool is unavailable, say the meal is NOT saved to ORBIT and provide the proposed entry instead.',
      'ORBIT reads this table using the user\'s signed-in GAIA account. Apple Health summaries in VITA Body are separate; food entries do not automatically write to Apple Health.',
      'Keep the rest of the FUEL Project instructions about useful conversational nutrition logging, moderation, and nonjudgmental feedback.'
    ].join('\n\n');
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(instructions);
      setStatus('FUEL setup copied. Paste it into the FUEL Project instructions and authorize the Supabase app in that Project.');
    }catch(_){
      window.prompt('Copy this setup and add it to the FUEL Project instructions:',instructions);
      setStatus('Copy and paste the displayed setup into FUEL Project instructions.');
    }
  }
  $('#fuel-date').value=localDay();setNow();
  $('#fuel-date').addEventListener('change',()=>{lastSync=0;void refresh(true);});
  $('#fuel-refresh').addEventListener('click',()=>void refresh(true));
  $('#fuel-copy-setup').addEventListener('click',()=>void copySetup());
  $('#fuel-manual-form').addEventListener('submit',saveManual);
  document.addEventListener('click',event=>{
    const remove=event.target.closest('[data-fuel-delete]');
    if(remove){void deleteEntry(remove.dataset.fuelDelete);return;}
    if(event.target.closest('[data-view="fuel"]'))void refresh(true);
  });
  document.addEventListener('fuel:inbox-processed',()=>{lastSync=0;void refresh(true);});
  document.addEventListener('orbit:auth-changed',()=>{lastSync=0;void refresh(true);});
  window.addEventListener('focus',()=>{if(window.ORBITAuth?.user && Date.now()-lastSync>30000)void refresh(true);});
  window.ORBITAuth?.ready.then(()=>void refresh(true));
})();