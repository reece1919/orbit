const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../formatting.js');
const W=require('../writing.js');
const {Element,Text,mount}=require('./dom.cjs');

test('formatted sources show nested headings, emphasis, paragraphs and quotes without BBCode',()=>{
 const html=F.render('[h2]A heading[/h2]\n[p][b]Bold [i]and italic[/i][/b][/p][quote]A witness.[/quote]');
 assert.match(html,/<h2[^>]*><span[^>]*>A heading<\/span><\/h2>/);assert.match(html,/<strong[^>]*>/);assert.match(html,/<em[^>]*>/);assert.match(html,/<blockquote[^>]*>/);assert.doesNotMatch(html,/\[\/?(?:h2|p|b|i|quote)\]/);
});
test('both imported li lists and documented hyphen lists render, including numbered lists',()=>{
 for(const body of ['[ul][li]One[/li][li]Two[/li][/ul]','[ul]\n- One\n- Two\n[/ul]','[ol]\n- One\n- Two\n[/ol]','[list=1][*]One[*]Two[/list]']){
  const html=F.render(body);assert.equal((html.match(/<li(?: |>|$)/g)||[]).length,2);assert.doesNotMatch(html,/>\s*- One/);
 }
 const nested=F.render('[ul]\n- Parent\n[ul]\n- Child\n[/ul]\n- Next\n[/ul]');assert.equal((nested.match(/<ul/g)||[]).length,2);assert.match(nested,/Child/);
});
test('table markup renders cells and does not put whitespace spans between table rows',()=>{
 const html=F.render('[table]\n[tr][th]Name[/th][th:35]Value[/th][/tr]\n[tr][td]A[/td][td][b]B[/b][/td][/tr]\n[/table]');
 assert.match(html,/<table[^>]*><tr/);assert.equal((html.match(/<td /g)||[]).length,2);assert.match(html,/<\/tr><tr/);assert.match(html,/<strong/);
});
test('source HTML, scripts, event handlers, unsafe links, and image URLs never become active HTML',()=>{
 const html=F.render('<script>alert(1)</script><img src=x onerror="x">[url:javascript:alert(1)]bad[/url][url:data:text/html,boom]bad[/url][img:https://example.com/tracker][container:x" onclick="evil]Body[/container]');
 assert.doesNotMatch(html,/<(?:script|img|iframe)\b|\shref="(?:javascript|data):|\son(?:click|error)="/i);assert.match(html,/&lt;script&gt;/);assert.match(html,/Image/);assert.match(html,/Custom layout/);
});
test('safe links permit web URLs and anchors while rejecting executable protocols and credentials',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,x','file:///secret','//evil.com','https://user:pass@example.com','java\nscript:alert(1)'])assert.equal(F.safeUrl(value),'');
 assert.equal(F.safeUrl('https://example.com/a[b]'),'https://example.com/a%5Bb%5D');assert.equal(F.safeUrl('#history'),'#history');
 assert.match(F.render('[url:https://example.com|tab]Read[/url]'),/href="https:\/\/example.com\/" target="_blank" rel="noopener noreferrer"/);
});
test('literal BBCode and hidden comments keep their meaning without rendering the comment',()=>{
 const html=F.render('[noparse][b]Literal[/b][/noparse]/* private comment */');assert.doesNotMatch(html,/<strong|private comment/);assert.match(html,/\[b\]Literal\[\/b\]/);assert.match(html,/Hidden comment/);
 assert.equal(F.plainText('[h2]Title[/h2][p][b]Text[/b] @[Article](person:123) [[Other]] [/p]/* hidden */'),'Title\nText Article Other');
});
test('malformed, unknown, and deeply nested markup is bounded and preserved by parsing',()=>{
 for(const source of ['[p]See [Unknown] here[/p]','[b]unclosed','[u][b]odd[/u][/b]','[container:layout][h2]Title[/h2][/container]','[b]'.repeat(600)+'deep'+'[/b]'.repeat(600)]){
  assert.equal(F.parse(source).map(n=>n.raw).join(''),source);assert.ok(F.render(source).length>0);
 }
});
test('opening and saving a visual source without editing preserves every source byte',()=>{
 for(const source of [' [H2|anchor]Title[/H2]\r\n[p]Text[/p]  ','[ul]\n- A\n- B\n[/ul]','[table]\n[tr][td:20]Cell[/td][/tr]\n[/table]','[container:custom]\n[img:123|center][subcontainer:private]Keep[/subcontainer]\n[/container]/* note */']){
  const doc=F.createDocument(source),el=mount(doc);assert.equal(doc.read(el),source);assert.equal(doc.read(el.cloneNode(true)),source);
 }
});
test('editing one paragraph preserves untouched paragraphs, original tag arguments and advanced items',()=>{
 const advanced='[container:special]'+('Long preserved lore. '.repeat(50))+'[img:123][/container]';
 const source='[h2|anchor]Title[/h2]\n[p][b]Old[/b] words[/p]\n'+advanced+'/* note */';
 const doc=F.createDocument(source),el=mount(doc);el.querySelectorAll('strong')[0].childNodes[0].firstChild.nodeValue='New';
 assert.equal(doc.read(el),source.replace('[b]Old[/b]','[b]New[/b]'));assert.ok(doc.read(el).includes(advanced));
});
test('editing existing table cells keeps the other cells and column arguments',()=>{
 const source='[table]\n[tr][th:35]Name[/th][th]Value[/th][/tr]\n[tr][td]One[/td][td]Two[/td][/tr]\n[/table]';
 const doc=F.createDocument(source),el=mount(doc);el.querySelectorAll('td')[0].childNodes[0].firstChild.nodeValue='Edited';
 const result=doc.read(el);assert.match(result,/\[th:35\]Name\[\/th\]/);assert.match(result,/\[td\]Edited\[\/td\]\[td\]Two\[\/td\]/);
});
test('native editor paragraphs, lists and formatting serialize as BBCode instead of HTML',()=>{
 const doc=F.createDocument(''),el=mount(doc);el.innerHTML='<p>Words <b>in bold</b> and <i>italic</i>.</p><ul><li>One</li><li>Two</li></ul><blockquote>A quote</blockquote><hr>';
 assert.equal(doc.read(el),'[p]Words [b]in bold[/b] and [i]italic[/i].[/p][ul]\n- One\n- Two\n[/ul][quote]A quote[/quote][hr]');
});
test('literal text typed into the visual editor cannot accidentally create BBCode or a hidden comment',()=>{
 const doc=F.createDocument(''),el=mount(doc);el.textContent='Use [b] literally and /* show this */';const bb=doc.read(el);
 assert.equal(F.plainText(bb),'Use [b] literally and /* show this */');assert.doesNotMatch(F.render(bb),/<strong/);
});
test('link changes update the destination while text-only edits retain original link options',()=>{
 const doc=F.createDocument('[url:https://example.com|tab]Old label[/url]'),el=mount(doc),a=el.querySelectorAll('a')[0];
 a.childNodes[0].firstChild.nodeValue='New label';assert.equal(doc.read(el),'[url:https://example.com|tab]New label[/url]');
 a.setAttribute('href','https://different.example/');assert.equal(doc.read(el),'[url:https://different.example/]New label[/url]');
 a.setAttribute('href','javascript:alert(1)');assert.equal(doc.read(el),'New label');
});
test('deleting a preserved item removes exactly that item and clearing the draft stays empty',()=>{
 const doc=F.createDocument('Before[img:123]After'),el=mount(doc);el.childNodes.splice(1,1);assert.equal(doc.read(el),'BeforeAfter');
 el.innerHTML='<br>';assert.equal(doc.read(el),'');
});
test('copying part of an original wrapper keeps only the selected prose and its formatting',()=>{
 const doc=F.createDocument('[b]Long original[/b]'),el=mount(doc),fragment=new Element();fragment.appendChild(el.firstChild.cloneNode(true));
 fragment.firstChild.childNodes[0].firstChild.nodeValue='original';assert.equal(doc.read(fragment),'[b]original[/b]');
});
test('plain-text export removes formatting while World Anvil export keeps the exact BBCode',()=>{
 const article=W.normalizeArticle({sections:[{id:'a',title:'Section',draft:'[b]My prose[/b][br]Second line.'}]});
 assert.equal(W.draftText('Title',article,'text'),'Title\n\nSection\nMy prose\nSecond line.');assert.match(W.draftText('Title',article,'bbcode'),/\[b\]My prose\[\/b\]\[br\]Second line\./);
});

