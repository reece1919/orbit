// ORBIT secure Todoist OAuth bridge. Do not expose the Supabase server credential or token ciphertext.
// Public GET callback validates a single-use PKCE state; every POST action checks a Supabase user JWT.
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const HOME = "https://reece1919.github.io/orbit/";
const ORIGIN = "https://reece1919.github.io";
const PROJECT = "zdurujqwhxqrwbhwzzxg";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://" + PROJECT + ".supabase.co";
const CLIENT_ID = HOME + "todoist-oauth-client.json";
const CALLBACK = SUPABASE_URL + "/functions/v1/orbit-todoist?mode=callback";
const OAUTH_TOKEN = "https://api.todoist.com/oauth/access_token";
const OAUTH_AUTHORIZE = "https://app.todoist.com/oauth/authorize";
const API = "https://api.todoist.com/api/v1";
const CORS = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Vary":"Origin" };

const errors = (status, message) => new Response(JSON.stringify({error:message}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...CORS}});
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...CORS}});
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const bytes = text => new TextEncoder().encode(text);
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes(text)))).map(n=>n.toString(16).padStart(2,"0")).join("");
const random = (n=32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function serverCredential() {
  const old=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(old)return old;
  try {
    const set=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const key=set.default||Object.values(set)[0];
    return typeof key==="string"?key:(key?.key || key?.value || key?.api_key || "");
  } catch (_) {return "";}
}
const ADMIN_KEY=serverCredential();
const db=ADMIN_KEY?createClient(SUPABASE_URL,ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
async function aesKey(){
  if(!ADMIN_KEY)throw new Error("Supabase server secret unavailable");
  // Purpose-separated HKDF. Rotate/migrate ciphertext before rotating the Supabase server key.
  const root=await crypto.subtle.importKey("raw",bytes(ADMIN_KEY),"HKDF",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:bytes(PROJECT),info:bytes("orbit-todoist-oauth-token-v1")},root,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encrypt(value){
  if(!value)return null;
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(),bytes(value)));
  return "v1."+b64url(iv)+"."+b64url(cipher);
}
function decodeB64(value){
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(normalized+"=".repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));
}
async function decrypt(value){
  if(!value?.startsWith("v1."))throw new Error("Unknown token encryption version");
  const parts=value.split(".");
  if(parts.length!==3)throw new Error("Invalid token ciphertext");
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeB64(parts[1])},await aesKey(),decodeB64(parts[2]));
  return new TextDecoder().decode(clear);
}
function redirect(status){
  const url=new URL(HOME);
  url.searchParams.set("todoist",status);
  return new Response(null,{status:303,headers:{Location:url.href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}
async function tokenExchange(params){
  const response=await fetch(OAUTH_TOKEN,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(params)});
  if(!response.ok)throw new Error("Todoist rejected OAuth token exchange ("+response.status+")");
  const data=await response.json();
  if(!data?.access_token || typeof data.access_token!=="string")throw new Error("Todoist returned no token");
  return data;
}
async function saveConnection(owner,tokens){
  const expires=Number.isFinite(Number(tokens.expires_in))&&Number(tokens.expires_in)>0
    ?new Date(Date.now()+Math.floor(Number(tokens.expires_in))*1000).toISOString():null;
  const payload={
    owner_id:owner,encrypted_access_token:await encrypt(tokens.access_token),
    encrypted_refresh_token:tokens.refresh_token?await encrypt(tokens.refresh_token):null,
    access_token_expires_at:expires,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()
  };
  const {error}=await db.from("orbit_todoist_connections").upsert(payload,{onConflict:"owner_id"});
  if(error)throw error;
}
async function callback(req){
  const url=new URL(req.url);
  const state=url.searchParams.get("state")||"";
  const code=url.searchParams.get("code")||"";
  if(url.searchParams.get("error"))return redirect("denied");
  if(state.length<32||state.length>256||!code||code.length>8192)return redirect("invalid");
  const key=await hash(state);
  // A DELETE...RETURNING makes the state and server-side PKCE verifier single-use.
  const {data:pending,error}=await db.from("orbit_todoist_oauth_states").delete()
    .eq("state_hash",key).gt("expires_at",new Date().toISOString())
    .select("owner_id,code_verifier").maybeSingle();
  if(error||!pending)return redirect("invalid");
  try{
    const result=await tokenExchange({client_id:CLIENT_ID,code,code_verifier:pending.code_verifier,redirect_uri:CALLBACK,grant_type:"authorization_code"});
    await saveConnection(pending.owner_id,result);
    return redirect("connected");
  }catch(e){console.error("Todoist callback failed",e?.message);return redirect("error");}
}
async function authorize(req){
  const header=req.headers.get("Authorization")||"";
  if(!/^Bearer \S+$/i.test(header))return null;
  const jwt=header.replace(/^Bearer\s+/i,"");
  const {data,error}=await db.auth.getUser(jwt);
  return error?null:data?.user||null;
}
async function getRow(user){
  const {data,error}=await db.from("orbit_todoist_connections").select("*").eq("owner_id",user.id).maybeSingle();
  if(error)throw error;
  return data;
}
async function liveToken(row,user){
  if(!row)return null;
  const expires=row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : 0;
  if(expires && expires<Date.now()+120000 && row.encrypted_refresh_token){
    const refresh=await decrypt(row.encrypted_refresh_token);
    const tokens=await tokenExchange({client_id:CLIENT_ID,grant_type:"refresh_token",refresh_token:refresh});
    await saveConnection(user.id,tokens);
    return tokens.access_token;
  }
  if(expires && expires<Date.now())throw new Error("Todoist authorization expired. Reconnect Todoist.");
  return decrypt(row.encrypted_access_token);
}
async function todoistApi(user,body){
  const row=await getRow(user);
  if(!row)return errors(409,"Todoist is not connected.");
  const p=String(body.path||"");
  const m=String(body.method||"GET").toUpperCase();
  const url=new URL(API+p);
  if(!p.startsWith("/")||url.origin!=="https://api.todoist.com"||!url.pathname.startsWith("/api/v1/"))return errors(400,"Invalid Todoist API path.");
  const list=m==="GET"&&url.pathname==="/api/v1/tasks"&&[...url.searchParams.keys()].every(k=>["cursor","limit"].includes(k));
  const create=m==="POST"&&url.pathname==="/api/v1/tasks"&&!url.search;
  const complete=m==="POST"&&/^\/api\/v1\/tasks\/[A-Za-z0-9_-]{1,128}\/close$/.test(url.pathname)&&!url.search;
  if(!(list||create||complete))return errors(403,"This Todoist operation is not available in ORBIT.");
  if(create && (typeof body.body!=="string"||body.body.length>8000))return errors(400,"Invalid task payload.");
  const token=await liveToken(row,user);
  const response=await fetch(url.href,{method:m,headers:{Authorization:"Bearer "+token,...(create?{"Content-Type":"application/json"}:{})},body:create?body.body:undefined});
  let responseBody;
  const raw=await response.text();
  try{responseBody=raw?JSON.parse(raw):{ok:true};}catch(_){responseBody={error:"Todoist returned an unexpected response"};}
  if(!response.ok){
    if(response.status===401)return errors(401,"Todoist authorization expired or was revoked. Reconnect Todoist.");
    if(response.status===429)return errors(429,"Todoist rate limit reached; try again later.");
    return errors(response.status>=500?502:400,typeof responseBody?.error==="string"?responseBody.error:"Todoist request failed.");
  }
  return json(responseBody);
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(!db)return errors(503,"Supabase server credentials are unavailable");
  const url=new URL(req.url);
  if(req.method==="GET"&&url.searchParams.get("mode")==="callback"){
    try{return await callback(req)}catch(e){console.error("OAuth callback internal failure",e?.message);return redirect("error");}
  }
  if(req.method!=="POST")return errors(405,"Method not allowed.");
  if(req.headers.get("Origin")!==ORIGIN)return errors(403,"Invalid request origin.");
  const user=await authorize(req);
  if(!user)return errors(401,"Sign in to ORBIT to connect Todoist.");
  let payload;
  try { payload=await req.json(); } catch(_) {return errors(400,"Invalid JSON payload.");}
  try{
    switch(payload?.action){
      case "status":{
        const row=await getRow(user);
        return json({connected:Boolean(row),type:"oauth",connected_at:row?.connected_at||null});
      }
      case "start":{
        await db.from("orbit_todoist_oauth_states").delete().eq("owner_id",user.id);
        const state=random(),verifier=random(),challenge=b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes(verifier))));
        const {error}=await db.from("orbit_todoist_oauth_states").insert({state_hash:await hash(state),owner_id:user.id,code_verifier:verifier,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
        if(error)throw error;
        const auth=new URL(OAUTH_AUTHORIZE);
        for(const [k,v] of Object.entries({client_id:CLIENT_ID,redirect_uri:CALLBACK,response_type:"code",scope:"data:read_write",state,code_challenge:challenge,code_challenge_method:"S256"}))auth.searchParams.set(k,v);
        return json({authorization_url:auth.href});
      }
      case "api":return todoistApi(user,payload);
      case "disconnect":{
        const {error}=await db.from("orbit_todoist_connections").delete().eq("owner_id",user.id);
        if(error)throw error;
        return json({connected:false});
      }
      default:return errors(400,"Unknown action");
    }
  }catch(e){
    console.error("ORBIT Todoist bridge error",e?.message);
    return errors(502,"Todoist connection problem. Please retry or reconnect.");
  }
});