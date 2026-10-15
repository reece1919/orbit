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
  // A subtask with no explicit due date inherits its visible parent's date.
  const byTaskId = id => tasks.find(x=>String(x.id)===String(id));
  const ancestorsOf = t => {const result=[];const seen=new Set([String(t.id)]);let pid=t.parent_id;while(pid&&result.length<25&&!seen.has(String(pid))){seen.add(String(pid));const p=byTaskId(pid);if(!p)break;result.push(p);pid=p.parent_id;}return result};
  const dayOf = t => String(t?.due?.date || ancestorsOf(t).find(p=>p.due?.date)?.due.date || '').slice(0,10);
  const timeText = () => new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  const gaiaRoot='https://reece1919.github.io/gaia/';
  const gaiaCatalog=gaiaRoot+'plants.json';
  // GAIA now shares ORBITAuth's single authenticated Supabase client.
  const TODOIST_API='https://api.todoist.com/api/v1';
  let sessionKey='';let token='';let activeAccount='';let serverConnected=false;let oauthChecking=false;let todoistReconnectNeeded=false;
  const BRIDGE='https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/orbit-todoist';
  async function oauthRequest(action,extra={}){
    const auth=window.ORBITAuth;
    if(!auth?.client||!auth.user)throw new Error('Sign in to ORBIT first.');
    const {data,error}=await auth.client.auth.getSession();
    if(error||!data?.session?.access_token)throw new Error('Your ORBIT session expired. Sign in again.');
    const response=await fetch(BRIDGE,{method:'POST',cache:'no-store',headers:{
      'Content-Type':'application/json','Authorization':'Bearer '+data.session.access_token
    },body:JSON.stringify({action,...extra})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result?.error||'Could not reach Todoist connection service ('+response.status+').');
    return result;
  }
  async function checkOAuth(owner){
    if(!owner)return;
    oauthChecking=true;renderTodoist();
    try{
      const status=await oauthRequest('status');
      if(activeAccount!==owner)return;
      serverConnected=!!status.connected;
      todoistReconnectNeeded=!!status.reconnect_required;
      if(todoistReconnectNeeded)todoistError='Todoist authorization expired. Select Reconnect Todoist to restore your tasks.';
      const oauthResult=new URLSearchParams(window.location.search).get('todoist');
      if(oauthResult){
        const clean=new URL(window.location.href);clean.searchParams.delete('todoist');
        window.history.replaceState(null,'',clean.pathname+clean.search+clean.hash);
        if(oauthResult==='connected' && serverConnected){
          document.querySelector('.main-nav [data-view="focus"]')?.click();
          toast('Todoist securely connected! Your tasks are available on all signed-in devices.');
        }else if(oauthResult==='denied')toast('Todoist authorization was canceled.');
        else if(oauthResult==='error' || oauthResult==='invalid')toast('Todoist authorization failed. Please try Connect with Todoist again.');
      }
      if(serverConnected){
        token='';try{sessionStorage.removeItem(sessionKey);}catch(_){}
        void refreshTodoist();
      }
    }catch(err){
      if(activeAccount===owner)todoistError='Connection status unavailable: '+(err.message||'Try again.');
    }finally{if(activeAccount===owner){oauthChecking=false;renderTodoist();}}
  }
  async function startOAuth(){
    const button=$('#todoist-oauth-connect');button.disabled=true;button.textContent='Opening Todoist…';
    try{
      const result=await oauthRequest('start');
      const url=new URL(result.authorization_url);
      if(url.origin!=='https://app.todoist.com'||url.pathname!=='/oauth/authorize')throw new Error('Unexpected Todoist approval URL.');
      window.location.assign(url.href);
    }catch(err){toast('Could not start secure Todoist connection: '+err.message);button.disabled=false;button.textContent=todoistReconnectNeeded?'Reconnect Todoist ↗':'Connect with Todoist ↗';}
  }
  // Retire the older unscoped browser-tab token so it cannot cross ORBIT accounts.
  try{sessionStorage.removeItem('helm-todoist-token-v03');}catch(_){}
  let tasks=[]; let todoistSyncTime=''; let todoistError=''; let todoistLoading=false; let todoistPartial=false; let todoistFilter='today';
  let catalog=null; let gaiaLastSync=''; let gaiaPublicError='';
  let gaiaClient=null; let gaiaUser=null; let gaiaPrivateTasks=[]; let gaiaPrivateError=''; let gaiaPrivateLoading=false;
  let gaiaPrivateInitialized=false; let gaiaPrivateBusy=new Set();

  function note(selector, message){ const el=$(selector); if(el) el.textContent=message; }
  function toast(message){ const element=$('#toast'); if (!element) return; element.textContent=message; element.hidden=false; clearTimeout(toast.timer);toast.timer=setTimeout(()=>{element.hidden=true;},3800); }
  function prettyDate(date){ if(!date) return ''; const d=/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+'T12:00:00') : new Date(date); return Number.isNaN(d.valueOf())?date:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function safeTaskLink(id){ return 'https://app.todoist.com/app/task/'+encodeURIComponent(String(id)); }
  const SIDEQUEST_LABEL='sidequest';
  function isSideQuest(t){
    const labeled=x=>Array.isArray(x?.labels)&&x.labels.some(l=>String(l).replace(/^@/,'').trim().toLowerCase()===SIDEQUEST_LABEL);
    return labeled(t)||ancestorsOf(t).some(labeled);
  }
  function isToday(t){ const due=t._groupDay||dayOf(t); return !!due && due<=TODAY() && !isSideQuest(t); }
  function selectTasks(kind){
    const today=TODAY();
    const upper=new Date(today+'T12:00:00');upper.setDate(upper.getDate()+14);
    const upperDay=`${upper.getFullYear()}-${String(upper.getMonth()+1).padStart(2,'0')}-${String(upper.getDate()).padStart(2,'0')}`;
    // Filter whole parent groups together, not individual children, or their order gets scrambled.
    return ordered(tasks).filter(t=>kind==='all'||(kind==='today'&&isToday(t))||(kind==='upcoming'&&!isSideQuest(t)&&t._groupDay>today&&t._groupDay<=upperDay));
  }
 function hierarchy(records,dayOf,today) {
 const source=Array.isArray(records)?records:[];
 const index=new Map(source.map((t,i)=>[String(t.id),i]));
 const nodes=new Map(source.map(t=>[String(t.id),{task:t,children:[]}]));
 const roots=[];
 const compareSibling=(a,b)=>{
  const sameScope=String(a.project_id||"")===String(b.project_id||"")&&String(a.section_id||"")===String(b.section_id||"")&&String(a.parent_id||"")===String(b.parent_id||"");
  if(sameScope){
   if(typeof a.order_key==="string"&&a.order_key&&typeof b.order_key==="string"&&b.order_key&&a.order_key!==b.order_key)return a.order_key<b.order_key?-1:1;
   const ao=a.child_order,bo=b.child_order;
   if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;
  }
  return (index.get(String(a.id))??0)-(index.get(String(b.id))??0);
 };
 for(const node of nodes.values()){
  const t=node.task,parent=nodes.get(String(t.parent_id));
  let safe=!!parent&&parent!==node;
  if(safe){
   const seen=new Set([String(t.id)]);let p=String(t.parent_id);
   while(nodes.has(p)){
    if(seen.has(p)){safe=false;break}
    seen.add(p);p=String(nodes.get(p).task.parent_id);
   }
  }
  if(safe)parent.children.push(node);
  else roots.push(node);
 }
 const sortChildren=node=>{node.children.sort((a,b)=>compareSibling(a.task,b.task));node.children.forEach(sortChildren)};
 roots.forEach(sortChildren);
 const groupDate=node=>{
  const direct=dayOf(node.task);
  if(direct)return direct;
  const dates=node.children.map(groupDate).filter(Boolean);
  return dates.length?dates.sort()[0]:"";
 };
 // Morning and evening checklists are fixed anchors in displayed views.
 // Only root tasks are promoted; all their subtasks retain the saved sibling order.
 const daypartRank=task=>{
  const title=String(task?.content||"").toLowerCase().trim().replace(/\s+/g," ");
  if(/^morning (?:routine|check ?list)\b/.test(title))return -1;
  if(/^evening (?:routine|check ?list)\b/.test(title))return 1;
  return 0;
 };
 roots.sort((a,b)=>{
  const rankA=daypartRank(a.task),rankB=daypartRank(b.task);
  if(rankA!==rankB)return rankA-rankB;
  const da=groupDate(a)||"9999-12-31",db=groupDate(b)||"9999-12-31";
  if(da!==db)return da.localeCompare(db);
  if(da===today&&Number.isFinite(a.task.day_order)&&Number.isFinite(b.task.day_order)&&a.task.day_order!==b.task.day_order)return a.task.day_order-b.task.day_order;
  return compareSibling(a.task,b.task);
 });
 const out=[];
 const visit=(node,depth,date)=>{
  out.push({...node.task,_treeDepth:depth,_groupDay:date});
  for(const child of node.children)visit(child,depth+1,date);
 };
 for(const root of roots)visit(root,0,groupDate(root));
 return out;
}
  function ordered(records){return hierarchy(records,dayOf,TODAY());}
    function taskMarkup(t){
    const due=dayOf(t),overdue=due && due<TODAY();
    const detail=[due?(overdue?'Overdue · ':'Due ')+prettyDate(due):'No due date', Number(t.priority||1)>=3?'High priority':''].filter(Boolean).join(' · ');
    return `<article class="live-task${overdue?' is-overdue':''}"${t._treeDepth?' style="margin-left:'+Math.min(t._treeDepth,5)*1.15+'rem;border-left:2px solid currentColor"':''}><input type="checkbox" data-todoist-done="${esc(t.id)}" aria-label="Complete ${esc(t.content)}"><div class="live-task-body"><strong>${t._treeDepth?'↳ ':''}${esc(t.content)}</strong><small>${esc(detail)}</small><div class="todoist-task-controls">${todoistTaskAction(t,'todoist-task-action')}<a href="${esc(safeTaskLink(t.id))}" target="_blank" rel="noopener noreferrer">Open in Todoist ↗</a></div></div></article>`;
  }
  const HOME_SYSTEMS=['gaia','echo','rune','fuel','pulse','vita','quill','driftmark','orbit'];
  function homeTaskSystem(t){
    const labels=Array.isArray(t?.labels)?t.labels.map(x=>String(x).replace(/^@/,'').trim().toLowerCase()):[];
    return HOME_SYSTEMS.find(x=>labels.includes(x)) || ancestorsOf(t).map(p=>homeTaskSystem(p)).find(x=>x!=='general') || 'general';
  }
  // Both choices are explicit for every open task. Neither records completion:
  // Skip reschedules; Dismiss removes the task (or its entire recurring series).
  function todoistTaskAction(t,style){
    const recurring=Boolean(t.due?.is_recurring);
    return `<span class="todoist-decision-actions" role="group" aria-label="Options for ${esc(t.content)}">
      <button class="${style} todoist-skip" type="button" data-todoist-skip="${esc(t.id)}" aria-label="Skip ${esc(t.content)} without completing" title="Not today — move the task to its next date without completion">Skip</button>
      <button class="${style} todoist-drop" type="button" data-todoist-drop="${esc(t.id)}" aria-label="Dismiss ${esc(t.content)} without completing" title="${recurring?'Permanently end this recurring series':'Permanently remove this task'} without recording a completion">Dismiss</button>
    </span>`;
  }
  function homeTaskMarkup(t){
    const system=homeTaskSystem(t);
    // Unassigned Todoist tasks belong to ORBIT. Preserve the source icon for module-tagged tasks.
    const origin=system==='general'?'orbit':system;
    const iconAssets={
      orbit:'assets/orbit-emblem-cutout.png?v=4.0.0',
      vita:'assets/systems/vita-metal.webp?v=2.0.0',
      quill:'assets/systems/quill-blue-metal.png?v=2.0.0',
      driftmark:'assets/systems/quill-blue-metal.png?v=2.0.0'
    };
    const iconSrc=iconAssets[origin]||'assets/systems/'+origin+'.svg';
    const icon=`<img class="agenda-system-icon" src="${iconSrc}" alt="" width="20" height="20">`;
    const due=dayOf(t)||t._groupDay||'';
    const overdue=!!due && due<TODAY();
    const dateLabel=due ? `<small class="agenda-due-date${overdue?' agenda-overdue-date':''}" title="${esc(overdue?'Overdue since '+prettyDate(due):'Due '+prettyDate(due))}">${esc(overdue?'Due '+prettyDate(due):prettyDate(due))}</small>` : '<small class="agenda-due-date" aria-hidden="true">—</small>';
    return `<article class="agenda-row${overdue?' is-overdue':''}">
      <input type="checkbox" data-todoist-done="${esc(t.id)}" aria-label="Complete ${esc(t.content)}">
      <span class="agenda-system-label">${icon}${esc(origin==='driftmark'?'QUILL':origin.toUpperCase())}</span>
      <div class="agenda-task-layout">
        <a href="${esc(safeTaskLink(t.id))}" target="_blank" rel="noopener noreferrer" class="agenda-task-title"${t._treeDepth?' style="padding-left:'+Math.min(t._treeDepth,5)*0.7+'rem"':''}>${t._treeDepth?'↳ ':''}${esc(t.content)}</a>
        ${dateLabel}
        ${todoistTaskAction(t,'agenda-task-action')}
      </div>
    </article>`;
  }
  function homeAgenda(){
    const today=TODAY(),future=new Date(today+'T12:00:00');
    future.setDate(future.getDate()+1);
    const tomorrow=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`;
    const organized=ordered(tasks);
    const visible=organized.filter(t=>!isSideQuest(t));
    const effectiveDate=t=>dayOf(t)||t._groupDay||'';
    const behind=visible.filter(t=>effectiveDate(t)&&effectiveDate(t)<today);
    const fresh=visible.filter(t=>effectiveDate(t)===today);
    const next=visible.filter(t=>effectiveDate(t)===tomorrow);
    const group=(name,list)=>{
      const groupClass='agenda-day'+(name==='Overdue'?' is-overdue-group':'');
      if(!list.length)return `<section class="${groupClass}"><h4>${name} <span class="agenda-count">0</span></h4><p class="agenda-empty">Nothing scheduled</p></section>`;
      return `<section class="${groupClass}"><h4>${name} <span class="agenda-count">${list.length}</span></h4>${list.map(homeTaskMarkup).join('')}</section>`;
    };
    return (behind.length?group('Overdue',behind):'')+group('Today',fresh)+group('Tomorrow',next);
  }
  function sideQuestMarkup(t){
    const due=dayOf(t);
    return `<article class="sidequest-row"><input type="checkbox" data-todoist-done="${esc(t.id)}" aria-label="Complete side quest: ${esc(t.content)}"><div class="sidequest-row-body"><strong class="sidequest-row-title">${t._treeDepth?'↳ ':''}${esc(t.content)}</strong><small class="sidequest-row-sub">${esc(due?'Optional · '+prettyDate(due):'No deadline · just for fun')}</small></div><a href="${esc(safeTaskLink(t.id))}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(t.content)} in Todoist">↗</a></article>`;
  }
  function renderTodoist(){
    const active=Boolean(token||serverConnected); const total=tasks.length; const due=selectTasks('today');
    const sidequests=ordered(tasks.filter(isSideQuest));
    const reconnectButton=$('#todoist-oauth-connect');
    if(reconnectButton && !reconnectButton.disabled)reconnectButton.textContent=todoistReconnectNeeded?'Reconnect Todoist ↗':'Connect with Todoist ↗';
    const connectorHeading=$('#todoist-connect strong');
    if(connectorHeading)connectorHeading.textContent=todoistReconnectNeeded?'Your Todoist authorization expired':'Connect Todoist across all your devices';
    const mode=$('#todoist-connection-mode');
    if(mode)mode.textContent=serverConnected?'Secure connection · available across devices':token?'Temporary browser-tab connection':'';
    const check=$('#todoist-oauth-checking');
    if(check)check.hidden=!oauthChecking;
    $('#todoist-connect').hidden=active;$('#todoist-connected').hidden=!active;
    $('#todoist-add').disabled=!active || todoistLoading;
    const addQuest=$('#sidequest-add-btn'),questInput=$('#sidequest-add-input');
    if(addQuest)addQuest.disabled=!active||todoistLoading;
    if(questInput)questInput.disabled=!active||todoistLoading;
    $('#nav-task-count').textContent=active && todoistSyncTime?String(due.length):'—';
    note('#todoist-home-note',todoistError?todoistError:!active?'':todoistSyncTime?'Updated '+todoistSyncTime:'');
    note('#todoist-status',todoistLoading?'Refreshing Todoist…':todoistError?'Could not refresh: '+todoistError:todoistSyncTime?`${total}${todoistPartial?'+':''} open tasks · last refreshed ${todoistSyncTime}`:'Ready to sync');
    $$('[data-todoist-filter]').forEach(el=>el.classList.toggle('selected',el.dataset.todoistFilter===todoistFilter));
    const selected=selectTasks(todoistFilter);
    $('#todoist-task-list').innerHTML=!active?(todoistReconnectNeeded?'<p class="watch-detail">Your Todoist authorization expired. Use the Reconnect Todoist button above to restore your tasks.</p>':'<p class="watch-detail">Connect Todoist to manage your actual tasks here.</p>'):
      todoistLoading&&!todoistSyncTime?'<p class="watch-detail">Loading your Todoist tasks…</p>':
      selected.length?selected.map(taskMarkup).join(''):
      `<p class="watch-detail">${esc(todoistError||'No tasks in this view.')}</p>`;
    $('#todoist-home-list').innerHTML=!active?(todoistReconnectNeeded?'<p class="watch-detail">Todoist authorization expired. <button type="button" data-view="focus" class="subtle-link">Open Tasks to reconnect ↗</button></p>':'<p class="watch-detail">Connect Todoist to see your agenda.</p>'):
      todoistLoading&&!todoistSyncTime?'<p class="watch-detail">Loading…</p>':homeAgenda();
    const sideQuestList=$('#sidequest-list');
    if(sideQuestList)sideQuestList.innerHTML=!active?'<p class="watch-detail">Connect Todoist to view and add side quests.</p>':
      todoistLoading&&!todoistSyncTime?'<p class="watch-detail">Looking for your side quests…</p>':
      sidequests.length?sidequests.map(sideQuestMarkup).join(''):
      `<p class="watch-detail">${esc(todoistError||'No side quests.')}</p>`;
  }
  async function todoistRequest(path, opts={}, apiToken=token){
    if(serverConnected && (!apiToken || apiToken===token)){
      return oauthRequest('api',{path,method:opts.method||'GET',...(opts.body?{body:JSON.stringify(opts.body)}:{})});
    }
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
    if(!token&&!serverConnected){renderTodoist();return;}
    if(todoistLoading)return;
    todoistLoading=true;todoistError='';renderTodoist();
    const owner=activeAccount;
    try{const data=await getTodoistTasks();if(owner!==activeAccount)return;tasks=data.tasks;todoistPartial=data.partial;todoistSyncTime=timeText();}
    catch(e){if(owner===activeAccount)todoistError=e.message||'Could not reach Todoist.';}
    finally{todoistLoading=false;renderTodoist();}
  }
  async function connectTodoist(e){
    e.preventDefault();const input=$('#todoist-token');const candidate=(input.value||'').trim();
    if(!candidate)return;
    const submit=$('#todoist-connect-form button[type=submit]');submit.disabled=true;submit.textContent='Connecting…';
    try{
      const owner=activeAccount;const data=await getTodoistTasks(candidate);if(owner!==activeAccount||!owner)throw new Error('Account changed. Please reconnect.');token=candidate;tasks=data.tasks;todoistPartial=data.partial;
      try{sessionStorage.setItem(sessionKey,token);}catch(_) {toast('Tab storage unavailable; reconnect after refresh.');}
      todoistSyncTime=timeText();todoistError='';input.value='';renderTodoist();toast('Todoist connected.');
    }catch(e){input.value='';toast('Could not connect Todoist: '+(e.message||'Check the token.'));}
    finally{submit.disabled=false;submit.textContent='Connect Todoist';}
  }
  async function disconnectTodoist(){
    if(serverConnected){
      try{await oauthRequest('disconnect');serverConnected=false;}
      catch(err){toast('Could not disconnect Todoist: '+err.message);return;}
    }
    token='';tasks=[];todoistSyncTime='';todoistError='';
    try{sessionStorage.removeItem(sessionKey);}catch(_){}
    renderTodoist();toast('Todoist disconnected from ORBIT.');
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
  const todoistActionBusy=new Set();
  const nextDay=()=>{
    const d=new Date(TODAY()+'T12:00:00');d.setDate(d.getDate()+1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  async function skipOrDismissTodoist(id,kind,button){
    const task=tasks.find(t=>String(t.id)===String(id));
    if(!task||todoistActionBusy.has(String(id)))return;
    const recurring=Boolean(task.due?.is_recurring);
    if(!serverConnected){toast('A secure Todoist OAuth connection is required to skip or dismiss from ORBIT.');return;}
    const today=TODAY(),due=dayOf(task);
    const next=recurring && due && due<today ? today : nextDay();
    const hasChildren=tasks.some(t=>String(t.parent_id)===String(id));
    const message=kind==='skip'
      ? 'Skip “'+task.content+'” without marking it complete? '+(recurring?'Only the next due date changes; the recurring rule stays active. ':'')+'Next date: '+prettyDate(next)+'.'
      : 'Dismiss “'+task.content+'”? '+(recurring?'This permanently ends the ENTIRE repeating series. ':'This permanently deletes this task. ')+(hasChildren?'Any subtasks may be removed too. ':'')+'No completion is recorded. This cannot be undone.';
    if(!window.confirm(message))return;
    todoistActionBusy.add(String(id));
    // Disable both decisions while this Todoist action is in progress.
    const row=button.closest('.agenda-task-main, .live-task-body');
    const controls=[...(row?.querySelectorAll('[data-todoist-skip],[data-todoist-drop]')||[button])];
    controls.forEach(x=>x.disabled=true);
    const original=button.textContent;
    button.textContent=kind==='skip'?'Skipping…':'Dismissing…';
    try{
      const result=await oauthRequest(kind==='skip'?'skip':'drop',{task_id:String(id),...(kind==='skip'?{next_date:next}:{})});
      if(!result?.ok||result.action!==(kind==='skip'?'skipped':'dropped'))throw new Error('Todoist did not confirm the action.');
      // Refresh from Todoist rather than mark any occurrence completed locally.
      tasks=tasks.filter(t=>String(t.id)!==String(id));
      renderTodoist();
      toast(kind==='skip'?'Skipped — not completed. Task rescheduled.':'Dismissed — not completed.');
      await refreshTodoist();
    }catch(error){
      button.textContent=original;
      toast('Could not '+(kind==='skip'?'skip':'dismiss')+' task: '+(error.message||'Please retry.'));
      void refreshTodoist();
    }finally{
      controls.forEach(x=>x.disabled=false);
      todoistActionBusy.delete(String(id));
    }
  }
  async function createTodoist(e){
    e.preventDefault();if(!token&&!serverConnected)return;
    const f=e.target, fd=new FormData(f),content=String(fd.get('content')||'').trim();if(!content)return;
    const due=String(fd.get('due_date')||'');const priority=Number(fd.get('priority')||1);
    const payload={content,priority};if(due)payload.due_date=due;
    const btn=f.querySelector('button[type=submit]');btn.disabled=true;
    try{await todoistRequest('/tasks',{method:'POST',body:payload});$('#todoist-create-dialog').close();f.reset();toast('Task added to Todoist.');await refreshTodoist();}
    catch(e){toast('Could not add task: '+e.message);}finally{btn.disabled=false;}
  }

  async function ensureSideQuestLabel(){
    // Create this one personal label only when the user adds a side quest.
    const existing=await todoistRequest('/labels/search?query=sidequest&limit=50');
    if(!Array.isArray(existing?.results))throw new Error('Could not verify the sidequest label.');
    const present=existing.results.some(l=>String(l?.name||'').toLowerCase()===SIDEQUEST_LABEL);
    if(!present)await todoistRequest('/labels',{method:'POST',body:{name:SIDEQUEST_LABEL}});
  }
  async function createSideQuest(e){
    e.preventDefault();
    if(!token&&!serverConnected){toast('Connect Todoist before adding a side quest.');return;}
    const form=e.currentTarget||e.target;
    const input=$('#sidequest-add-input');
    const name=String(input?.value||'').trim();
    if(!name||name.length>500)return;
    const add=$('#sidequest-add-btn');
    const originalButtonMarkup=add.innerHTML;
    add.disabled=true;add.textContent='Adding…';input.disabled=true;
    try{
      await ensureSideQuestLabel();
      await todoistRequest('/tasks',{method:'POST',body:{content:name,labels:[SIDEQUEST_LABEL]}});
      form.reset();
      toast('Side quest added in Todoist.');
      await refreshTodoist();
    }catch(err){toast('Could not add side quest: '+(err.message||'Try again.'));}
    finally{add.innerHTML=originalButtonMarkup;add.disabled=!(token||serverConnected);input.disabled=!(token||serverConnected);}
  }

  function gaiaHtmlSafe(source){return String(source||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
  function renderGaiaPublic(){
    if(!catalog){note('#gaia-home-note',gaiaPublicError||'Reading GAIA published records.');note('#gaia-last-updated',gaiaPublicError||'Loading GAIA…');return;}
    const plants=Array.isArray(catalog.plants)?catalog.plants:[];
    const watch=plants.filter(p=>['Watch','Concern'].includes(p.status));
    const needsReview=plants.filter(p=>['Fair','Watch','Concern'].includes(p.status));
    const newborn=plants.filter(p=>p.newAddition);
    note('#nav-gaia-count',plants.length);
    note('#gaia-count',plants.length);note('#gaia-watch-count',watch.length);note('#gaia-new-count',newborn.length);
    note('#gaia-home-note',needsReview.length?`Some plants could use a closer look · refreshed ${gaiaLastSync}`:`No current care flags · refreshed ${gaiaLastSync}`);
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
  function renderGaiaPrivate(){
    const isSignedIn=Boolean(gaiaUser);
    note('#gaia-private-status',gaiaPrivateLoading?'Syncing private GAIA tasks…':gaiaPrivateError||(!gaiaPrivateSupported()?'Private tasks become available when ORBIT is deployed on reece1919.github.io (the same host as GAIA).':isSignedIn?`Signed into ORBIT and GAIA · ${gaiaPrivateTasks.filter(t=>!t.done).length} unfinished task(s)`:'Sign in to ORBIT to see your private GAIA tasks.'));
    const visible=gaiaPrivateTasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999-12-31').localeCompare(b.due||'9999-12-31')).slice(0,60);
    $('#gaia-private-tasks').innerHTML=(isSignedIn||visible.length)?(visible.length?visible.map(t=>{
      const id=esc(t.id), kind=esc(t.kind);
      return `<article class="live-task"><input type="checkbox" data-gaia-done="${id}" data-gaia-kind="${kind}" ${!isSignedIn||gaiaPrivateBusy.has(t.kind+':'+t.id)?'disabled':''} aria-label="Complete ${esc(t.title)}"><div class="live-task-body"><strong>${esc(t.title)}</strong><small>${esc([t.plantName,t.due?(t.due<TODAY()?'Overdue · ':'Due ')+prettyDate(t.due):''].filter(Boolean).join(' · '))}</small></div></article>`;
    }).join(''):'<p class="watch-detail">No unfinished GAIA care tasks. Open GAIA to record completed care events.</p>'):
    '<p class="watch-detail">Private tasks are hidden until you sign in to GAIA. Published follow-ups will display when the catalog loads.</p>';
  }
  async function initializeGaiaPrivate(){
    if(gaiaPrivateInitialized)return;gaiaPrivateInitialized=true;
    if(!gaiaPrivateSupported()){renderGaiaPrivate();return;}
    gaiaPrivateLoading=true;renderGaiaPrivate();
    try{
      await window.ORBITAuth.ready;
      gaiaClient=window.ORBITAuth.client;
      gaiaUser=window.ORBITAuth.user;
      if(!gaiaClient)throw new Error('Could not initialize ORBIT authentication.');
      if(gaiaUser)await refreshGaiaPrivate();
    }catch(e){gaiaPrivateError='Could not connect private GAIA tasks: '+(e.message||'Connection error.');}
    finally{gaiaPrivateLoading=false;renderGaiaPrivate();}
  }
  function handleOrbitAccount(user){
    const next=user?.id||'';
    if(activeAccount===next&&gaiaUser?.id===next)return;
    // An interrupted GAIA session must not erase an independent Todoist
    // connection. Credentials are scoped to the authenticated account ID
    // and are removed only by explicit Todoist Disconnect (or tab closure).
    activeAccount=next;
    sessionKey=next?'orbit-todoist-v04-'+next:'';
    token='';serverConnected=false;oauthChecking=false;todoistReconnectNeeded=false;tasks=[];todoistError='';todoistSyncTime='';todoistPartial=false;todoistLoading=false;
    if(next){try{token=sessionStorage.getItem(sessionKey)||'';}catch(_){}}
    gaiaClient=window.ORBITAuth?.client||gaiaClient;gaiaUser=user||null;gaiaPrivateTasks=[];gaiaPrivateError='';
    renderTodoist();renderGaiaPrivate();
    if(gaiaUser&&gaiaClient)void refreshGaiaPrivate();
    if(token)void refreshTodoist();
    if(next)void checkOAuth(next);
    if(!gaiaUser)renderGaiaPublic();
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
    if(event.target.closest('#todoist-oauth-connect')){void startOAuth();return;}
    if(event.target.closest('#todoist-disconnect')){void disconnectTodoist();return;}
    const skip=event.target.closest('[data-todoist-skip]');if(skip){void skipOrDismissTodoist(skip.dataset.todoistSkip,'skip',skip);return;}
    const drop=event.target.closest('[data-todoist-drop]');if(drop){void skipOrDismissTodoist(drop.dataset.todoistDrop,'drop',drop);return;}
    if(event.target.closest('#todoist-add')){if(token||serverConnected)$('#todoist-create-dialog').showModal();return;}
    if(event.target.closest('#todoist-create-close, #todoist-create-cancel')){$('#todoist-create-dialog').close();return;}
  });
  document.addEventListener('change',event=>{
    const todo=event.target.closest('[data-todoist-done]');if(todo){void completeTodoist(todo.dataset.todoistDone,todo);return;}
    const gaia=event.target.closest('[data-gaia-done]');if(gaia){void toggleGaiaTask(gaia.dataset.gaiaDone,gaia.dataset.gaiaKind,gaia);return;}
  });
  $('#todoist-connect-form').addEventListener('submit',connectTodoist);
  $('#todoist-create-form').addEventListener('submit',createTodoist);
  $('#sidequest-create-form').addEventListener('submit',createSideQuest);
  window.ORBITConnectedTodoist={active:()=>Boolean(token||serverConnected),render:renderTodoist,refreshGaiaPrivate};
  document.addEventListener('orbit:auth-changed',event=>handleOrbitAccount(event.detail?.user||null));
  renderTodoist();renderGaiaPublic();renderGaiaPrivate();
  // Restore Todoist as soon as ORBIT knows the signed-in account, without
  // waiting for the public GAIA catalog network request to complete.
  void window.ORBITAuth.ready.then(()=>handleOrbitAccount(window.ORBITAuth?.user||null));
  void refreshGaiaPublic().then(()=>initializeGaiaPrivate());
  window.addEventListener('focus',()=>{if((token||serverConnected)&&!todoistLoading)void refreshTodoist();if(gaiaClient&&gaiaUser&&!gaiaPrivateLoading)void refreshGaiaPrivate();});
})();