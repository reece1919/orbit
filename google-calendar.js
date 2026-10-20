/* ORBIT Google Calendar: read-only OAuth integration; event data stays in browser memory. */
(()=>{
 'use strict';
 const BRIDGE='https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/orbit-google-calendar';
 const $=s=>document.querySelector(s);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let owner='',connected=false,configured=false,email='',busy=false,calendarOptions=[],selected=[],items=[],rangeStart='',rangeEnd='',loaded=false,needsRange=null,error='',lastSync='';
 const stamp=s=>{const d=new Date(s);return Number.isNaN(d.valueOf())?'':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
 const emit=()=>document.dispatchEvent(new CustomEvent('orbit:google-calendar-changed'));
 function info(){return {connected,configured,email,busy,error,lastSync,selected:[...selected],calendars:[...calendarOptions]}}
 async function request(action,extra={}){
  const auth=window.ORBITAuth;
  if(!auth?.user||!auth.client)throw new Error('Sign in to ORBIT to use Google Calendar.');
  const {data,error:authError}=await auth.client.auth.getSession();
  if(authError||!data?.session?.access_token)throw new Error('Your ORBIT session expired. Sign in again.');
  const res=await fetch(BRIDGE,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+data.session.access_token},body:JSON.stringify({action,...extra})});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(payload.error||'Google Calendar service unavailable ('+res.status+').');
  return payload;
 }
 function renderConnection(){
  const status=$('#cal-google-status'),connect=$('#cal-google-connect'),reload=$('#cal-google-refresh'),disconnect=$('#cal-google-disconnect');
  if(!status)return;
  status.textContent=!owner?'Sign in to connect a Google Calendar.':
   busy?(connected?'Refreshing Google Calendar…':'Checking Google Calendar connection…'):
   error?error:!configured?'Google Calendar setup required: configure Google OAuth credentials in Supabase.':
   connected?'Connected to '+email+' · Read only'+(lastSync?' · Updated '+stamp(lastSync):''):
   'Not connected · Google events will appear alongside ORBIT events and Todoist tasks.';
  connect.hidden=!owner||connected;connect.disabled=busy||!configured;
  connect.textContent=connected?'Connected':'Connect Google Calendar';
  reload.hidden=!owner||!connected;reload.disabled=busy;
  disconnect.hidden=!owner||!connected;disconnect.disabled=busy;
  const picker=$('#cal-google-calendars');
  if(picker){
   picker.hidden=!owner||!connected||!calendarOptions.length;
   const inputs=calendarOptions.map(cal=>{
    const checked=selected.includes(cal.id)||(selected.includes('primary')&&cal.primary);
    return '<label class="cal-google-cal-choice"><input type="checkbox" value="'+esc(cal.id)+'" data-cal-google-calendar '+(checked?'checked':'')+'><span>'+esc(cal.name)+(cal.primary?' (primary)':'')+'</span></label>';
   }).join('');
   picker.innerHTML='<span class="cal-google-pick-title">Show calendars</span><div class="cal-google-cal-list">'+inputs+'</div><button type="button" id="cal-google-save" class="cal-button" '+(busy?'disabled':'')+'>Save calendar selection</button>';
  }
 }
 async function check(){
  const current=owner;
  if(!current)return;
  busy=true;error='';renderConnection();
  try{
   const status=await request('status');
   if(owner!==current)return;
   connected=!!status.connected;configured=!!status.configured;email=status.email||'';
   selected=Array.isArray(status.selected)?status.selected:[];
   if(connected){
    const list=await request('calendars');if(owner!==current)return;
    calendarOptions=Array.isArray(list.items)?list.items:[];selected=Array.isArray(list.selected)?list.selected:selected;
   }else{items=[];loaded=false;calendarOptions=[];lastSync=''}
   const param=new URL(window.location.href).searchParams.get('google_calendar');
   if(param){
    const clean=new URL(window.location.href);clean.searchParams.delete('google_calendar');
    window.history.replaceState(null,'',clean.pathname+clean.search+clean.hash);
    if(param==='connected'&&connected){
     const tab=document.querySelector('.main-nav [data-view="calendar"]')||document.querySelector('[data-view="calendar"]');
     tab?.click();
    }else if(param==='denied')error='Google authorization was canceled.';
    else if(param==='unconfigured')error='Google authorization is not configured yet.';
    else if(param!=='connected')error='Google authorization did not finish. Please try connecting again.';
   }
  }catch(e){if(owner===current)error=e.message||'Connection check failed.'}
  finally{if(owner===current){busy=false;renderConnection();emit();if(connected&&needsRange)void ensureRange(...needsRange)}}
 }
 async function begin(){
  if(busy)return;
  busy=true;error='';renderConnection();
  try{
   const data=await request('start');
   const url=new URL(data.authorization_url);
   if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw new Error('Unexpected Google sign-in page.');
   window.location.assign(url.href);
  }catch(e){error=e.message;busy=false;renderConnection()}
 }
 async function disconnect(){
  if(busy||!connected)return;
  if(!window.confirm('Disconnect Google Calendar from ORBIT? Your Google events will be hidden; no Google calendar events will be deleted.'))return;
  busy=true;renderConnection();
  try{
   await request('disconnect');
   connected=false;email='';items=[];selected=[];calendarOptions=[];loaded=false;lastSync='';error='';
  }catch(e){error=e.message}
  finally{busy=false;renderConnection();emit()}
 }
 async function save(){
  const ids=[...document.querySelectorAll('[data-cal-google-calendar]:checked')].map(x=>x.value);
  if(!ids.length){error='Select at least one Google calendar.';renderConnection();return}
  busy=true;error='';renderConnection();
  try{
   await request('select_calendars',{calendar_ids:ids});
   selected=ids;loaded=false;items=[];lastSync='';
  }catch(e){error=e.message}
  finally{busy=false;renderConnection();emit();if(connected&&needsRange)void ensureRange(...needsRange)}
 }
 function localDay(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 function nextDay(day){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+1);return localDay(d)}
 function toDays(event){
  if(!event.start)return [];
  const start=event.allDay?String(event.start).slice(0,10):localDay(new Date(event.start));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return [];
  let last=start;
  if(event.end){
   if(event.allDay){const e=String(event.end).slice(0,10);const d=new Date(e+'T12:00:00');d.setDate(d.getDate()-1);last=localDay(d)}
   else{const ts=Date.parse(event.end);if(Number.isFinite(ts))last=localDay(new Date(ts-1))}
  }
  const values=[];
  for(let d=start;d<=last&&values.length<72;d=nextDay(d))values.push(d);
  return values.length?values:[start];
 }
 function events(){
  return items.flatMap(event=>toDays(event).map(date=>({
   kind:'google',date,title:event.title||'(Untitled event)',id:event.calendarId+':'+event.id,
   time:event.allDay?'All day':new Date(event.start).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}),
   source:'google',event
  })));
 }
 async function ensureRange(start,end,force=false){
  if(!connected)return;
  needsRange=[start,end];
  if(!force&&loaded&&rangeStart<=start&&rangeEnd>=end)return;
  if(busy)return;
  const current=owner;
  busy=true;error='';renderConnection();
  try{
   const begin=new Date(start+'T00:00:00'),finish=new Date(end+'T00:00:00');
   const result=await request('events',{start:begin.toISOString(),end:finish.toISOString()});
   if(owner!==current)return;
   items=Array.isArray(result.items)?result.items:[];rangeStart=start;rangeEnd=end;loaded=true;lastSync=result.synced_at||new Date().toISOString();
   if(result.incomplete)error='Google Calendar returned a partial result. Some events may be missing.';
  }catch(e){if(owner===current)error=e.message||'Calendar refresh failed.'}
  finally{
   if(owner===current){
    busy=false;renderConnection();emit();
    if(needsRange&&(rangeStart>needsRange[0]||rangeEnd<needsRange[1]))void ensureRange(...needsRange);
   }
  }
 }
 $('#cal-google-connect')?.addEventListener('click',begin);
 $('#cal-google-refresh')?.addEventListener('click',()=>{loaded=false;items=[];lastSync='';if(needsRange)void ensureRange(...needsRange);else void check()});
 $('#cal-google-disconnect')?.addEventListener('click',disconnect);
 $('#cal-google-calendars')?.addEventListener('click',e=>{if(e.target.closest('#cal-google-save'))void save()});
 document.addEventListener('orbit:auth-changed',e=>{
  const id=e.detail?.user?.id||'';
  if(id===owner)return;
  owner=id;connected=false;configured=false;email='';busy=false;calendarOptions=[];selected=[];items=[];rangeStart='';rangeEnd='';loaded=false;error='';lastSync='';
  renderConnection();emit();if(owner)void check();
 });
 window.ORBITGoogleCalendar=Object.freeze({ensureRange,getEvents:events,getStatus:info});
 renderConnection();
 window.ORBITAuth?.ready?.then(()=>{const id=window.ORBITAuth.user?.id||'';if(id!==owner){owner=id;renderConnection();if(id)void check()}});
})();
