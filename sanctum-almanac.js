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
  const days=root.querySelector('[data-almanac-days]'), detail=root.querySelector('[data-almanac-detail]'), period=root.querySelector('[data-almanac-period]');
  let start=today(),selected=start,rows=new Map(),request=0;
  function render(){
    period.textContent=label(start,{month:'short',day:'numeric'})+' – '+label(shift(start,6),{month:'short',day:'numeric'});
    days.replaceChildren();
    for(let i=0;i<7;i++){const d=shift(start,i),b=el('button',label(d,{weekday:'short',day:'numeric'}),'quiet-pill almanac-day');b.type='button';b.setAttribute('aria-pressed',String(d===selected));b.addEventListener('click',()=>{selected=d;render();});days.append(b);}
    detail.replaceChildren();const r=rows.get(selected);
    detail.append(el('h3',label(selected,{weekday:'long',month:'long',day:'numeric'})));
    if(!r){detail.append(el('p','No saved guidance for this date.','watch-detail'));return;}
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
  async function load(){
    const seq=++request;rows=new Map();render();const auth=window.ORBITAuth;
    if(!auth)return;await auth.ready;
    if(seq!==request)return;
    const uid=auth.user?.id;if(!uid||!auth.client){detail.replaceChildren(el('p','Sign in to view your private Almanac.','watch-detail'));return;}
    detail.replaceChildren(el('p','Loading your Almanac…','watch-detail'));
    try{const {data,error}=await auth.client.from('sanctum_almanac').select('event_date,astronomy,correspondences,events,recommendation,personal_connection,sources').eq('owner_id',uid).gte('event_date',start).lte('event_date',shift(start,6)).order('event_date');if(seq!==request||uid!==auth.user?.id)return;if(error)throw error;rows=new Map((data||[]).map(r=>[r.event_date,r]));render();}catch{if(seq===request)detail.replaceChildren(el('p','Almanac unavailable. Try refreshing.','watch-detail'));}
  }
  root.querySelector('[data-almanac-prev]').addEventListener('click',()=>{start=shift(start,-7);selected=start;void load();});
  root.querySelector('[data-almanac-next]').addEventListener('click',()=>{start=shift(start,7);selected=start;void load();});
  root.querySelector('[data-almanac-today]').addEventListener('click',()=>{start=today();selected=start;void load();});
  document.addEventListener('orbit:auth-changed',()=>{void load();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  void load();
})();