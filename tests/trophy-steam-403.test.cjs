"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const src=fs.readFileSync(path.join(__dirname,"..","supabase","functions","orbit-steam","index.ts"),"utf8")
  .replace(/^import \{ createClient \} from "[^"]+";\s*$/m,"");
function server(fetch){
  const ctx={
    Deno:{env:{get:()=>null},serve:()=>{}},
    URL,fetch,AbortSignal:{timeout:()=>null},console,
  };
  return vm.runInNewContext(src+"\n({steamCall,profileVisibility})",ctx);
}
const steamId="76561190000000000";
function reply(status,obj){return {status,ok:status===200,json:async()=>obj};}

test("403 containing 'Profile is not public' is classified, without leaking provider data",async()=>{
 const {steamCall}=server(async()=>reply(403,{playerstats:{error:"Profile is not public",debug:"should not be exposed"}}));
 await assert.rejects(steamCall("ISteamUserStats","GetPlayerAchievements","0001",{steamid:steamId,appid:413150},"synthetic-key"),
   err=>err.code==="PROFILE_PRIVATE"&&/My Profile/.test(err.message)&&!/debug|synthetic-key/.test(err.message));
});
test("ambiguous Steam 403 remains ambiguous rather than asserting the account is private",async()=>{
 const {steamCall}=server(async()=>reply(403,{playerstats:{error:"Something else"}}));
 await assert.rejects(steamCall("ISteamUserStats","GetPlayerAchievements","0001",{steamid:steamId,appid:413150},"synthetic-key"),
   err=>err.code==="HTTP_403"&&/without a definitive reason/.test(err.message));
});
test("403 about missing achievement stats is not misclassified as account-wide privacy",async()=>{
 const {steamCall}=server(async()=>reply(403,{playerstats:{error:"Requested app has no stats"}}));
 await assert.rejects(steamCall("ISteamUserStats","GetPlayerAchievements","0001",{steamid:steamId,appid:47810},"synthetic-key"),
   err=>err.code==="NO_STATS");
});
test("profile visibility check distinguishes public and nonpublic summaries",async()=>{
 for(const visibility of [3,1]){
   const {profileVisibility}=server(async()=>reply(200,{response:{players:[{steamid:steamId,communityvisibilitystate:visibility}]}}));
   assert.equal(await profileVisibility(steamId,"synthetic-key"),visibility===3?"public":"private");
 }
});
