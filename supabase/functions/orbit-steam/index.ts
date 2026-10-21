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
// Never include the Steam API key, request URL or raw provider responses in diagnostics.
function steamFailure(code,message){
  const e=new Error(message);e.code=code;return e;
}
async function steamCall(service,method,version,params,key){
  let res;
  try{
    res=await fetch(steamUrl(service,method,version,params,key),{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(12000)});
  }catch(_){throw steamFailure("NETWORK","Steam could not be reached (network error or timeout).");}
  if(res.status===429)throw steamFailure("HTTP_429","Steam rate limit (HTTP 429). Try again later.");
  if(res.status===403){
    // Steam may include a stable reason in the 403 JSON body. Inspect only
    // known provider phrases; never return arbitrary remote HTML or response text.
    let reason="";
    try{
      const body=await res.json();
      reason=String(body?.playerstats?.error||body?.error||"").toLowerCase().slice(0,160);
    }catch(_){}
    if(reason.includes("profile is not public")||reason.includes("profile not public")){
      throw steamFailure("PROFILE_PRIVATE","Steam reports that the profile is not public. To share achievements, set My Profile and Game details to Public in Steam privacy settings.");
    }
    if(reason.includes("requested app has no stats")){
      throw steamFailure("NO_STATS","Steam reports no accessible achievement stats for this game. This may be a game without achievements or a visibility restriction.");
    }
    throw steamFailure("HTTP_403","Steam denied the achievement request (HTTP 403) without a definitive reason.");
  }
  if(res.status===401)throw steamFailure("HTTP_401","Steam refused this API key (HTTP 401).");
  if(res.status===400 && service==="ISteamUserStats" && method==="GetPlayerAchievements"){
    // Valve returns HTTP 400 with {playerstats:{error:"Requested app has no stats",success:false}}
    // for many games without Steam achievements. This is not a transport failure.
    let reason="";
    try{
      const body=await res.json();
      reason=String(body?.playerstats?.error||body?.error||"").toLowerCase().slice(0,160);
    }catch(_){}
    if(reason.includes("requested app has no stats")){
      throw steamFailure("NO_STATS","Steam reports that this game has no accessible achievement stats.");
    }
    throw steamFailure("HTTP_400","Steam returned HTTP 400 for this game's achievement request.");
  }
  if(!res.ok)throw steamFailure("HTTP_"+res.status,"Steam returned HTTP "+res.status+".");
  try{return await res.json();}catch(_){throw steamFailure("INVALID_JSON","Steam returned a response that could not be decoded.");}
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
async function profileVisibility(steamid,key){
  try{
    const summary=await steamCall("ISteamUser","GetPlayerSummaries","2",{steamids:steamid},key);
    const item=summary?.response?.players?.find(p=>String(p.steamid)===String(steamid));
    return item?.communityvisibilitystate===3?"public":item?.communityvisibilitystate?"private":"unknown";
  }catch(_){return "unknown";}
}
// On a per-game 403, independently inspect Steam's current public visibility.
// Do not expose credentials or the raw Steam response to the browser.
async function checkPublicVisibility(steamid,appid,key){
  const profile=await profileVisibility(steamid,key);
  let gameVisibility="unknown";
  try{
    const library=await steamCall("IPlayerService","GetOwnedGames","0001",
      {steamid,include_appinfo:0,include_played_free_games:1},key);
    const visibleGames=library?.response?.games;
    if(Array.isArray(visibleGames)){
      gameVisibility=visibleGames.some(g=>Number(g.appid)===Number(appid))?"visible":"not_listed";
    }else if(library?.response&&Number(library.response.game_count)===0){
      gameVisibility="not_listed";
    }
  }catch(_){}
  return {profile,gameVisibility};
}
// A no-stats response is frequently a normal game without achievements.
// Confirm from the game's public schema before storing a zero-achievement result.
async function handleNoStats(db,owner,appid,key){
  let schema;
  try{
    schema=await steamCall("ISteamUserStats","GetSchemaForGame","2",{appid,l:"english"},key);
  }catch(_){
    const message="Steam has no accessible achievement stats for this title. Achievement support could not be verified.";
    const {error:e}=await db.from("orbit_steam_games").update({
      achievement_error:message,achievements_checked_at:new Date().toISOString()
    }).eq("owner_id",owner).eq("app_id",appid);
    if(e)throw e;
    return {app_id:appid,ok:false,code:"STATS_UNVERIFIED",message};
  }
  const achievements=schema?.game?.availableGameStats?.achievements;
  if(schema?.game && (!Array.isArray(achievements)||achievements.length===0)){
    const {error:e}=await db.from("orbit_steam_games").update({
      achievements_total:0,achievements_unlocked:0,achievement_error:null,
      achievements_checked_at:new Date().toISOString()
    }).eq("owner_id",owner).eq("app_id",appid);
    if(e)throw e;
    return {app_id:appid,ok:true,noAchievements:true,total:0,unlocked:0};
  }
  const message="Steam lists achievements for this game, but player achievement stats were not available.";
  const {error:e}=await db.from("orbit_steam_games").update({
    achievement_error:message,achievements_checked_at:new Date().toISOString()
  }).eq("owner_id",owner).eq("app_id",appid);
  if(e)throw e;
  return {app_id:appid,ok:false,code:"STATS_UNAVAILABLE",message};
}
async function achievements(db,owner,steamid,appid,key){
  let result;
  try{
    result=await steamCall("ISteamUserStats","GetPlayerAchievements","0001",{steamid,appid,l:"english"},key);
  }catch(ex){
    if(ex?.code==="NO_STATS")return await handleNoStats(db,owner,appid,key);
    let code=typeof ex?.code==="string"&&/^(HTTP_[0-9]{3}|NETWORK|INVALID_JSON|PROFILE_PRIVATE|NO_STATS)$/.test(ex.code)?ex.code:"UNKNOWN";
    let message=code==="UNKNOWN"?"Unexpected Steam achievement request failure.":String(ex.message);
    if(code==="PROFILE_PRIVATE" || code==="HTTP_403"){
      const visibility=await checkPublicVisibility(steamid,appid,key);
      if(visibility.profile==="private"){
        code="PROFILE_PRIVATE";
        message="Steam's public API still sees your profile as private. Confirm My Profile is Public in Steam and allow time for the change to propagate.";
      }else if(visibility.profile==="public"&&visibility.gameVisibility==="not_listed"){
        code="GAME_NOT_PUBLIC";
        message="Your Steam profile is public, but this game is not listed in the public game library. Verify Game details is Public and the game is not individually marked Private.";
      }else if(visibility.profile==="public"&&visibility.gameVisibility==="visible"){
        code="ACHIEVEMENTS_FORBIDDEN";
        message="Steam confirms your profile and this game are public, but its achievement API still refuses access. This can happen while a privacy change propagates; try again later.";
      }else if(visibility.profile==="public"){
        code="GAME_DETAILS_UNVERIFIED";
        message="Steam confirms your profile is public, but game visibility could not be verified. Check Game details privacy and retry after the setting propagates.";
      }else if(visibility.gameVisibility==="visible"){
        code="ACHIEVEMENTS_FORBIDDEN";
        message="Your game is visible in Steam's public library, but Steam's achievement API still refuses access. Try again after the privacy update propagates.";
      }else if(code==="PROFILE_PRIVATE"){
        message="Steam's achievement API still reports that the profile is not public, but TROPHY could not independently verify visibility. Confirm My Profile and Game details are Public, then retry.";
      }
    }
    const {error:e}=await db.from("orbit_steam_games").update({achievement_error:message,achievements_checked_at:new Date().toISOString()}).eq("owner_id",owner).eq("app_id",appid);
    if(e)throw e;
    // Return only sanitized error codes and descriptions, never credentials or URLs.
    return {app_id:appid,ok:false,code,message};
  }
  const player=result?.playerstats;
  if(!player?.success || !Array.isArray(player.achievements)){
    // A 200 response with success:false or no achievements may also be a
    // legitimate title without Steam stats (e.g., standalone older games).
    // Confirm against the game's schema rather than claiming sync success.
    if(player?.success===false || (player && !Array.isArray(player.achievements))){
      return await handleNoStats(db,owner,appid,key);
    }
    const message="Steam returned no achievement data for this title.";
    const {error:e}=await db.from("orbit_steam_games").update({achievement_error:message,achievements_checked_at:new Date().toISOString()}).eq("owner_id",owner).eq("app_id",appid);
    if(e)throw e;
    return {app_id:appid,ok:false,code:"NO_ACHIEVEMENTS",message};
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
    let q=db.from("orbit_steam_games").select("app_id").eq("owner_id",owner);
    if(body.action==="sync_failed"){
      // Retry only previously failed games, each no more than once per run.
      q=q.not("achievement_error","is",null).lt("achievements_checked_at",cutoff);
    }else{
      q=q.or("achievements_checked_at.is.null,achievements_checked_at.lt."+cutoff);
    }
    const {data,error:e}=await q.order("achievements_checked_at",{ascending:true,nullsFirst:true}).limit(6);
    if(e)throw e;ids=(data||[]).map(x=>x.app_id);
  }
  const processed=[];
  let blocked=null;
  for(const appid of ids){
    const item=await achievements(db,owner,steamid,appid,key);
    processed.push(item);
    // Do not send hundreds of doomed requests after an identical account-wide
    // auth/rate-limit failure. Not all HTTP failures are account-wide.
    if(body.action!=="sync_game" && processed.length>=2){
      const a=processed[processed.length-1],b=processed[processed.length-2];
      if(!a.ok && !b.ok && a.code===b.code && ["HTTP_401","HTTP_403","HTTP_429","PROFILE_PRIVATE","GAME_NOT_PUBLIC","GAME_DETAILS_UNVERIFIED","ACHIEVEMENTS_FORBIDDEN","NETWORK"].includes(a.code)){
        blocked={code:a.code,message:a.message};
        break;
      }
    }
  }
  return reply({processed,blocked,more:!blocked&&body.action!=="sync_game"&&ids.length===6});
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
    if(body.action==="sync_batch"||body.action==="sync_game"||body.action==="sync_failed")return await batch(db,user.id,account.steam_id,key,body);
    return error("Unsupported action.");
  }catch(ex){console.error("TROPHY sync:",String(ex?.message||ex).slice(0,160));return error("TROPHY server encountered an unexpected error. Steam privacy is not necessarily the cause.",502);}
});