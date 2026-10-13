/* ORBIT Headquarters v0.3 — Todoist + GAIA, with local projects and routines. */
(() => {
  'use strict';
  const LEGACY_KEY='helm-headquarters-v1';
  const KEY='orbit-v04-user-';
  let accountId='';
  const currentKey=()=>accountId?KEY+accountId:null;
  const ICONS = {
    'layout-dashboard':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    'grid':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    'settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-1.78 1.78-.05-.05A1.8 1.8 0 0 0 16 18.4a1.8 1.8 0 0 0-1.5 1.6V21h-5v-1a1.8 1.8 0 0 0-1.5-1.6A1.8 1.8 0 0 0 6 18.76l-.05.05-1.78-1.78.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.6-1.5H2v-3h1a1.8 1.8 0 0 0 1.6-1.5 1.8 1.8 0 0 0-.38-1.98l-.05-.05L5.95 5.2l.05.05A1.8 1.8 0 0 0 8 5.6a1.8 1.8 0 0 0 1.5-1.6V3h5v1A1.8 1.8 0 0 0 16 5.6a1.8 1.8 0 0 0 1.98-.35l.05-.05 1.78 1.78-.05.05A1.8 1.8 0 0 0 19.4 9a1.8 1.8 0 0 0 1.6 1.5h1v3h-1a1.8 1.8 0 0 0-1.6 1.5Z"/>',
    'leaf':'<path d="M20 4C10 4 4 9 4 16a4 4 0 0 0 4 4c7 0 12-6 12-16Z"/><path d="M4 20c4-6 8-9 13-12"/>',
    'arrow-up-right':'<path d="M7 17 17 7M8 7h9v9"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'list-check':'<path d="m3 7 2 2 4-4M13 7h8M3 17l2 2 4-4m4 2h8"/>',
    'github':'<path d="M9 19c-4 1-4-2-6-2m6 4v-3.3a4 4 0 0 1-1.1-3.1C4 14 3.5 10 5 7c-1-2 0-3 0-3s2-.2 3.4 1.6a12 12 0 0 1 7.2 0C17 4 19 4 19 4s1 1 0 3c1.5 3 1 7-3 7.6a4 4 0 0 1-1 3.1V21"/>',
    'hard-drive':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18M7 17h.01M11 17h.01"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'layers':'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    'link':'<path d="M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2"/>',
    'pen-line':'<path d="m13 6 5 5M4 20l5-.8L20 8a2.1 2.1 0 0 0-4-4L5 15.2 4 20ZM4 22h16"/>',
    'book-open':'<path d="M12 7c-3-2-6-2-10-1v13c4-1 7-1 10 1 3-2 6-2 10-1V6c-4-1-7-1-10 1Zm0 0v13"/>',
    'radio':'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="m6 8 11-6M7 14h7m-7 3h4"/><circle cx="17" cy="16" r="2"/>',
    'briefcase':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13c5 3 13 3 18 0"/>',
    'sprout':'<path d="M12 22v-9M12 13C6 13 4 10 4 5c6 0 8 3 8 8ZM12 17c0-6 3-9 9-9 0 6-3 9-9 9Z"/>',
    'gamepad':'<rect x="2" y="7" width="20" height="12" rx="5"/><path d="M7 13h6m-3-3v6M17 12h.01M19 15h.01"/>',
    'flag':'<path d="M5 21V4m0 1c5-4 8 3 15-1v12c-7 4-10-3-15 1"/>',
    'folder':'<path d="M3 5h6l2 2h10v13H3V5Z"/>',
    'search':'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    'trash':'<path d="M4 7h16M10 4h4m4 3-.8 13H6.8L6 7M10 10v7m4-7v7"/>',
    'edit':'<path d="m14 5 5 5M4 20l4.5-.9L20 7.6a2.1 2.1 0 0 0-3-3L5 16 4 20Z"/>',
    'menu':'<path d="M4 7h16M4 12h16M4 17h16"/>',
    'x':'<path d="M5 5l14 14M19 5 5 19"/>',
    'palette':'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 2-2c0-1-.5-2 1-2h1a3 3 0 0 0 3-3 11 11 0 0 0-9-11Z"/><circle cx="7" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="9" r="1"/>',
    'moon':'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
    'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    'database':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
    'download':'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    'upload':'<path d="M12 17V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    'shield-check':'<path d="m12 2 9 4v6c0 6-4 9-9 11-5-2-9-5-9-11V6l9-4Zm-4 10 3 3 5-5"/>',
    'wallet':'<rect x="2" y="5" width="20" height="16" rx="3"/><path d="M2 9h20m-5 7h2"/>',
    'activity':'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    'mail':'<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    'message-circle':'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.7 0-3.3-.48-4.65-1.3L3 20l1.42-4.64A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11.5h8m-8 3.5h5"/>',
    'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'heart-pulse':'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.7Z"/><path d="M3 12h5l2-3 3 6 2-3h6"/>',
    'repeat':'<path d="M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3"/>',
    'radar':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12 19 5"/>'
  };
  const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">${ICONS[name] || ICONS.folder}</svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaultState = () => ({
    version:2, theme:'dark', scratchpad:'', tasks:[], accounts:[], bills:[], checkins:[], balancesVisible:false,
    routines:[{id:'exercise',name:'Get some exercise',goal:3,completions:[]},{id:'prescription',name:'Fill weekly prescription organizer',goal:1,completions:[]}],
    projects:[
      {id:'gaia',name:'GAIA',description:'Plant collection, care history, and your living herbarium.',type:'plants',status:'Live',url:'https://reece1919.github.io/gaia/'},
      {id:'driftbound',name:'Driftbound',description:'Worldbuilding, lore, maps, and the evolving world of Eilmark.',type:'world',status:'In progress',url:''},
      {id:'controlled-drift',name:'Controlled Drift',description:'Gaming, golf, cooking, and everything going live.',type:'stream',status:'In progress',url:'https://www.twitch.tv/controlled_drift'}
    ],
    links:[
      {id:'quick-gaia',name:'GAIA',url:'https://reece1919.github.io/gaia/'},
      {id:'quick-todoist',name:'Todoist',url:'https://app.todoist.com/app/today'},
      {id:'quick-github',name:'GitHub',url:'https://github.com/reece1919'}
    ]
  });
  const fuelProject = {id:'fuel',name:'FUEL',description:'Conversational meal logging and your private nutrition journal.',type:'general',status:'Live',url:'https://chatgpt.com/g/g-p-6acd6e86e82081919497cb8e044c60bd/project'};
  const echoProject = {id:'echo',name:'ECHO',description:'Streaming, content production, broadcasts, and promotions. Uses shared ORBIT sign-in.',type:'stream',status:'Live',url:'https://reece1919.github.io/echo/'};
  const runeProject = {id:'rune',name:'RUNE',description:'Tablet-friendly character journals, spells, encounters, and campaign notes.',type:'world',status:'Live',url:'https://reece1919.github.io/rune-web/'};
  const effectiveProjects = () => {
    const source = state.projects;
    const has = p => source.some(x => x.id === p.id || x.name.toLowerCase() === p.name.toLowerCase());
    return [...source,...[fuelProject,echoProject,runeProject].filter(p=>!has(p))].filter(p=>!["gaia","echo","rune"].includes(String(p.id).toLowerCase())&&!["gaia","echo","rune"].includes(String(p.name).toLowerCase()));
  };
  const safeText = (s,limit=200) => typeof s === 'string' ? s.slice(0,limit) : '';
  function safeUrl(url){
    if(!url) return '';
    try { const u = new URL(url); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : ''; }
    catch { return ''; }
  }
  function validMeasure(v,min,max){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
  function normalized(data) {
    const base = defaultState();
    if(!data || typeof data !== 'object' || Array.isArray(data) || ![1,2].includes(data.version)) throw new Error('Unsupported ORBIT backup format.');
    return {
      version:2,
      balancesVisible:!!data.balancesVisible,
      accounts:Array.isArray(data.accounts)?data.accounts.slice(0,50).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),name:safeText(x.name,80),balance:Number.isFinite(Number(x.balance))?Math.round(Number(x.balance)*100)/100:0,asof:/^\d{4}-\d{2}-\d{2}$/.test(x.asof)?x.asof:''})).filter(x=>x.name):[],
      bills:Array.isArray(data.bills)?data.bills.slice(0,100).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),name:safeText(x.name,100),amount:Number.isFinite(Number(x.amount))?Math.max(0,Math.round(Number(x.amount)*100)/100):0,day:Math.min(31,Math.max(1,Number(x.day)||1)),paidMonths:Array.isArray(x.paidMonths)?x.paidMonths.filter(s=>/^\d{4}-\d{2}$/.test(s)).slice(-24):[]})).filter(x=>x.name):[],
      checkins:Array.isArray(data.checkins)?data.checkins.slice(0,600).filter(x=>x&&typeof x==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).map(x=>({id:safeText(x.id,90)||id(),date:x.date,weight:validMeasure(x.weight,30,1000),sleep:validMeasure(x.sleep,0,24),steps:validMeasure(x.steps,0,100000),mood:['Great','Good','Okay','Low',''].includes(x.mood)?x.mood:'',note:safeText(x.note,500)})):[],
      routines:Array.isArray(data.routines)?data.routines.slice(0,80).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),name:safeText(x.name,100),goal:Math.max(1,Math.min(14,Number(x.goal)||1)),completions:Array.isArray(x.completions)?x.completions.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)).slice(-365):[]})).filter(x=>x.name):base.routines,
      theme:data.theme==='light'?'light':'dark', scratchpad:safeText(data.scratchpad,50000),
      tasks:Array.isArray(data.tasks)?data.tasks.slice(0,300).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),title:safeText(x.title,160),priority:x.priority==='High'?'High':'Normal',due:/^\d{4}-\d{2}-\d{2}$/.test(x.due)?x.due:'',done:!!x.done,created:safeText(x.created,35)})).filter(x=>x.title):[],
      projects:Array.isArray(data.projects)?data.projects.slice(0,100).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),name:safeText(x.name,80),description:safeText(x.description,400),type:['plants','world','stream','work','general'].includes(x.type)?x.type:'general',status:['Live','In progress','Planned'].includes(x.status)?x.status:'Planned',url:safeUrl(x.url)})).filter(x=>x.name):base.projects,
      links:Array.isArray(data.links)?data.links.slice(0,100).filter(x=>x&&typeof x==='object').map(x=>({id:safeText(x.id,90)||id(),name:safeText(x.name,80),url:safeUrl(x.url)})).filter(x=>x.name&&x.url):base.links
    };
  }
  function load() {try{const key=currentKey(),raw=key?localStorage.getItem(key):null;return raw?normalized(JSON.parse(raw)):defaultState();}catch(e){console.warn('ORBIT data could not be loaded:',e);return defaultState();}}
  let state=load();let view='home';let focusFilter='open';let modalKind=null;let editingId=null;let toastTimer;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  function persist(){if(!currentKey())return false;try{localStorage.setItem(currentKey(),JSON.stringify(state));document.dispatchEvent(new CustomEvent('orbit:local-saved',{detail:{ownerId:accountId}}));return true;}catch(e){toast('Browser storage is unavailable. Export a backup to save your work.');return false;}}
  function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},3500);}
  const projectType = {
    plants:{icon:'leaf',color:'#a9ddba',bg:'rgba(143,205,162,.11)'},
    world:{icon:'book-open',color:'#d1b3ea',bg:'rgba(181,140,215,.12)'},
    stream:{icon:'radio',color:'#91cdea',bg:'rgba(125,188,222,.12)'},
    work:{icon:'briefcase',color:'#e5bb91',bg:'rgba(220,164,117,.12)'},
    fuel:{icon:'heart-pulse',color:'#ff9860',bg:'rgba(255,152,96,.14)'},
    general:{icon:'folder',color:'#8fcfff',bg:'rgba(75,165,221,.11)'}
  };
  function cardHtml(p){
    const style=p.id==='fuel'||String(p.name).toLowerCase()==='fuel'?projectType.fuel:projectType[p.type]||projectType.general;
    const openLabel=p.url?'Launch project':'Add project link';
    const systemId=['gaia','echo','rune','fuel','pulse'].find(x=>p.id===x||String(p.name).toLowerCase()===x);
    const emblem=systemId?`<img src="assets/systems/${systemId}.svg?v=1.5.0" width="39" height="39" alt="">`:icon(style.icon);
    return `<article class="project-card" style="--project-accent:${style.color};--project-bg:${style.bg}">
      <div class="project-top"><div class="project-emblem">${emblem}</div><span class="project-badge">${esc(p.status.toUpperCase())}</span></div>
      <h3>${esc(p.name)}</h3><p>${esc(p.description||'Your project workspace.')}</p>
      <div class="project-footer">${p.url?`<a class="project-open" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${openLabel} ${icon('arrow-up-right')}</a>`:`<button type="button" class="project-open" data-edit-project="${esc(p.id)}">${openLabel} ${icon('arrow-right')}</button>`}
      ${state.projects.some(item=>item.id===p.id)?`<button class="project-edit" type="button" data-edit-project="${esc(p.id)}" aria-label="Edit ${esc(p.name)}" title="Edit project">${icon('edit')}</button>`:''}</div>
    </article>`;
  }
  function renderProjects(){
    $('#featured-projects').innerHTML=effectiveProjects().slice(0,3).map(cardHtml).join('') || `<div class="empty-state">${icon('folder')}<div><strong>No projects yet</strong><p>Create a project to put it on the dashboard.</p></div></div>`;
    const q=$('#project-search').value.trim().toLowerCase();const filtered=effectiveProjects().filter(p=>(p.name+' '+p.description).toLowerCase().includes(q));
    $('#all-projects').innerHTML=filtered.length?filtered.map(cardHtml).join(''):`<div class="empty-state">${icon('search')}<div><strong>Nothing found</strong><p>Try another search, or add a new project.</p></div></div>`;
    $('#project-summary').textContent=`${filtered.length} of ${effectiveProjects().length} projects`;
  }
  function dateDisplay(value){if(!value)return '';const d=new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  function taskMeta(t){return `${t.priority==='High'?'High priority':'Normal priority'}${t.due?' · '+dateDisplay(t.due):''}`;}
  function renderTasks(){
    const open=state.tasks.filter(t=>!t.done).sort((a,b)=>(a.priority==='High'?-1:1)-(b.priority==='High'?-1:1)||((a.due||'9999').localeCompare(b.due||'9999')));
    if(!window.ORBITConnectedTodoist || !window.ORBITConnectedTodoist.active()) {
      $('#nav-task-count').textContent=open.length;
    }
    const items=state.tasks.filter(t=>focusFilter==='all'||(focusFilter==='open'?!t.done:t.done)).sort((a,b)=>(a.done-b.done)||((a.priority==='High'?-1:1)-(b.priority==='High'?-1:1))||((a.due||'9999').localeCompare(b.due||'9999')));
    $('#focus-count').textContent=`${items.length} ${items.length===1?'item':'items'}`;
    $('#focus-list').innerHTML=items.length?items.map(t=>`<div class="focus-item${t.done?' done':''}"><input type="checkbox" class="task-check" aria-label="Mark ${esc(t.title)} ${t.done?'incomplete':'complete'}" data-check-task="${esc(t.id)}" ${t.done?'checked':''}><div><div class="task-name">${esc(t.title)}</div><div class="focus-sub"><span class="priority-pill ${t.priority==='High'?'high':''}">${esc(t.priority.toUpperCase())}</span>${t.due?`<span>Due ${esc(dateDisplay(t.due))}</span>`:''}</div></div><div class="focus-actions"><button type="button" data-edit-task="${esc(t.id)}" aria-label="Edit ${esc(t.title)}" title="Edit">${icon('edit')}</button><button type="button" data-delete-task="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Delete">${icon('trash')}</button></div></div>`).join(''):`<div class="empty-state" style="margin:16px 0">${icon('flag')}<div><strong>${focusFilter==='done'?'Nothing completed yet':'Nothing on this list'}</strong><p>${focusFilter==='done'?'Completed priorities show up here.':'Add a priority to get started.'}</p></div></div>`;
  }
  function renderLinks(){
    // GAIA plant count is managed by the external integration module.
    $('#settings-links').innerHTML=state.links.length?state.links.map(l=>`<div class="settings-link">${icon('link')}<span>${esc(l.name)}</span><button type="button" aria-label="Edit ${esc(l.name)}" data-edit-link="${esc(l.id)}" title="Edit">${icon('edit')}</button><button type="button" aria-label="Remove ${esc(l.name)}" data-delete-link="${esc(l.id)}" title="Remove">${icon('trash')}</button></div>`).join(''):'<span class="result-label">No custom shortcuts yet.</span>';
    const side=$('.sidebar-links');const pinned=`<a href="${esc(fuelProject.url)}" target="_blank" rel="noopener noreferrer">${icon('heart-pulse')} Ask FUEL ${icon('arrow-up-right')}</a>`;side.innerHTML=`<div class="nav-label">QUICK ACCESS</div>`+pinned+state.links.filter(l=>l.id!=='fuel'&&!l.url.includes('g-p-6acd6e86e82081919497cb8e044c60bd')).slice(0,5).map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon(l.name.toLowerCase().includes('github')?'github':l.name.toLowerCase().includes('todoist')?'list-check':'link')} ${esc(l.name)} ${icon('arrow-up-right')}</a>`).join('');
    side.querySelectorAll('a').forEach(a=>a.lastElementChild.classList.add('right-icon'));
  }
  function renderCount(){
    $('#nav-project-count').textContent=String(effectiveProjects().length).padStart(2,'0');
  }

  function localDay(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  const moneyFmt=n=>new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(n);
  function weekMonday(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return localDay(d);}
  function weekCount(r){const start=weekMonday();return (r.completions||[]).filter(d=>d>=start&&d<=localDay()).length;}
  function latestMetric(key){return [...state.checkins].filter(x=>x[key]!==null).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;}
  function nearestBill(b){const now=new Date();now.setHours(12,0,0,0);const inMonth=(year,month)=>new Date(year,month,Math.min(b.day,new Date(year,month+1,0).getDate()),12);
    let due=inMonth(now.getFullYear(),now.getMonth());if(due<now || b.paidMonths.includes(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`))due=inMonth(now.getFullYear(),now.getMonth()+1);
    return due;
  }
  function renderMoney(){
    const totals=state.accounts.reduce((sum,a)=>sum+a.balance,0); const show=state.balancesVisible;
    $('#money-total').textContent=!state.accounts.length?'No accounts':show?moneyFmt(totals):'••••••';
    $('#home-money').textContent=!state.accounts.length?'No accounts yet':show?moneyFmt(totals):`${state.accounts.length} account${state.accounts.length===1?'':'s'} tracked`;
    $('#home-money-note').textContent=state.accounts.length?(show?'Combined manual snapshots — not a live bank balance.':'Balances hidden • manual snapshots only'):'Add a manually tracked account to get started.';
    $('#money-asof').textContent=state.accounts.length?`Manually entered • latest snapshot ${dateDisplay(state.accounts.map(a=>a.asof).sort().at(-1))||'undated'}. These amounts may be stale.`:'Add an account to begin tracking. No live banking connection.';
    for(const el of ['#toggle-balance-money','#toggle-balance-home'])$(el).textContent=show?'Hide balances':'Show balances';
    $('#account-list').innerHTML=state.accounts.length?state.accounts.map(a=>`<article class="ledger-row"><div class="ledger-icon">${icon('wallet')}</div><div class="ledger-main"><h3>${esc(a.name)}</h3><div class="ledger-sub">Manual snapshot • ${a.asof?dateDisplay(a.asof):'No snapshot date'}</div></div><strong class="ledger-amount">${show?moneyFmt(a.balance):'••••••'}</strong><button class="small-icon-btn" type="button" data-edit-account="${esc(a.id)}" aria-label="Edit ${esc(a.name)}" title="Edit">${icon('edit')}</button><button class="small-icon-btn" type="button" data-delete-account="${esc(a.id)}" aria-label="Remove ${esc(a.name)}" title="Remove">${icon('trash')}</button></article>`).join(''):`<div class="empty-state">${icon('wallet')}<div><strong>No accounts entered.</strong><p>Use Add account to save a manual snapshot. No account numbers or passwords.</p></div></div>`;
    $('#monthly-bills-total').textContent=moneyFmt(state.bills.reduce((s,b)=>s+b.amount,0));
    const month=localDay().slice(0,7);
    $('#bill-list').innerHTML=state.bills.length?state.bills.slice().sort((a,b)=>nearestBill(a)-nearestBill(b)).map(b=>{const paid=b.paidMonths.includes(month);return `<article class="ledger-row"><div class="ledger-icon">${icon('list-check')}</div><div class="ledger-main"><h3>${esc(b.name)}</h3><div class="ledger-sub">Due day ${b.day} each month • ${paid?'Paid this month':'Next due '+dateDisplay(localDay(nearestBill(b)))}</div></div><strong class="ledger-amount">${moneyFmt(b.amount)}</strong><button type="button" class="quiet-pill" data-toggle-bill="${esc(b.id)}">${paid?'Undo paid':'Mark paid'}</button><button class="small-icon-btn" type="button" data-edit-bill="${esc(b.id)}" aria-label="Edit ${esc(b.name)}">${icon('edit')}</button><button class="small-icon-btn" type="button" data-delete-bill="${esc(b.id)}" aria-label="Remove ${esc(b.name)}">${icon('trash')}</button></article>`}).join(''):`<div class="empty-state">${icon('list-check')}<div><strong>No bills added yet.</strong><p>Add recurring monthly commitments and mark them paid each month.</p></div></div>`;
  }
  function renderHealth(){
    const checkins=state.checkins.slice().sort((a,b)=>b.date.localeCompare(a.date));const latest=checkins[0];
    $('#home-health').textContent=latest?`Last: ${dateDisplay(latest.date)}`:'No check-ins';
    $('#home-health-note').textContent=latest?`You have ${checkins.length} wellness log entr${checkins.length===1?'y':'ies'} saved locally.`:'Log weight, sleep, steps or mood at your own pace.';
    [['weight','lb'],['sleep','hr'],['steps','steps']].forEach(([k,unit])=>{const found=latestMetric(k);$('#health-'+k).textContent=found?(k==='steps'?found[k].toLocaleString():found[k])+` ${unit}`:'—';$('#health-'+k+'-date').textContent=found?`As logged ${dateDisplay(found.date)}`:'Not logged';});
    $('#health-history').innerHTML=checkins.length?checkins.slice(0,50).map(c=>{const tags=[c.weight!==null?c.weight+' lb':null,c.sleep!==null?c.sleep+' hr sleep':null,c.steps!==null?c.steps.toLocaleString()+' steps':null,c.mood||null].filter(Boolean);return `<article class="ledger-row"><div class="ledger-icon health-accent">${icon('heart-pulse')}</div><div class="ledger-main"><h3>${esc(dateDisplay(c.date))}</h3><div class="ledger-sub">${esc(tags.join(' · ')||'Notes only')}</div>${c.note?`<p class="ledger-note">${esc(c.note)}</p>`:''}</div><button class="small-icon-btn" type="button" data-edit-checkin="${esc(c.id)}" aria-label="Edit check-in">${icon('edit')}</button><button class="small-icon-btn" type="button" data-delete-checkin="${esc(c.id)}" aria-label="Delete check-in">${icon('trash')}</button></article>`}).join(''):`<div class="empty-state">${icon('heart-pulse')}<div><strong>Nothing logged yet.</strong><p>Add your first check-in; every field other than date is optional.</p></div></div>`;
  }
  function renderRoutines(){
    let completed=state.routines.reduce((sum,r)=>sum+Math.min(r.goal,weekCount(r)),0),target=state.routines.reduce((sum,r)=>sum+r.goal,0);
    $('#home-routines').textContent=`${completed} of ${target}`;
    $('#home-routines-note').textContent=state.routines.length?`${state.routines.length} routines • current week starts ${dateDisplay(weekMonday())}`:'Create a recurring routine to begin.';
    $('#routine-list').innerHTML=state.routines.length?state.routines.map(r=>{const n=weekCount(r),pct=Math.min(100,100*n/r.goal);return `<article class="routine-card module"><div class="routine-top"><div><div class="eyebrow small">WEEKLY GOAL</div><h3>${esc(r.name)}</h3><p class="watch-detail">${n} / ${r.goal} completed this week</p></div><div class="routine-actions"><button class="small-icon-btn" type="button" data-edit-routine="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">${icon('edit')}</button><button class="small-icon-btn" type="button" data-delete-routine="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">${icon('trash')}</button></div></div><div class="progress-track"><div style="width:${pct}%"></div></div><div class="routine-bottom"><button class="outline-button" type="button" data-complete-routine="${esc(r.id)}" ${n>=r.goal?'disabled':''}>${n>=r.goal?'Weekly goal complete':'Log one completion'}</button>${(r.completions||[]).includes(localDay())?`<button class="text-button" type="button" data-undo-routine="${esc(r.id)}">Undo today</button>`:''}</div></article>`}).join(''):`<div class="empty-state">${icon('repeat')}<div><strong>No routines configured</strong><p>Create a weekly routine and set a target.</p></div></div>`;
  }
  function renderAttention(){
    const notices=[];const today=localDay(); const due=state.tasks.filter(t=>!t.done&&t.due&&t.due<=today);
    if(due.length)notices.push({kind:'Priorities',text:`${due.length} task${due.length===1?' is':'s are'} due today or overdue`,view:'focus'});
    for(const r of state.routines){if(weekCount(r)<r.goal)notices.push({kind:'Routine',text:`${esc(r.name)}: ${weekCount(r)} of ${r.goal} this week`,view:'routines'});}
    $('#attention-items').innerHTML=notices.length?notices.slice(0,5).map(n=>`<button class="attention-row" type="button" data-view="${n.view}"><span class="attention-tag">${n.kind}</span><span>${n.text}</span>${icon('arrow-right')}</button>`).join(''):`<p class="watch-detail">Everything you have configured is on track. This doesn't include unconnected external services.</p>`;
  }
  function renderTheme(){document.body.dataset.theme=state.theme;$$('[data-theme-choice]').forEach(b=>{b.classList.toggle('selected',b.dataset.themeChoice===state.theme);b.setAttribute('aria-pressed',String(b.dataset.themeChoice===state.theme));});}
  function render(){renderProjects();renderTasks();renderLinks();renderCount();renderRoutines();renderAttention();renderTheme();$('#scratchpad').value=state.scratchpad;window.ORBITConnectedTodoist?.render();}
  function closeNavigation(){
    $('#sidebar').classList.remove('open');
    $('#nav-backdrop').hidden=true;
    $('#menu-button').setAttribute('aria-expanded','false');
    $('#mobile-more').setAttribute('aria-expanded','false');
  }
  function toggleNavigation(){
    const show=!$('#sidebar').classList.contains('open');
    $('#sidebar').classList.toggle('open',show);
    $('#nav-backdrop').hidden=!show;
    $('#menu-button').setAttribute('aria-expanded',String(show));
    $('#mobile-more').setAttribute('aria-expanded',String(show));
  }
  function setView(next){
    if(!['home','projects','focus','gaia','fuel','pulse','inbox','automations','routines','settings'].includes(next))return;
    view=next;
    $$('[data-panel]').forEach(x=>x.hidden=x.dataset.panel!==view);
    $('.main-nav [data-view], .mobile-nav [data-view]').forEach(x=>{x.classList.toggle('active',x.dataset.view===view);if(x.dataset.view===view)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
    const more=$('#mobile-more');
    more.classList.toggle('active',!['home','focus','projects','inbox'].includes(view));
    $('#current-crumb').textContent=({home:'OVERVIEW',projects:'PROJECTS',focus:'TASKS',gaia:'GAIA',fuel:'FUEL',pulse:'PULSE',inbox:'INBOX',automations:'AUTOMATIONS',routines:'ROUTINES',settings:'SETTINGS'})[view];
    closeNavigation();window.scrollTo({top:0,behavior:'instant'});
  }
  const field = (name,label,value='',type='text',other='') => `<label class="dialog-field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${other}></label>`;
  const select = (name,label,value,options) => `<label class="dialog-field">${label}<select name="${name}">${options.map(v=>`<option value="${esc(v.value)}" ${v.value===value?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>`;
  function openDialog(kind,editId=null){
    modalKind=kind;editingId=editId;let record;
    if(kind==='task')record=state.tasks.find(x=>x.id===editId)||{title:'',priority:'Normal',due:''};
    if(kind==='project')record=state.projects.find(x=>x.id===editId)||{name:'',description:'',type:'general',status:'Planned',url:''};
    if(kind==='link')record=state.links.find(x=>x.id===editId)||{name:'',url:''};
    if(kind==='account')record=state.accounts.find(x=>x.id===editId)||{name:'',balance:'',asof:localDay()};
    if(kind==='bill')record=state.bills.find(x=>x.id===editId)||{name:'',amount:'',day:1};
    if(kind==='checkin')record=state.checkins.find(x=>x.id===editId)||{date:localDay(),weight:'',sleep:'',steps:'',mood:'',note:''};
    if(kind==='routine')record=state.routines.find(x=>x.id===editId)||{name:'',goal:1};
    const title=({task:'priority',project:'project',link:'shortcut',account:'account snapshot',bill:'monthly bill',checkin:'health check-in',routine:'weekly routine'})[kind]||'item';
    $('#dialog-eyebrow').textContent=editId?'EDIT ITEM':'NEW ITEM';
    $('#dialog-title').textContent=(editId?'Edit ':'New ')+title;
    $('#dialog-submit').textContent=editId?'Save changes':'Create '+title;
    if(kind==='task')$('#dialog-fields').innerHTML=field('title','Next action',record.title,'text','required maxlength="160" placeholder="What needs to happen?"')+select('priority','Priority',record.priority,[{value:'Normal',label:'Normal'},{value:'High',label:'High'}])+field('due','Due date (optional)',record.due,'date');
    if(kind==='project')$('#dialog-fields').innerHTML=field('name','Project name',record.name,'text','required maxlength="80" placeholder="Project name"')+`<label class="dialog-field">What is it for?<textarea name="description" rows="3" maxlength="400" placeholder="One-line description">${esc(record.description)}</textarea></label>`+select('type','Category',record.type,[{value:'general',label:'General'},{value:'plants',label:'Plants'},{value:'world',label:'Worldbuilding'},{value:'stream',label:'Streaming / Creative'},{value:'work',label:'Work / Business'}])+select('status','Status',record.status,[{value:'Planned',label:'Planned'},{value:'In progress',label:'In progress'},{value:'Live',label:'Live'}])+field('url','Project link (optional)',record.url,'url','placeholder="https://..."')+`<span class="result-label">Paste a direct URL to the relevant app, site, or ChatGPT Project.</span>`;
    if(kind==='link')$('#dialog-fields').innerHTML=field('name','Shortcut label',record.name,'text','required maxlength="80" placeholder="For example, ChatGPT"')+field('url','Full website address',record.url,'url','required placeholder="https://..."');
    if(kind==='account')$('#dialog-fields').innerHTML=field('name','Account nickname',record.name,'text','required maxlength="80" placeholder="Checking, emergency savings, etc."')+field('balance','Balance snapshot ($)',record.balance,'number','required step="0.01" min="-100000000" max="100000000"')+field('asof','Snapshot date',record.asof,'date','required')+'<p class="result-label">Do not enter bank account numbers or passwords. This is a manual snapshot.</p>';
    if(kind==='bill')$('#dialog-fields').innerHTML=field('name','Bill name',record.name,'text','required maxlength="100" placeholder="Rent, internet, insurance..."')+field('amount','Monthly amount ($)',record.amount,'number','required min="0" step="0.01" max="100000000"')+field('day','Day of month due',record.day,'number','required min="1" max="31" step="1"');
    if(kind==='checkin')$('#dialog-fields').innerHTML=field('date','Date',record.date,'date','required')+field('weight','Weight (lb, optional)',record.weight??'','number','step="0.1" min="30" max="1000"')+field('sleep','Sleep (hours, optional)',record.sleep??'','number','step="0.1" min="0" max="24"')+field('steps','Steps (optional)',record.steps??'','number','step="1" min="0" max="100000"')+select('mood','How you felt (optional)',record.mood,[{value:'',label:'Not specified'},{value:'Great',label:'Great'},{value:'Good',label:'Good'},{value:'Okay',label:'Okay'},{value:'Low',label:'Low'}])+`<label class="dialog-field">Note (optional)<textarea name="note" maxlength="500" rows="3" placeholder="Anything you want to remember">${esc(record.note)}</textarea></label>`;
    if(kind==='routine')$('#dialog-fields').innerHTML=field('name','Routine name',record.name,'text','required maxlength="100" placeholder="Something to do every week"')+field('goal','Completions per week',record.goal,'number','required min="1" max="14" step="1"');
    const dialog=$('#item-dialog');if(!dialog.open)dialog.showModal();dialog.querySelector('input')?.focus();
  }
  function closeDialog(){$('#item-dialog').close();modalKind=null;editingId=null;}
  function saveDialog(e){
    e.preventDefault();const form=e.currentTarget;const data=new FormData(form);
    const named=(k,limit)=>safeText(String(data.get(k)||'').trim(),limit);
    let entry;
    if(modalKind==='task'){
      if(!named('title',160))return toast('Please enter a task title.');
      entry={id:editingId||id(),title:named('title',160),priority:data.get('priority')==='High'?'High':'Normal',due:/^\d{4}-\d{2}-\d{2}$/.test(named('due',10))?named('due',10):'',done:state.tasks.find(x=>x.id===editingId)?.done||false,created:state.tasks.find(x=>x.id===editingId)?.created||new Date().toISOString()};
      if(editingId)state.tasks=state.tasks.map(x=>x.id===editingId?entry:x);else state.tasks.unshift(entry);
    } else if(modalKind==='project'){
      if(!named('name',80))return toast('Please name the project.');
      const rawUrl=named('url',500);const url=safeUrl(rawUrl);if(rawUrl&&!url)return toast('Use a valid http or https link.');
      entry={id:editingId||id(),name:named('name',80),description:named('description',400),type:['plants','world','stream','work','general'].includes(data.get('type'))?data.get('type'):'general',status:['Live','In progress','Planned'].includes(data.get('status'))?data.get('status'):'Planned',url};
      if(editingId)state.projects=state.projects.map(x=>x.id===editingId?entry:x);else state.projects.push(entry);
    } else if(modalKind==='link'){
      const url=safeUrl(named('url',500));if(!named('name',80))return toast('Please give the shortcut a name.');if(!url)return toast('Use a valid http or https link.');
      entry={id:editingId||id(),name:named('name',80),url};
      if(editingId)state.links=state.links.map(x=>x.id===editingId?entry:x);else state.links.push(entry);
    } else if(modalKind==='account'){
      if(!named('name',80))return toast('Name the account.');const raw=Number(data.get('balance'));if(String(data.get('balance')||'').trim()===''||!Number.isFinite(raw)||Math.abs(raw)>1e8)return toast('Please enter a valid balance.');
      entry={id:editingId||id(),name:named('name',80),balance:Math.round(raw*100)/100,asof:named('asof',10)||localDay()};
      if(editingId)state.accounts=state.accounts.map(x=>x.id===editingId?entry:x);else state.accounts.push(entry);
    } else if(modalKind==='bill'){
      if(!named('name',100))return toast('Name the bill.');const amount=Number(data.get('amount'));const day=Number(data.get('day'));
      if(!Number.isFinite(amount)||amount<0||amount>1e8||!Number.isInteger(day)||day<1||day>31)return toast('Enter a valid amount and day of the month.');
      entry={id:editingId||id(),name:named('name',100),amount:Math.round(amount*100)/100,day,paidMonths:state.bills.find(x=>x.id===editingId)?.paidMonths||[]};
      if(editingId)state.bills=state.bills.map(x=>x.id===editingId?entry:x);else state.bills.push(entry);
    } else if(modalKind==='checkin'){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(named('date',10)))return toast('Choose a date.');
      const getMeasure=(k,mi,ma)=>{let val=named(k,30);if(!val)return null;return validMeasure(val,mi,ma)};
      const weight=getMeasure('weight',30,1000),sleep=getMeasure('sleep',0,24),steps=getMeasure('steps',0,100000);
      if((named('weight',30)&&weight===null)||(named('sleep',30)&&sleep===null)||(named('steps',30)&&steps===null))return toast('Please check your measurements.');
      entry={id:editingId||id(),date:named('date',10),weight,sleep,steps,mood:named('mood',20),note:named('note',500)};
      if(editingId)state.checkins=state.checkins.map(x=>x.id===editingId?entry:x);else state.checkins.push(entry);
    } else if(modalKind==='routine'){
      const goal=Number(data.get('goal'));if(!named('name',100)||!Number.isInteger(goal)||goal<1||goal>14)return toast('Enter a name and weekly goal from 1 to 14.');
      entry={id:editingId||id(),name:named('name',100),goal,completions:state.routines.find(x=>x.id===editingId)?.completions||[]};
      if(editingId)state.routines=state.routines.map(x=>x.id===editingId?entry:x);else state.routines.push(entry);
    } else return;
    persist();closeDialog();render();toast('Saved to this browser.');
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`orbit-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup downloaded.');
  }
  async function importBackup(file){
    if(!file)return;if(file.size>2_000_000)return toast('The backup file is too large.');
    try{const incoming=normalized(JSON.parse(await file.text()));if(!window.confirm('Replace the ORBIT data currently stored in this browser with this backup?'))return;state=incoming;persist();render();toast('Backup restored.');}
    catch(e){toast('Could not import backup: '+e.message);}
    finally{$('#import-data').value='';}
  }
  function wire(){
    $$('[data-icon]').forEach(x=>{const classes=x.getAttribute('class');x.outerHTML=icon(x.dataset.icon).replace('<svg ',`<svg${classes?' class=\"'+esc(classes)+'\"':''} `);});
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
      const action=e.target.closest('[data-action]');if(action){openDialog(({ 'add-task':'task','add-project':'project','add-link':'link','add-account':'account','add-bill':'bill','add-checkin':'checkin','add-routine':'routine'})[action.dataset.action]);return;}
      const editProject=e.target.closest('[data-edit-project]');if(editProject){openDialog('project',editProject.dataset.editProject);return;}
      const editTask=e.target.closest('[data-edit-task]');if(editTask){openDialog('task',editTask.dataset.editTask);return;}
      const editLink=e.target.closest('[data-edit-link]');if(editLink){openDialog('link',editLink.dataset.editLink);return;}
      const deleteTask=e.target.closest('[data-delete-task]');if(deleteTask){const t=state.tasks.find(x=>x.id===deleteTask.dataset.deleteTask);if(t&&confirm(`Delete "${t.title}"?`)){state.tasks=state.tasks.filter(x=>x.id!==t.id);persist();renderTasks();toast('Priority deleted.');}return;}
      const deleteLink=e.target.closest('[data-delete-link]');if(deleteLink){const l=state.links.find(x=>x.id===deleteLink.dataset.deleteLink);if(l&&confirm(`Remove shortcut "${l.name}"?`)){state.links=state.links.filter(x=>x.id!==l.id);persist();renderLinks();toast('Shortcut removed.');}return;}
      const filter=e.target.closest('[data-filter]');if(filter){focusFilter=filter.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===filter));renderTasks();return;}

      const entityEdits=[['account','account'],['bill','bill'],['checkin','checkin'],['routine','routine']];
      for(const [attr,kind] of entityEdits){const btn=e.target.closest(`[data-edit-${attr}]`);if(btn){openDialog(kind,btn.dataset[`edit${attr.charAt(0).toUpperCase()+attr.slice(1)}`]);return;}}
      for(const [attr,key] of [['account','accounts'],['bill','bills'],['checkin','checkins'],['routine','routines']]){
        const btn=e.target.closest(`[data-delete-${attr}]`);if(btn){const selected=state[key].find(x=>x.id===btn.dataset[`delete${attr.charAt(0).toUpperCase()+attr.slice(1)}`]);if(selected&&confirm(`Delete ${selected.name||selected.date}?`)){state[key]=state[key].filter(x=>x!==selected);persist();render();toast('Entry removed.');}return;}
      }
      const balanceBtn=e.target.closest('#toggle-balance-money, #toggle-balance-home');if(balanceBtn){state.balancesVisible=!state.balancesVisible;persist();renderMoney();return;}
      const bill=e.target.closest('[data-toggle-bill]');if(bill){const found=state.bills.find(x=>x.id===bill.dataset.toggleBill);if(found){const month=localDay().slice(0,7);found.paidMonths=found.paidMonths.includes(month)?found.paidMonths.filter(x=>x!==month):[...found.paidMonths,month];persist();renderMoney();renderAttention();}return;}
      const routine=e.target.closest('[data-complete-routine]');if(routine){const found=state.routines.find(x=>x.id===routine.dataset.completeRoutine);if(found&&weekCount(found)<found.goal){found.completions.push(localDay());persist();renderRoutines();renderAttention();}return;}
      const undo=e.target.closest('[data-undo-routine]');if(undo){const found=state.routines.find(x=>x.id===undo.dataset.undoRoutine);if(found){const at=found.completions.lastIndexOf(localDay());if(at>=0)found.completions.splice(at,1);persist();renderRoutines();renderAttention();}return;}
      const theme=e.target.closest('[data-theme-choice]');if(theme){state.theme=theme.dataset.themeChoice;persist();renderTheme();return;}
    });
    document.addEventListener('change',e=>{const check=e.target.closest('[data-check-task]');if(check){const t=state.tasks.find(x=>x.id===check.dataset.checkTask);if(t){t.done=check.checked;persist();renderTasks();renderAttention();toast(check.checked?'Priority completed.':'Priority reopened.');}}});
    $('#project-search').addEventListener('input',renderProjects);
    $('#scratchpad').addEventListener('input',e=>{state.scratchpad=e.target.value.slice(0,50000);persist();$('#note-saved').textContent='Saved';});
    $('#item-form').addEventListener('submit',saveDialog);
    $('#dialog-close').addEventListener('click',closeDialog);$('#dialog-cancel').addEventListener('click',closeDialog);
    $('#export-data').addEventListener('click',exportBackup);
    $('#import-data').addEventListener('change',e=>importBackup(e.target.files[0]));
    $('#reset-data').addEventListener('click',()=>{if(confirm('Reset this ORBIT workspace? If cloud sync is enabled, the reset will also sync to other devices. Export a backup and pause cloud sync first if you want to retain your cloud data.')){state=defaultState();persist();render();setView('home');toast('Workspace reset.');}});
    $('#menu-button').addEventListener('click',toggleNavigation);
    $('#mobile-more').addEventListener('click',toggleNavigation);
    $('#nav-backdrop').addEventListener('click',closeNavigation);
    window.addEventListener('resize',()=>{if(window.innerWidth>980)closeNavigation();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNavigation();});
    window.addEventListener('storage',e=>{if(e.key===currentKey()&&currentKey()){state=load();render();toast('Updated from another tab.');}});
    $('#orbit-import-legacy').addEventListener('click',()=>{
      if(!accountId)return;
      const legacy=localStorage.getItem(LEGACY_KEY);if(!legacy)return;
      if(!confirm('Import older browser-local ORBIT data into this signed-in account? Current account-specific data will be replaced. The older copy stays on this device.'))return;
      try{state=normalized(JSON.parse(legacy));persist();render();updateLegacyButton();toast('Earlier ORBIT data imported.');}
      catch(err){toast('Old ORBIT data could not be imported: '+err.message);}
    });
    document.addEventListener('orbit:auth-changed',e=>{
      accountId=e.detail?.user?.id||'';state=load();focusFilter='open';render();setView('home');updateLegacyButton();
    });
  }
  function updateLegacyButton(){
    const el=$('#orbit-import-legacy');
    el.hidden=!(accountId&&!localStorage.getItem(currentKey())&&localStorage.getItem(LEGACY_KEY));
  }
  function initDate(){
    const d=new Date();
    $('#topbar-date').textContent=d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase();
    $('#home-date').textContent=d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    const greeting=d.getHours()<11?'Good morning.':d.getHours()<17?'Good afternoon.':'Good evening.';
    $('#home-greeting').innerHTML=greeting.replace('.','<span class="accent-period">.</span>');
  }
  window.ORBITLocal = Object.freeze({
    getOwner:()=>accountId,
    snapshot:()=>JSON.parse(JSON.stringify(state)),
    setFromCloud:(incoming,expectedOwner)=>{
      if(!expectedOwner || expectedOwner!==accountId)throw new Error('Account changed; cloud state was not loaded.');
      const clean=normalized(incoming);
      const key=currentKey();
      if(!key)throw new Error('Sign in before restoring cloud data.');
      state=clean;
      localStorage.setItem(key,JSON.stringify(state));
      render();
      updateLegacyButton();
      return true;
    }
  });
    wire();render();initDate();setView('home');
  if(window.ORBITAuth?.user){accountId=window.ORBITAuth.user.id;state=load();render();updateLegacyButton();}
})();