/* Read-only, owner-authenticated Celestial Almanac. */
(() => {
  'use strict';
  const root=document.getElementById('sanctum-almanac');
  if(!root)return;
  const zone='America/Los_Angeles';
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
  const today=()=>{const parts=Object.fromEntries(fmt.formatToParts(new Date()).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day;};
  const shift=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
  const label=(d,options)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',...options});
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const detail=root.querySelector('[data-almanac-detail]'), preview=document.getElementById('almanac-week-preview');
  const fallback=()=>({today:today(),selected:today(),days:Array.from({length:7},(_,i)=>shift(today(),i)),mode:'week'});
  let selection=window.ORBITCalendar?.getSelection?.()||fallback(),rows=new Map(),request=0,lastKey='';
  // Curated interpretive reference, not claims of physical effects.
  const comparative='https://occultcalendar.com/correspondences/';
  const theurgy='https://www.planetarytheurgy.com/correspondences.html';
  const planetary='https://planetaryhours.org/blog/planetary-hours-for-magic';
  const colorSource='https://arachnefiberworks.com/correspondences/color';
  const herbSource='https://esotericwitch.com/witchcraft/herbs/';
  const lunarSource='https://www.llewellyn.com/blog/2022/10/witches-and-the-moon/';
  const planets=[
    ['Sun','Sunday','Confidence, creativity and recognition','gold','frankincense','rosemary','citrine','fire'],
    ['Moon','Monday','Dreams, emotional reflection and cycles','silver','jasmine','willow','moonstone','water'],
    ['Mars','Tuesday','Resolve, protection and courageous action','red',"dragon's blood",'ginger','garnet','fire'],
    ['Mercury','Wednesday','Study, conversation and resourcefulness','orange','mastic','lavender','agate','air'],
    ['Jupiter','Thursday','Opportunity, generosity and learning','blue','cedar','sage','amethyst','air / fire'],
    ['Venus','Friday','Affection, art and harmony','green','rose','thyme','rose quartz','earth / water'],
    ['Saturn','Saturday','Limits, patience and endings','black','myrrh','cypress','obsidian','earth']
  ];
  const names={ruler:'Planetary ruler',color:'Color',incense:'Incense',herb:'Herb',stone:'Stone',element:'Element'};
  const colors={red:'Courage, passion and purposeful action.',gold:'Achievement, warmth and confidence.',silver:'Reflection and lunar symbolism.',orange:'Creative energy and communication.',blue:'Calm, understanding and trust.',green:'Growth, renewal and affection.',black:'Boundaries, protection and closure.',white:'Clarity and fresh starts.',purple:'Wisdom and spiritual exploration.',pink:'Kindness and affection.',yellow:'Joy and confidence.'};
  const elements={fire:'Action, transformation and enthusiasm.',water:'Emotion, intuition and adaptability.',air:'Thought, communication and learning.',earth:'Stability, practical effort and grounding.'};
  const normalized=v=>String(v).trim().toLowerCase().replace(/’/g,"'");
  function explain(key,value){
    const v=normalized(value);
    if(key==='phase'){
      const theme=v.includes('full')?'Fulfillment and review.':v.includes('new')?'Beginnings and setting intentions.':v.includes('waning')||v.includes('last quarter')||v.includes('third quarter')?'Letting go and reflecting on what is finished.':v.includes('waxing')||v.includes('first quarter')?'Cultivating an intention through practical effort.':null;
      return {text:theme||'Lunar phases are used as symbolic markers for cycles of change.',sources:[['Llewellyn: Witches and the Moon',lunarSource]]};
    }
    if(key==='ruler'){
      const p=planets.find(p=>normalized(p[0])===v);
      if(p)return {text:p[0]+' traditionally governs '+p[1]+' in the classical planetary weekday system. Symbolic themes: '+p[2]+'. This is a weekday association, not a claim about current planetary position.',sources:[['Planetary correspondences',planetary],['Historical correspondence overview',theurgy]]};
    }
    if(key==='color'&&Object.hasOwn(colors,v))return {text:colors[v]+' Consider wearing or displaying the color as a reminder of an intention.',sources:[['Color correspondences',colorSource],['Planetary correspondence table',comparative]]};
    if(key==='element'){
      const parts=v.split('/').map(x=>x.trim());
      if(parts.every(x=>Object.hasOwn(elements,x)))return {text:parts.map(x=>x[0].toUpperCase()+x.slice(1)+': '+elements[x]).join(' ')+' These are symbolic classical elements.',sources:[['Planetary correspondence table',comparative]]};
    }
    const pos={incense:4,herb:5,stone:6}[key];
    const p=pos===undefined?null:planets.find(p=>normalized(p[pos])===v);
    if(p){
      const context=value+' is associated with '+p[0]+' in some correspondence systems. In that context it can symbolize '+p[2].toLowerCase()+'.';
      const use=key==='incense'?' You can use the name or scent as a symbolic cue; burning is optional.':key==='herb'?' Consider it as a botanical symbol, not a medicinal or ingestion recommendation.':' Keep it as a visual or tactile reminder of an intention.';
      const sources=key==='incense'?[['Planetary incense correspondences',theurgy]]:key==='herb'&&['rosemary','thyme'].includes(v)?[['Herbal correspondences',herbSource]]:[['Comparative planetary correspondences',comparative]];
      return {text:context+use,sources};
    }
    return {text:'No individual reference entry is available yet. Consult the saved daily sources for the tradition behind this selection.',sources:[]};
  }
  function referenceLink(name,url){
    try{const u=new URL(url);if(u.protocol!=='https:')return null;const a=el('a',name||u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}
  }
  const expanded=new Set();
  function clickable(key,value,row){
    const identity=row.event_date+'|'+key+'|'+String(value);
    const d=el('details',null,'almanac-explainer'),summary=el('summary',String(value));
    d.open=expanded.has(identity);summary.setAttribute('aria-label',String(value)+' — more information');d.append(summary);
    const info=explain(key,value),body=el('div',null,'almanac-explainer-body');body.append(el('p',info.text));
    body.append(el('small','Traditional symbolism; associations vary by practice.'));
    const sources=info.sources.length?info.sources:(Array.isArray(row.sources)?row.sources.map(s=>[s.purpose,s.url]):[]);
    for(const [name,url] of sources){const link=referenceLink(name,url);if(link){const line=el('div');line.append(link);body.append(line);}}
    d.append(body);d.addEventListener('toggle',()=>{if(d.open)expanded.add(identity);else expanded.delete(identity);});return d;
  }
  function renderCorrespondences(target,row){
    const c=row.correspondences||{},dl=el('dl',null,'almanac-correspondences');
    for(const [key,name] of Object.entries(names)){if(c[key]){const cell=el('div'),dd=el('dd');dd.append(clickable(key,c[key],row));cell.append(el('dt',name),dd);dl.append(cell);}}
    if(dl.childElementCount)target.append(dl);
  }
  function render(){
    detail.replaceChildren();const r=rows.get(selection.today);
    if(!r){detail.append(el('p','No saved guidance for today.','watch-detail'));return;}
    const a=r.astronomy||{},c=r.correspondences||{};
    if(a.moon_phase)detail.append(clickable('phase',a.moon_phase,r));
    renderCorrespondences(detail,r);
    for(const ev of Array.isArray(r.events)?r.events:[]){detail.append(el('p',[ev.title,ev.time].filter(Boolean).join(' · '),'watch-detail'));}
    detail.append(el('h4','Daily recommendation'),el('p',r.recommendation));
    if(r.personal_connection){detail.append(el('h4','From the Book of Shadows'),el('p',r.personal_connection));}
    if(c.basis)detail.append(el('p',c.basis,'watch-detail'));
    if(a.basis)detail.append(el('p',a.basis,'watch-detail'));
    const refs=el('details');refs.append(el('summary','Sources'));
    for(const s of Array.isArray(r.sources)?r.sources:[]){try{const url=new URL(s.url);if(url.protocol!=='https:')continue;const p=el('p'),link=el('a',s.purpose||url.hostname);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';p.append(link);refs.append(p);}catch{}}
    if(refs.childElementCount>1)detail.append(refs);
  }
  function renderPreview(){
    if(!preview)return;
    preview.replaceChildren();
    const chosen=selection.selected, r=rows.get(chosen);
    if(chosen!==selection.today){
      preview.append(el('h4','Celestial outlook'));
      if(r){const phase=r.astronomy?.moon_phase;if(phase)preview.append(clickable('phase',phase,r));renderCorrespondences(preview,r);preview.append(el('p',r.recommendation,'watch-detail'));}
      else preview.append(el('p','No saved guidance for this date.','watch-detail'));
    }
    const upcoming=selection.days.filter(d=>d>=selection.today).flatMap(d=>(Array.isArray(rows.get(d)?.events)?rows.get(d).events:[]).map(event=>({d,event})));
    if(upcoming.length){preview.append(el('h4','Celestial events'));for(const {d,event} of upcoming.slice(0,6))preview.append(el('p',label(d,{weekday:'short',month:'short',day:'numeric'})+' · '+event.title,'watch-detail'));}
  }
  async function load(force=false){
    const dates=[...new Set([selection.today,...selection.days])];
    const key=dates.join('|');
    if(!force&&key===lastKey){render();renderPreview();return;}
    lastKey=key;const seq=++request;rows=new Map();detail.replaceChildren(el('p','Loading your Almanac…','watch-detail'));preview?.replaceChildren();
    const auth=window.ORBITAuth;if(!auth)return;await auth.ready;
    if(seq!==request)return;
    const uid=auth.user?.id;if(!uid||!auth.client){detail.replaceChildren(el('p','Sign in to view your private Almanac.','watch-detail'));return;}
    try{
      const {data,error}=await auth.client.from('sanctum_almanac').select('event_date,astronomy,correspondences,events,recommendation,personal_connection,sources').eq('owner_id',uid).in('event_date',dates).order('event_date');
      if(seq!==request||uid!==auth.user?.id)return;if(error)throw error;
      rows=new Map((data||[]).map(r=>[r.event_date,r]));render();renderPreview();
    }catch{if(seq===request){lastKey='';detail.replaceChildren(el('p','Almanac unavailable. Try refreshing.','watch-detail'));}}
  }
  document.addEventListener('orbit:calendar-selection',e=>{selection=e.detail;void load();});
  document.addEventListener('orbit:auth-changed',()=>{void load(true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){selection=window.ORBITCalendar?.getSelection?.()||fallback();void load(true);}});
  void load(true);
})();