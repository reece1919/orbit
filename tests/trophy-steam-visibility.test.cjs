"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"..","supabase","functions","orbit-steam","index.ts"),"utf8")
 .replace(/^import \{ createClient \} from "[^"]+";\s*$/m,"");
const steamId="76561190000000000";

function harness(profileState,gameListed){
 const updates=[],requests=[];
 const fetch=async (url)=>{
   const requestPath=new URL(url.toString()).pathname;
   requests.push(requestPath);
   if(requestPath.includes("/GetPlayerAchievements/"))
     return {status:403,ok:false,json:async()=>({playerstats:{error:"Profile is not public",success:false}})};
   if(requestPath.includes("/GetPlayerSummaries/"))
     return {status:200,ok:true,json:async()=>({response:{players:[{steamid:steamId,communityvisibilitystate:profileState}]}})};
   if(requestPath.includes("/GetOwnedGames/"))
     return {status:200,ok:true,json:async()=>({response:{game_count:gameListed?1:0,games:gameListed?[{appid:413150}]:[]}})};
   throw new Error("Unexpected Steam endpoint");
 };
 const db={from:()=>({
   update(row){updates.push(row);return this;},
   eq(){return this;},
   then(f){return Promise.resolve({error:null}).then(f);}
 })};
 const sandbox={URL,fetch,AbortSignal:{timeout:()=>null},Deno:{env:{get:()=>null},serve:()=>{}},console};
 const {achievements}=vm.runInNewContext(source+"\n({achievements})",sandbox);
 return {run:()=>achievements(db,"synthetic-owner",steamId,413150,"synthetic-api-key"),updates,requests};
}
test("Public Steam profile and visible game are not incorrectly called private",async()=>{
 const h=harness(3,true),out=await h.run();
 assert.equal(out.code,"ACHIEVEMENTS_FORBIDDEN");
 assert.match(out.message,/profile and this game are public/);
 assert.equal(h.requests.length,3);
 assert.doesNotMatch(out.message,/synthetic-api-key/);
});
test("Public profile but unlisted game prompts game-specific visibility check",async()=>{
 const h=harness(3,false),out=await h.run();
 assert.equal(out.code,"GAME_NOT_PUBLIC");
 assert.match(out.message,/individually marked Private/);
});
test("Nonpublic profile is differentiated from game privacy",async()=>{
 const h=harness(1,false),out=await h.run();
 assert.equal(out.code,"PROFILE_PRIVATE");
 assert.match(out.message,/Steam's public API still sees your profile as private/);
});