test('copying inside bold text keeps the inline formatting context in the BBCode clipboard',()=>{
 const doc=F.createDocument('[p]Before [b]Original bold[/b] after[/p]'),el=mount(doc),text=el.querySelectorAll('strong')[0].firstChild.firstChild;
 const data={};const range={commonAncestorContainer:text,cloneContents:()=>new Text('bold')};
 el.ownerDocument={createElement:tag=>new Element(tag),defaultView:{getSelection:()=>({rangeCount:1,isCollapsed:false,getRangeAt:()=>range})}};
 const event={clipboardData:{setData:(key,value)=>{data[key]=value;}},preventDefault(){this.prevented=true;}};
 F.copy(event,el,doc);assert.equal(data['application/x-driftmark-bbcode'],'[b]bold[/b]');assert.equal(data['text/plain'],'bold');assert.equal(event.prevented,true);
});
test('ambiguous paragraph/table layouts are protected rather than moved or duplicated by HTML parsing',()=>{
 for(const source of ['[p]Before[h2]Heading[/h2]After[/p]','[table]Outside[tr][td]Cell[/td][/tr][/table]']){
  const doc=F.createDocument(source),el=mount(doc);assert.match(el.innerHTML,/contenteditable="false"/);el.appendChild(new Text(' New words.'));assert.equal(doc.read(el),source+' New words.');
 }
});
