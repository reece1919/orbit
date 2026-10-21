"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "orbit-steam", "index.ts"), "utf8")
  .replace(/^import \{ createClient \} from "[^"]+";\s*$/m, "");

function fixture({response400 = true, schemaAchievements = [], schemaFails = false, noStats = true} = {}) {
  const updates = [], calls = [];
  const fetch = async url => {
    const endpoint = new URL(url.toString()).pathname;
    calls.push(endpoint);
    if(endpoint.includes("GetPlayerAchievements")) {
      const value = noStats ? {playerstats:{success:false,error:"Requested app has no stats"}} : {message:"Other provider problem"};
      return {ok:!response400,status:response400?400:200,json:async()=>value};
    }
    if(endpoint.includes("GetSchemaForGame")) {
      if(schemaFails)return {ok:false,status:503,json:async()=>({})};
      return {ok:true,status:200,json:async()=>({game:{gameName:"Sample",availableGameStats:{achievements:schemaAchievements}}})};
    }
    throw Error("Unexpected endpoint");
  };
  const db = {from(table) {return {
    update(value){updates.push({table,value});return this;},
    eq(){return this;},
    then(next){return Promise.resolve({error:null}).then(next);}
  }}};
  const ctx = {URL,fetch,AbortSignal:{timeout:()=>null},Deno:{env:{get:()=>null},serve:()=>{}},console};
  const {achievements} = vm.runInNewContext(src+"\n({achievements})",ctx);
  return {run:()=>achievements(db,"synthetic-owner","76561190000000000",22320,"fake-key"),updates,calls};
}

test("Known 400 with empty game schema is normal no-achievements result", async()=>{
  const h=fixture();
  const result=await h.run();
  assert.equal(result.ok,true);
  assert.equal(result.noAchievements,true);
  assert.equal(result.total,0);
  assert.equal(result.unlocked,0);
  assert.equal(h.calls.length,2);
  assert.equal(h.updates[0].value.achievement_error,null);
  assert.equal(h.updates[0].value.achievements_total,0);
});

test("400 does not mark games with actual achievement definitions as empty", async()=>{
  const h=fixture({schemaAchievements:[{name:"SAMPLE"}]});
  const result=await h.run();
  assert.equal(result.ok,false);
  assert.equal(result.code,"STATS_UNAVAILABLE");
  assert.match(result.message,/lists achievements/);
  assert.equal(h.updates[0].value.achievements_total,undefined);
});

test("Unverified schema never silently means zero Steam achievements", async()=>{
  const h=fixture({schemaFails:true});
  const result=await h.run();
  assert.equal(result.ok,false);
  assert.equal(result.code,"STATS_UNVERIFIED");
  assert.equal(h.updates[0].value.achievements_total,undefined);
});

test("Unrelated HTTP 400 remains an HTTP error, not zero achievements", async()=>{
  const h=fixture({noStats:false});
  const result=await h.run();
  assert.equal(result.code,"HTTP_400");
  assert.equal(result.ok,false);
  assert.equal(h.calls.length,1);
});

test("A successful HTTP response with success false checks schema too", async()=>{
  const h=fixture({response400:false});
  const result=await h.run();
  assert.equal(result.ok,true);
  assert.equal(result.noAchievements,true);
});
