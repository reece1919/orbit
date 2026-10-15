const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const W=require('../writing.js'),F=require('../formatting.js');
const {Element,Text}=require('./dom.cjs');
function fixture(kind='article',initial=null){
 const html=readFileSync(require.resolve('../index.html'),'utf8');
 const controls=new Map([...html.matchAll(/id="([\w-]+)"/g)].map(m=>['#'+m[1],new Element()]));
 controls.set('#entry-form [name=title]',new Element('input'));
 const $=id=>{assert.ok(controls.has(id),id);return controls.get(id);};
 let marks=0,confirmations=0;
 const record={title:'Entry',category:'Lore',world_anvil:kind==='category'?{kind:'category',fields:{description:'[p][b]Current[/b] source.[/p]',excerpt:'Keep teaser',custom1:'Keep block',custom2:'',custom3:'',custom4:'',custom5:''}}:{kind:'article',content:'[h2]Original heading[/h2]\n[p][b]Current[/b] article.[/p][img:123]'}};
 const selection={rangeCount:0,isCollapsed:true,removeAllRanges(){this.rangeCount=0;},addRange(range){this.range=range;this.rangeCount=1;},getRangeAt(){return this.range;}};
 const window={DriftmarkWriting:W,DriftmarkFormat:F,getSelection:()=>selection};
 const document={querySelector:$,querySelectorAll:()=>[],getElementById:id=>$('#'+id),addEventListener(){},defaultView:window,
  createElement:tag=>new Element(tag),createRange(){return {commonAncestorContainer:null,selectNodeContents(el){this.commonAncestorContainer=el;},collapse(){},cloneRange(){return {...this};}};},
  execCommand(name,_,value){if(name==='insertHTML')$('#section-visual').innerHTML+=value;if(name==='insertText')$('#section-visual').appendChild(new Text(value));return true;}};
 for(const control of controls.values())control.ownerDocument=document;
 const context={window,document,confirm:()=>{confirmations++;return true;}};
 vm.runInNewContext(readFileSync(require.resolve('../editor.js'),'utf8'),context);
 vm.runInNewContext(readFileSync(require.resolve('../workbench.js'),'utf8'),context);
 const desk=window.DriftmarkWorkbench.init({getEntries:()=>[],getSelected:()=>'entry',getRecord:()=>record,markDirty:()=>marks++,status(){},download(){}});
 const open=article=>desk.open({...record,article});open(initial);
 const navigate=id=>$('#section-nav').emit('click',{target:{closest:()=>({dataset:{section:id}})}});
 const type=async text=>{$('#section-visual').textContent=text;await $('#section-visual').emit('input',{inputType:'insertText'});};
 const format=action=>$('#draft-toolbar').emit('click',{target:{closest:()=>({dataset:{format:action}})}});
 return {$,record,desk,open,navigate,type,format,marks:()=>marks,confirmations:()=>confirmations};
}
test('the real workbench starts in visual mode and only imports source prose after the author asks',async()=>{
 const f=fixture();assert.equal(f.$('#section-visual').hidden,false);assert.equal(f.$('#section-draft').hidden,true);assert.equal(f.desk.collect().sections[0].draft,'');
 assert.equal(f.$('#article-use-current').hidden,false);await f.$('#article-use-current').emit('click');
 assert.equal(f.desk.collect().sections[0].draft,f.record.world_anvil.content);assert.match(f.$('#section-visual').innerHTML,/<h2|<strong/);assert.match(f.$('#section-visual').innerHTML,/Image/);
 assert.equal(f.desk.collect().sections[0].reviewed,false);assert.ok(f.marks()>0);
});
test('visual edits survive navigation, collection and reload without putting prose into the planning fields',async()=>{
 const f=fixture();await f.type('My first prose.');await f.navigate('starter-1');await f.type('My second prose.');
 const saved=JSON.parse(JSON.stringify(f.desk.collect()));f.open(saved);await f.navigate('starter-0');assert.equal(f.$('#section-visual').textContent,'My first prose.');
 assert.equal(f.desk.collect().sections[1].draft,'My second prose.');assert.notEqual(f.desk.collect().sections[0].prompt,'My first prose.');
});
test('switching visual and BBCode views preserves exact drafts and supports deliberate source edits',async()=>{
 const f=fixture();await f.$('#article-use-current').emit('click');const original=f.desk.collect().sections[0].draft;
 await f.$('#draft-source-mode').emit('click');assert.equal(f.$('#section-draft').hidden,false);assert.equal(f.$('#section-draft').value,original);
 await f.$('#draft-visual-mode').emit('click');assert.equal(f.desk.collect().sections[0].draft,original);
 await f.$('#draft-source-mode').emit('click');f.$('#section-draft').value='[p][i]My revision[/i][/p]';await f.$('#section-draft').emit('input');await f.$('#draft-visual-mode').emit('click');
 assert.equal(f.desk.collect().sections[0].draft,'[p][i]My revision[/i][/p]');assert.match(f.$('#section-visual').innerHTML,/<em/);
});
test('formatted category drafts still send only the selected field and preserve every other field',async()=>{
 const f=fixture('category');assert.match(f.$('#category-field-source-preview').innerHTML,/<strong/);await f.$('#category-field-use-current').emit('click');
 assert.deepEqual(W.categoryChanges(f.desk.collect()),{description:f.record.world_anvil.fields.description});await f.type('My edited description.');
 await f.navigate('excerpt');assert.equal(f.$('#section-visual').textContent,'');assert.equal(f.$('#category-field-include').checked,false);
 assert.deepEqual(W.categoryChanges(f.desk.collect()),{description:'My edited description.'});assert.equal(f.record.world_anvil.fields.excerpt,'Keep teaser');
});
test('an included empty visual category field remains an explicit reviewed clear',async()=>{
 const f=fixture('category');await f.$('#category-field-use-current').emit('click');await f.type('');
 assert.deepEqual(W.categoryChanges(f.desk.collect()),{description:''});assert.equal(f.$('#section-reviewed').disabled,true);
});
test('reconciliation refreshes the visible reference without resetting visual writing or its undo history',async()=>{
 const f=fixture();await f.type('Keep my pending writing.');const html=f.$('#section-visual').innerHTML;
 f.record.world_anvil.content='[b]Updated source[/b]';f.desk.refreshSource();assert.equal(f.$('#section-visual').innerHTML,html);assert.equal(f.desk.collect().sections[0].draft,'Keep my pending writing.');
 await f.format('undo');assert.equal(f.desk.collect().sections[0].draft,'');
});
test('undo and redo operate only on the current section, including after a view change',async()=>{
 const f=fixture();await f.type('First section.');await f.navigate('starter-1');await f.type('Second section.');await f.format('undo');
 assert.equal(f.desk.collect().sections[0].draft,'First section.');assert.equal(f.desk.collect().sections[1].draft,'');await f.format('redo');assert.equal(f.desk.collect().sections[1].draft,'Second section.');
 await f.$('#draft-source-mode').emit('click');const event=await f.$('#section-draft').emit('keydown',{key:'z',ctrlKey:true});assert.equal(event.defaultPrevented,true);assert.equal(f.desk.collect().sections[1].draft,'');
 await f.format('redo');assert.equal(f.desk.collect().sections[1].draft,'Second section.');
});
test('oversized visual input is rejected as a whole without silently truncating the prior draft',async()=>{
 const f=fixture();await f.type('Keep this.');const marks=f.marks();await f.type('x'.repeat(80001));assert.equal(f.desk.collect().sections[0].draft,'Keep this.');assert.equal(f.marks(),marks);assert.match(f.$('#draft-format-feedback').textContent,/80,000/);
});
test('external clipboard HTML is ignored, while app BBCode is safely rendered and preserved',async()=>{
 const f=fixture();const requested=[];await f.$('#section-visual').emit('paste',{clipboardData:{getData:type=>{requested.push(type);return type==='text/plain'?'<img src=x onerror=evil>':'';}}});
 assert.equal(requested.includes('text/html'),false);assert.equal(f.desk.collect().sections[0].draft,'<img src=x onerror=evil>');assert.doesNotMatch(f.$('#section-visual').innerHTML,/<img/);
 const g=fixture();const bb='[b]Pasted prose[/b][img:123][container:layout]Keep custom[/container]';await g.$('#section-visual').emit('paste',{clipboardData:{getData:type=>type==='application/x-driftmark-bbcode'?bb:''}});
 assert.equal(g.desk.collect().sections[0].draft,bb);assert.match(g.$('#section-visual').innerHTML,/<strong/);assert.doesNotMatch(g.$('#section-visual').innerHTML,/<img/);
});
test('using source text never overwrites an existing draft without the author replacement action',async()=>{
 const f=fixture();await f.type('Existing author draft.');await f.$('#article-use-current').emit('click');assert.equal(f.confirmations(),1);assert.equal(f.desk.collect().sections[0].draft,f.record.world_anvil.content);
});
test('source drafts over the section limit remain available to read and cannot be silently truncated on import',async()=>{
 const f=fixture();f.record.world_anvil.content='x'.repeat(80001);f.desk.refreshSource();assert.equal(f.$('#article-use-current').disabled,true);await f.$('#article-use-current').emit('click');assert.equal(f.desk.collect().sections[0].draft,'');
});
