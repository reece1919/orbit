/* ORBIT SIGNALS v1.1 — private, dated snapshots of Gmail unread and ChatGPT recurring tasks.
   These are NOT direct live integrations. This client only reads owner-restricted Supabase rows. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const MODULES=["gmail_unread","chatgpt_recurring"];
const MAILBOXES=[
 {email:"reece1919@gmail.com",label:"Personal"},
 {email:"controlleddriftonline@gmail.com",label:"Controlled Drift"},
 {email:"passporter19@gmail.com",label:"Passporter"}
];
const REFRESH_PROMPT=[
"Refresh the private Inbox and Automations snapshots for my ORBIT dashboard at https://reece1919.github.io/orbit/.",
"Use EACH connected Gmail account independently: reece1919@gmail.com, controlleddriftonline@gmail.com and passporter19@gmail.com. Verify the profile, search in:inbox is:unread, paginate all results, and record actual counts. Save ONLY id, from, subject, snippet (max 185 chars), date, and actual account-specific Gmail display URL; no email bodies or attachments.",
"Store ONE private gmail_unread row with items=[{type:'mailbox',account:'reece1919@gmail.com',total_count:N,refreshed_at:ISO,items:[message metadata]}, similarly for the other two addresses]. Set total_count to sum of all mailbox totals. Preserve each mailbox's last good nested snapshot on failure.",
"Use my ChatGPT Scheduled Tasks to list ONLY enabled recurring tasks. Exclude disabled, paused, completed, and one-time tasks. Save id, title, human-readable schedule, last_run, and url set to https://chatgpt.com/schedules. Do not save task instruction prompts.",
"Update the two existing owner-private rows in Supabase project zdurujqwhxqrwbhwzzxg, public.orbit_external_snapshots, with modules gmail_unread and chatgpt_recurring. Use owner_id from the exact GAIA/ORBIT Supabase auth.users account whose email matches the connected Gmail account. If ambiguous, stop and ask. Set items to JSON arrays, total_count appropriately, source to the actual connected source, and refreshed_at=now(). Use an upsert. Keep other users' rows untouched.",
"This is a read-only dashboard synchronization: do NOT mark email read, archive, send email, change labels, or create/update/pause/delete ChatGPT tasks. Report the two counts, or explain any blocker. Do not claim automation or direct Gmail integration was established."
].join("\n\n");
const snap={gmail_unread:null,chatgpt_recurring:null};
let account="",loading=false,lastLoaded=0,inboxFilter="all";
const dateFormat=v=>{
 const d=new Date(v);
 return Number.isNaN(d.valueOf())?"Unknown":d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
};
const safeUrl=(value,kind)=>{
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:")return "";
  if(kind==="gmail"&&u.hostname==="mail.google.com")return u.href;
  if(kind==="tasks"&&u.hostname==="chatgpt.com"&&u.pathname==="/schedules")return u.href;
 }catch(_){}
 return "";
};
function stamp(module){
 const item=snap[module];
 if(!item)return "No snapshot saved yet. Open ChatGPT to synchronize.";
 const d=item.refreshed_at;
 const days=(Date.now()-new Date(d).getTime())/3600000;
 const age=Number.isFinite(days)&&days>6?" · May be out of date":"";
 return "Saved "+dateFormat(d)+age+" · "+(item.source||"ChatGPT-connected snapshot")+" · Not live";
}
function empty(message){return '<p class="watch-detail signal-empty">'+esc(message)+'</p>';}
function emailRow(e){
 const link=safeUrl(e.url,"gmail");
 const title=esc(e.subject||"(No subject)");
 const sender=esc(e.from||"Gmail message");
 const mailbox=e.account_label?esc(e.account_label)+" · ":"";
 const snippet=esc(String(e.snippet||"").slice(0,190));
 const copy='<div class="signal-item-copy"><strong>'+title+'</strong><small>'+mailbox+sender+(e.date?" · "+esc(String(e.date).slice(0,10)):"")+'</small>'+(snippet?'<p>'+snippet+'</p>':"")+'</div>';
 return link?'<a class="signal-item signal-item-email" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+copy+'<span class="signal-external" aria-hidden="true">↗</span></a>':
 '<article class="signal-item signal-item-email">'+copy+'</article>';
}
function automationRow(t){
 const link=safeUrl(t.url,"tasks");
 const title=esc(t.title||"Recurring task");
 const description=esc(t.schedule||"Recurring");
 const last=t.last_run?" · Last ran "+dateFormat(t.last_run):"";
 const text='<div class="signal-item-orb" aria-hidden="true"></div><div class="signal-item-copy"><strong>'+title+'</strong><small>'+description+esc(last)+'</small></div>';
 return link?'<a class="signal-item signal-item-task" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+text+'<span class="signal-external" aria-hidden="true">↗</span></a>':
 '<article class="signal-item signal-item-task">'+text+'</article>';
}
function mailboxes(gmail){
 const nested=Array.isArray(gmail?.items)&&gmail.items.some(e=>e?.type==="mailbox");
 return MAILBOXES.map(config=>{
  const entry=nested?gmail.items.find(e=>e?.type==="mailbox"&&e.account===config.email):null;
  const legacy=!nested&&config.email===MAILBOXES[0].email&&gmail;
  const data=entry||legacy;
  return {...config,total_count:data?Number(data.total_count)||0:null,refreshed_at:data?.refreshed_at||null,
   items:Array.isArray(data?.items)?data.items:[]};
 });
}
function filterButtons(boxes,total){
 let el=$("#inbox-account-switcher");
 if(!el){
  const list=$("#inbox-panel-list");
  if(!list)return;
  el=document.createElement("div");
  el.id="inbox-account-switcher";el.className="signal-mailbox-filters";
  list.before(el);
 }
 const opts=[{email:"all",label:"All inboxes",total_count:total},...boxes];
 el.innerHTML=opts.map(b=>'<button type="button" class="quiet-pill signal-mailbox-filter'+(inboxFilter===b.email?" selected":"")+'" data-inbox-filter="'+esc(b.email)+'" aria-pressed="'+(inboxFilter===b.email)+'">'+esc(b.label)+' <span>'+(b.total_count==null?"—":String(b.total_count))+'</span></button>').join("");
}
function render(){
 const gmail=snap.gmail_unread,auto=snap.chatgpt_recurring;
 const boxes=mailboxes(gmail);
 const allMessages=boxes.flatMap(box=>box.items.map(e=>({...e,account_label:box.label,account_email:box.email})))
  .sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
 const chosen=inboxFilter==="all"?allMessages:allMessages.filter(e=>e.account_email===inboxFilter);
 const tasks=Array.isArray(auto?.items)?auto.items:[];
 const gmailN=gmail?gmail.total_count:null,taskN=auto?auto.total_count:null;
 const counts=[
  ["#home-inbox-count",gmailN],["#inbox-panel-count",inboxFilter==="all"?gmailN:boxes.find(b=>b.email===inboxFilter)?.total_count],["#nav-inbox-count",gmailN],
  ["#automations-panel-count",taskN],["#nav-automations-count",taskN]
 ];
 counts.forEach(([selector,value])=>{const el=$(selector);if(el)el.textContent=value==null?"—":String(value)});
 filterButtons(boxes,gmailN);
 const gmailEmpty="No unread inbox messages in the saved snapshot.";
 const autoEmpty="No active recurring tasks in the saved snapshot.";
 const views=[
  ["#home-inbox-list",gmail,allMessages.slice(0,3),emailRow,gmailEmpty],
  ["#inbox-panel-list",gmail,chosen,emailRow,gmailEmpty],
  ["#automations-panel-list",auto,tasks,automationRow,autoEmpty]
 ];
 views.forEach(([selector,obj,rows,fn,message])=>{
  const el=$(selector);if(!el)return;
  el.innerHTML=!account?empty("Sign into ORBIT to view private snapshots."):
   !obj?empty("No private snapshot yet. Ask ChatGPT to sync this source."):
   rows.length?rows.map(fn).join(""):empty(message);
 });
 [
  ["#home-inbox-synced","gmail_unread"],["#inbox-panel-synced","gmail_unread"],
  ["#automations-panel-synced","chatgpt_recurring"]
 ].forEach(([selector,module])=>{
  const el=$(selector);
  if(!el)return;
  const pending=module==="gmail_unread"&&gmail?boxes.filter(b=>!b.refreshed_at).length:0;
  el.textContent=stamp(module)+(pending?" · "+pending+" mailbox"+(pending===1?"":"es")+" pending sync":"");
 });
}
async function refresh(){
 if(!account||!window.ORBITAuth?.client){render();return}
 if(loading)return;loading=true;
 const id=account;
 try{
  const {data,error}=await window.ORBITAuth.client.from("orbit_external_snapshots")
   .select("module,items,total_count,refreshed_at,source").eq("owner_id",id).in("module",MODULES);
  if(error)throw error;
  if(account!==id)return;
  MODULES.forEach(m=>snap[m]=null);
  (data||[]).forEach(item=>{if(MODULES.includes(item.module))snap[item.module]=item});
  lastLoaded=Date.now();render();
 }catch(error){
  console.warn("ORBIT private Signals snapshot unavailable",error?.message||error);
  MODULES.forEach(m=>snap[m]=null);
  render();
  ["#home-inbox-synced","#automations-panel-synced"].forEach(selector=>{const el=$(selector);if(el)el.textContent="Cannot retrieve private snapshot. Try again."});
 }finally{loading=false}
}
function accountChanged(user){
 const next=user?.id||"";
 if(next===account&&lastLoaded)return;
 account=next;MODULES.forEach(m=>snap[m]=null);render();
 if(account)void refresh();
}
async function copyInstructions(){
 const targets=["#signals-copy-status-inbox","#signals-copy-status-automations"];
 try{
  await navigator.clipboard.writeText(REFRESH_PROMPT);
  targets.forEach(t=>{const el=$(t);if(el)el.textContent="Sync instructions copied. Paste them into ChatGPT."});
 }catch(_){
  targets.forEach(t=>{const el=$(t);if(el)el.textContent="Clipboard unavailable. Open ORBIT in a secure browser and try copying again."});
 }
}
document.addEventListener("click",e=>{
 const filter=e.target.closest("[data-inbox-filter]");
 if(filter){inboxFilter=filter.getAttribute("data-inbox-filter")||"all";render();return}
 if(e.target.closest("[data-signals-reload]")){void refresh();return}
 if(e.target.closest("[data-signals-copy]")){void copyInstructions();return}
});
document.addEventListener("orbit:auth-changed",e=>accountChanged(e.detail?.user||null));
window.addEventListener("focus",()=>{if(account&&Date.now()-lastLoaded>120000)void refresh()});
// Keep the visible dashboard in sync with the private snapshot updated by the hourly inbox job.
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&account)void refresh()});
setInterval(()=>{if(!document.hidden&&account&&Date.now()-lastLoaded>120000)void refresh()},180000);
render();
void window.ORBITAuth.ready.then(()=>accountChanged(window.ORBITAuth.user||null));
})();
