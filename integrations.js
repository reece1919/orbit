/* ORBIT v0.3 — browser integrations. Public GAIA catalog + optional authenticated private checklists.
 * No account credentials are bundled. Todoist token exists only in this tab's sessionStorage.
 * GAIA session uses the existing GAIA Supabase project and owner-restricted tables.
 */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TODAY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dayOf = t => String(t?.due?.date || '').slice(0,10);
  const timeText = () => new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const gaiaRoot='https://reece1919.github.io/gaia/';
  const gaiaCatalog=gaiaRoot+'plants.json';
  const supabaseUrl='https://zdurujqwhxqrwbhwzzxg.supabase.co';
  // Publishable key also ships in GAIA's publicly hosted gaia-config.js; not a secret.
  const publishableKey='sb_publishable_Xa0DTx_PbvtynbiQN6_xNQ_l1D55vzK';
  const TODOIST_API='https://api.todoist.com/api/v1';
  const sessionKey='helm-todoist-token-v03';
  let token='';
  try { token=sessionStorage.getItem(sessionKey)||''; } catch (_) {}
  let tasks=[]; let todoistSyncTime=''; let todoistError=''; let todoistLoading=false; let todoistPartial=false; let todoistFilter='today';
  let catalog=null; let gaiaLastSync=''; let gaiaPublicError='';
  let gaiaClient=null; let gaiaUser=null; let gaiaPrivateTasks=[]; let gaiaPrivateError=''; let gaiaPrivateLoading=false;
  let gaiaPrivateInitialized=false; let gaiaPrivateBusy=new Set();

  function note(selector, message){ const el=$(selector); if(el) el.textContent=message; }
  function toast(message){ const element=$('#toast'); if (!element) return; element.textContent=message; element.hidden=false; clearTimeout(toast.timer);toast.timer=setTimeout(()=>{element.hidden=true;},3800); }
  function prettyDate(date){ if(!date) return ''; const d=/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+'T12:00:00') : new Date(date); return Number.isNaN(d.valueOf())?date:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function safeTaskLink(id){ return 'https://app.todoist.com/app/task/'+encodeURIComponent(String(id)); }
  function isToday(t){ const due=dayOf(t); return !!due && due<=TODAY(); }
  function selectTasks(kind){
    const today=TODAY();
    const upper=new Date(today+'T12:00:00');upper.setDate(upper.getDate()+14);
    const upperDay=`${upper.getFullYear()}-${String(upper.getMonth()+1).padStart(2,'0')}-${String(upper.getDate()).padStart(2,'0')}`;
    return tasks.filter(t=>kind==='all'||(kind==='today'&&isToday(t))||(kind==='upcoming'&&dayOf(t)>today&&dayOf(t)<=upperDay));
  }
  function ordered(records){return [...records].sort((a,b)=>{
    const da=dayOf(a)||'9999-12-31', db=dayOf(b)||'9999-12-31';
    if(da!==db)return da.localeCompare(db);
    if(a.priority!==b.priority)return Number(b.priority||1)-Number(a.priority||1);
    return String(a.content||'').localeCompare(String(b.content||''));
  });}
  function taskMarkup(t){
    const due=dayOf(t),overdue=due && due<TODAY();
    const detail=[due?(overdue?'Overdue · ':'Due ')+prettyDate(due):'No due date', Number(t.priority||1)>=3?'High priority':''].filter(Boolean).join(' · ');
    return `<article class="live-task${overdue?' is-overdue':''}"><input type="checkbox" data-todoist-done="${esc(t.id)}" aria-label="Complete ${esc(t.content)}"><div class="live-task-body"><strong>${esc(t.content)}</strong><small>${esc(detail)}</small><a href="${esc(safeTaskLink(t.id))}" target="_blank" rel="noopener noreferrer">Open in Todoist ↗</a></div></article>`;
  }
  function renderTodoist(){
    const active=Boolean(token); const total=tasks.length; const due=selectTasks('today');
    $('#todoist-connect').hidden=active;$('#todoist-connected').hidden=!active;
    $('#todoist-add').disabled=!active || todoistLoading;
    $('#stat-tasks').textContent=active && todoistSyncTime?total:'—';
    $('#nav-task-count').textContent=active && todoistSyncTime?String(due.length):'—';
    note('#todoist-home-value',!active?'Not connected':todoistLoading && !todoistSyncTime?'Loading…':todoistError && !todoistSyncTime?'Sync failed':`${due.length} due / overdue`);
    note('#todoist-home-note',!active?'Connect Todoist once per browser tab to see tasks.':todoistError?todoistError:todoistSyncTime?`${total}${todoistPartial?'+':''} open tasks · refreshed ${todoistSyncTime}`:'Connecting…');
    note('#todoist-status',todoistLoading?'Refreshing Todoist…':todoistError?'Could not refresh: '+todoistError:todoistSyncTime?`${total}${todoistPartial?'+':''} open tasks · last refreshed ${todoistSyncTime}`:'Ready to sync');
    $$('[data-todoist-filter]').forEach(el=>el.classList.toggle('selected',el.dataset.todoistFilter===todoistFilter));
    const selected=ordered(selectTasks(todoistFilter));
    $('#todoist-task-list').innerHTML=!active?'<p class="watch-detail">Connect Todoist to manage your actual tasks here.</p>':
      todoistLoading&&!todoistSyncTime?'<p class="watch-detail">Loading your Todoist tasks…</p>':
      selected.length?selected.slice(0,100).map(taskMarkup).join('')+ (selected.length>100?`<p class="watch-detail">Showing 100 of ${selected.length} matching tasks.</p>`:''):
      `<p class="watch-detail">${esc(todoistError||'No tasks in this view.')}</p>`;
    $('#todoist-home-list').innerHTML=!active?'<p class="watch-detail">Connect Todoist under Todoist & Tasks to see your agenda.</p>':
      due.length?ordered(due).slice(0,5).map(taskMarkup).join(''):`<p class="watch-detail">${esc(todoistError||'No tasks due today or overdue.')}</p>`;
  }
  async function todoistRequest(path, opts={}, apiToken=token){
    if(!apiToken)throw new Error('Connect Todoist first.');
    const response=await fetch(TODOIST_API+path,{
      method:opts.method||'GET',
      headers:{'Authorization':'Bearer '+apiToken,...(opts.body?{'Content-Type':'application/json'}:{})},
      ...(opts.body?{body:JSON.stringify(opts.body)}:{}),cache:'no-store'
    });
    if(!response.ok){
      let label='Todoist error '+response.status;
      if(response.status===401||response.status===403)label='Token not authorized. Check Todoist Settings → Integrations → Developer.';
      else if(response.status===429)label='Todoist rate limit reached; try again later.';
      throw new Error(label);
    }
    if(response.status===204)return null;
    const type=response.headers.get('content-type')||'';
    return type.includes('json')?response.json():null;
  }
  async function getTodoistTasks(apiToken=token){
    let cursor='',result=[],partial=false;
    for(let i=0;i<10;i++){
      const params=new URLSearchParams({limit:'200'});if(cursor)params.set('cursor',cursor);
      const page=await todoistRequest('/tasks?'+params.toString(),{},apiToken);
      if(!page || !Array.isArray(page.results))throw new Error('Unexpected Todoist response.');
      result.push(...page.results.filter(t=>t && !t.checked && !t.is_deleted && !t.is_uncompletable));
      if(!page.next_cursor && !page.nextCursor)break;
      cursor=String(page.next_cursor||page.nextCursor);
      if(i===9)partial=true;
    }
    return {tasks:result,partial};
  }
  async function refreshTodoist(){
    if(!token){renderTodoist();return;}
    if(todoistLoading)return;
    todoistLoading=true;todoistError='';renderTodoist();
    try{const data=await getTodoistTasks();tasks=data.tasks;todoistPartial=data.partial;todoistSyncTime=timeText();}
    catch(e){todoistError=e.message||'Could not reach Todoist.';}
    finally{todoistLoading=false;renderTodoist();}
  }
  async function connectTodoist(e){
    e.preventDefault();const input=$('#todoist-token');const candidate=(input.value||'').trim();
    if(!candidate)return;
    const submit=$('#todoist-connect-form button[type=submit]');submit.disabled=true;submit.textContent='Connecting…';
    try{
      const data=await getTodoistTasks(candidate);token=candidate;tasks=data.tasks;todoistPartial=data.partial;
      try{sessionStorage.setItem(sessionKey,token);}catch(_) {toast('Tab storage unavailable; reconnect after refresh.');}
      todoistSyncTime=timeText();todoistError='';input.value='';renderTodoist();toast('Todoist connected.');
    }catch(e){input.value='';toast('Could not connect Todoist: '+(e.message||'Check the token.'));}
    finally{submit.disabled=false;submit.textContent='Connect Todoist';}
  }
  function disconnectTodoist(){
    token='';tasks=[];todoistSyncTime='';todoistError='';try{sessionStorage.removeItem(sessionKey);}catch(_){}
    renderTodoist();toast('Todoist disconnected from this browser tab.');
  }
  async function completeTodoist(id,checkbox){
    const task=tasks.find(t=>String(t.id)===String(id));if(!task)return;
    checkbox.disabled=true;
    try{await todoistRequest('/tasks/'+encodeURIComponent(String(id))+'/close',{method:'POST'});
      tasks=tasks.filter(t=>String(t.id)!==String(id));renderTodoist();toast('Completed in Todoist.');
      // Recurring tasks move to their next date in Todoist: reload the updated occurrence.
      void refreshTodoist();
    }catch(e){checkbox.checked=false;checkbox.disabled=false;toast('Could not complete task: '+e.message);}
  }
  async function createTodoist(e){
    e.preventDefault();if(!token)return;
    const f=e.target, fd=new FormData(f),content=String(fd.get('content')||'').trim();if(!content)return;
    const due=String(fd.get('due_date')||'');const priority=Number(fd.get('priority')||1);
    const payload={content,priority};if(due)payload.due_date=due;
    const btn=f.querySelector('button[type=submit]');btn.disabled=true;
    try{await todoistRequest('/tasks',{method:'POST',body:payload});$('#todoist-create-dialog').close();f.reset();toast('Task added to Todoist.');await refreshTodoist();}
    catch(e){toast('Could not add task: '+e.message);}finally{btn.disabled=false;}
  }

  function gaiaHtmlSafe(source){return String(source||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
  function renderGaiaPublic(){
    if(!catalog){note('#gaia-home-value',gaiaPublicError?'Unavailable':'Loading collection…');note('#gaia-home-note',gaiaPublicError||'Reading GAIA published records.');note('#gaia-last-updated',gaiaPublicError||'Loading GAIA…');return;}
    const plants=Array.isArray(catalog.plants)?catalog.plants:[];
    const watch=plants.filter(p=>['Watch','Concern'].includes(p.status));
    const needsReview=plants.filter(p=>['Fair','Watch','Concern'].includes(p.status));
    const newborn=plants.filter(p=>p.newAddition);
    note('#stat-links',plants.length);note('#nav-gaia-count',plants.length);
    note('#gaia-count',plants.length);note('#gaia-watch-count',watch.length);note('#gaia-new-count',newborn.length);
    note('#gaia-home-value',`${plants.length} plants`);
    note('#gaia-home-note',`${needsReview.length} Fair / Watch / Concern · updated ${catalog.updatedAt||'date unavailable'} · retrieved ${gaiaLastSync}`);
    note('#gaia-last-updated',`Published catalog last updated ${catalog.updatedAt||'date unknown'} · refreshed ${gaiaLastSync}. Plant conditions are recorded observations, not live sensor readings.`);
    if(!gaiaUser){gaiaPrivateTasks=(catalog.dashboardTasks||[]).filter(t=>typeof t.id==='string'&&typeof t.title==='string').map(t=>({id:t.id,kind:'curated',title:t.title,plantName:'Collection follow-up',due:'',done:false})); renderGaiaPrivate();}
    const tiles=Array.isArray(catalog.recentCare?.tiles)?catalog.recentCare.tiles.slice(0,5):[];
    $('#gaia-care-notes').innerHTML=tiles.length?tiles.map(t=>`<article class="gaia-care-tile"><strong>${esc(t.title)}</strong><p>${esc(gaiaHtmlSafe(t.descriptionHtml))}</p></article>`).join(''):'<p class="watch-detail">No recent care notes in the published catalog.</p>';
    $('#gaia-watch-list').innerHTML=watch.length?watch.slice(0,20).map(p=>`<a class="gaia-plant-pill" target="_blank" rel="noopener noreferrer" href="${gaiaRoot}">${esc(p.name)} · ${esc(p.status)}</a>`).join(''):'<p class="watch-detail">No Watch or Concern labels in the published catalog.</p>';
  }
  async function refreshGaiaPublic(){
    try{
      const res=await fetch(gaiaCatalog,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);
      const data=await res.json();if(!Array.isArray(data?.plants))throw new Error('GAIA catalog format changed.');
      catalog=data;gaiaLastSync=timeText();gaiaPublicError='';
    }catch(e){gaiaPublicError='Could not retrieve published GAIA records: '+(e.message||'Network unavailable.');}
    renderGaiaPublic();
  }
  function gaiaPrivateSupported(){return location.origin==='https://reece1919.github.io';}
  async function loadSupabaseSdk(){
    if(window.supabase?.createClient)return;
    await new Promise((resolve,reject)=>{
      const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0';sc.async=true;
      sc.onload=()=>window.supabase?.createClient?resolve():reject(new Error('SDK unavailable'));
      sc.onerror=()=>reject(new Error('Supabase library was blocked'));document.head.appendChild(sc);
    });
  }
  function renderGaiaPrivate(){
    const isSignedIn=Boolean(gaiaUser);
    note('#gaia-private-status',gaiaPrivateLoading?'Syncing private GAIA tasks…':gaiaPrivateError||(!gaiaPrivateSupported()?'Private tasks become available when ORBIT is deployed on reece1919.github.io (the same host as GAIA).':isSignedIn?`Signed into GAIA · ${gaiaPrivateTasks.filter(t=>!t.done).length} unfinished task(s)`:'Sign in under Account & backup in GAIA, then refresh ORBIT.'));
    const visible=gaiaPrivateTasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999-12-31').localeCompare(b.due||'9999-12-31')).slice(0,60);
    $('#gaia-private-tasks').innerHTML=(isSignedIn||visible.length)?(visible.length?visible.map(t=>{
      const id=esc(t.id), kind=esc(t.kind);
      return `<article class="live-task"><input type="checkbox" data-gaia-done="${id}" data-gaia-kind="${kind}" ${!isSignedIn||gaiaPrivateBusy.has(t.kind+':'+t.id)?'disabled':''} aria-label="Complete ${esc(t.title)}"><div class="live-task-body"><strong>${esc(t.title)}</strong><small>${esc([t.plantName,t.due?(t.due<TODAY()?'Overdue · ':'Due ')+prettyDate(t.due):''].filter(Boolean).join(' · '))}</small></div></article>`;
    }).join(''):'<p class="watch-detail">No unfinished GAIA care tasks. Open GAIA to record completed care events.</p>'):
    '<p class="watch-detail">Private tasks are hidden until you sign in to GAIA. Published follow-ups will display when the catalog loads.</p>';
  }
  async function initializeGaiaPrivate(){
    if(gaiaPrivateInitialized)return;
    gaiaPrivateInitialized=true;
    if(!gaiaPrivateSupported()){renderGaiaPrivate();return;}
    gaiaPrivateLoading=true;renderGaiaPrivate();
    try{
      await loadSupabaseSdk();
      gaiaClient=window.supabase.createClient(supabaseUrl,publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
      const {data,error}=await gaiaClient.auth.getUser();if(error&&!/session missing/i.test(error.message||''))throw error;
      gaiaUser=data?.user||null;
      if(gaiaUser)await refreshGaiaPrivate();
      gaiaClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{if(gaiaUser?.id!==session?.user?.id){gaiaUser=session?.user||null;gaiaPrivateTasks=[];void refreshGaiaPrivate();}},0);});
    }catch(e){gaiaPrivateError='Could not initialize private GAIA tasks: '+(e.message||'Connection error.');}
    finally{gaiaPrivateLoading=false;renderGaiaPrivate();}
  }
  async function refreshGaiaPrivate(){
    if(!gaiaClient||!gaiaUser){renderGaiaPrivate();return;}
    gaiaPrivateLoading=true;gaiaPrivateError='';renderGaiaPrivate();
    const owner=gaiaUser.id;
    try{
      const [completion,custom]=await Promise.all([
        gaiaClient.from('gaia_task_completions').select('task_id').eq('user_id',owner).limit(1000),
        gaiaClient.from('gaia_custom_tasks').select('id,plant_id,title,detail,due_on,completed_at').eq('user_id',owner).limit(1000)
      ]);
      if(completion.error)throw completion.error;if(custom.error)throw custom.error;
      if(gaiaUser?.id!==owner)return;
      const names=new Map((catalog?.plants||[]).map(p=>[String(p.id),String(p.name)]));
      const done=new Set((completion.data||[]).map(x=>x.task_id));
      const curated=(catalog?.dashboardTasks||[]).filter(t=>typeof t.id==='string'&&typeof t.title==='string').map(t=>({id:t.id,kind:'curated',title:t.title,plantName:'Collection follow-up',due:'',done:done.has(t.id)}));
      const personals=(custom.data||[]).map(t=>({id:String(t.id),kind:'custom',title:String(t.title),plantName:t.plant_id?names.get(String(t.plant_id))||'Plant':'Collection task',due:t.due_on||'',done:Boolean(t.completed_at)}));
      gaiaPrivateTasks=[...curated,...personals];
    }catch(e){gaiaPrivateError='Private GAIA task sync failed: '+(e.message||'Try refreshing.');}
    finally{gaiaPrivateLoading=false;renderGaiaPrivate();}
  }
  async function toggleGaiaTask(id,kind,checkbox){
    if(!gaiaUser||!gaiaClient)return;
    const record=gaiaPrivateTasks.find(t=>t.id===id&&t.kind===kind);if(!record)return;
    const key=kind+':'+id;if(gaiaPrivateBusy.has(key))return;
    gaiaPrivateBusy.add(key);checkbox.disabled=true;
    try{
      const owner=gaiaUser.id;
      const response=kind==='custom' ? await gaiaClient.from('gaia_custom_tasks').update({completed_at:new Date().toISOString()}).eq('id',id).eq('user_id',owner) :
        await gaiaClient.from('gaia_task_completions').upsert({user_id:owner,task_id:id,completed_at:new Date().toISOString()},{onConflict:'user_id,task_id'});
      if(response.error)throw response.error;
      record.done=true;toast('GAIA task completed. Care events must still be logged in GAIA.');
    }catch(e){checkbox.checked=false;toast('Could not save to GAIA: '+(e.message||'Try again.'));}
    finally{gaiaPrivateBusy.delete(key);renderGaiaPrivate();}
  }
  document.addEventListener('click',event=>{
    const refresh=event.target.closest('[data-refresh]');
    if(refresh){if(refresh.dataset.refresh==='todoist')void refreshTodoist();else if(refresh.dataset.refresh==='gaia'){void refreshGaiaPublic().then(()=>refreshGaiaPrivate());}return;}
    const filter=event.target.closest('[data-todoist-filter]');if(filter){todoistFilter=filter.dataset.todoistFilter;renderTodoist();return;}
    if(event.target.closest('#todoist-disconnect')){disconnectTodoist();return;}
    if(event.target.closest('#todoist-add')){if(token)$('#todoist-create-dialog').showModal();return;}
    if(event.target.closest('#todoist-create-close, #todoist-create-cancel')){$('#todoist-create-dialog').close();return;}
  });
  document.addEventListener('change',event=>{
    const todo=event.target.closest('[data-todoist-done]');if(todo){void completeTodoist(todo.dataset.todoistDone,todo);return;}
    const gaia=event.target.closest('[data-gaia-done]');if(gaia){void toggleGaiaTask(gaia.dataset.gaiaDone,gaia.dataset.gaiaKind,gaia);return;}
  });
  $('#todoist-connect-form').addEventListener('submit',connectTodoist);
  $('#todoist-create-form').addEventListener('submit',createTodoist);
  window.ORBITConnectedTodoist={active:()=>Boolean(token),render:renderTodoist,refreshGaiaPrivate};
  renderTodoist();renderGaiaPublic();renderGaiaPrivate();void refreshGaiaPublic().then(()=>initializeGaiaPrivate());
  if(token)void refreshTodoist();
  window.addEventListener('focus',()=>{if(token&&!todoistLoading)void refreshTodoist();if(gaiaClient&&gaiaUser&&!gaiaPrivateLoading)void refreshGaiaPrivate();});
})();
