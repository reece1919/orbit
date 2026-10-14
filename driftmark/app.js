/* DRIFTMARK 0.5 — automatic source reconciliation preserves author-owned work. */
(()=>{"use strict";
const URL="https://zdurujqwhxqrwbhwzzxg.supabase.co";
const KEY="sb_publishable_Xa0DTx_PbvtynbiQN6_xNQ_l1D55vzK"; // publishable, never a service-role key
const TABLE="driftmark_workspaces";
const W=window.DriftmarkWriting;
const R=window.DriftmarkReconcile;
const CATS=["Locations","Characters","Factions","Lore","Timeline","Scenes","Drafts","Ideas"];
const STATES=["Seed","Researching","Drafting","Ready to publish","Published"];
const $=q=>document.querySelector(q);
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new window.URL(String(v||""));return u.protocol==="https:"?u.href:""}catch(_){return ""}};
const form=$("#entry-form"), search=$("#search"),filter=$("#filter");
const field=name=>form.querySelector('[name="'+name+'"]');
let client=null,uid="",revision=0,entries=[],selected="",dirty=false,connected=false,saving=false,pendingId="",linkedSource=null,linkedLink=null,editorOwner="";
const setStatus=(msg,issue=false)=>{const el=$("#status");el.textContent=msg;el.style.background=issue?"#573a3d":"#2b3b46"};
function download(text,name,type){
 const blob=new Blob([text],{type});const objectURL=window.URL.createObjectURL(blob),a=document.createElement("a");
 a.href=objectURL;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>window.URL.revokeObjectURL(objectURL),500);
}
const desk=window.DriftmarkWorkbench.init({getEntries:()=>entries,getSelected:()=>selected,
 getRecord:()=>({title:field("title").value.trim(),category:field("category").value,body:field("body").value,world_anvil:linkedSource}),
 markDirty:()=>{dirty=true;$("#editor-state").textContent="Unsaved changes"},status:setStatus,download});
const wa=window.DriftmarkWorldAnvil.init({getClient:()=>client,getOwner:()=>uid,
 getSource:()=>linkedSource,getLink:()=>linkedLink,hasEntry:()=>!form.hidden,isSaving:()=>saving,status:setStatus,
 applySync:async batch=>{
  if(!uid||!connected||saving)return false;
  let next=entries;
  if(batch.index)next=R.reconcileIndex(next,batch.index,{complete:batch.complete,makeEntry:(row,id,now)=>normalize({
   id,title:row.title,category:"Lore",status:"Researching",body:"",article:W.starter("Lore"),created_at:now,updated_at:now})}).entries;
  next=R.reconcileSources(next,batch.sources||[],batch.failed||[]).entries;
  if(!await saveCloud(next,{preserveEditor:true}))return false;
  const current=entries.find(e=>e.id===selected),target=linkedSource?.id||linkedLink?.id;
  if(current&&target&&R.key(current)===target){linkedSource=current.world_anvil;linkedLink=current.world_anvil_link;wa.recordChanged()}
  return true;
 },
 getArticleText:()=>W.articleContent(desk.collect()),
 getCategoryChanges:()=>W.categoryChanges(desk.collect()),
 attach:source=>{
  if(saving||form.hidden)return;
  linkedSource=window.DriftmarkWorldAnvil.normalizeSource(source);
  linkedLink=source.kind==="article"?R.normalizeLink({kind:"article",id:source.id,world_id:source.world_id,
   source_title:source.title,presence:"present",text_status:"available",checked_at:source.read_at}):null;
  if(!field("title").value.trim())field("title").value=source.title;
  if(!field("url").value.trim()&&source.url)field("url").value=source.url;
  dirty=true;$("#editor-state").textContent="Unsaved changes";
 },
 addReference:async source=>{
  if(saving||dirty)return false;
  const existing=entries.find(e=>source.kind==="article"?R.key(e)===source.id:e.world_anvil?.kind==="category"&&e.world_anvil.id===source.id),now=new Date().toISOString();
  const link=source.kind==="article"?R.normalizeLink({kind:"article",id:source.id,world_id:source.world_id,
   source_title:source.title,presence:"present",text_status:"available",checked_at:source.read_at}):null;
  const rec=normalize(existing?{...existing,world_anvil:source,world_anvil_link:link,url:existing.url||source.url,updated_at:now}:
   {id:"mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),title:source.title,category:"Lore",
    status:source.isDraft?"Drafting":"Researching",body:"",url:source.url,article:source.kind==="category"?W.normalizeCategoryArticle():W.starter("Lore"),
    world_anvil:source,world_anvil_link:link,created_at:now,updated_at:now});
  const next=existing?entries.map(e=>e.id===rec.id?rec:e):[...entries,rec];
  if(!await saveCloud(next))return false;
  openEntry(rec.id);return true;
 },
 afterWrite:async source=>{
  if(!linkedSource||linkedSource.id!==source.id||linkedSource.kind!==source.kind)return false;
  linkedSource=window.DriftmarkWorldAnvil.normalizeSource(source);
  if(source.kind==="article")linkedLink=R.normalizeLink({kind:"article",id:source.id,world_id:source.world_id,
   source_title:source.title,presence:"present",text_status:"available",checked_at:source.read_at});
  dirty=true;$("#editor-state").textContent="Unsaved changes";
  if(saving||!form.reportValidity())return false;
  const rec=editorRecord(),old=entries.find(e=>e.id===selected);
  const next=old?entries.map(e=>e.id===old.id?rec:e):[...entries,rec];
  if(!await saveCloud(next))return false;
  openEntry(rec.id);return true;
 }});
