import{test}from"node:test";
import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import vm from"node:vm";
import{createRequire}from"node:module";
import{createHandler,ORIGIN,SERVICE,WORLD,OWNER,digest,articleDTO}from"../../supabase/functions/driftmark-worldanvil/core.mjs";
import{createAuthorize}from"../../supabase/functions/driftmark-worldanvil/auth.mjs";
const ARTICLE="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",USER="11111111-2222-3333-4444-555555555555",TOKEN="unit-test-credential";
const fingerprint=async raw=>(await articleDTO(raw)).version_hash;
const source=()=>({id:ARTICLE,title:"Test article",world:{id:WORLD},content:"Original source.",isEditable:true,state:"private",isDraft:true,isWip:true});
function setup(overrides={}){
 let article=source(),savedToken=null;const calls=[];
 const handle=createHandler({authorize:async()=>({id:OWNER,aal:"aal2"}),connections:{read:async()=>savedToken,write:async(_owner,token)=>{savedToken=token;},remove:async()=>{savedToken=null;}},fetcher:async(url,options)=>{
  calls.push({url,options});const parsed=new URL(url);assert.equal(parsed.origin,SERVICE);assert.equal(options.headers["x-auth-token"],TOKEN);
  if(parsed.pathname==="/identity")return Response.json({id:USER});
  if(parsed.pathname==="/user/worlds")return Response.json({worlds:[{id:WORLD,title:"Test world"}]});
  if(parsed.pathname==="/article"&&options.method==="PATCH"){const patch=JSON.parse(options.body);assert.deepEqual(Object.keys(patch),["content"]);article={...article,content:patch.content};}
  return Response.json(article);
 },...overrides});
 const request=async body=>{const response=await handle(new Request("https://test.invalid",{method:"POST",headers:{Origin:ORIGIN,Authorization:"Bearer test.jwt","Content-Type":"application/json"},body:JSON.stringify({token:TOKEN,...body})}));return{status:response.status,data:await response.json()};};
 return{request,calls};
}
test("connect verifies identity and world without echoing credentials",async()=>{
 const s=setup(),r=await s.request({action:"configure"});assert.equal(r.status,200);assert.equal(r.data.connected,true);assert.equal(r.data.world.id,WORLD);assert.doesNotMatch(JSON.stringify(r.data),/unit-test-credential/);assert.equal(s.calls.length,2);
});
test("missing auth, wrong account, and AAL1 cannot reach World Anvil",async()=>{
 for(const auth of[null,{id:"not-owner",aal:"aal2"},{id:OWNER,aal:"aal1"}]){const s=setup({authorize:async()=>auth}),r=await s.request({action:"article",article_id:ARTICLE});assert.equal(r.status,403);assert.equal(s.calls.length,0);}
});
test("articles outside Driftbound are rejected",async()=>{
 const s=setup({fetcher:async()=>Response.json({...source(),world:{id:USER}})}),r=await s.request({action:"article",article_id:ARTICLE});assert.equal(r.status,403);assert.equal(r.data.code,"wrong_world");
});
test("stale source review prevents a write",async()=>{
 const s=setup(),r=await s.request({action:"update",article_id:ARTICLE,expected_hash:"0".repeat(64),content:"My own writing.",reviewed:true});assert.equal(r.status,409);assert.equal(r.data.code,"source_changed");assert.equal(s.calls.filter(c=>c.options.method==="PATCH").length,0);
});
test("reviewed update changes content only and verifies privacy and WIP",async()=>{
 const s=setup(),r=await s.request({action:"update",article_id:ARTICLE,expected_hash:await fingerprint(source()),content:"My own writing.",reviewed:true});
 assert.equal(r.status,200);assert.equal(r.data.verified,true);assert.equal(r.data.article.content,"My own writing.");assert.equal(r.data.article.state,"private");assert.equal(r.data.article.isDraft,true);assert.equal(r.data.article.isWip,true);assert.equal(s.calls.filter(c=>c.options.method==="PATCH").length,1);
});
test("unreviewed text and additional publication fields cannot be sent",async()=>{
 for(const extra of[{reviewed:false},{reviewed:true,state:"public"}]){const s=setup(),r=await s.request({action:"update",article_id:ARTICLE,expected_hash:await fingerprint(source()),content:"My own writing.",...extra});assert.equal(r.status,400);assert.equal(s.calls.filter(c=>c.options.method==="PATCH").length,0);}
});
test("read-back mismatch reports uncertain write without claiming success",async()=>{
 let patched=false;const s=setup({fetcher:async(_url,options)=>{if(options.method==="PATCH")patched=true;return Response.json({...source(),content:patched?"Different returned text.":source().content});}});
 const r=await s.request({action:"update",article_id:ARTICLE,expected_hash:await fingerprint(source()),content:"My own writing.",reviewed:true});assert.equal(r.status,502);assert.equal(r.data.code,"verification_uncertain");assert.equal(r.data.may_have_written,true);assert.equal(r.data.verified,undefined);
});
test("invalid credentials do not leak upstream details and endpoints are fixed",async()=>{
 const s=setup({fetcher:async()=>Response.json({error:"private upstream detail"},{status:401})}),r=await s.request({action:"configure"});assert.equal(r.status,401);assert.doesNotMatch(JSON.stringify(r.data),/private upstream detail|unit-test-credential/);
 const invalid=setup(),bad=await invalid.request({action:"article",article_id:"https://other.invalid/"});assert.equal(bad.status,400);assert.equal(invalid.calls.length,0);
});
test("only author drafts are used for World Anvil content",()=>{
 const W=createRequire(import.meta.url)("../writing.js"),a=W.starter("Lore");a.sections[0].draft="My own paragraph.";a.sections[0].decisions="Private planning decision.";
 const content=W.articleContent(a);assert.match(content,/My own paragraph/);assert.doesNotMatch(content,/Private planning decision|needs_checking|Introduce this subject/);
});
test("cached source serialization strips authentication fields",async()=>{
 const W=createRequire(import.meta.url)("../writing.js"),context={window:{DriftmarkWriting:W}};vm.runInNewContext(readFileSync(new URL("../worldanvil.js",import.meta.url),"utf8"),context);
 const dto=await articleDTO(source(),ARTICLE),clean=context.window.DriftmarkWorldAnvil.normalizeSource({...dto,token:TOKEN,authorization:TOKEN});
 assert.equal(clean.content,"Original source.");assert.equal(clean.token,undefined);assert.equal(clean.authorization,undefined);assert.doesNotMatch(JSON.stringify(clean),/unit-test-credential/);
});
test("all frontend controls and script references are present",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8"),wa=readFileSync(new URL("../worldanvil.js",import.meta.url),"utf8");
 const ids=new Set([...html.matchAll(/id="([\w-]+)"/g),...wa.matchAll(/id="([\w-]+)"/g),...wa.matchAll(/\.id="([\w-]+)"/g)].map(x=>x[1]));
 for(const file of["app.js","workbench.js","worldanvil.js"]){const js=readFileSync(new URL("../"+file,import.meta.url),"utf8");for(const m of js.matchAll(/\$\("#([\w-]+)"\)/g))assert.ok(ids.has(m[1]),file+": "+m[1]);}
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1].split("?")[0]);assert.deepEqual(scripts.slice(1),["writing.js","reconcile.js","workbench.js","worldanvil.js","app.js"]);
});

