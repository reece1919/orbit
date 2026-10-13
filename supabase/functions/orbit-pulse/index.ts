// ORBIT PULSE scheduled Web Push bridge. Never publish private VAPID keys.
// Secrets and push endpoints are readable only to the server-side service role.
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { sendPushNotification, deserializeVapidKeys } from "npm:web-push-browser@1.4.2";
const ORIGIN="https://reece1919.github.io";
const LINK=ORIGIN+"/orbit/";
const PROJECT="zdurujqwhxqrwbhwzzxg";
const URL=Deno.env.get("SUPABASE_URL")||"https://"+PROJECT+".supabase.co";
const HEADERS={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-pulse-cron-auth","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Vary":"Origin","Cache-Control":"no-store"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
function key(){
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 try{const cfg=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");const k=cfg.default||Object.values(cfg)[0];return typeof k==="string"?k:(k?.key||k?.value||k?.api_key||"")}catch{return ""}
}
const adminKey=key();
const db=adminKey?createClient(URL,adminKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const cached={};
async function setting(name){
 if(cached[name])return cached[name];
 const {data,error}=await db.from("pulse_server_keys").select("value").eq("key",name).maybeSingle();
 if(error||!data?.value)throw new Error("PULSE server setting missing: "+name);
 return cached[name]=data.value;
}
async function me(req){
 const a=req.headers.get("authorization")||"";
 if(!/^Bearer \S+$/i.test(a))return null;
 const {data,error}=await db.auth.getUser(a.replace(/^Bearer\s+/i,""));
 return error?null:data?.user||null;
}
function validEndpoint(endpoint){
 if(typeof endpoint!=="string"||endpoint.length>2000)return false;
 try{
  const u=new URL(endpoint);
  const h=u.hostname.toLowerCase();
  return u.protocol==="https:"&&!u.username&&!u.password&&
   (["fcm.googleapis.com","fcmregistrations.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com"].includes(h)
    ||h.endsWith(".push.apple.com")||h.endsWith(".notify.windows.com"));
 }catch{return false}
}
function validSub(s){
 return s&&validEndpoint(s.endpoint)&&s.keys&&
 /^[A-Za-z0-9_-]{70,120}$/.test(s.keys.p256dh||"")&&
 /^[A-Za-z0-9_-]{18,50}$/.test(s.keys.auth||"");
}
async function configuredKeys(){
 return deserializeVapidKeys({publicKey:await setting("vapid_public"),privateKey:await setting("vapid_private")});
}
async function send(row,kind,day){
 const payload={title:kind==="journal"?"PULSE · Evening reflection":"PULSE · Mood check-in",body:kind==="journal"?"Your daily journal prompt is ready.":"A small moment to check in with yourself.",url:LINK+"?view=pulse",tag:"pulse-"+kind+"-"+day};
 const response=await sendPushNotification(await configuredKeys(),{endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_secret}},"support@reece1919.github.io",JSON.stringify(payload),{algorithm:"aes128gcm",ttl:3600});
 return response;
}
const slots=["morning","afternoon","evening","journal"];
function localClock(zone,now){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const g=k=>parts.find(p=>p.type===k)?.value;
 return {day:g("year")+"-"+g("month")+"-"+g("day"),minute:Number(g("hour"))*60+Number(g("minute"))};
}
function minutes(hhmm){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm||""))return -1;
 return Number(hhmm.slice(0,2))*60+Number(hhmm.slice(3,5));
}
function dueSlots(settings,now){
 const clock=localClock(settings.time_zone,now);
 const times=[...(settings.mood_times||[]),settings.journal_time];
 const due=[];
 times.forEach((t,i)=>{const diff=clock.minute-minutes(t);if(diff>=0&&diff<=14)due.push(slots[i])});
 return {day:clock.day,due};
}
async function dispatch(req){
 const given=req.headers.get("x-pulse-cron-auth")||"";
 const expected=await setting("cron_token");
 if(given.length!==expected.length||!given)return reply({error:"Unauthorized scheduler"},401);
 let delta=0;for(let i=0;i<given.length;i++)delta|=given.charCodeAt(i)^expected.charCodeAt(i);
 if(delta!==0)return reply({error:"Unauthorized scheduler"},401);
 const {data:settings,error}=await db.from("pulse_settings").select("*").eq("notifications_enabled",true).limit(200);
 if(error)throw error;
 const now=new Date();let delivered=0,checked=0,failures=0;
 for(const settingRow of settings||[]){
  let clock;
  try{clock=dueSlots(settingRow,now)}catch{continue}
  if(!clock.due.length)continue;
  const {data:devices,error:deviceError}=await db.from("pulse_push_subscriptions").select("*").eq("owner_id",settingRow.owner_id).limit(12);
  if(deviceError||!devices?.length)continue;
  const {data:moods}=await db.from("pulse_moods").select("slot").eq("owner_id",settingRow.owner_id).eq("entry_date",clock.day);
  const {data:journals}=await db.from("pulse_journals").select("id").eq("owner_id",settingRow.owner_id).eq("entry_date",clock.day).limit(1);
  const completed=new Set((moods||[]).map(x=>x.slot));
  if(journals?.length)completed.add("journal");
  for(const kind of clock.due){
   if(completed.has(kind))continue;
   for(const device of devices){
    checked++;
    const {error:insertError}=await db.from("pulse_push_deliveries").insert({subscription_id:device.id,owner_id:settingRow.owner_id,local_day:clock.day,kind});
    if(insertError){if(insertError.code!=="23505")failures++;continue}
    try{
     const response=await send(device,kind,clock.day);
     if(response.ok){delivered++;continue}
     if(response.status===404||response.status===410){await db.from("pulse_push_subscriptions").delete().eq("id",device.id);continue}
     failures++;console.error("PULSE push provider error",response.status);
     await db.from("pulse_push_deliveries").delete().eq("subscription_id",device.id).eq("local_day",clock.day).eq("kind",kind);
    }catch(e){
     failures++;console.error("PULSE Web Push error",String(e?.message||e));
     await db.from("pulse_push_deliveries").delete().eq("subscription_id",device.id).eq("local_day",clock.day).eq("kind",kind);
    }
   }
  }
 }
 return reply({ok:true,checked,delivered,failures});
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 if(!db)return reply({error:"Server unavailable"},503);
 let body;try{body=await req.json()}catch{return reply({error:"Invalid request"},400)}
 try{
  if(body?.action==="dispatch")return await dispatch(req);
  if(req.headers.get("Origin")!==ORIGIN)return reply({error:"Origin blocked"},403);
  const user=await me(req);
  if(!user)return reply({error:"Sign into ORBIT first"},401);
  if(body?.action==="status"){
   const {count,error}=await db.from("pulse_push_subscriptions").select("id",{count:"exact",head:true}).eq("owner_id",user.id);
   if(error)throw error;
   return reply({vapid_public_key:await setting("vapid_public"),device_count:count||0});
  }
  if(body?.action==="subscribe"){
   const s=body.subscription;
   if(!validSub(s))return reply({error:"Invalid browser push subscription"},400);
   const {error}=await db.from("pulse_push_subscriptions").upsert({owner_id:user.id,endpoint:s.endpoint,p256dh:s.keys.p256dh,auth_secret:s.keys.auth,device_label:String(body.label||"Device").slice(0,70),updated_at:new Date().toISOString()},{onConflict:"endpoint"});
   if(error)throw error;
   return reply({connected:true});
  }
  if(body?.action==="unsubscribe"){
   if(typeof body.endpoint!=="string")return reply({error:"Invalid endpoint"},400);
   const {error}=await db.from("pulse_push_subscriptions").delete().eq("owner_id",user.id).eq("endpoint",body.endpoint);
   if(error)throw error;
   return reply({connected:false});
  }
  if(body?.action==="test"){
   const {data:device,error}=await db.from("pulse_push_subscriptions").select("*").eq("owner_id",user.id).eq("endpoint",String(body.endpoint||"")).maybeSingle();
   if(error||!device)return reply({error:"Enable notifications on this device first"},404);
   const resp=await send(device,"morning",new Date().toISOString().slice(0,10));
   if(!resp.ok)return reply({error:"Push service rejected the test ("+resp.status+")"},502);
   return reply({sent:true});
  }
  return reply({error:"Unknown action"},400);
 }catch(e){console.error("PULSE error",e?.message||e);return reply({error:"PULSE service error. Try again."},502)}
});
