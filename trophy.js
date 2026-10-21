/* TROPHY - ORBIT's private Steam achievements/completion dashboard. */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 if(!$("trophy-panel"))return;
 const state={db:null,owner:"",account:null,games:[],selected:null,achievements:[],filter:"all",sort:"playtime",search:"",achievementFilter:"remaining",achievementSearch:"",gameLoading:false,busy:false,epoch:0};
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=s=>{if(!s)return "Not yet";const d=new Date(s);return Number.isNaN(d.getTime())?"Unknown":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});};
 const hours=m=>Math.round((Number(m)||0)/60).toLocaleString();
 const image=app=>Number.isSafeInteger(Number(app))&&Number(app)>0?"https://cdn.cloudflare.steamstatic.com/steam/apps/"+Number(app)+"/header.jpg":"";
 const heroImage=app=>Number.isSafeInteger(Number(app))&&Number(app)>0?"https://cdn.cloudflare.steamstatic.com/steam/apps/"+Number(app)+"/library_hero.jpg":"";
 const palettes=[
   ["#c3a17a","#402534"],["#73b4bf","#123b50"],["#e0b85a","#3e334d"],
   ["#a7c568","#254437"],["#d49075","#482a30"],["#93a7d9","#27365a"],
   ["#dcbb84","#393e50"],["#8dc8b4","#154c4b"],["#d3a5d4","#3e2b5a"]
 ];
 function palette(g){
   const id=String(g.app_id),name=String(g.name||"").toLowerCase();
   if(/hogwarts/.test(name))return ["#cfb189","#2c2643"];
   if(/cyberpunk/.test(name))return ["#f0da55","#343b21"];
   if(/witcher/.test(name))return ["#c3b7b1","#382c35"];
   if(/stardew/.test(name))return ["#aad58a","#285b4b"];
   if(/elden ring/.test(name))return ["#d0ac70","#353027"];
   const n=[...id].reduce((acc,c)=>acc*31+c.charCodeAt(0),7);
   return palettes[n%palettes.length];
 }
 function artStyle(g){const [accent,shade]=palette(g);return "--trophy-game-accent:"+accent+";--trophy-game-shade:"+shade+";";}
 const progress=g=>g.achievements_total>0?Math.round(100*g.achievements_unlocked/g.achievements_total):0;
 const done=g=>g.achievements_total>0&&g.achievements_unlocked===g.achievements_total;
 const checked=g=>g.achievements_checked_at!==null && !g.achievement_error;
 function status(text,bad=false){const el=$("trophy-status");el.textContent=text||"";el.classList.toggle("trophy-error",bad);}
 function lock(busy){
   state.busy=busy;
   for(const id of ["trophy-connect","trophy-sync","trophy-disconnect"]){const el=$(id);if(el)el.disabled=busy;}
 }
 function renderSummary(){
  const games=state.games, game=games.find(x=>x.app_id===state.selected),isGame=!!game;
  const achieved=games.reduce((n,g)=>n+(g.achievements_unlocked||0),0);
  const available=games.reduce((n,g)=>n+(g.achievements_total||0),0);
  $("trophy-count-games").textContent=String(games.length);
  $("trophy-count-complete").textContent=String(games.filter(done).length);
  $("trophy-count-unlocked").textContent=available>0?achieved.toLocaleString()+" / "+available.toLocaleString():"— / —";
  $("trophy-count-hours").textContent=hours(games.reduce((n,g)=>n+g.playtime_minutes,0));
  $("trophy-connection").hidden=!!state.account;
  $("trophy-connected").hidden=!state.account;
  $("trophy-stats").hidden=isGame;
  $("trophy-connection-card").hidden=isGame;
  $("trophy-library").hidden=!state.account||isGame;
  $("trophy-game-view").hidden=!isGame;
  $("trophy-connected-id").textContent=state.account?.steam_id||"";
  $("trophy-last-sync").textContent=state.account?.last_synced_at?"Library synced "+date(state.account.last_synced_at):"Library not yet synced";
 }
 function renderGames(){
  const target=$("trophy-game-list");
  const all=state.games.filter(g=>{
    if(state.filter==="recently-played"&&(!g.last_played_at||Date.now()-Date.parse(g.last_played_at)>30*86400000))return false;
    if(state.filter==="nearly-complete"&&!(g.achievements_total>0&&progress(g)>=75&&!done(g)))return false;
    if(state.filter==="not-started"&&g.playtime_minutes>0)return false;
    if(state.filter==="complete"&&!done(g))return false;
    if(state.filter==="progress"&&!(g.achievements_total>0&&!done(g)))return false;
    if(state.filter==="unchecked"&&checked(g))return false;
    return (g.name||"").toLowerCase().includes(state.search.toLowerCase());
  });
  const sorters={
    playtime:(a,b)=>b.playtime_minutes-a.playtime_minutes,
    progress:(a,b)=>progress(b)-progress(a)||b.achievements_unlocked-a.achievements_unlocked,
    name:(a,b)=>a.name.localeCompare(b.name),
    recent:(a,b)=>new Date(b.last_played_at||0)-new Date(a.last_played_at||0)
  };
  all.sort(sorters[state.sort]||sorters.playtime);
  $("trophy-game-count").textContent=all.length+" game"+(all.length===1?"":"s");
  target.innerHTML=all.length?all.map(g=>{
    const label=done(g)?"100% COMPLETE":g.achievements_total>0?(g.achievements_unlocked+" / "+g.achievements_total+" ACHIEVEMENTS"):(g.achievement_error?g.achievement_error:(checked(g)?"NO ACHIEVEMENTS":"AWAITING SCAN"));
    const pct=g.achievements_total>0?progress(g):0;
    return '<button type="button" class="trophy-game trophy-game-gallery-card" data-trophy-app="'+g.app_id+'" style="'+artStyle(g)+'" aria-label="Open '+esc(g.name)+' game details">'
      +'<span class="trophy-gallery-cover"><img loading="lazy" alt="" src="'+image(g.app_id)+'"><span class="trophy-gallery-shade"></span>'
      +(done(g)?'<span class="trophy-gallery-complete">100% COMPLETE</span>':'')+'</span>'
      +'<span class="trophy-gallery-info"><strong>'+esc(g.name)+'</strong><small>'+esc(label)+'</small>'
      +'<span class="trophy-bar"><i style="width:'+pct+'%"></i></span>'
      +'<span class="trophy-gallery-footer"><span>'+hours(g.playtime_minutes)+' HOURS PLAYED</span><b>'+(g.achievements_total>0?pct+"%":"—")+'</b></span></span>'
      +'</button>';
  }).join(""):'<p class="trophy-empty">'+(state.games.length?"No games match this filter.":"Your Steam library will appear here after your first sync.")+"</p>";
 }
 function renderRecent(){
  const host=$("trophy-recent");
  const all=state.games;
  const list=state.achievements.filter(x=>x.unlocked_at).sort((a,b)=>new Date(b.unlocked_at)-new Date(a.unlocked_at)).slice(0,8);
  host.innerHTML=list.length?list.map(a=>{
    const g=all.find(x=>x.app_id===a.app_id);
    return '<div class="trophy-recent-item"><strong>'+esc(a.display_name||a.api_name)+'</strong><span>'+esc(g?.name||"Steam game")+' · '+date(a.unlocked_at)+'</span></div>';
  }).join(""):'<p class="trophy-empty">Recently unlocked achievements will appear as game scans complete.</p>';
 }
 function renderGamePage(){
  const host=$("trophy-game-achievement-list"),g=state.games.find(x=>x.app_id===state.selected);
  if(!g)return;
  const [accent,shade]=palette(g),hero=$("trophy-game-hero"),art=$("trophy-game-hero-art");
  hero.style.setProperty("--trophy-game-accent",accent);
  hero.style.setProperty("--trophy-game-shade",shade);
  $("trophy-game-view").style.setProperty("--trophy-game-accent",accent);
  $("trophy-game-view").style.setProperty("--trophy-game-shade",shade);
  if(art.dataset.appId!==String(g.app_id)){
    art.dataset.appId=String(g.app_id);art.dataset.fallback="";
    art.hidden=false;art.src=heroImage(g.app_id);
  }
  $("trophy-game-title").textContent=g.name;
  $("trophy-game-subtitle").textContent=g.achievement_error?g.achievement_error:done(g)?"100% Steam achievements completed":g.achievements_total>0
    ?(g.achievements_unlocked+" of "+g.achievements_total+" Steam achievements unlocked")
    :"Achievement progress not available yet";
  $("trophy-game-percentage").textContent=g.achievements_total>0?progress(g)+"%":"—";
  $("trophy-game-unlocked").textContent=g.achievements_total===null?"—":String(g.achievements_unlocked);
  $("trophy-game-remaining").textContent=g.achievements_total===null?"—":String(g.achievements_total-g.achievements_unlocked);
  $("trophy-game-playtime").textContent=hours(g.playtime_minutes);
  $("trophy-game-lastplayed").textContent=g.last_played_at?date(g.last_played_at):"Unknown";
  const pct=progress(g);
  const prog=$("trophy-game-progress-track");
  prog.setAttribute("aria-valuenow",String(pct));
  $("trophy-game-progress-fill").style.width=pct+"%";
  $("trophy-game-progress-label").textContent=g.achievements_total>0?pct+"% Achievement Completion":"Not yet scanned";
  $("trophy-game-steam-link").href="https://store.steampowered.com/app/"+g.app_id+"/";
  const list=state.achievements.filter(x=>x.app_id===g.app_id);
  const remaining=g.achievements_total===null?null:g.achievements_total-g.achievements_unlocked;
  const statusTitle=remaining===null?"Waiting for Steam data":remaining===0&&g.achievements_total>0?"Every achievement unlocked!":g.achievements_total===0?"No achievements listed":remaining+" achievements to go";
  $("trophy-game-status-title").textContent=g.achievement_error?"Achievement data unavailable":statusTitle;
  $("trophy-game-status-copy").textContent=g.achievement_error?g.achievement_error:remaining===null?"Sync this game to check whether Steam reports achievements.":remaining===0&&g.achievements_total>0
    ?"You have completed the full Steam achievement list for this game."
    :g.achievements_total===0?"Steam has not exposed any achievements for this game."
    :"Filter by 'Still to unlock' to focus on your remaining Steam milestones.";
  $("trophy-game-privacy-link").hidden=!g.achievement_error||!/profile|privacy|403|game details/i.test(g.achievement_error);
  $("trophy-game-rescan").disabled=state.busy;
  const earned=list.filter(x=>x.unlocked&&x.unlocked_at).sort((a,b)=>new Date(b.unlocked_at)-new Date(a.unlocked_at)).slice(0,6);
  $("trophy-game-timeline").innerHTML=earned.length?earned.map(a=>'<div class="trophy-game-timeline-item"><span class="trophy-game-timeline-dot"></span><div><strong>'+esc(a.display_name||a.api_name)+'</strong><small>'+date(a.unlocked_at)+'</small></div></div>').join(""):'<p class="trophy-empty">No dated unlocks available yet.</p>';
  if(state.gameLoading){
    $("trophy-game-achievement-count").textContent="Loading…";
    host.innerHTML='<p class="trophy-empty">Loading this game\'s achievements…</p>';
    return;
  }
  const filtered=list.filter(a=>
    (state.achievementFilter==="all"||(state.achievementFilter==="remaining"?!a.unlocked:a.unlocked))
    &&(a.display_name+" "+(a.hidden&&!a.unlocked?"":a.description)+" "+a.api_name).toLowerCase().includes(state.achievementSearch.toLowerCase())
  ).sort((a,b)=>Number(a.unlocked)-Number(b.unlocked)||new Date(b.unlocked_at||0)-new Date(a.unlocked_at||0)||String(a.display_name).localeCompare(String(b.display_name)));
  $("trophy-game-achievement-count").textContent=filtered.length+" shown";
  const safeIcon=x=>{
    try{const u=new URL(String(x||""));return u.protocol==="https:"&&["steamcdn-a.akamaihd.net","cdn.cloudflare.steamstatic.com","community.akamai.steamstatic.com","steamcommunity-a.akamaihd.net"].includes(u.hostname)?u.href:"";}catch{return ""}
  };
  host.innerHTML=filtered.length?filtered.map(a=>{
    const hidden=a.hidden&&!a.unlocked, icon=hidden?"":safeIcon(a.icon_url);
    return '<article class="trophy-game-achievement '+(a.unlocked?"is-unlocked":"")+'"><span class="trophy-game-achievement-art">'
      +(icon?'<img alt="" loading="lazy" src="'+esc(icon)+'">':'<span aria-hidden="true">'+(a.unlocked?"★":"◇")+'</span>')+'</span>'
      +'<div class="trophy-game-achievement-text"><strong>'+esc(hidden?"Hidden achievement":a.display_name||a.api_name)+'</strong><p>'+esc(hidden?"Unlock it to reveal its details.":a.description||"No description provided by Steam.")+'</p>'
      +(a.unlocked_at?'<small>UNLOCKED '+date(a.unlocked_at)+'</small>':(a.unlocked?'<small>UNLOCKED</small>':'<small>NOT YET UNLOCKED</small>'))
      +'</div><span class="trophy-game-achievement-symbol" aria-hidden="true">'+(a.unlocked?"✓":"○")+'</span></article>';
  }).join(""):'<p class="trophy-empty">'+(g.achievement_error?esc(g.achievement_error):g.achievements_total===null?"Achievement data has not been scanned. Choose Rescan game.":list.length?"No achievements match these filters.":"This game has no available individual achievement records.")+"</p>";
 }
 function render(){renderSummary();renderGames();renderGamePage();renderRecent();}
 async function load(){
  if(!state.db||!state.owner)return;
  const ep=state.epoch, db=state.db;
  const {data:account,error:ce}=await db.from("orbit_steam_connections").select("steam_id,last_synced_at").eq("owner_id",state.owner).maybeSingle();
  if(ce)throw ce;if(ep!==state.epoch)return;
  state.account=account||null;
  if(!account){state.games=[];state.achievements=[];state.selected=null;render();return;}
  const games=[];
  for(let from=0;from<10000;from+=1000){
    const {data,error:e}=await db.from("orbit_steam_games").select("*").eq("owner_id",state.owner).order("playtime_minutes",{ascending:false}).range(from,from+999);
    if(e)throw e;games.push(...(data||[]));if(!data||data.length<1000)break;
  }
  const recent=await db.from("orbit_steam_achievements").select("app_id,api_name,display_name,unlocked,unlocked_at").eq("owner_id",state.owner).eq("unlocked",true).order("unlocked_at",{ascending:false}).limit(12);
  if(recent.error)throw recent.error;
  if(ep!==state.epoch)return;
  state.games=games;
  state.achievements=(recent.data||[]);
  render();
 }
 async function invoke(action,more={}){
  const {data,error}=await state.db.functions.invoke("orbit-steam",{body:{action,...more}});
  if(error){
   // Edge error responses include diagnostic JSON; supabase-js exposes the response on context.
   let message=error.message||"Steam request failed";
   if(error.context?.json){try{const body=await error.context.json();if(body?.error)message=body.error;}catch(_){}}
   throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data;
 }
 async function task(label,fn){
  if(state.busy||!state.owner)return;
  lock(true);status(label);
  try{await fn();}
  catch(e){status(e.message||"TROPHY request failed.",true);}
  finally{lock(false);renderGamePage();}
 }
 async function sync(full){
  await task("Refreshing your Steam library…",async()=>{
   const {games}=await invoke("sync_library");
   await load();status("Library updated: "+games+" games. Scanning achievements…");
   const before=new Date().toISOString();
   let checked=0,failed=0,blocked=null,firstFailure=null;
   // Full sync is explicit; connection initially scans a manageable first 12 games.
   const max=full?Math.ceil(Math.max(state.games.length,1)/6)+1:2;
   for(let i=0;i<max;i++){
    const result=await invoke("sync_batch",{before});
    if(!result.processed?.length)break;
    checked+=result.processed.length;
    failed+=result.processed.filter(x=>!x.ok).length;
    firstFailure ||=result.processed.find(x=>!x.ok)?.message||null;
    status("Steam scan: "+checked+" games checked"+(failed?" · "+failed+" unavailable":"")+"…");
    if(result.blocked){blocked=result.blocked;break;}
    if(!result.more)break;
   }
   await load();
   if(blocked){
     status("Achievement sync paused after "+checked+" tests: "+blocked.message+" Your game library and hours remain saved.",true);
   }else if(failed){
     status("Steam scan completed: "+checked+" games checked, "+failed+" unavailable. "+(firstFailure||"Some games may not support Steam achievements."),true);
   }else status("Steam scan finished: "+checked+" games checked. Achievements are up to date.");
  });
 }
 async function loadGame(appid){
  if(!state.db||!state.owner)return;
  state.selected=appid;state.achievementFilter="remaining";state.achievementSearch="";
  $("trophy-game-achievement-filter").value="remaining";
  $("trophy-game-achievement-search").value="";
  state.gameLoading=true;render();
  window.scrollTo({top:0,behavior:"instant"});
  const ep=state.epoch;
  const {data,error}=await state.db.from("orbit_steam_achievements").select("*").eq("owner_id",state.owner).eq("app_id",appid).order("unlocked",{ascending:false}).limit(1500);
  if(ep!==state.epoch||state.selected!==appid)return;
  state.gameLoading=false;
  if(error){status(error.message,true);render();return;}
  state.achievements=state.achievements.filter(x=>x.app_id!==appid).concat(data||[]);
  render();
 }
 async function reset(user){
  const owner=user?.id||"";
  if(owner===state.owner&&state.db)return;
  ++state.epoch;
  state.owner=owner;state.db=owner?window.ORBITAuth?.client:null;
  state.account=null;state.games=[];state.achievements=[];state.selected=null;state.busy=false;state.gameLoading=false;
  status(owner?"Loading TROPHY…":"Sign in to ORBIT to open TROPHY.");render();
  if(!owner)return;
  try{
    await load();status("");
    const synced=state.account?.last_synced_at?Date.parse(state.account.last_synced_at):0;
    if(state.account && (!synced || Date.now()-synced>24*60*60*1000))void sync(false);
  }catch(e){status("Unable to load Steam data. Complete ORBIT two-factor authentication.",true);}
 }
 $("trophy-connect-form").addEventListener("submit",e=>{
  e.preventDefault();const id=$("trophy-steamid").value.trim();
  void task("Linking Steam profile…",async()=>{await invoke("connect",{steam_id:id});await load();status("SteamID saved. Select Sync Steam to import your game library.");});
 });
 $("trophy-sync").addEventListener("click",()=>void sync(true));
 $("trophy-disconnect").addEventListener("click",()=>{
  if(!confirm("Disconnect Steam and delete all cached TROPHY games and achievements?"))return;
  void task("Disconnecting Steam…",async()=>{await invoke("disconnect");await load();status("Steam disconnected.");});
 });
 $("trophy-search").addEventListener("input",e=>{state.search=e.target.value;renderGames();});
 $("trophy-filter").addEventListener("change",e=>{state.filter=e.target.value;renderGames();});
 $("trophy-sort").addEventListener("change",e=>{state.sort=e.target.value;renderGames();});
 $("trophy-game-list").addEventListener("click",e=>{
  const b=e.target.closest("[data-trophy-app]");if(b&&state.db)void loadGame(Number(b.dataset.trophyApp));
 });
 $("trophy-details").addEventListener("click",e=>{
  const b=e.target.closest("[data-trophy-reload]");
  if(!b)return;
  const app=Number(b.dataset.trophyReload);
  void task("Checking this game's achievements…",async()=>{await invoke("sync_game",{app_id:app});await load();await loadGame(app);status("Game refreshed.");});
 });
 $("trophy-game-back").addEventListener("click",()=>{
   state.selected=null;state.gameLoading=false;state.achievementSearch="";render();window.scrollTo({top:0,behavior:"instant"});
 });
 $("trophy-game-rescan").addEventListener("click",()=>{
   if(state.selected===null)return;
   const app=state.selected;
   void task("Refreshing "+(state.games.find(g=>g.app_id===app)?.name||"game")+"…",async()=>{
     const result=await invoke("sync_game",{app_id:app});await load();await loadGame(app);
     const outcome=result.processed?.[0];
     status(outcome?.ok?"Game achievements refreshed.":"Achievement sync failed: "+(outcome?.message||"Steam did not return usable data."),!outcome?.ok);
   });
 });
 $("trophy-game-achievement-filter").addEventListener("change",e=>{state.achievementFilter=e.target.value;renderGamePage();});
 $("trophy-game-achievement-search").addEventListener("input",e=>{state.achievementSearch=e.target.value;renderGamePage();});
 $("trophy-game-hero-art").addEventListener("error",()=>{
   const art=$("trophy-game-hero-art");
   if(!art.dataset.fallback){art.dataset.fallback="1";art.src=image(state.selected);}
   else art.hidden=true;
 });
 document.addEventListener("orbit:auth-changed",e=>void reset(e.detail?.user));
 if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>reset(window.ORBITAuth.user));else void reset(null);
})();