test("JWT assurance is trusted only after Auth validates the exact owner token",async()=>{
 const jwt=claims=>"test."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".signature";
 for(const item of[
  {claims:{sub:OWNER,aal:"aal2"},user:OWNER,error:null,allowed:true},
  {claims:{sub:OWNER,aal:"aal1"},user:OWNER,error:null},
  {claims:{sub:USER,aal:"aal2"},user:OWNER,error:null},
  {claims:{sub:USER,aal:"aal2"},user:USER,error:null},
  {claims:{sub:OWNER,aal:"aal2"},user:OWNER,error:{message:"expired or forged JWT"}}
 ]){
  const token=jwt(item.claims);let received;
  const authorize=createAuthorize({auth:{getUser:async value=>{received=value;return{data:{user:{id:item.user}},error:item.error};}}});
  const result=await authorize("Bearer "+token);assert.equal(received,token);
  if(item.allowed)assert.deepEqual(result,{id:OWNER,aal:"aal2"});else assert.equal(result,null);
 }
});
test("missing credentials and a public API key alone do not authenticate",async()=>{
 let calls=0;const authorize=createAuthorize({auth:{getUser:async()=>{calls++;return{data:{user:null},error:{}};}}});
 for(const header of["","Basic test","Bearer sb_publishable_unit_test","Bearer bad.jwt"]){assert.equal(await authorize(header),null);}
 assert.equal(calls,2);
});
test("foreign origins are rejected and valid preflight sends no credentials upstream",async()=>{
 let authorized=0,upstream=0;
 const handle=createHandler({authorize:async()=>{authorized++;return{id:OWNER,aal:"aal2"};},fetcher:async()=>{upstream++;throw Error("unused");}});
 const foreign=await handle(new Request("https://test.invalid",{method:"POST",headers:{Origin:"https://foreign.invalid"}}));assert.equal(foreign.status,403);
 const preflight=await handle(new Request("https://test.invalid",{method:"OPTIONS",headers:{Origin:ORIGIN}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get("Access-Control-Allow-Origin"),ORIGIN);assert.equal(authorized,0);assert.equal(upstream,0);
});
test("read counters do not cause false conflicts, but content and privacy changes do",async()=>{
 const initial=await fingerprint({...source(),sumOfViews:4});
 assert.equal(initial,await fingerprint({...source(),sumOfViews:5}));
 for(const change of[{content:"New source"},{state:"public"},{category:{id:USER}},{updateDate:"new-date"}])assert.notEqual(initial,await fingerprint({...source(),...change}));
});
test("unconfirmed privacy or edit permission blocks PATCH",async()=>{
 for(const change of[{state:null},{isDraft:null},{isWip:null},{isEditable:false}]){
  let calls=0;const raw={...source(),...change};
  const s=setup({fetcher:async(_url,options)=>{if(options.method==="PATCH")calls++;return Response.json(raw);}});
  const r=await s.request({action:"update",article_id:ARTICLE,expected_hash:await fingerprint(raw),content:"My own writing.",reviewed:true});assert.ok([403,409].includes(r.status));assert.equal(calls,0);
 }
});
test("changed publication or hierarchy on read-back never reports verified success",async()=>{
 for(const change of[{state:"public"},{isDraft:false},{isWip:false},{title:"Changed title"},{category:{id:USER}}]){
  let written=false;const s=setup({fetcher:async(_url,options)=>{if(options.method==="PATCH")written=true;return Response.json({...source(),...(written?{content:"My own writing.",...change}:{})});}});
  const r=await s.request({action:"update",article_id:ARTICLE,expected_hash:await fingerprint(source()),content:"My own writing.",reviewed:true});assert.equal(r.status,502);assert.equal(r.data.may_have_written,true);assert.equal(r.data.verified,undefined);
 }
});
test("category reads and article pagination keep the supplied Action contract",async()=>{
 const s=setup({fetcher:async(url,options)=>{
  const parsed=new URL(url);assert.equal(parsed.origin,SERVICE);assert.equal(parsed.searchParams.get("id"),WORLD);
  if(parsed.pathname==="/world/categories"){assert.deepEqual(JSON.parse(options.body),{limit:"100",offset:"0"});return Response.json({categories:[{id:USER,title:"Reference category"}]});}
  assert.equal(parsed.pathname,"/world/articles");assert.equal(options.method,"POST");assert.deepEqual(JSON.parse(options.body),{limit:"50",offset:"50",category:{id:USER}});
  return Response.json({articles:Array.from({length:50},()=>({id:ARTICLE,title:"Reference"}))});
 }});
 const categories=await s.request({action:"categories"});assert.equal(categories.status,200);assert.equal(categories.data.categories[0].id,USER);
 const articles=await s.request({action:"articles",offset:50,category_id:USER});assert.equal(articles.status,200);assert.equal(articles.data.offset,50);assert.equal(articles.data.has_more,true);
});
test("oversized or malformed operations cannot reach upstream",async()=>{
 for(const body of[{action:"configure",token:"line\nbreak"},{action:"article",article_id:ARTICLE,publish:true},{action:"toString"},{action:"article",article_id:ARTICLE,token:"x".repeat(300001)}]){
  const s=setup(),r=await s.request(body);assert.ok(r.status>=400);assert.equal(s.calls.length,0);assert.doesNotMatch(JSON.stringify(r.data),/line\\nbreak|x{100}/);
 }
});

