// Small DOM adapter for deterministic editor/serializer tests; no browser session or service access.
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[name]));
class Text {
  constructor(value) { this.nodeType=3;this.nodeName='#text';this.nodeValue=value;this.childNodes=[]; }
  get textContent(){return this.nodeValue;} set textContent(v){this.nodeValue=String(v);}
  get outerHTML(){return escape(this.nodeValue);} cloneNode(){return new Text(this.nodeValue);}
}
class Element {
  constructor(tag='div', attrs={}) { this.nodeType=1;this.tagName=tag.toUpperCase();this.nodeName=this.tagName;this.attrs={...attrs};this.childNodes=[];this.style={};this.listeners=new Map();this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.open=false;this.dataset={}; }
  getAttribute(name){return this.attrs[name]??null;} setAttribute(name,value){this.attrs[name]=String(value);}
  appendChild(node){node.parentNode=this;node.ownerDocument=this.ownerDocument;this.childNodes.push(node);return node;}
  get firstChild(){return this.childNodes[0];}
  get textContent(){return this.childNodes.map(c=>c.textContent).join('');} set textContent(value){this.childNodes=[];if(value)this.appendChild(new Text(String(value)));}
  get innerHTML(){return this.childNodes.map(c=>c.outerHTML).join('');}
  set innerHTML(value){
    this.childNodes=[];const stack=[this];const tokens=String(value).matchAll(/<\/?([a-z][a-z\d-]*)\b([^>]*?)>|([^<]+)/gi);
    for(const match of tokens){
      if(match[3]!==undefined){stack.at(-1).appendChild(new Text(decode(match[3])));continue;}
      if(match[0][1]==='/'){if(stack.length>1)stack.pop();continue;}
      const attrs={};for(const a of match[2].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=decode(a[2]);
      const el=new Element(match[1],attrs);stack.at(-1).appendChild(el);if(!['br','hr','input','img'].includes(match[1]))stack.push(el);
    }
  }
  get outerHTML(){const tag=this.tagName.toLowerCase();return '<'+tag+Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+(['br','hr','input','img'].includes(tag)?'':this.innerHTML+'</'+tag+'>');}
  querySelectorAll(selector){const out=[];const visit=el=>{for(const c of el.childNodes){if(c.nodeType!==1)continue;if(selector==='[data-bb-node]'?c.getAttribute('data-bb-node'):c.tagName.toLowerCase()===selector)out.push(c);visit(c);}};visit(this);return out;}
  contains(node){return node===this||this.childNodes.some(child=>child===node||(child.contains&&child.contains(node)));}
  cloneNode(deep=true){const el=new Element(this.tagName,this.attrs);if(deep)for(const c of this.childNodes)el.appendChild(c.cloneNode(true));return el;}
  addEventListener(type,fn){this.listeners.set(type,[...(this.listeners.get(type)||[]),fn]);}
  async emit(type,props={}){const event={target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...props};for(const fn of this.listeners.get(type)||[])await fn(event);return event;}
  focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}
  showModal(){this.open=true;} close(){this.open=false;}
}
function mount(doc){const el=new Element();el.innerHTML=doc.html;doc.bind(el);return el;}
module.exports={Element,Text,mount};
