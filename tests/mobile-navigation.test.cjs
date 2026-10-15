"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"mobile-nav.css"),"utf8");
const launchCss=fs.readFileSync(path.join(root,"compact-systems.css"),"utf8");
const within=(str,left,right)=>{
 const a=str.indexOf(left),b=str.indexOf(right,a+left.length);
 assert.ok(a>=0&&b>a,"Expected bounds: "+left);
 return str.slice(a,b);
};

test("Four-tab mobile bar retains Home / Systems / VITA / More in order",()=>{
 const nav=within(html,'<nav class="mobile-nav"','</nav>');
 assert.equal((nav.match(/<button\b/g)||[]).length,4);
 const expected=['data-view="home"','id="mobile-systems"','data-view="vita"','id="mobile-more"'];
 let last=-1;
 for(const marker of expected){
  const position=nav.indexOf(marker);
  assert.ok(position>last,"Missing or out-of-order mobile nav item: "+marker);
  last=position;
 }
 assert.doesNotMatch(nav,/data-view="focus"|data-view="inbox"|>Tasks<|>Inbox</);
 assert.match(html,/data-view="focus"[^>]*>.*?Tasks/);
 assert.match(html,/data-view="inbox"/);
});

test("Systems selector offers existing destinations with secure external links",()=>{
 const sheet=within(html,'<section id="mobile-system-sheet"','</section>');
 for(const name of ["GAIA","ECHO","RUNE","VITA","QUILL"])
  assert.ok(sheet.includes(">"+name+"</span>"),"Missing "+name+" link");
 assert.match(sheet,/href="https:\/\/reece1919.github.io\/gaia\/"/);
 assert.match(sheet,/href="https:\/\/reece1919.github.io\/echo\/"/);
 assert.match(sheet,/href="https:\/\/reece1919.github.io\/rune-web\/"/);
 assert.match(sheet,/href="driftmark\/"/);
 assert.match(sheet,/type="button" data-view="vita"/);
 assert.match(sheet,/target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/id="mobile-systems-backdrop"[^>]*hidden/);
 assert.match(html,/id="mobile-systems"[^>]*aria-expanded="false"/);
});

test("Mobile overrides have four columns and leave desktop alone",()=>{
 assert.match(css,/@media\s*\(max-width:\s*980px\)/);
 assert.match(css,/\.mobile-nav\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
 assert.match(css,/\.topbar \.menu-button\s*\{\s*display:\s*none\s*!important/);
 assert.match(css,/@media\s*\(min-width:\s*981px\)/);
 assert.ok(html.indexOf("mobile-nav.css")>html.indexOf("compact-systems.css"));
 assert.match(html,/class="main-nav"/);
});

test("Systems opens, closes, and yields correctly to More",()=>{
 class Item{
  constructor(){this.hidden=true;this.attrs={};this.classes=new Set();this.focused=false;this.classList={
    add:(name)=>this.classes.add(name),
    remove:(name)=>this.classes.delete(name),
    contains:(name)=>this.classes.has(name),
    toggle:(name,force)=>{if(force===undefined? !this.classes.has(name):force){this.classes.add(name);return true;}this.classes.delete(name);return false;}
  };}
  setAttribute(key,value){this.attrs[key]=value;}
  focus(){this.focused=true;}
  querySelector(){return firstLink;}
 }
 const selectors=["#mobile-system-sheet","#mobile-systems-backdrop","#mobile-systems","#sidebar","#nav-backdrop","#menu-button","#mobile-more"];
 const nodes=Object.fromEntries(selectors.map(s=>[s,new Item()]));
 const firstLink=new Item();
 nodes["#mobile-system-sheet"].querySelector=()=>firstLink;
 nodes["#mobile-systems"].hidden=false;
 nodes["#mobile-more"].hidden=false;
 const f=within(app,"  function closeSystemsMenu(", "  let vitaSection=");
 const funcs=vm.runInNewContext(f+"\n({toggleSystemsMenu,closeSystemsMenu,toggleNavigation})",{$:(selector)=>nodes[selector]});
 funcs.toggleSystemsMenu();
 assert.equal(nodes["#mobile-system-sheet"].hidden,false);
 assert.equal(nodes["#mobile-systems-backdrop"].hidden,false);
 assert.equal(nodes["#mobile-systems"].attrs["aria-expanded"],"true");
 assert.equal(firstLink.focused,true);
 funcs.toggleNavigation();
 assert.equal(nodes["#mobile-system-sheet"].hidden,true);
 assert.equal(nodes["#mobile-systems"].attrs["aria-expanded"],"false");
 assert.equal(nodes["#sidebar"].classList.contains("open"),true);
 funcs.toggleSystemsMenu();
 assert.equal(nodes["#sidebar"].classList.contains("open"),false);
 funcs.closeSystemsMenu(true);
 assert.equal(nodes["#mobile-systems"].focused,true);
 assert.equal(nodes["#mobile-system-sheet"].hidden,true);
 assert.match(app,/view=next;\s*closeSystemsMenu\(\)/);
 assert.match(app,/if\(e.key==='Escape'\).*closeSystemsMenu\(true\)/);
});


test("Home system shortcuts omit duplicate VITA and Inbox destinations",()=>{
 const row=within(html,'<section class="system-launch-bar"','</section>');
 const entries=[...row.matchAll(/class="system-launch"/g)];
 assert.equal(entries.length,4);
 const expected=["GAIA","ECHO","RUNE","QUILL"];
 let prev=-1;
 for(const label of expected){
  const index=row.indexOf(">"+label+"</span>");
  assert.ok(index>prev,"Expected specialist shortcut in order: "+label);
  prev=index;
 }
 assert.doesNotMatch(row,/>VITA<|>INBOX<|data-view="vita"|data-view="inbox"/);
 assert.match(launchCss,/\.system-launch-items\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(launchCss,/\.system-launch-items[^\n]*repeat\(6,minmax\(0,1fr\)\)/);
 // Direct VITA navigation and Inbox on Home remain available.
 const nav=within(html,'<nav class="mobile-nav"','</nav>');
 assert.match(nav,/data-view="vita"/);
 assert.match(html,/class="subtle-link" type="button" data-view="inbox"|type="button" class="subtle-link" data-view="inbox"/);
});

