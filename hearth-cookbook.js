/* The Hearth: read-only cookbook. All writes remain conversational. */
(() => {
  'use strict';
  const scalar=v=>typeof v==='string'||typeof v==='number'?String(v):'';
  const array=v=>Array.isArray(v)?v:[];
  const ingredient=v=>scalar(v)||(!v||typeof v!=='object'?'':[scalar(v.quantity??v.amount),scalar(v.unit),scalar(v.name??v.ingredient??v.item),scalar(v.notes??v.note)].filter(Boolean).join(' ')||scalar(v.text));
  const step=v=>scalar(v)||scalar(v?.instruction??v?.text??v?.step??v?.description);
  const tags=r=>array(r.tags).filter(t=>typeof t==='string'&&t.trim());
  const norm=v=>scalar(v).toLocaleLowerCase().trim();
  const filter=(rows,q,status,tag)=>rows.filter(r=>(!status||r.status===status)&&(!tag||tags(r).includes(tag))&&(!norm(q)||[r.title,...tags(r),...array(r.ingredients).map(ingredient),r.details?.cuisine,r.details?.meal_type].map(norm).join(' ').includes(norm(q))));
  const shopping=r=>array(r.ingredients).map(ingredient).filter(Boolean).join('\n');
  if(typeof module==='object'&&module.exports)module.exports={ingredient,step,tags,filter,shopping};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),dialog=$('hearth-dialog');
  if(!dialog)return;
  const list=$('hearth-list'),detail=$('hearth-recipe'),state=$('hearth-state'),tagFilter=$('hearth-tag-filter'),search=$('hearth-search'),statusFilter=$('hearth-status-filter');
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
  let rows=[],selected=null,sequence=0,ready=false,owner='',checked=new Set();
  function clear(message){rows=[];selected=null;checked.clear();ready=false;list.replaceChildren();detail.replaceChildren();tagFilter.replaceChildren(new Option('All tags',''));search.value='';statusFilter.value='';state.textContent=message;}
  function renderDetail(r){
    detail.replaceChildren();
    if(!r){detail.append(el('p','Choose a recipe from the index.','watch-detail'));return;}
    detail.append(el('p',r.status==='favorite'?'FAVORITE':r.status==='tested'?'TESTED':'UNTESTED','hearth-kicker'),el('h3',r.title||'Untitled recipe'));
    const meta=[r.servings!=null?'Serves '+scalar(r.servings):'',scalar(r.details?.cuisine),scalar(r.details?.meal_type),...tags(r)].filter(Boolean);
    if(meta.length)detail.append(el('p',meta.join(' · '),'hearth-meta'));
    const description=scalar(r.details?.description??r.details?.summary);if(description)detail.append(el('p',description));
    const items=array(r.ingredients).map(ingredient).filter(Boolean);
    detail.append(el('h4','Ingredients'));
    if(!items.length)detail.append(el('p','No ingredients recorded.'));
    else{
      const ul=el('ul',null,'hearth-ingredients');
      items.forEach((item,i)=>{const li=el('li'),label=el('label'),box=el('input');box.type='checkbox';const key=r.id+':'+i;box.checked=checked.has(key);box.addEventListener('change',()=>box.checked?checked.add(key):checked.delete(key));label.append(box,document.createTextNode(item));li.append(label);ul.append(li);});detail.append(ul);
      const copy=el('button','Copy ingredients','quiet-pill');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(shopping(r));copy.textContent='Copied';}catch{copy.textContent='Copy unavailable; select the ingredient text.';}});detail.append(copy);
    }
    detail.append(el('h4','Method'));const steps=array(r.instructions).map(step).filter(Boolean);if(steps.length){const ol=el('ol');steps.forEach(x=>ol.append(el('li',x)));detail.append(ol);}else detail.append(el('p','No method recorded.'));
    if(r.nutrition&&typeof r.nutrition==='object'&&!Array.isArray(r.nutrition)){
      const n=Object.entries(r.nutrition).filter(([,v])=>scalar(v));
      if(n.length){detail.append(el('h4','Estimated nutrition'));const dl=el('dl',null,'hearth-nutrition');for(const [k,v] of n){dl.append(el('dt',k.replace(/_/g,' ')),el('dd',scalar(v)));}detail.append(dl);}
    }
    const notes=scalar(r.details?.notes);if(notes)detail.append(el('h4','Kitchen notes'),el('p',notes));
  }
  function render(){
    if(!ready)return;
    const visible=filter(rows,search.value,statusFilter.value,tagFilter.value);
    if(!visible.some(r=>r.id===selected))selected=visible[0]?.id??null;
    list.replaceChildren();state.textContent=rows.length?visible.length+' of '+rows.length+' recipes':'Your cookbook is empty. Ask ChatGPT to save your first recipe to The Hearth.';
    for(const r of visible){const b=el('button',r.title||'Untitled recipe','hearth-index-item');b.type='button';b.setAttribute('aria-pressed',String(r.id===selected));b.addEventListener('click',()=>{selected=r.id;render();});list.append(b);}
    if(rows.length&&!visible.length)list.append(el('p','No recipes match these filters.'));
    renderDetail(visible.find(r=>r.id===selected));
  }
  async function load(){
    const seq=++sequence,auth=window.ORBITAuth;
    clear('Checking private cookbook…');
    try{
      if(!auth)throw Error('Authentication unavailable');
      await auth.ready;if(seq!==sequence||!dialog.open)return;
      owner=auth.user?.id||'';
      if(!owner||!auth.client){clear('Sign in to Grimoire to open your cookbook.');return;}
      const account=owner,client=auth.client,all=[];
      for(let offset=0;;offset+=100){
        const {data,error}=await client.from('hearth_recipes').select('id,title,status,servings,ingredients,instructions,nutrition,details,tags').eq('owner_id',account).order('title',{ascending:true}).order('id',{ascending:true}).range(offset,offset+99);
        if(seq!==sequence||auth.user?.id!==account||!dialog.open)return;
        if(error)throw error;if(!Array.isArray(data))throw Error('Unexpected response');
        all.push(...data);if(data.length<100)break;
      }
      rows=all;ready=true;const allTags=[...new Set(rows.flatMap(tags))].sort((a,b)=>a.localeCompare(b));for(const t of allTags)tagFilter.append(new Option(t,t));render();
    }catch(_){if(seq===sequence)clear('The private cookbook could not be loaded. Refresh to try again.');}
  }
  $('hearth-open').addEventListener('click',()=>{dialog.showModal();void load();});
  $('hearth-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{++sequence;owner='';clear('');});
  $('hearth-refresh').addEventListener('click',()=>void load());
  search.addEventListener('input',render);statusFilter.addEventListener('change',render);tagFilter.addEventListener('change',render);
  document.addEventListener('orbit:auth-changed',()=>{++sequence;owner='';clear('Account changed.');if(dialog.open)void load();});
})();
