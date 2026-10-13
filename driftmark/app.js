/* DRIFTMARK 0.1 — owner-private atlas backed by existing ORBIT Supabase identity. */
(()=>{"use strict";
const URL="https://zdurujqwhxqrwbhwzzxg.supabase.co";
const KEY="sb_publishable_Xa0DTx_PbvtynbiQN6_xNQ_l1D55vzK"; // publishable, never a service-role key
const TABLE="driftmark_workspaces";
const CATS=["Locations","Characters","Factions","Lore","Timeline","Scenes","Drafts","Ideas"];
const STATES=["Seed","Researching","Drafting","Ready to publish","Published"];
const $=q=>document.querySelector(q);
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=v=>{try{const u=new window.URL(String(v||""));return u.protocol==="https:"?u.href:""}catch(_){return ""}};
const form=$("#entry-form"), search=$("#search"),filter=$("#filter");
const field=name=>form.querySelector('[name="'+name+'"]');
let client=null,uid="",revision=0,entries=[],selected="",dirty=false,connected=false;
const setStatus=(msg,issue=false)=>{const el=$("#status");el.textContent=msg;el.style.background=issue?"#573a3d":"#2b3b46"};
const validDate=v=>!Number.isNaN(Date.parse(v))?v:new Date().toISOString();
function normalize(e){
 if(!e||typeof e!=="object")return null;
 const title=String(e.title||"").trim().slice(0,150);if(!title)return null;
 return {id:String(e.id||"").slice(0,100)||("mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),
 title,category:CATS.includes(e.category)?e.category:"Ideas",status:STATES.includes(e.status)?e.status:"Seed",
 tags:String(e.tags||"").slice(0,300),url:safeUrl(e.url),body:String(e.body||"").slice(0,80000),
 created_at:validDate(e.created_at),updated_at:validDate(e.updated_at)};
}
function resetEditor(){selected="";dirty=false;form.reset();form.hidden=true;$("#editor-empty").hidden=false;$("#editor-head").textContent="Select an entry";$("#editor-state").textContent="Ready to write";renderList()}
function openEntry(id){
 const e=entries.find(x=>x.id===id);
 if(!e)return;
 if(dirty&&!confirm("Discard unsaved edits?"))return;
 selected=e.id;dirty=false;form.hidden=false;$("#editor-empty").hidden=true;
 $("#editor-head").textContent="Edit atlas entry";$("#editor-state").textContent="Cloud-saved version";
 for(const name of ["title","category","status","tags","url","body"])field(name).value=e[name]||"";
 $("#delete").hidden=false;renderList();
}
function newEntry(){
 if(dirty&&!confirm("Discard unsaved edits?"))return;
 selected="__new__";dirty=false;form.reset();form.hidden=false;$("#editor-empty").hidden=true;
 $("#editor-head").textContent="New atlas entry";$("#editor-state").textContent="Not saved yet";
 $("#delete").hidden=true;field("title").focus();renderList();
}
function renderList(){
 const term=search.value.trim().toLowerCase(),category=filter.value;
 const filtered=entries.filter(e=>(category==="all"||e.category===category)&&
 [e.title,e.tags,e.category,e.status,e.body].some(v=>String(v||"").toLowerCase().includes(term)))
 .sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
 $("#total").textContent=String(entries.length);
 $("#results").textContent=String(filtered.length)+" "+(filtered.length===1?"entry":"entries");
 $("#list").innerHTML=filtered.length?filtered.map(e=>
 '<button type="button" class="item'+(e.id===selected?' active':'')+'" data-entry="'+escapeHtml(e.id)+'">'+
 '<span class="eyebrow">'+escapeHtml(e.category)+" / "+escapeHtml(e.status)+'</span><strong>'+escapeHtml(e.title)+'</strong><small>'+
 escapeHtml(e.tags||"Uncategorized notes")+'</small></button>').join(""):
 '<div class="empty-catalog">No matching entries. Create the first mark or adjust your filters.</div>';
}
async function saveCloud(next){
 if(!connected||!client||!uid){setStatus("Sign in through ORBIT and verify MFA before saving.",true);return false}
 const payload={version:1,world:"Eilmark",entries:next};
 $("#save").disabled=true;$("#save").textContent="Saving…";
 try{
  const {data,error}=await client.from(TABLE).update({payload,revision:revision+1,updated_at:new Date().toISOString()})
   .eq("owner_id",uid).eq("revision",revision).select("revision,updated_at").maybeSingle();
  if(error)throw error;
  if(!data){setStatus("A newer version exists in the cloud. Export your notes before refreshing; no data was overwritten.",true);return false}
  revision=Number(data.revision);entries=next;dirty=false;connected=true;renderList();
  $("#last-sync").textContent="Saved "+new Date(data.updated_at).toLocaleString();
  setStatus("Saved securely to your private DRIFTMARK cloud workspace.");
  return true;
 }catch(e){setStatus("Could not save changes: "+(e.message||"Connection problem")+". Your draft remains in the editor.",true);return false}
 finally{$("#save").disabled=false;$("#save").textContent="Save to cloud"}
}
async function loadCloud(){
 if(!client||!uid)return;
 let {data,error}=await client.from(TABLE).select("revision,payload,updated_at").eq("owner_id",uid).maybeSingle();
 if(error)throw error;
 if(!data){
  const inserted=await client.from(TABLE).insert({owner_id:uid,payload:{version:1,world:"Eilmark",entries:[]}})
   .select("revision,payload,updated_at").single();
  if(inserted.error)throw inserted.error;
  data=inserted.data;
 }
 if(!data||!Array.isArray(data.payload?.entries))throw Error("Unexpected cloud workspace format; no data changed.");
 revision=Number(data.revision);entries=data.payload.entries.map(normalize).filter(Boolean);
 connected=true;$("#workspace").hidden=false;resetEditor();renderList();
 $("#last-sync").textContent="Synced "+new Date(data.updated_at).toLocaleString();
 setStatus("Connected to your shared ORBIT account · private cloud sync active");
}
async function connect(){
 $("#sync").disabled=true;setStatus("Checking your shared ORBIT identity…");
 try{
  if(!window.supabase?.createClient)throw Error("Supabase library unavailable. Check your connection.");
  if(!client)client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"pkce"}});
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError&&!/session missing/i.test(authError.message||""))throw authError;
  if(!auth?.user){uid="";connected=false;$("#workspace").hidden=true;setStatus("Sign in to ORBIT first, then return and choose Refresh. <No records exposed>",true);return}
  uid=auth.user.id;
  const {data:level,error:levelError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(levelError)throw levelError;
  if(level?.currentLevel!=="aal2"){connected=false;$("#workspace").hidden=true;setStatus("Open ORBIT, complete authenticator verification, then return to DRIFTMARK and choose Refresh.",true);return}
  if(dirty&&!confirm("Discard unsaved changes and load the cloud copy?"))return;
  await loadCloud();
 }catch(e){connected=false;setStatus("Could not open private atlas: "+(e.message||"Unknown error")+". No data was modified.",true)}
 finally{$("#sync").disabled=false}
}
form.addEventListener("submit",async ev=>{
 ev.preventDefault();const old=entries.find(e=>e.id===selected);
 const title=String(field("title").value||"").trim();
 if(!title){field("title").focus();return}
 const now=new Date().toISOString();
 const rec=normalize({id:old?.id||("mark-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)),
 title,category:field("category").value,status:field("status").value,tags:field("tags").value,
 url:field("url").value,body:field("body").value,created_at:old?.created_at||now,updated_at:now});
 if(field("url").value.trim()&&!rec.url){setStatus("Use a valid HTTPS article URL or leave it blank.",true);return}
 const next=old?entries.map(e=>e.id===old.id?rec:e):[...entries,rec];
 if(await saveCloud(next)){selected=rec.id;openEntry(rec.id)}
});
$("#list").addEventListener("click",e=>{const b=e.target.closest("[data-entry]");if(b)openEntry(b.dataset.entry)});
form.addEventListener("input",()=>{dirty=true;$("#editor-state").textContent="Unsaved changes"});
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
 const blob=new Blob([JSON.stringify({app:"DRIFTMARK",version:1,world:"Eilmark",exported_at:new Date().toISOString(),entries},null,2)],{type:"application/json"});
 const objectURL=window.URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=objectURL;a.download="driftmark-atlas-"+new Date().toISOString().slice(0,10)+".json";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>window.URL.revokeObjectURL(objectURL),500);
});
$("#import").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const raw=JSON.parse(await file.text());
  if(raw.app!=="DRIFTMARK"||!Array.isArray(raw.entries)||raw.entries.length>1000)throw Error("Not a valid DRIFTMARK backup (maximum 1,000 entries).");
  const next=raw.entries.map(normalize).filter(Boolean);
  if(next.length!==raw.entries.length)throw Error("Backup contains invalid records.");
  if(!confirm("Replace all current DRIFTMARK cloud entries with "+next.length+" imported entries? Export a backup first."))return;
  if(await saveCloud(next))resetEditor();
 }catch(err){setStatus("Import rejected: "+err.message,true)}
 finally{e.target.value=""}
});
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
void connect();
})();