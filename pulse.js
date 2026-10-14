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
let user=null,client=null,settings=defaults(),moods=[],journals=[],isLoading=false,saving=false,deviceSubscribed=false,pushPublicKey="",pushRegistration=null,pushExisting=null,pushSetupReady=false,pushError="",pushRepairRequired=false;
const log=(m)=>{const el=$("#pulse-status");if(el)el.textContent=m;};
const logPush=(m)=>{const el=$("#pulse-push-feedback");if(el)el.textContent=m;log(m);};
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
  status.textContent=!user?"Sign into ORBIT before enabling notifications.":
  ios&&!standalone?"iPhone: Notifications require the installed ORBIT Home Screen app. Open ORBIT using its Home Screen icon, not a Safari tab.":
  !capable?"Web Push is unavailable in this browser/app context.":
  Notification.permission==="denied"?"Notifications are blocked in device/browser settings. Allow ORBIT notifications there first.":
  pushError?pushError:
  deviceSubscribed?"This device is registered with ORBIT. Notifications can arrive while ORBIT is closed.":
  !pushSetupReady?"Preparing secure notification registration…":
  "This device is not registered yet. Tap Enable notifications to connect it.";
 }
 const enable=$("#pulse-enable-push"),disable=$("#pulse-disable-push"),test=$("#pulse-test-push");
 if(enable){enable.hidden=!!deviceSubscribed;enable.disabled=false;enable.textContent=pushSetupReady?"Enable notifications":"Set up notifications"}
 if(disable)disable.hidden=!deviceSubscribed;
 if(test)test.disabled=false;
 const repair=$("#pulse-repair-push");if(repair)repair.hidden=!pushRepairRequired;
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
function base64url(buffer){
 const value=Array.from(new Uint8Array(buffer),b=>String.fromCharCode(b)).join("");
 return btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function validPushAddress(value){
 if(typeof value!=="string"||value.length>2000)return false;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&!!u.hostname&&!u.username&&!u.password&&!u.port;
 }catch{return false}
}
function subscriptionEndpoint(sub){
 // Some Push API implementations provide both a property and JSON serialization.
 // Trust only a syntactically valid secure URL; do not guess, concatenate, or repair
 // an invalid endpoint because the token component is a private capability URL.
 const raw=sub?.endpoint;
 if(validPushAddress(raw))return raw;
 const serialized=typeof sub?.toJSON==="function"?sub.toJSON()?.endpoint:null;
 if(validPushAddress(serialized))return serialized;
 throw Error("This device has an invalid push subscription address. Use Repair device subscription.");
}
function subscriptionPayload(sub){
 const endpoint=subscriptionEndpoint(sub);
 // Read encryption keys from raw bytes instead of relying on Safari's serialization.
 const p256dh=sub.getKey("p256dh"),auth=sub.getKey("auth");
 if(!p256dh||!auth||p256dh.byteLength!==65||auth.byteLength!==16)throw Error("Browser returned incomplete push encryption keys.");
 return {endpoint,keys:{p256dh:base64url(p256dh),auth:base64url(auth)}};
}
async function checkDevice(){
 if(!user||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){renderSchedule();return}
 const owner=user.id;
 pushSetupReady=false;pushError="";pushRepairRequired=false;deviceSubscribed=false;renderSchedule();
 try{
  // Prepare the service worker and public VAPID key before the user's click.
  // iOS requires subscribe() to follow the actual permission gesture without a network fetch.
  const config=await api("status");
  if(!config?.vapid_public_key||bytes(config.vapid_public_key).length!==65)throw Error("Invalid public notification key.");
  const reg=await navigator.serviceWorker.register("./pulse-sw.js",{scope:"/orbit/"});
  if(user?.id!==owner)return;
  pushPublicKey=config.vapid_public_key;
  pushRegistration=reg;
  pushExisting=await reg.pushManager.getSubscription();
  pushSetupReady=true;
  if(pushExisting&&Notification.permission==="granted"){
   // Detect unusable local subscriptions before sending to the server.
   const payload=subscriptionPayload(pushExisting);
   await api("subscribe",{subscription:payload,label:navigator.platform||"Browser"});
   if(user?.id!==owner)return;
   deviceSubscribed=true;
  }
 }catch(e){
  if(user?.id!==owner)return;
  pushRepairRequired=!!pushExisting&&/invalid push subscription address/i.test(String(e.message||""));
  pushError="Device registration needs attention: "+(e.message||"Unknown error)+(pushRepairRequired?"":" Tap Check connection to retry.");
  logPush(pushError);
  console.warn("PULSE registration needs attention:",e.message);
 }
 renderSchedule();
}
async function enablePush(){
 if(!user){logPush("Sign into ORBIT first, then enable notifications.");return}
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
 const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
 if(ios&&!standalone){logPush("iPhone push requires the installed Home Screen ORBIT app. Open it from your Home Screen icon rather than a Safari tab.");return}
 if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){logPush("Web Push is unavailable in this browser or app context.");return}
 if(Notification.permission==="denied"){logPush("Notifications are blocked. Enable ORBIT notifications in your iPhone Settings → Notifications, then try again.");return}
 if(!pushSetupReady||!pushRegistration){
  logPush("Preparing the device connection. After this finishes, tap Enable notifications again.");
  await checkDevice();
  if(!pushSetupReady)logPush(pushError||"Could not prepare notifications. Tap Check connection to see the error.");
  return;
 }
 try{
  // Keep browser permission/subscription close to the user gesture for WebKit.
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){logPush("Notification permission was not granted. Check your device notification settings.");renderSchedule();return}
  let sub=pushExisting;
  if(!sub)sub=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(pushPublicKey)});
  pushExisting=sub;
  const payload=subscriptionPayload(sub);
  logPush("Permission granted. Registering this device with ORBIT…");
  await api("subscribe",{subscription:payload,label:navigator.platform||"Browser"});
  await saveSettings({notifications_enabled:true});
  deviceSubscribed=true;pushRepairRequired=false;pushError="";renderSchedule();
  logPush("Device registered successfully. Tap Send test to confirm delivery.");
 }catch(e){
  deviceSubscribed=false;
  pushRepairRequired=!!pushExisting&&/invalid push subscription address/i.test(String(e.message||""));
  pushError="Device registration failed: "+(e.message||"Unknown error");
  renderSchedule();logPush(pushError);
 }
}
async function checkPushConnection(){
 if(!user){logPush("Sign into ORBIT first.");return}
 logPush("Checking notification support and ORBIT registration…");
 await checkDevice();
 if(deviceSubscribed)logPush("ORBIT confirms this device is registered. Tap Send test.");
 else if(pushError)logPush(pushError);
 else if(!pushSetupReady)logPush("Notification setup is unavailable here. Check whether you opened the installed Home Screen app.");
 else logPush("No registered notification device was found. Tap Enable notifications to register.");
}
async function repairPush(){
 if(!user){logPush("Sign into ORBIT before repairing notifications.");return}
 if(!pushRegistration||!pushSetupReady){logPush("Tap Check connection first, then try Repair device subscription.");return}
 if(Notification.permission!=="granted"){logPush("Allow notifications in iPhone Settings first, then retry.");return}
 if(!pushExisting){logPush("There is no saved subscription to repair. Tap Enable notifications instead.");return}
 const button=$("#pulse-repair-push");
 if(button)button.disabled=true;
 try{
  logPush("Replacing this device's invalid push subscription…");
  // Only remove the local browser subscription after an explicit repair tap.
  // Other devices and saved PULSE settings remain unchanged.
  const removed=await pushExisting.unsubscribe();
  if(!removed)throw Error("iPhone did not release the previous push subscription.");
  pushExisting=null;
  const next=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(pushPublicKey)});
  pushExisting=next;
  const payload=subscriptionPayload(next);
  await api("subscribe",{subscription:payload,label:navigator.platform||"Browser"});
  await saveSettings({notifications_enabled:true});
  deviceSubscribed=true;pushRepairRequired=false;pushError="";renderSchedule();
  logPush("Push subscription repaired and registered. Tap Send test.");
 }catch(e){
  deviceSubscribed=false;pushRepairRequired=!!pushExisting;
  pushError="Repair unsuccessful: "+(e.message||"Unknown error");
  renderSchedule();logPush(pushError);
 }finally{if(button)button.disabled=false}
}
async function disablePush(){
 try{
  const reg=await navigator.serviceWorker.getRegistration("/orbit/");
  const sub=reg?await reg.pushManager.getSubscription():null;
  if(sub){await api("unsubscribe",{endpoint:sub.endpoint});await sub.unsubscribe()}
  deviceSubscribed=false;pushExisting=null;pushRepairRequired=false;pushError="";
  const state=await api("status");
  if(!state.device_count)await saveSettings({notifications_enabled:false});
  renderSchedule();logPush("Notifications disabled on this device.");
 }catch(e){logPush("Couldn't disable notifications: "+e.message)}
}
async function testPush(){
 if(!user){logPush("Sign into ORBIT first.");return}
 logPush("Checking whether the push provider accepts a test…");
 try{
  const reg=await navigator.serviceWorker.getRegistration("/orbit/");
  const sub=reg?await reg.pushManager.getSubscription():null;
  if(!sub)throw Error("Enable notifications first.");
  await api("test",{endpoint:sub.endpoint});logPush("Push provider accepted the test. Check device notifications and Focus settings.");
 }catch(e){logPush("Couldn't send test: "+e.message)}
}
function handleAccount(u){
 user=u||null;client=window.ORBITAuth?.client||null;
 moods=[];journals=[];settings=defaults();deviceSubscribed=false;pushSetupReady=false;pushRegistration=null;pushExisting=null;pushRepairRequired=false;pushError="";render();
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
 if(e.target.closest("#pulse-check-push")){void checkPushConnection();return}
 if(e.target.closest("#pulse-repair-push")){void repairPush();return}
 if(e.target.closest("#pulse-refresh")){void refresh();return}
});
on($("#pulse-schedule-form"),"submit",saveSchedule);
on(document,"orbit:auth-changed",e=>handleAccount(e.detail?.user||null));
render();
void window.ORBITAuth.ready.then(()=>{
 handleAccount(window.ORBITAuth.user||null);
 const p=new URLSearchParams(location.search);
 if(p.get("view")==="pulse"){
  (document.querySelector("#vita-tabs [data-view=pulse]")||document.querySelector(".main-nav [data-view=pulse]"))?.click();
  const clean=new URL(location.href);clean.searchParams.delete("view");
  history.replaceState(null,"",clean.pathname+clean.search+clean.hash);
 }
});
})();
