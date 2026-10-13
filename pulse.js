/* ORBIT PULSE v1.0: owner-private mood and journal data + scheduled Web Push. */
(() => {
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const URL="https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/orbit-pulse";
const SLOTS=["morning","afternoon","evening"];
const TITLES=["Morning","Afternoon","Evening"];
const RATINGS=[["😞","Rough"],["😕","Low"],["😐","Okay"],["🙂","Good"],["😄","Great"]];
const PROMPTS=[
"What was one small moment today that deserves to be remembered?",
"What gave you energy today, and what took energy away?",
"What are you looking forward to, even if it's something small?",
"What's something you learned about yourself recently?",
"What made you smile or laugh today?",
"What did you handle better today than you might have a month ago?",
"If today had a soundtrack, what song would be playing and why?",
"What's one thing you're grateful to have in your space right now?",
"Where did you feel most comfortable being yourself today?",
"What would make tomorrow feel a little easier?",
"What did you create, fix, cook, or make progress on?",
"What was a surprisingly good part of an ordinary day?",
"What would you like to give yourself permission to enjoy?",
"Who or what helped you feel connected recently?",
"What part of your routine is working well for you?",
"What did you notice outside or in nature today?",
"What is one thing you're proud of that others might not notice?",
"What have you been curious to try or explore lately?",
"If you could leave yourself one kind reminder for tomorrow, what would it be?",
"What do you want to carry forward from this week?"
];
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const promptIndex=day=>((Math.floor((Date.parse(day+"T00:00:00Z")-Date.UTC(2026,0,1))/86400000)%PROMPTS.length)+PROMPTS.length)%PROMPTS.length;
const defaults=()=>({time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone||"America/Los_Angeles",mood_times:["09:00","14:00","20:00"],journal_time:"20:30",notifications_enabled:false});
let user=null,client=null,settings=defaults(),moods=[],journals=[],isLoading=false,saving=false,deviceSubscribed=false,pushPublicKey="";
const log=(m)=>{const el=$("#pulse-status");if(el)el.textContent=m;};
const on=(node,type,handler)=>node?.addEventListener(type,handler);
function currentMood(slot){return moods.find(m=>m.entry_date===localDay()&&m.slot===slot)}
function currentJournal(){return journals.find(j=>j.entry_date===localDay())}
function reflectPrompt(){return PROMPTS[promptIndex(localDay())]}
function writeHome(){
 const summary=$("#pulse-home-summary");if(!summary)return;
 const count=SLOTS.filter(s=>currentMood(s)).length,entry=currentJournal();
 summary.textContent=!user?"Sign in to save PULSE reflections.":count+" of 3 mood check-ins · "+(entry?"Journal written":"Journal awaiting you");
}
function renderMoods(){
 const place=$("#pulse-mood-panels");
 if(!place)return;
 place.innerHTML=SLOTS.map((slot,i)=>{
  const row=currentMood(slot);
  const selected=row?.mood||0;
  return '<article class="pulse-mood-card"><div class="pulse-mood-head"><div><span class="pulse-overline">CHECK-IN 0'+(i+1)+'</span><h3>'+TITLES[i]+'</h3></div><span class="pulse-mood-saved">'+(row?'Saved ✓':'Whenever you are ready')+'</span></div>'+
  '<div class="pulse-mood-scale" role="group" aria-label="'+TITLES[i]+' mood">'+RATINGS.map(([icon,label],j)=>'<button type="button" data-pulse-rate="'+slot+':'+(j+1)+'" aria-label="'+label+'" aria-pressed="'+(selected===j+1)+'" class="pulse-mood-option '+(selected===j+1?'selected':'')+'" '+(!user?'disabled':'')+'><span>'+icon+'</span><small>'+label+'</small></button>').join('')+'</div>'+
  '<details class="pulse-mood-detail"><summary>Energy, stress & a note <span class="pulse-optional">optional</span></summary>'+
  '<div class="pulse-detail-fields"><label>Energy <select data-pulse-energy="'+slot+'">'+[0,1,2,3,4,5].map(v=>'<option value="'+v+'" '+((row?.energy||0)===v?'selected':'')+'>'+(v?v+'/5':'Not rated')+'</option>').join('')+'</select></label>'+
  '<label>Stress <select data-pulse-stress="'+slot+'">'+[0,1,2,3,4,5].map(v=>'<option value="'+v+'" '+((row?.stress||0)===v?'selected':'')+'>'+(v?v+'/5':'Not rated')+'</option>').join('')+'</select></label></div>'+
  '<textarea data-pulse-note="'+slot+'" maxlength="2000" rows="2" placeholder="Anything you want to remember...">'+esc(row?.note||'')+'</textarea>'+
  '<button class="quiet-pill" type="button" data-pulse-save-detail="'+slot+'" '+(!user?'disabled':'')+'>Save details</button></details></article>';
 }).join('');
}
function renderJournal(){
 const journal=currentJournal();
 const prompt=$("#pulse-prompt-text"),text=$("#pulse-journal-text"),save=$("#pulse-journal-save"),label=$("#pulse-journal-state");
 if(prompt)prompt.textContent=reflectPrompt();
 if(text){text.value=journal?.body||"";text.disabled=!user}
 if(save)save.disabled=!user;
 if(label)label.textContent=journal?"Saved today · you can edit it":"A fresh prompt each day. Your entries stay private.";
}
function renderHistory(){
 const el=$("#pulse-history");if(!el)return;
 const dateSet=[...new Set([...moods,...journals].map(x=>x.entry_date))].sort().reverse().slice(0,14);
 if(!dateSet.length){el.innerHTML='<p class="watch-detail">Your completed check-ins and journal entries will appear here.</p>';return}
 el.innerHTML=dateSet.map(day=>{
  const moodRows=moods.filter(m=>m.entry_date===day).sort((a,b)=>SLOTS.indexOf(a.slot)-SLOTS.indexOf(b.slot));
  const journal=journals.find(j=>j.entry_date===day);
  const nice=new Date(day+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",weekday:"short"});
  return '<div class="pulse-history-day"><strong>'+nice+'</strong><span>'+moodRows.map(m=>RATINGS[m.mood-1]?.[0]||"·").join(" ")+'</span>'+(journal?'<small>Journal ✓</small>':'')+'</div>';
 }).join('');
}
function renderSchedule(){
 const fields=[...document.querySelectorAll("[data-pulse-time]")];
 fields.forEach((field,i)=>field.value=(settings.mood_times||defaults().mood_times)[i]||defaults().mood_times[i]);
 const jt=$("#pulse-journal-time"),tz=$("#pulse-timezone"),all=$("#pulse-notification-enabled");
 if(jt)jt.value=settings.journal_time||"20:30";
 if(tz)tz.value=settings.time_zone||defaults().time_zone;
 if(all)all.checked=!!settings.notifications_enabled;
 const status=$("#pulse-push-status");
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
 const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
 const capable=("serviceWorker" in navigator)&&("PushManager" in window)&&("Notification" in window);
 if(status){
  status.textContent=!capable?"Web push is not available in this browser. Use a supported browser or install ORBIT as a web app.":
  ios&&!standalone?"iPhone: In Safari, tap Share → Add to Home Screen. Then open ORBIT from the new icon to enable notifications.":
  deviceSubscribed?"Notifications are enabled on this device. They can arrive while ORBIT is closed.":
  Notification.permission==="denied"?"Notifications are blocked in device/browser settings. Allow ORBIT notifications there first.":
  "Notifications are not enabled on this device yet.";
 }
 const enable=$("#pulse-enable-push"),disable=$("#pulse-disable-push"),test=$("#pulse-test-push");
 if(enable)enable.hidden=!capable||deviceSubscribed;
 if(disable)disable.hidden=!capable||!deviceSubscribed;
 if(test)test.disabled=!deviceSubscribed;
}
function render(){renderMoods();renderJournal();renderHistory();writeHome();renderSchedule()}
async function withAccount(){
 if(!client||!user)throw Error("Sign in to ORBIT first.");
 return {client,user};
}
async function refresh(){
 if(!user||!client){render();return}
 const owner=user.id;
 isLoading=true;log("Syncing your private PULSE journal…");
 try{
  const from=new Date();from.setDate(from.getDate()-34);
  const since=[from.getFullYear(),String(from.getMonth()+1).padStart(2,"0"),String(from.getDate()).padStart(2,"0")].join("-");
  const [a,b,c]=await Promise.all([
   client.from("pulse_settings").select("*").eq("owner_id",owner).maybeSingle(),
   client.from("pulse_moods").select("*").eq("owner_id",owner).gte("entry_date",since).order("entry_date",{ascending:false}).limit(120),
   client.from("pulse_journals").select("*").eq("owner_id",owner).gte("entry_date",since).order("entry_date",{ascending:false}).limit(40)
  ]);
  if(a.error||b.error||c.error)throw a.error||b.error||c.error;
  if(user?.id!==owner)return;
  settings=a.data||defaults();
  moods=b.data||[];journals=c.data||[];
  if(!a.data){
   const {error}=await client.from("pulse_settings").upsert({owner_id:owner,...settings},{onConflict:"owner_id"});
   if(error)throw error;
  }
  log("Private journal connected · "+(moods.length)+" recent mood check-ins.");
  render();
  await checkDevice();
 }catch(e){log("Couldn't sync PULSE: "+(e.message||"Please retry."))}
 finally{isLoading=false}
}
async function saveMood(slot,rate,details=false){
 if(saving)return;
 const {client,user}=await withAccount();
 if(!SLOTS.includes(slot))return;
 const old=currentMood(slot);
 const energy=details?Number($('[data-pulse-energy="'+slot+'"]')?.value||0)||null:old?.energy||null;
 const stress=details?Number($('[data-pulse-stress="'+slot+'"]')?.value||0)||null:old?.stress||null;
 const note=details?String($('[data-pulse-note="'+slot+'"]')?.value||"").slice(0,2000):old?.note||"";
 const mood=rate||old?.mood;
 if(!mood){log("Select a mood first, then save the extra details.");return}
 saving=true;
 try{
  const value={owner_id:user.id,entry_date:localDay(),slot,mood,energy,stress,note,updated_at:new Date().toISOString()};
  const {data,error}=await client.from("pulse_moods").upsert(value,{onConflict:"owner_id,entry_date,slot"}).select().single();
  if(error)throw error;
  moods=[...moods.filter(x=>!(x.entry_date===value.entry_date&&x.slot===slot)),data];
  renderMoods();writeHome();renderHistory();
  log(TITLES[SLOTS.indexOf(slot)]+" check-in saved privately.");
 }catch(e){log("Couldn't save check-in: "+e.message)}
 finally{saving=false}
}
async function saveJournal(){
 const {client,user}=await withAccount();
 const text=String($("#pulse-journal-text")?.value||"").trim();
 if(!text){log("Write a little something before saving.");return}
 if(text.length>12000){log("This journal entry is too long (12,000-character limit).");return}
 const btn=$("#pulse-journal-save");btn.disabled=true;
 try{
  const item={owner_id:user.id,entry_date:localDay(),prompt_index:promptIndex(localDay()),body:text,updated_at:new Date().toISOString()};
  const {data,error}=await client.from("pulse_journals").upsert(item,{onConflict:"owner_id,entry_date"}).select().single();
  if(error)throw error;
  journals=[...journals.filter(x=>x.entry_date!==item.entry_date),data];
  renderHistory();writeHome();
  $("#pulse-journal-state").textContent="Saved today · you can edit it";
  log("Today's reflection saved privately.");
 }catch(e){log("Couldn't save journal: "+e.message)}
 finally{btn.disabled=false}
}
async function saveSettings(changes){
 const {client,user}=await withAccount();
 const payload={...settings,...changes,owner_id:user.id,updated_at:new Date().toISOString()};
 const {data,error}=await client.from("pulse_settings").upsert(payload,{onConflict:"owner_id"}).select().single();
 if(error)throw error;
 settings=data;renderSchedule();return settings;
}
async function saveSchedule(e){
 e.preventDefault();
 const moodTimes=[...document.querySelectorAll("[data-pulse-time]")].map(x=>x.value);
 const journalTime=$("#pulse-journal-time").value;
 const zone=$("#pulse-timezone").value.trim();
 if(!moodTimes.every(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(journalTime)){log("Enter valid reminder times.");return}
 try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format(new Date())}catch{log("Use a valid timezone such as America/Los_Angeles.");return}
 try{await saveSettings({mood_times:moodTimes,journal_time:journalTime,time_zone:zone,notifications_enabled:$("#pulse-notification-enabled").checked});log("PULSE reminder schedule updated. Times use "+zone+".")}
 catch(e){log("Couldn't update schedule: "+e.message)}
}
async function api(action,payload={}){
 const {client}=await withAccount();
 const {data,error}=await client.auth.getSession();
 if(error||!data?.session?.access_token)throw Error("Sign in again before managing notifications.");
 const response=await fetch(URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+data.session.access_token},body:JSON.stringify({action,...payload})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||"Notification service unavailable");
 return result;
}
function bytes(base64){const s=base64.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),ch=>ch.charCodeAt(0))}
async function checkDevice(){
 if(!user||!("serviceWorker" in navigator)||!("PushManager" in window))return;
 try{
  const reg=await navigator.serviceWorker.getRegistration("/orbit/");
  const existing=reg?await reg.pushManager.getSubscription():null;
  deviceSubscribed=!!existing&&Notification.permission==="granted";
  if(deviceSubscribed){
   // Keep this subscription associated with the current signed-in ORBIT account.
   await api("subscribe",{subscription:existing.toJSON(),label:navigator.platform||"Browser"});
  }
 }catch(e){console.warn("PULSE device status",e.message)}
 renderSchedule();
}
async function enablePush(){
 if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){log("This device does not support Web Push.");return}
 if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.matchMedia("(display-mode: standalone)").matches&&!navigator.standalone){log("Add ORBIT to your iPhone Home Screen, then open it from the icon and enable notifications there.");return}
 // Permission is requested directly from a user click, never on page load.
 const permission=await Notification.requestPermission();
 if(permission!=="granted"){log("Notification permission wasn't granted.");renderSchedule();return}
 try{
  const config=await api("status");pushPublicKey=config.vapid_public_key;
  const reg=await navigator.serviceWorker.register("./pulse-sw.js",{scope:"/orbit/"});
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(pushPublicKey)});
  await api("subscribe",{subscription:sub.toJSON(),label:navigator.platform||"Browser"});
  await saveSettings({notifications_enabled:true});
  deviceSubscribed=true;renderSchedule();log("Web Push enabled. Scheduled reminders can reach this device while ORBIT is closed.");
 }catch(e){log("Couldn't enable Web Push: "+e.message)}
}
async function disablePush(){
 try{
  const reg=await navigator.serviceWorker.getRegistration("/orbit/");
  const sub=reg?await reg.pushManager.getSubscription():null;
  if(sub){await api("unsubscribe",{endpoint:sub.endpoint});await sub.unsubscribe()}
  deviceSubscribed=false;
  const state=await api("status");
  if(!state.device_count)await saveSettings({notifications_enabled:false});
  renderSchedule();log("Notifications disabled on this device.");
 }catch(e){log("Couldn't disable notifications: "+e.message)}
}
async function testPush(){
 try{
  const reg=await navigator.serviceWorker.getRegistration("/orbit/");
  const sub=reg?await reg.pushManager.getSubscription():null;
  if(!sub)throw Error("Enable notifications first.");
  await api("test",{endpoint:sub.endpoint});log("Test notification sent. Check your device notifications.");
 }catch(e){log("Couldn't send test: "+e.message)}
}
function handleAccount(u){
 user=u||null;client=window.ORBITAuth?.client||null;
 moods=[];journals=[];settings=defaults();deviceSubscribed=false;render();
 if(user&&client)void refresh();
 else log("Sign into ORBIT to use your private PULSE journal.");
}
on(document,"click",e=>{
 const rate=e.target.closest("[data-pulse-rate]");
 if(rate){const [slot,mood]=rate.dataset.pulseRate.split(":");void saveMood(slot,Number(mood));return}
 const more=e.target.closest("[data-pulse-save-detail]");
 if(more){void saveMood(more.dataset.pulseSaveDetail,null,true);return}
 if(e.target.closest("#pulse-journal-save")){void saveJournal();return}
 if(e.target.closest("#pulse-enable-push")){void enablePush();return}
 if(e.target.closest("#pulse-disable-push")){void disablePush();return}
 if(e.target.closest("#pulse-test-push")){void testPush();return}
 if(e.target.closest("#pulse-refresh")){void refresh();return}
});
on($("#pulse-schedule-form"),"submit",saveSchedule);
on(document,"orbit:auth-changed",e=>handleAccount(e.detail?.user||null));
render();
void window.ORBITAuth.ready.then(()=>{
 handleAccount(window.ORBITAuth.user||null);
 const p=new URLSearchParams(location.search);
 if(p.get("view")==="pulse"){
  document.querySelector(".main-nav [data-view=pulse]")?.click();
  const clean=new URL(location.href);clean.searchParams.delete("view");
  history.replaceState(null,"",clean.pathname+clean.search+clean.hash);
 }
});
})();
