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
  function render(){
    detail.replaceChildren();const r=rows.get(selection.today);
    if(!r){detail.append(el('p','No saved guidance for today.','watch-detail'));return;}
    const a=r.astronomy||{},c=r.correspondences||{};
    if(a.moon_phase)detail.append(el('p',a.moon_phase,'almanac-phase'));
    const dl=el('dl',null,'almanac-correspondences');
    for(const [key,name] of Object.entries({ruler:'Planetary ruler',color:'Color',incense:'Incense',herb:'Herb',stone:'Stone',element:'Element'})){if(c[key]){const cell=el('div');cell.append(el('dt',name),el('dd',c[key]));dl.append(cell);}}
    if(dl.childElementCount)detail.append(dl);
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
      if(r){const phase=r.astronomy?.moon_phase;if(phase)preview.append(el('p',phase,'watch-detail'));preview.append(el('p',r.recommendation,'watch-detail'));}
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