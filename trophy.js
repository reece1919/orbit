/* TROPHY - ORBIT's private Steam achievements/completion dashboard. */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 if(!$("trophy-panel"))return;
 const state={db:null,owner:"",account:null,games:[],selected:null,achievements:[],filter:"all",sort:"playtime",search:"",busy:false,epoch:0};
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=s=>{if(!s)return "Not yet";const d=new Date(s);return Number.isNaN(d.getTime())?"Unknown":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});};
 const hours=m=>Math.round((Number(m)||0)/60).toLocaleString();
 const image=app=>Number.isSafeInteger(Number(app))&&Number(app)>0?"https://cdn.cloudflare.steamstatic.com/steam/apps/"+Number(app)+"/header.jpg":"";
 const progress=g=>g.achievements_total>0?Math.round(100*g.achievements_unlocked/g.achievements_total):0;
 const done=g=>g.achievements_total>0&&g.achievements_unlocked===g.achievements_total;
 const checked=g=>g.achievements_checked_at!==null;
 function status(text,bad=false){const el=$("trophy-status");el.textContent=text||"";el.classList.toggle("trophy-error",bad);}
 function lock(busy){
   state.busy=busy;
   for(const id of ["trophy-connect","trophy-sync","trophy-disconnect"]){const el=$(id);if(el)el.disabled=busy;}
 }
 function renderSummary(){
  const games=state.games;const doneCount=games.filter(done).length;
  const achieved=games.reduce((n,g)=>n+(g.achievements_unlocked||0),0);
  const available=games.reduce((n,g)=>n+(g.achievements_total||0),0);
  $("trophy-count-games").textContent=String(games.length);
  $("trophy-count-complete").textContent=String(doneCount);
  $("trophy-count-unlocked").textContent=achieved.toLocaleString()+" / "+available.toLocaleString();
  $("trophy-count-hours").textContent=hours(games.reduce((n,g)=>n+g.playtime_minutes,0));
  $("trophy-connection").hidden=!!state.account;
  $("trophy-connected").hidden=!state.account;
  $("trophy-library").hidden=!state.account;
  $("trophy-connected-id").textContent=state.account?.steam_id||"";
  $("trophy-last-sync").textContent=state.account?.last_synced_at?"Library synced "+date(state.account.last_synced_at):"Library not yet synced";
 }
 function renderGames(){
  const target=$("trophy-game-list");
  let all=state.games.filter(g=>{
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
    const label=done(g)?"100% COMPLETE":g.achievements_total>0?(g.achievements_unlocked+" / "+g.achievements_total+" unlocked"):(checked(g)?"No achievement data":"Awaiting scan");
    return '<button type="button" class="trophy-game'+(state.selected===g.app_id?' trophy-selected':'')+'" data-trophy-app="'+g.app_id+'"><img loading="lazy" alt="" src="'+image(g.app_id)+'"><span class="trophy-game-info"><strong>'+esc(g.name)+'</strong><small>'+esc(label)+' · '+hours(g.playtime_minutes)+' hr</small><span class="trophy-bar"><i style="width:'+progress(g)+'%"></i></span></span><span class="trophy-game-percent">'+(g.achievements_total>0?progress(g)+"%":"—")+'</span></button>';
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
 function renderDetails(){
  const host=$("trophy-details");
  const game=state.games.find(x=>x.app_id===state.selected);
  if(!game){host.innerHTML='<p class="trophy-empty">Choose a game to inspect its achievements.</p>';return;}
  const list=state.achievements.filter(x=>x.app_id===game.app_id)
    .sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||new Date(b.unlocked_at||0)-new Date(a.unlocked_at||0)||a.display_name.localeCompare(b.display_name));
  host.innerHTML='<div class="trophy-detail-heading"><h3>'+esc(game.name)+'</h3><button type="button" class="quiet-pill" data-trophy-reload="'+game.app_id+'" '+(state.busy?"disabled":"")+'>Rescan game</button></div><p>'+ (game.achievements_total===null?"Achievement data has not been retrieved yet.":game.achievements_total+" achievements · "+game.achievements_unlocked+" unlocked")+'</p>'
   +(list.length?'<div class="trophy-achievements">'+list.map(a=>'<div class="trophy-achievement '+(a.unlocked?"is-unlocked":"")+'"><span class="trophy-achievement-mark">'+(a.unlocked?"✓":"○")+'</span><div><strong>'+esc(a.hidden&&!a.unlocked?"Hidden achievement":a.display_name||a.api_name)+'</strong><small>'+esc(a.hidden&&!a.unlocked?"Unlock to reveal details":a.description||"")+(a.unlocked_at?" · "+date(a.unlocked_at):"")+'</small></div></div>').join("")+'</div>':'<p class="trophy-empty">No individual achievements available.</p>');
 }
 function render(){renderSummary();renderGames();renderDetails();renderRecent();}
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
  finally{lock(false);renderDetails();}
 }
 async function sync(full){
  await task("Refreshing your Steam library…",async()=>{
   const {games}=await invoke("sync_library");
   await load();status("Library updated: "+games+" games. Scanning achievements…");
   const before=new Date().toISOString();
   let checked=0,failed=0;
   // Full sync is explicit; connection initially scans a manageable first 12 games.
   const max=full?Math.ceil(Math.max(state.games.length,1)/6)+1:2;
   for(let i=0;i<max;i++){
    const result=await invoke("sync_batch",{before});
    if(!result.processed?.length)break;
    checked+=result.processed.length;
    failed+=result.processed.filter(x=>!x.ok).length;
    status("Steam scan: "+checked+" games checked"+(failed?" · "+failed+" unavailable":"")+"…");
    if(!result.more)break;
   }
   await load();
   status("Steam scan finished: "+checked+" games checked"+(failed?" · "+failed+" without achievement data":"")+".");
  });
 }
 async function loadGame(appid){
  state.selected=appid;
  $("trophy-details").innerHTML='<p class="trophy-empty">Loading achievements…</p>';
  const ep=state.epoch;
  const {data,error}=await state.db.from("orbit_steam_achievements").select("*").eq("owner_id",state.owner).eq("app_id",appid).order("unlocked",{ascending:false}).limit(1500);
  if(error){status(error.message,true);return;}
  if(ep!==state.epoch||state.selected!==appid)return;
  state.achievements=state.achievements.filter(x=>x.app_id!==appid).concat(data||[]);
  render();
 }
 async function reset(user){
  const owner=user?.id||"";
  if(owner===state.owner&&state.db)return;
  ++state.epoch;
  state.owner=owner;state.db=owner?window.ORBITAuth?.client:null;
  state.account=null;state.games=[];state.achievements=[];state.selected=null;state.busy=false;
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
 document.addEventListener("orbit:auth-changed",e=>void reset(e.detail?.user));
 if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>reset(window.ORBITAuth.user));else void reset(null);
})();