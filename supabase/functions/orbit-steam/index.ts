// TROPHY - secure, owner-scoped Steam synchronizer for ORBIT.
// Configure STEAM_WEB_API_KEY as a Supabase Edge Function secret. Never put it in browser code.
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const ORIGIN = "https://reece1919.github.io";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://zdurujqwhxqrwbhwzzxg.supabase.co";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_Xa0DTx_PbvtynbiQN6_xNQ_l1D55vzK";
const CORS = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
const error=(message,status=400)=>reply({error:message},status);
const safeInt=n=>Number.isSafeInteger(Number(n)) && Number(n)>=0 ? Math.min(Number(n),2147483647) : 0;
const asTime=seconds=>Number(seconds)>0 && Number.isFinite(Number(seconds)) ? new Date(Number(seconds)*1000).toISOString() : null;
function steamUrl(service,method,version,params,key){
  const url=new globalThis.URL("https://api.steampowered.com/"+service+"/"+method+"/v"+version+"/");
  url.searchParams.set("key",key);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  return url;
}
async function steamCall(service,method,version,params,key){
  const res=await fetch(steamUrl(service,method,version,params,key),{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(12000)});
  if(res.status===429)throw new Error("Steam is rate-limiting requests. Retry later.");
  if(res.status===403||res.status===401)throw new Error("Steam rejected this API key or the profile is private.");
  if(!res.ok)throw new Error("Steam API returned HTTP "+res.status);
  return res.json();
}
async function connected(db,owner){
  const {data,error:e}=await db.from("orbit_steam_connections").select("steam_id,last_synced_at").eq("owner_id",owner).maybeSingle();
  if(e)throw e;return data;
}
async function connect(db,owner,steamid){
  if(typeof steamid!=="string" || !/^[0-9]{17}$/.test(steamid))return error("Enter a 17-digit SteamID64, not a profile name.");
  const old=await connected(db,owner);
  if(old && old.steam_id!==steamid){
    const {error:e}=await db.from("orbit_steam_games").delete().eq("owner_id",owner);if(e)throw e;
  }
  const {error:e}=await db.from("orbit_steam_connections").upsert({owner_id:owner,steam_id:steamid,updated_at:new Date().toISOString(),...(old?.steam_id===steamid?{}:{last_synced_at:null})});
  if(e)throw e;return reply({connected:true,steam_id:steamid});
}
async function library(db,owner,steamid,key){
  const result=await steamCall("IPlayerService","GetOwnedGames","0001",{steamid,include_appinfo:1,include_played_free_games:1},key);
  if(!result?.response || !Array.isArray(result.response.games))return error("Steam did not return a visible game library. Check Steam privacy settings (Game details: Public).",422);
  const games=result.response.games.slice(0,10000).filter(g=>Number.isSafeInteger(Number(g.appid)) && Number(g.appid)>0).map(g=>({
    owner_id:owner,app_id:Number(g.appid),name:String(g.name||"Game "+g.appid).slice(0,220),
    playtime_minutes:safeInt(g.playtime_forever),last_played_at:asTime(g.rtime_last_played),
    icon_hash:/^[a-f0-9]{0,80}$/i.test(g.img_icon_url||"")?String(g.img_icon_url||""):""
  }));
  for(let n=0;n<games.length;n+=200){
    // Update only library metadata. Preserve already collected achievement counts.
    const {error:e}=await db.from("orbit_steam_games").upsert(games.slice(n,n+200),{onConflict:"owner_id,app_id",ignoreDuplicates:false});
    if(e)throw e;
  }
  const now=new Date().toISOString();
  const {error:e}=await db.from("orbit_steam_connections").update({last_synced_at:now,updated_at:now}).eq("owner_id",owner);
  if(e)throw e;
  return reply({games:games.length,updated_at:now});
}
async function achievements(db,owner,steamid,appid,key){
  let result;
  try{
    result=await steamCall("ISteamUserStats","GetPlayerAchievements","0001",{steamid,appid,l:"english"},key);
  }catch(ex){
    await db.from("orbit_steam_games").update({achievement_error:"Unavailable from Steam",achievements_checked_at:new Date().toISOString()}).eq("owner_id",owner).eq("app_id",appid);
    return {app_id:appid,ok:false,message:String(ex.message).includes("rate-limiting")?"Steam rate limit":"Achievements unavailable"};
  }
  const player=result?.playerstats;
  if(!player?.success || !Array.isArray(player.achievements)){
    await db.from("orbit_steam_games").update({achievement_error:"Not exposed by Steam",achievements_checked_at:new Date().toISOString()}).eq("owner_id",owner).eq("app_id",appid);
    return {app_id:appid,ok:false,message:"No achievement data"};
  }
  const achieved=new Map(player.achievements.map(a=>[String(a.apiname||""),a]));
  let schema=[];
  try{
    const s=await steamCall("ISteamUserStats","GetSchemaForGame","2",{appid,l:"english"},key);
    schema=s?.game?.availableGameStats?.achievements||[];
  }catch(_){ /* Player achievement list remains an authoritative fallback. */ }
  const list=(schema.length?schema:player.achievements).slice(0,1500);
  const rows=list.map(a=>{
    const name=String(a.name||a.apiname||"").slice(0,300);
    const unlocked=achieved.get(name) || (a.apiname?achieved.get(String(a.apiname)):null);
    const done=Number(unlocked?.achieved||0)===1;
    const icon=String(a.icon||a.icongray||"");
    return {owner_id:owner,app_id:appid,api_name:name,display_name:String(a.displayName||unlocked?.name||name).slice(0,300),
      description:String(a.description||unlocked?.description||"").slice(0,1200),
      icon_url:/^https:\/\/(?:steamcdn-a\.akamaihd\.net|cdn\.cloudflare\.steamstatic\.com|community\.akamai\.steamstatic\.com|steamcommunity-a\.akamaihd\.net)\//i.test(icon)?icon.slice(0,800):"",
      hidden:Boolean(a.hidden),unlocked:done,unlocked_at:done?asTime(unlocked?.unlocktime):null};
  }).filter(r=>r.api_name);
  if(rows.length){
    for(let i=0;i<rows.length;i+=200){
      const {error:e}=await db.from("orbit_steam_achievements").upsert(rows.slice(i,i+200),{onConflict:"owner_id,app_id,api_name"});if(e)throw e;
    }
  }
  const total=rows.length;
  const done=rows.filter(x=>x.unlocked).length;
  const {error:e}=await db.from("orbit_steam_games").update({achievements_total:total,achievements_unlocked:done,achievement_error:null,achievements_checked_at:new Date().toISOString()}).eq("owner_id",owner).eq("app_id",appid);
  if(e)throw e;
  return {app_id:appid,ok:true,total,unlocked:done};
}
async function batch(db,owner,steamid,key,body){
  let ids=[];
  if(body.action==="sync_game"){
    const id=Number(body.app_id);
    if(!Number.isSafeInteger(id)||id<=0)return error("Invalid Steam app ID.");
    const {data,error:e}=await db.from("orbit_steam_games").select("app_id").eq("owner_id",owner).eq("app_id",id).maybeSingle();
    if(e)throw e;if(!data)return error("This game is not in your connected Steam library.",404);
    ids=[id];
  }else{
    const cutoff=String(body.before||"");
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(cutoff))return error("Invalid sync cutoff.");
    const {data,error:e}=await db.from("orbit_steam_games").select("app_id").eq("owner_id",owner)
      .or("achievements_checked_at.is.null,achievements_checked_at.lt."+cutoff)
      .order("achievements_checked_at",{ascending:true,nullsFirst:true}).limit(6);
    if(e)throw e;ids=(data||[]).map(x=>x.app_id);
  }
  const processed=[];
  for(const appid of ids)processed.push(await achievements(db,owner,steamid,appid,key));
  return reply({processed,more:body.action!=="sync_game" && ids.length===6});
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return error("Method not allowed",405);
  if(req.headers.get("origin")!==ORIGIN)return error("Origin not allowed",403);
  const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!bearer || bearer.split(".").length!==3)return error("Sign into ORBIT first.",401);
  const db=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+bearer}}});
  try{
    const {data:{user},error:authError}=await db.auth.getUser(bearer);
    if(authError || !user)return error("Session expired; sign in again.",401);
    const part=bearer.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    const token=JSON.parse(atob(part+"=".repeat((4-part.length%4)%4)));
    if(token.aal!=="aal2")return error("MFA_REQUIRED: Verify your authenticator in ORBIT.",403);
    const body=await req.json();
    if(!body || typeof body!=="object")return error("Invalid request.");
    if(body.action==="connect")return await connect(db,user.id,body.steam_id);
    if(body.action==="disconnect"){
      const {error:e}=await db.from("orbit_steam_connections").delete().eq("owner_id",user.id);if(e)throw e;
      return reply({connected:false});
    }
    const account=await connected(db,user.id);
    if(!account)return error("Connect your SteamID64 first.",409);
    const key=Deno.env.get("STEAM_WEB_API_KEY")||"";
    if(!key)return error("Steam sync is not configured on the ORBIT server yet. Add STEAM_WEB_API_KEY in Supabase Edge Function secrets.",503);
    if(body.action==="sync_library")return await library(db,user.id,account.steam_id,key);
    if(body.action==="sync_batch"||body.action==="sync_game")return await batch(db,user.id,account.steam_id,key,body);
    return error("Unsupported action.");
  }catch(ex){console.error("TROPHY sync:",String(ex?.message||ex).slice(0,160));return error("TROPHY server encountered an unexpected error. Steam privacy is not necessarily the cause.",502);}
});