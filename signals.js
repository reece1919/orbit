/* ORBIT SIGNALS v1.1 — private, dated snapshots of Gmail unread and ChatGPT recurring tasks.
   These are NOT direct live integrations. This client only reads owner-restricted Supabase rows. */
(()=>{
"use strict";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const MODULES=["gmail_unread","chatgpt_recurring"];
const REFRESH_PROMPT=[
"Refresh the private Inbox and Automations snapshots for my ORBIT dashboard at https://reece1919.github.io/orbit/.",
"Use my connected Gmail account to search in:inbox is:unread. Retrieve the latest 10 unread inbox messages and the unread inbox count. Save ONLY id, from (if available), subject, snippet (max 185 characters), date, and Gmail message URL; never store full email bodies or attachments.",
"Use my ChatGPT Scheduled Tasks to list ONLY enabled recurring tasks. Exclude disabled, paused, completed, and one-time tasks. Save id, title, human-readable schedule, last_run, and url set to https://chatgpt.com/schedules. Do not save task instruction prompts.",
"Update the two existing owner-private rows in Supabase project zdurujqwhxqrwbhwzzxg, public.orbit_external_snapshots, with modules gmail_unread and chatgpt_recurring. Use owner_id from the exact GAIA/ORBIT Supabase auth.users account whose email matches the connected Gmail account. If ambiguous, stop and ask. Set items to JSON arrays, total_count appropriately, source to the actual connected source, and refreshed_at=now(). Use an upsert. Keep other users' rows untouched.",
"This is a read-only dashboard synchronization: do NOT mark email read, archive, send email, change labels, or create/update/pause/delete ChatGPT tasks. Report the two counts, or explain any blocker. Do not claim automation or direct Gmail integration was established."
].join("\n\n");
const snap={gmail_unread:null,chatgpt_recurring:null};
let account="",loading=false,lastLoaded=0;
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
 const snippet=esc(String(e.snippet||"").slice(0,190));
 const text='<div class="signal-item-copy"><strong>'+title+'</strong><small>'+sender+(e.date?" · "+esc(String(e.date).slice(0,10)):"")+'</small>'+(snippet?'<p>'+snippet+'</p>':'')+'</div>';
 return link?'<a class="signal-item signal-item-email" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+text+'<span class="signal-external" aria-hidden="true">↗</span></a>':
 '<article class="signal-item signal-item-email">'+text+'</article>';
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
function render(){
 const gmail=snap.gmail_unread,auto=snap.chatgpt_recurring;
 const messages=Array.isArray(gmail?.items)?gmail.items:[];
 const tasks=Array.isArray(auto?.items)?auto.items:[];
 const gmailN=gmail?gmail.total_count:null,taskN=auto?auto.total_count:null;
 const counts=[
  ["#home-inbox-count",gmailN],["#inbox-panel-count",gmailN],["#nav-inbox-count",gmailN],
  ["#home-automations-count",taskN],["#automations-panel-count",taskN],["#nav-automations-count",taskN]
 ];
 counts.forEach(([selector,value])=>{const el=$(selector);if(el)el.textContent=value==null?"—":String(value)});
 const gmailEmpty="No unread inbox messages in the saved snapshot.";
 const autoEmpty="No active recurring tasks in the saved snapshot.";
 const boxes=[
  ["#home-inbox-list",gmail,messages.slice(0,3),emailRow,gmailEmpty],
  ["#inbox-panel-list",gmail,messages,emailRow,gmailEmpty],
  ["#home-automations-list",auto,tasks.slice(0,3),automationRow,autoEmpty],
  ["#automations-panel-list",auto,tasks,automationRow,autoEmpty]
 ];
 boxes.forEach(([selector,obj,rows,fn,message])=>{
  const el=$(selector);if(!el)return;
  el.innerHTML=!account?empty("Sign into ORBIT to view private snapshots."):
   !obj?empty("No private snapshot yet. Ask ChatGPT to sync this source."):
   rows.length?rows.map(fn).join(""):empty(message);
 });
 [
  ["#home-inbox-synced","gmail_unread"],["#inbox-panel-synced","gmail_unread"],
  ["#home-automations-synced","chatgpt_recurring"],["#automations-panel-synced","chatgpt_recurring"]
 ].forEach(([selector,module])=>{const el=$(selector);if(el)el.textContent=stamp(module)});
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
  ["#home-inbox-synced","#home-automations-synced"].forEach(selector=>{const el=$(selector);if(el)el.textContent="Cannot retrieve private snapshot. Try again."});
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
 if(e.target.closest("[data-signals-reload]")){void refresh();return}
 if(e.target.closest("[data-signals-copy]")){void copyInstructions();return}
});
document.addEventListener("orbit:auth-changed",e=>accountChanged(e.detail?.user||null));
window.addEventListener("focus",()=>{if(account&&Date.now()-lastLoaded>120000)void refresh()});
render();
void window.ORBITAuth.ready.then(()=>accountChanged(window.ORBITAuth.user||null));
})();