function editorRecord(forBackup=false){
 const old=entries.find(e=>e.id===selected),now=new Date().toISOString();
 return normalize({id:old?.id||pendingId||("mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)),
 title:field("title").value.trim()||(forBackup?"Untitled article":""),category:field("category").value,
 status:field("status").value,tags:field("tags").value,url:field("url").value,body:field("body").value,
 article:desk.collect(),world_anvil:linkedSource,world_anvil_link:linkedLink,created_at:old?.created_at||now,updated_at:now});
}
function snapshot(){
 if(!dirty||form.hidden)return entries;
 const rec=editorRecord(true),old=entries.find(e=>e.id===selected);
 return old?entries.map(e=>e.id===old.id?rec:e):[...entries,rec];
}
const validDate=v=>!Number.isNaN(Date.parse(v))?v:new Date().toISOString();
function normalize(e){
 if(!e||typeof e!=="object")return null;
 const title=String(e.title||"").trim().slice(0,150);if(!title)return null;
 const source=window.DriftmarkWorldAnvil.normalizeSource(e.world_anvil);
 return {id:String(e.id||"").slice(0,100)||("mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),
 title,category:CATS.includes(e.category)?e.category:"Ideas",status:STATES.includes(e.status)?e.status:"Seed",
 tags:String(e.tags||"").slice(0,300),url:safeUrl(e.url),body:String(e.body||"").slice(0,80000),article:source?.kind==="category"?W.normalizeCategoryArticle(e.article):W.normalizeArticle(e.article),
 world_anvil:source,world_anvil_link:source?.kind==="category"?null:R.normalizeLink(e.world_anvil_link),
 created_at:validDate(e.created_at),updated_at:validDate(e.updated_at)};
}
function resetEditor(){desk.reset();selected="";pendingId="";linkedSource=null;linkedLink=null;editorOwner="";dirty=false;form.reset();form.hidden=true;$("#editor-empty").hidden=false;$("#editor-head").textContent="Select an entry";$("#editor-state").textContent="Ready to write";renderList();wa.recordChanged()}
function openEntry(id){
 const e=entries.find(x=>x.id===id);
 if(!e)return;
 if(dirty&&!confirm("Discard unsaved edits?"))return;
 selected=e.id;linkedSource=e.world_anvil;linkedLink=e.world_anvil_link;editorOwner=uid;dirty=false;form.hidden=false;$("#editor-empty").hidden=true;
 $("#editor-head").textContent=e.title;$("#editor-state").textContent="Cloud-saved version";
 for(const name of ["title","category","status","tags","url","body"])field(name).value=e[name]||"";
 desk.open(e);$("#delete").hidden=false;renderList();wa.recordChanged();
 document.querySelector(".article-details").open=false;
}
function newEntry(){
 if(dirty&&!confirm("Discard unsaved edits?"))return;
 selected="__new__";pendingId="mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);linkedSource=null;linkedLink=null;editorOwner=uid;dirty=false;form.reset();form.hidden=false;$("#editor-empty").hidden=true;
 $("#editor-head").textContent="New atlas entry";$("#editor-state").textContent="Not saved yet";
 desk.open({category:field("category").value});$("#delete").hidden=true;field("title").focus();renderList();wa.recordChanged();
 document.querySelector(".article-details").open=true;
}
function renderList(){
 const term=search.value.trim().toLowerCase(),category=filter.value;
 const filtered=entries.filter(e=>(category==="all"||e.category===category)&&
 [e.title,e.tags,e.category,e.status,e.body,e.world_anvil_link?.source_title,e.world_anvil?.content,...Object.values(e.world_anvil?.fields||{}),e.article?.purpose,...(e.article?.sections||[]).map(s=>[s.title,s.draft,s.prompt,...s.points.map(p=>p.text)].join(" "))].some(v=>String(v||"").toLowerCase().includes(term)))
 .sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
 $("#total").textContent=String(entries.length);
 $("#results").textContent=String(filtered.length)+" "+(filtered.length===1?"entry":"entries");
 $("#list").innerHTML=filtered.length?filtered.map(e=>
 '<button type="button" class="item'+(e.id===selected?' active':'')+'" data-entry="'+escapeHtml(e.id)+'">'+
 '<span class="eyebrow">'+escapeHtml(e.category)+" / "+escapeHtml(e.status)+'</span><strong>'+escapeHtml(e.title)+'</strong><small>'+
 escapeHtml((e.world_anvil?.kind==="category"?"Category page · ":"")+(e.tags||"Uncategorized notes"))+'</small>'+sourceLabel(e)+'</button>').join(""):
 '<div class="empty-catalog">No matching entries. Create the first mark or adjust your filters.</div>';
}
function sourceLabel(e){
 const link=R.linkFor(e);
 if(!link)return e.world_anvil?.kind==="category"?"":'<small class="source-note">Only in DRIFTMARK</small>';
 const note=link.presence==="not_seen"?"Not returned by World Anvil · kept locally":
  link.source_changed?"Source changed · your work is preserved":link.text_status==="cached"?"Cached source · live text unavailable":
  link.text_status==="unavailable"?"Source text unavailable · entry retained":link.text_status==="pending"?"Source text not loaded yet":"World Anvil reference";
 return '<small class="source-note">'+escapeHtml(note)+'</small>';
}
async function saveCloud(next,{preserveEditor=false}={}){
 if(saving)return false;
 if(!connected||!client||!uid){setStatus("Sign in through ORBIT and verify MFA before saving.",true);return false}
 const payload={version:5,world:"Eilmark",entries:next},savingOwner=uid;
 saving=true;
 const controls=[...document.querySelectorAll("#entry-form input,#entry-form select,#entry-form textarea,#entry-form button,#new,#sync,#export,#import")].map(el=>({el,disabled:el.disabled}));
 controls.forEach(({el})=>el.disabled=true);$("#save").textContent="Saving…";
 try{
  const {data,error}=await client.from(TABLE).update({payload,revision:revision+1,updated_at:new Date().toISOString()})
   .eq("owner_id",uid).eq("revision",revision).select("revision,updated_at").maybeSingle();
  if(error)throw error;
  if(!data){setStatus("A newer version exists in the cloud. Export your notes before refreshing; no data was overwritten.",true);return false}
  if(uid!==savingOwner||!connected)return false;
  revision=Number(data.revision);entries=next;if(!preserveEditor)dirty=false;connected=true;renderList();
  $("#last-sync").textContent="Saved "+new Date(data.updated_at).toLocaleString();
  setStatus("Saved securely to your private DRIFTMARK cloud workspace.");
  return true;
 }catch(e){setStatus("Could not save changes: "+(e.message||"Connection problem")+". Your draft remains in the editor.",true);return false}
 finally{saving=false;controls.forEach(({el,disabled})=>el.disabled=disabled);$("#save").textContent="Save to cloud";wa.recordChanged()}
}
async function loadCloud(){
 if(!client||!uid)return;
 const loadingOwner=uid;
 let {data,error}=await client.from(TABLE).select("revision,payload,updated_at").eq("owner_id",loadingOwner).maybeSingle();
 if(uid!==loadingOwner)return;
 if(error)throw error;
 if(!data){
  const inserted=await client.from(TABLE).insert({owner_id:loadingOwner,payload:{version:5,world:"Eilmark",entries:[]}})
   .select("revision,payload,updated_at").single();
  if(inserted.error)throw inserted.error;
  data=inserted.data;
 }
 if(uid!==loadingOwner)return;
 if(!data||!Array.isArray(data.payload?.entries)||![1,2,3,4,5].includes(data.payload.version))throw Error("Unexpected cloud workspace format; no data changed.");
 const loaded=data.payload.entries.map(normalize);
 if(loaded.some(e=>!e)||new Set(loaded.map(e=>e.id)).size!==loaded.length)throw Error("The cloud contains an invalid or duplicate entry. No data changed.");
 revision=Number(data.revision);entries=loaded;
 connected=true;$("#workspace").hidden=false;wa.accountChanged(uid);resetEditor();renderList();void wa.restore();
 $("#last-sync").textContent="Synced "+new Date(data.updated_at).toLocaleString();
 setStatus("Connected to your shared ORBIT account · private cloud sync active");
}
async function connect(){
 $("#sync").disabled=true;setStatus("Checking your shared ORBIT identity…");
 try{
  if(!window.supabase?.createClient)throw Error("Supabase library unavailable. Check your connection.");
  if(!client){
   client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"pkce"}});
   client.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_OUT"||(uid&&session?.user?.id!==uid)){
     uid="";connected=false;wa.accountChanged("");$("#workspace").hidden=true;
     setStatus("Your ORBIT session ended. Sign in and verify your authenticator before reconnecting.",true);
    }
   });
  }
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError&&!/session missing/i.test(authError.message||""))throw authError;
  if(!auth?.user){uid="";wa.accountChanged("");connected=false;$("#workspace").hidden=true;setStatus("Sign in to ORBIT first, then return and choose Refresh. <No records exposed>",true);return}
  uid=auth.user.id;wa.accountChanged(uid);
  const {data:level,error:levelError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(levelError)throw levelError;
  if(level?.currentLevel!=="aal2"){uid="";wa.accountChanged("");connected=false;$("#workspace").hidden=true;setStatus("Open ORBIT, complete authenticator verification, then return to DRIFTMARK and choose Refresh.",true);return}
  if(dirty){
   if(editorOwner!==uid){connected=false;$("#workspace").hidden=true;setStatus("Your unsaved editor belongs to the previous account and is preserved. Sign back into that account to continue.",true);return}
   connected=true;$("#workspace").hidden=false;setStatus("Your unsaved writing is preserved. Checking World Anvil references…");void wa.restore();return;
  }
  await loadCloud();
 }catch(e){connected=false;setStatus("Could not open private atlas: "+(e.message||"Unknown error")+". No data was modified.",true)}
 finally{$("#sync").disabled=false}
}
form.addEventListener("submit",async ev=>{
 ev.preventDefault();const old=entries.find(e=>e.id===selected);
 const title=String(field("title").value||"").trim();
 if(!title){field("title").focus();return}
 const rec=editorRecord();
 if(field("url").value.trim()&&!rec.url){setStatus("Use a valid HTTPS article URL or leave it blank.",true);return}
 const next=old?entries.map(e=>e.id===old.id?rec:e):[...entries,rec];
 if(await saveCloud(next)){selected=rec.id;openEntry(rec.id)}
});
$("#list").addEventListener("click",e=>{const b=e.target.closest("[data-entry]");if(b)openEntry(b.dataset.entry)});
form.addEventListener("input",()=>{dirty=true;$("#editor-state").textContent="Unsaved changes"});
field("category").addEventListener("change",()=>desk.changeCategory(field("category").value));
field("title").addEventListener("input",()=>{$("#editor-head").textContent=field("title").value.trim()||"New atlas entry"});
$("#new").addEventListener("click",newEntry);
$("#cancel").addEventListener("click",()=>{if(!dirty||confirm("Discard unsaved edits?"))resetEditor()});
$("#delete").addEventListener("click",async()=>{
 if(!selected||selected==="__new__")return;
 const entry=entries.find(e=>e.id===selected);if(!entry||!confirm("Permanently delete “"+entry.title+"” from your private atlas?"))return;
 if(await saveCloud(entries.filter(e=>e.id!==selected)))resetEditor();
});
search.addEventListener("input",renderList);filter.addEventListener("change",renderList);
$("#sync").addEventListener("click",()=>void connect());
$("#export").addEventListener("click",()=>{
 download(JSON.stringify({app:"DRIFTMARK",version:5,world:"Eilmark",exported_at:new Date().toISOString(),includes_unsaved_editor:dirty,entries:snapshot()},null,2),
 "driftmark-atlas-"+new Date().toISOString().slice(0,10)+".json","application/json");
});
$("#import").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>100000000)throw Error("Backup is too large (maximum 100 MB).");
  const raw=JSON.parse(await file.text());
  if(raw.app!=="DRIFTMARK"||!Array.isArray(raw.entries)||raw.entries.length>110000)throw Error("Not a valid DRIFTMARK backup (maximum 110,000 entries).");
  if(![1,2,3,4,5].includes(raw.version))throw Error("Unsupported backup version. No records changed.");
  const next=raw.entries.map(normalize).filter(Boolean);
  if(next.length!==raw.entries.length)throw Error("Backup contains invalid records.");
  if(new Set(next.map(entry=>entry.id)).size!==next.length)throw Error("Backup contains duplicate entry IDs.");
  if(!confirm("Replace all current DRIFTMARK cloud entries with "+next.length+" imported entries? Export a backup first."))return;
  if(dirty&&!confirm("This will also replace your unsaved editor. Export a backup first. Continue?"))return;
  if(await saveCloud(next))resetEditor();
 }catch(err){setStatus("Import rejected: "+err.message,true)}
 finally{e.target.value=""}
});
document.querySelector("label[for=import]").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#import").click()}});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
void connect();
})();
