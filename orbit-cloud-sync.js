/* ORBIT cloud sync v1.2 — owner/MFA-scoped, version checked, opt-in on each browser.
 * Local data is never erased before an explicit first-use choice.
 * Credentials / MFA factors / ECHO / GAIA / RUNE datasets are never copied here. */
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const auth = () => window.ORBITAuth;
  const local = () => window.ORBITLocal;
  const statusEl = $("#orbit-sync-status");
  const detailEl = $("#orbit-sync-detail");
  const uploadBtn = $("#orbit-sync-upload");
  const restoreBtn = $("#orbit-sync-restore");
  const refreshBtn = $("#orbit-sync-recheck");
  const pauseBtn = $("#orbit-sync-pause");
  const undoBtn = $("#orbit-sync-undo");
  if(!statusEl || !local())return;

  let owner="", client=null, revision=null, remote=null, baseline=null;
  let enabled=false, checking=false, writing=false, queued=false, timer=null, lastChecked=0, generation=0;
  let cloudUpdated="";
  const modeKey = id => "orbit-sync-enabled-v1:"+id;
  const backupKey = id => "orbit-sync-device-backup-v1:"+id;
  const localSnapshot = () => local().snapshot();
  const serialized = x => JSON.stringify(x);
  const isSame = (a,b) => serialized(a) === serialized(b);
  const setStatus = (text,detail="") => {statusEl.textContent=text;detailEl.textContent=detail};
  const fmt = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "time unavailable" : d.toLocaleString();
  };
  function buttons(){
    const offline = !owner || !client || checking || writing;
    uploadBtn.disabled=offline;
    refreshBtn.disabled=offline;
    restoreBtn.hidden=!remote;
    restoreBtn.disabled=offline || !remote;
    pauseBtn.hidden=!enabled;
    pauseBtn.disabled=offline;
    undoBtn.hidden=!owner || !localStorage.getItem(backupKey(owner));
    undoBtn.disabled=offline;
    uploadBtn.textContent=remote?"Replace cloud with this device":"Start cloud sync from this device";
    if(enabled){
      uploadBtn.hidden=true;
      if(remote)restoreBtn.hidden=true;
    }else uploadBtn.hidden=false;
  }
  function disable(message,detail){
    enabled=false;
    if(owner)try{localStorage.setItem(modeKey(owner),"off")}catch{}
    setStatus(message,detail||"Your device data has been kept. Choose an action to resolve.");
    buttons();
  }
  function saveBackup(){
    if(!owner)return;
    try{
      localStorage.setItem(backupKey(owner),JSON.stringify({savedAt:new Date().toISOString(),data:localSnapshot()}));
    }catch{}
  }
  function applyRemote(row){
    if(!owner)return;
    const current=localSnapshot();
    if(!isSame(current,row.data)){
      saveBackup();
      local().setFromCloud(row.data,owner);
    }
    revision=Number(row.revision);
    remote=row.data;
    baseline=serialized(row.data);
    cloudUpdated=row.updated_at;
    enabled=true;
    try{localStorage.setItem(modeKey(owner),"on")}catch{}
    setStatus("Cloud sync is on","Version "+revision+" · last cloud update "+fmt(cloudUpdated)+". Device backup retained before any cloud restore.");
    buttons();
  }
  async function readCloud(){
    const id=owner,db=client;
    const {data,error}=await db.from("orbit_local_workspaces")
      .select("data,revision,updated_at").eq("owner_id",id).maybeSingle();
    if(error)throw error;
    if(owner!==id || db!==client)throw new Error("Account changed during refresh.");
    lastChecked=Date.now();
    return data || null;
  }
  async function allowed(){
    const a=await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(a.error)throw a.error;
    return a.data?.currentLevel==="aal2";
  }
  async function inspect(){
    if(!owner || !client || checking || writing)return;
    const tick=generation;
    checking=true;buttons();
    try{
      if(!await allowed()){
        disable("Authenticator verification required","Complete the MFA prompt in ORBIT to access synced data.");
        return;
      }
      const row=await readCloud();
      if(tick!==generation)return;
      const previousRevision=revision;
      revision=row?Number(row.revision):0;
      remote=row?.data||null;
      cloudUpdated=row?.updated_at||"";
      const current=localSnapshot();
      const currentString=serialized(current);
      const cloudString=row?serialized(row.data):null;
      const wanted=localStorage.getItem(modeKey(owner))==="on";
      if(!row){
        enabled=false;baseline=null;
        setStatus("Cloud workspace not created yet","Your existing device data is safe. Select “Start cloud sync from this device” when ready.");
      }else if(cloudString===currentString){
        baseline=cloudString;
        enabled=wanted;
        setStatus(wanted?"Cloud sync is on":"Cloud copy matches this device",
          "Version "+revision+" · "+fmt(cloudUpdated)+(wanted?" · changes sync automatically.":" · select Restore cloud copy to enable syncing."));
      }else if(wanted && enabled && baseline===currentString && previousRevision!==null){
        applyRemote(row);
      }else{
        enabled=false;
        setStatus("Two different workspace copies found",
          "Nothing has been overwritten. Choose Restore cloud copy or Replace cloud with this device to select the version to keep.");
      }
    }catch(error){
      if(tick===generation)disable("Cloud check failed",error?.message||"Please try again.");
    }finally{checking=false;buttons()}
  }
  async function saveRemote(explicit=false){
    if(!owner||!client||checking||writing || (!enabled&&!explicit))return;
    const id=owner,db=client,stamp=generation,expected=revision??0;
    const snapshot=localSnapshot(),string=serialized(snapshot);
    if(!explicit && string===baseline)return;
    writing=true;buttons();
    setStatus("Saving securely…","Your current device copy remains available.");
    try{
      if(!await allowed())throw new Error("Authenticator verification required before cloud saving.");
      const {data,error}=await db.rpc("orbit_workspace_save",{p_expected_revision:expected,p_data:snapshot});
      if(error)throw error;
      if(stamp!==generation || id!==owner || db!==client)return;
      const saved=Array.isArray(data)?data[0]:data;
      if(!saved?.new_revision)throw new Error("Cloud copy changed on another device. Review it before deciding which copy to keep.");
      revision=Number(saved.new_revision);
      cloudUpdated=saved.saved_at;
      remote=snapshot;baseline=string;
      enabled=true;
      try{localStorage.setItem(modeKey(owner),"on")}catch{}
      setStatus("Cloud sync is on","Version "+revision+" · saved "+fmt(cloudUpdated));
      if(serialized(localSnapshot())!==string)queued=true;
    }catch(e){
      if(stamp===generation)disable("Cloud sync paused",e?.message||"Could not securely save changes.");
    }finally{
      writing=false;buttons();
      if(queued&&enabled){queued=false;scheduleSave()}
    }
  }
  function scheduleSave(){
    if(timer)clearTimeout(timer);
    if(!enabled)return;
    timer=setTimeout(()=>{timer=null;void saveRemote()},1150);
  }
  function reset(nextUser){
    generation+=1;
    if(timer){clearTimeout(timer);timer=null}
    client=auth()?.client||null;
    owner=nextUser?.id || "";
    remote=null;revision=null;baseline=null;cloudUpdated="";
    enabled=false;checking=false;writing=false;queued=false;lastChecked=0;
    if(!owner){
      setStatus("Sign in to connect cloud sync","Private workspace syncing requires your shared ORBIT account and MFA.");
      buttons();return;
    }
    setStatus("Checking your private workspace…","No local records will be replaced automatically.");
    buttons();
    void inspect();
  }

  uploadBtn.addEventListener("click",()=>{
    if(!owner || checking || writing)return;
    if(remote&&!window.confirm("Replace the existing cloud workspace with all data from THIS browser? Other devices will see these changes. Export a backup first if there are differences."))return;
    if(!remote&&!window.confirm("Start secure cloud sync using the workspace currently saved on THIS device? This becomes the starting copy for your other devices."))return;
    void saveRemote(true);
  });
  restoreBtn.addEventListener("click",()=>{
    if(!owner||!remote||checking||writing)return;
    if(!window.confirm("Replace this device's ORBIT workspace with the saved cloud copy? A safety copy of this device's previous workspace will be retained in this browser."))return;
    try{applyRemote({data:remote,revision,updated_at:cloudUpdated})}
    catch(e){disable("Cloud restore failed",e.message)}
  });
  refreshBtn.addEventListener("click",()=>void inspect());
  undoBtn.addEventListener("click",()=>{
    if(!owner || writing || checking)return;
    const saved=localStorage.getItem(backupKey(owner));
    if(!saved)return;
    if(!window.confirm("Restore the most recent device safety copy? Cloud sync will be paused, and your existing cloud version will stay unchanged until you explicitly upload this device."))return;
    try{
      const data=JSON.parse(saved)?.data;
      local().setFromCloud(data,owner);
      disable("Device safety copy restored","Cloud sync paused. Review both versions before choosing whether to replace the remote workspace.");
    }catch(error){setStatus("Could not restore device backup",error?.message||"The backup appears invalid.")}
  });
  pauseBtn.addEventListener("click",()=>{
    if(!owner)return;
    if(timer){clearTimeout(timer);timer=null}
    disable("Cloud sync paused","All device data remains here. Use the refresh button to review remote changes before resuming.");
  });
  document.addEventListener("orbit:local-saved",event=>{
    if(event.detail?.ownerId!==owner || !owner)return;
    if(enabled){
      if(writing)queued=true;
      else scheduleSave();
    }
  });
  document.addEventListener("orbit:auth-changed",event=>reset(event.detail?.user||null));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && enabled && Date.now()-lastChecked>45000)void inspect();
  });
  window.addEventListener("online",()=>{if(enabled)void inspect()});
  if(auth()?.ready)void auth().ready.then(()=>reset(auth().user||null));
})();