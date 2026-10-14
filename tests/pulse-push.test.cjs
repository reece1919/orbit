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
 browserHelpers+"\n({base64url,subscriptionPayload,validPushAddress,subscriptionEndpoint})",
 {URL,Uint8Array,Array,Error,btoa:(value)=>Buffer.from(value,"binary").toString("base64")}
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
 assert.ok(browser.includes('const payload=subscriptionPayload(pushExisting)'));
 const block=excerpt(browser,"async function checkDevice(){","async function enablePush(){");
 assert.ok(block.indexOf('await api("subscribe"')<block.indexOf("deviceSubscribed=true"));
 assert.ok(browser.includes("pushRegistration.pushManager.subscribe"));
 assert.ok(!browser.includes("subscription:sub.toJSON()"));
});


test("Notification controls show inline actionable feedback even without a registered device",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/id="pulse-push-feedback"[^>]*role="status"/);
 assert.match(html,/id="pulse-check-push"/);
 const schedule=excerpt(browser,"function renderSchedule(){","function render(){");
 assert.ok(!schedule.includes("if(test)test.disabled=!deviceSubscribed"));
 assert.ok(schedule.includes("enable.disabled=false"));
 assert.match(browser,/const logPush=\(m\)=>/);
 assert.match(browser,/if\(e.target.closest\("#pulse-check-push"\)\)/);
 assert.match(browser,/logPush\("Checking whether the push provider accepts a test/);
});

test("Rejected providers reveal hostname only, never subscription tokens",()=>{
 const s="https://unrecognized.push-provider.example/private-secret-token?key=do-not-log";
 const sample=browserCode.subscriptionPayload(validBrowserSubscription(s));
 const error=serverCode.subscriptionError(sample);
 assert.match(error,/unrecognized\.push-provider\.example/);
 assert.doesNotMatch(error,/private-secret-token|do-not-log/);
 assert.equal(serverCode.subscriptionError(browserCode.subscriptionPayload(validBrowserSubscription("https://web.push.apple.com/device"))),null);
});

test("Invalid browser addresses cannot reach the server and trigger repair",()=>{
 const malformed=validBrowserSubscription("bad-endpoint-token");
 assert.equal(browserCode.validPushAddress(malformed.endpoint),false);
 assert.throws(()=>browserCode.subscriptionPayload(malformed),/invalid push subscription address/);
 assert.equal(browserCode.validPushAddress("http://web.push.apple.com/token"),false);
 assert.equal(browserCode.validPushAddress("https://web.push.apple.com/token"),true);
 assert.match(browser,/pushRepairRequired=!!pushExisting/);
 assert.match(browser,/async function repairPush\(\)/);
 assert.match(browser,/pushExisting\.unsubscribe\(\)/);
 assert.match(browser,/pushRegistration\.pushManager\.subscribe/);
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/id="pulse-repair-push"/);
});
test("Browser uses valid JSON endpoint only when the raw Push API property is corrupt",()=>{
 const browserSub=validBrowserSubscription("invalid-locally");
 browserSub.toJSON=()=>({endpoint:"https://web.push.apple.com/safe-device-token"});
 const payload=browserCode.subscriptionPayload(browserSub);
 assert.equal(payload.endpoint,"https://web.push.apple.com/safe-device-token");
});

test("Full browser and server modules do not shadow the native URL constructor",()=>{
 assert.match(browser,/^const PULSE_API_URL=/m);
 assert.match(server,/^const SUPABASE_PROJECT_URL=/m);
 assert.doesNotMatch(browser,/^const URL=/m);
 assert.doesNotMatch(server,/^const URL=/m);
 // Inject the exact lexical shadowing bug from the original app. The URL
 // validators must still use the native URL constructor, even in this scope.
 const browserWithShadow=vm.runInNewContext(
  'const URL="https://not-a-constructor.example";\n'+browserHelpers+
  '\n({validPushAddress,subscriptionPayload})',
  {URL,Uint8Array,Array,Error,btoa:(value)=>Buffer.from(value,"binary").toString("base64")}
 );
 const serverWithShadow=vm.runInNewContext(
  'const URL="https://not-a-constructor.example";\n'+serverHelpers+
  '\n({subscriptionError,safePushHost})',
  {URL,atob:(value)=>Buffer.from(value,"base64").toString("binary")}
 );
 const apple=validBrowserSubscription("https://web.push.apple.com/valid-device-token");
 assert.equal(browserWithShadow.validPushAddress(apple.endpoint),true);
 const payload=browserWithShadow.subscriptionPayload(apple);
 assert.equal(serverWithShadow.subscriptionError(payload),null);
 assert.equal(serverWithShadow.safePushHost(payload.endpoint),"web.push.apple.com");
 assert.equal(browserWithShadow.validPushAddress("https://evil.example/secret"),true);
 assert.match(serverWithShadow.subscriptionError({...payload,endpoint:"https://evil.example/secret"}),/Unsupported/);
});
