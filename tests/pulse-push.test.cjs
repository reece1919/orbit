"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const browser=fs.readFileSync(path.join(root,"pulse.js"),"utf8");
const server=fs.readFileSync(path.join(root,"supabase/functions/orbit-pulse/index.ts"),"utf8");

function excerpt(text,from,to){
 const begin=text.indexOf(from),end=text.indexOf(to,begin);
 assert.ok(begin!==-1&&end!==-1,"Push helpers remain extractable: "+from);
 return text.slice(begin,end);
}
const browserHelpers=excerpt(browser,"function base64url(buffer){","async function checkDevice(){");
const serverHelpers=excerpt(server,"function validEndpoint(endpoint){","async function configuredKeys(){");
const browserCode=vm.runInNewContext(
 browserHelpers+"\n({base64url,subscriptionPayload})",
 {Uint8Array,Array,Error,btoa:(value)=>Buffer.from(value,"binary").toString("base64")}
);
const serverCode=vm.runInNewContext(
 serverHelpers+"\n({subscriptionError})",
 {URL,atob:(value)=>Buffer.from(value,"base64").toString("binary")}
);

function validBrowserSubscription(endpoint="https://web.push.apple.com/example"){
 const key=new Uint8Array(65);key[0]=4;
 for(let i=1;i<65;i++)key[i]=i;
 const auth=Uint8Array.from({length:16},(_,i)=>i+1);
 return {endpoint,getKey:(name)=>name==="p256dh"?key.buffer:auth.buffer,
  toJSON:()=>({endpoint,keys:{p256dh:"bad-json",auth:"bad-json"}})};
}

test("Browser serializes raw Safari keys to standard base64url",()=>{
 const payload=browserCode.subscriptionPayload(validBrowserSubscription());
 assert.equal(payload.keys.p256dh.length,87);
 assert.equal(payload.keys.auth.length,22);
 assert.match(payload.keys.p256dh,/^[A-Za-z0-9_-]+$/);
 assert.match(payload.keys.auth,/^[A-Za-z0-9_-]+$/);
 assert.equal(serverCode.subscriptionError(payload),null);
});

test("Server rejects SSRF endpoints and malformed keys",()=>{
 const valid=browserCode.subscriptionPayload(validBrowserSubscription());
 assert.match(serverCode.subscriptionError({...valid,endpoint:"https://push.apple.com.attacker.invalid/token"}),/Unsupported/);
 assert.match(serverCode.subscriptionError({...valid,endpoint:"http://web.push.apple.com/token"}),/Unsupported/);
 assert.match(serverCode.subscriptionError({...valid,endpoint:"https://localhost/token"}),/Unsupported/);
 assert.match(serverCode.subscriptionError({...valid,keys:{...valid.keys,auth:"invalid"}}),/invalid format/);
 assert.match(serverCode.subscriptionError({...valid,keys:{...valid.keys,p256dh:"invalid"}}),/invalid format/);
});

test("Registration reports errors instead of claiming the device is subscribed",()=>{
 assert.ok(browser.includes('await api("subscribe",{subscription:subscriptionPayload(pushExisting)'));
 const block=excerpt(browser,"async function checkDevice(){","async function enablePush(){");
 assert.ok(block.indexOf('await api("subscribe"')<block.indexOf("deviceSubscribed=true"));
 assert.ok(browser.includes("pushRegistration.pushManager.subscribe"));
 assert.ok(!browser.includes("sub.toJSON()"));
});
