/* VITA Food Inbox — save descriptions immediately and await hourly ChatGPT estimation.
 * Never guess nutrition in the browser. Supabase RLS protects all records.
 */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const localNow=()=>{
    const now=new Date();
    return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  };
  let busy=false,refreshing=false,accountId='',lastRefresh=0,lastStates=new Map();
  const form=byId('fuel-inbox-form');
  const list=byId('fuel-inbox-list');
  const status=byId('fuel-inbox-status');
  const submit=byId('fuel-inbox-save');
  const reload=byId('fuel-inbox-reload');
  const display=msg=>{if(status)status.textContent=msg;};
  const dateText=v=>{
    const d=new Date(v);
    return Number.isNaN(d.getTime())?'Unknown date':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  };
  function dateDefaults(){
    const date=byId('fuel-inbox-eaten-at');
    if(date&&!date.value)date.value=localNow();
  }
  async function session(){
    await window.ORBITAuth?.ready;
    const auth=window.ORBITAuth;
    if(!auth?.client || !auth?.user)throw Error('Sign in to ORBIT first.');
    const level=await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(level.error || level.data?.currentLevel!=='aal2')throw Error('Complete your authenticator verification to use the food inbox.');
    return {client:auth.client,owner:auth.user.id};
  }
  function reset(message){
    lastStates=new Map();lastRefresh=0;list.replaceChildren();
    const p=document.createElement('p');p.className='watch-detail';p.textContent=message;
    list.appendChild(p);display(message);
    byId('fuel-inbox-count').textContent='—';
  }
  function render(rows){
    list.replaceChildren();
    const pending=rows.filter(r=>r.status==='pending').length;
    const needs=rows.filter(r=>r.status==='needs_details').length;
    byId('fuel-inbox-count').textContent=pending+(needs?' pending · '+needs+' need details':' pending');
    if(rows.length===0){
      const p=document.createElement('p');p.className='watch-detail';
      p.textContent='Nothing waiting. Add what you ate above to begin.';
      list.appendChild(p);return;
    }
    for(const row of rows){
      const article=document.createElement('article');
      article.className='fuel-inbox-row';
      const header=document.createElement('div');header.className='fuel-inbox-row-head';
      const tag=document.createElement('span');tag.className='fuel-inbox-state state-'+row.status;
      tag.textContent=({pending:'Waiting for ChatGPT',processed:'Logged in FUEL',needs_details:'Needs more detail'})[row.status]||'Unknown status';
      const meta=document.createElement('small');
      meta.textContent=row.meal_type+' · '+dateText(row.consumed_at);
      header.append(tag,meta);
      const text=document.createElement('p');text.className='fuel-inbox-description';text.textContent=row.description;
      article.append(header,text);
      if(row.processing_note){
        const note=document.createElement('p');note.className='watch-detail';note.textContent=row.processing_note;
        article.appendChild(note);
      }
      if(row.status!=='processed'){
        const cancel=document.createElement('button');cancel.type='button';cancel.className='quiet-pill';
        cancel.textContent=row.status==='needs_details'?'Remove and re-enter':'Cancel';
        cancel.dataset.fuelInboxDelete=row.id;cancel.setAttribute('aria-label','Cancel queued food description');
        article.appendChild(cancel);
      }
      list.appendChild(article);
    }
  }
  async function refresh(force=false){
    if(refreshing)return;
    if(!force&&Date.now()-lastRefresh<15000)return;
    refreshing=true;
    if(reload)reload.disabled=true;
    try{
      const {client,owner}=await session();
      if(accountId!==owner){accountId=owner;lastStates=new Map();}
      const {data,error}=await client.from('fuel_food_inbox')
        .select('id,description,meal_type,consumed_at,status,processing_note,created_at,processed_at')
        .eq('owner_id',owner).order('created_at',{ascending:false}).limit(35);
      if(error)throw error;
      if(window.ORBITAuth?.user?.id!==owner)return;
      const rows=data||[];
      const changedToProcessed=rows.some(r=>lastStates.has(r.id)&&lastStates.get(r.id)!=='processed'&&r.status==='processed');
      lastStates=new Map(rows.map(r=>[r.id,r.status]));
      lastRefresh=Date.now();render(rows);
      if(!busy)display('Entries are saved immediately; nutritional estimates appear after the next successful hourly ORBIT sync.');
      if(changedToProcessed)document.dispatchEvent(new CustomEvent('fuel:inbox-processed'));
    }catch(e){
      if(!accountId || !window.ORBITAuth?.user)reset('Sign in to see your queued food entries.');
      else display('Could not refresh food inbox: '+(e?.message||'Please retry.'));
    }finally{refreshing=false;if(reload)reload.disabled=false;}
  }
  async function save(e){
    e.preventDefault();
    if(busy)return;
    const description=String(form.elements.description.value||'').trim();
    const meal_type=String(form.elements.meal_type.value||'other');
    const eaten=new Date(String(form.elements.consumed_at.value||''));
    if(description.length<3||description.length>1200){
      display('Describe what you ate (3–1,200 characters).');return;
    }
    if(!['breakfast','lunch','dinner','snack','drink','other'].includes(meal_type)||Number.isNaN(eaten.getTime())){
      display('Select a valid meal type and date/time.');return;
    }
    if(eaten.getTime()>Date.now()+10*60*1000){
      display('Choose when you ate this; future dates cannot be queued.');return;
    }
    busy=true;submit.disabled=true;submit.textContent='Saving…';
    try{
      const {client,owner}=await session();
      const {data,error}=await client.from('fuel_food_inbox').insert({
        owner_id:owner,description,meal_type,consumed_at:eaten.toISOString()
      }).select('id').single();
      if(error)throw error;
      if(!data?.id)throw Error('Save could not be confirmed.');
      form.elements.description.value='';form.elements.consumed_at.value=localNow();
      lastRefresh=0;await refresh(true);
      display('Saved to your private food inbox. Waiting for the hourly ChatGPT nutrition estimate.');
    }catch(e){display('Not saved: '+(e?.message||'Try again. Your description remains in the form.'));}
    finally{busy=false;submit.disabled=false;submit.textContent='Queue food entry';}
  }
  async function cancel(id){
    if(!/^[0-9a-f-]{36}$/i.test(id)||busy)return;
    if(!window.confirm('Remove this pending food description?'))return;
    busy=true;
    try{
      const {client,owner}=await session();
      const {data,error}=await client.from('fuel_food_inbox').delete()
        .eq('id',id).eq('owner_id',owner).in('status',['pending','needs_details'])
        .select('id');
      if(error)throw error;
      if(!data?.length){display('This entry may have been processed already. Reload to check.');}
      else display('Queued description canceled.');
      lastRefresh=0;await refresh(true);
    }catch(e){display('Could not cancel entry: '+(e?.message||'Please retry.'));}
    finally{busy=false;}
  }
  if(!form||!list||!status)return;
  dateDefaults();
  form.addEventListener('submit',e=>void save(e));
  reload?.addEventListener('click',()=>void refresh(true));
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-fuel-inbox-delete]');
    if(button){void cancel(button.dataset.fuelInboxDelete);return;}
    if(e.target.closest('[data-view="fuel"]'))void refresh(true);
  });
  document.addEventListener('orbit:auth-changed',e=>{
    accountId=e.detail?.user?.id||'';
    lastStates=new Map();lastRefresh=0;
    if(accountId)void refresh(true);else reset('Sign in to use the private food inbox.');
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&window.ORBITAuth?.user)void refresh(true);
  });
  window.addEventListener('focus',()=>{
    if(window.ORBITAuth?.user&&Date.now()-lastRefresh>30000)void refresh(true);
  });
  setInterval(()=>{
    if(!document.hidden&&!byId('fuel-inbox-form')?.closest('[data-panel="fuel"]')?.hidden&&window.ORBITAuth?.user)void refresh();
  },90000);
  void window.ORBITAuth?.ready.then(()=>refresh(true));
})();
