"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const code=fs.readFileSync(path.join(__dirname,"..","supabase","functions","orbit-steam","index.ts"),"utf8");

test("Steam URL factory uses native URL, not the Supabase URL string",()=>{
  assert.doesNotMatch(code,/\bconst URL\s*=/);
  const sandbox={
    URL,
    Deno:{env:{get:(name)=>name==="SUPABASE_URL"?"https://example.supabase.co":null},serve:()=>{}},
  };
  vm.createContext(sandbox);
  // Only drop the Deno npm import: this test checks actual URL construction without network.
  vm.runInContext(code.replace(/^import\s+\{\s*createClient\s*\}\s+from\s+"[^"]+";\s*$/m,""),sandbox);
  const url=vm.runInContext('steamUrl("IPlayerService","GetOwnedGames","0001",{steamid:"76561198060915786",include_appinfo:1},"test-key").toString()',sandbox);
  const parsed=new URL(url);
  assert.equal(parsed.origin,"https://api.steampowered.com");
  assert.equal(parsed.pathname,"/IPlayerService/GetOwnedGames/v0001/");
  assert.equal(parsed.searchParams.get("steamid"),"76561198060915786");
  assert.equal(parsed.searchParams.get("key"),"test-key");
  assert.equal(parsed.searchParams.get("include_appinfo"),"1");
});
