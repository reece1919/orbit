/* VITA — presentation-only bridges for the existing private FUEL, PULSE and Wellness views.
   Does not read credentials or write records. Keeps every legacy input and save handler intact. */
(() => {
  'use strict';
  const get=id=>document.getElementById(id);
  const set=(id,value)=>{const el=get(id);if(el && el.textContent!==value)el.textContent=value;};
  const clean=(v)=>String(v||'').trim();
  const original=[
    ['fuel-home-value','vita-summary-food'],
    ['pulse-home-summary','vita-summary-mind'],
    ['wellness-steps','vita-summary-steps'],
    ['wellness-steps-date','vita-summary-steps-date'],
    ['wellness-weight','vita-summary-weight'],
    ['wellness-weight-date','vita-summary-weight-date']
  ];
  function update(){
    for(const [source,destination] of original){
      const v=clean(get(source)?.textContent);
      if(v)set(destination,v);
    }
  }
  const observed=new MutationObserver(()=>update());
  for(const [source] of original){
    const el=get(source);
    if(el)observed.observe(el,{childList:true,characterData:true,subtree:true});
  }
  document.addEventListener('orbit:auth-changed',()=>update());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  update();
})();