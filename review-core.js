/* ORBIT 2.0 daily-review helpers. Pure functions, shared with Node tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ORBITReviewCore=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const DEFAULT_STEPS=[
    {id:'prepare-tomorrow',title:'Prepare for tomorrow'},
    {id:'wind-down',title:'Wind down for bed'}
  ];
  function dayKey(date=new Date()){
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function validClock(value){return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);}
  function normalizeSteps(items){
    if(!Array.isArray(items))return DEFAULT_STEPS.map(x=>({...x}));
    const used=new Set();const out=[];
    for(const item of items.slice(0,20)){
      const title=String(item?.title||'').trim().slice(0,90);
      const id=String(item?.id||'').trim().slice(0,90);
      if(!title||!id||used.has(id)||!/^[-A-Za-z0-9_]+$/.test(id))continue;
      used.add(id);out.push({id,title});
    }
    return out;
  }
  function reviewStatus(record){
    if(record?.finished_at)return 'complete';
    if(record?.skipped_at)return 'skipped';
    return 'pending';
  }
  function reportedAmount(value){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)&&n>=0&&n<=40?Math.round(n*100)/100:null;
  }
  function sourceBadges({mood=null,journal=null,health=null,alcohol=null}={}){
    return {
      mood:!!mood,
      journal:!!(journal&&typeof journal.body==='string'&&journal.body.trim()),
      health:!!(health&&health.metric_date),
      alcohol:reportedAmount(alcohol)!==null
    };
  }
  function percentComplete(steps,completed){
    const list=normalizeSteps(steps),ids=new Set(Array.isArray(completed)?completed:[]);
    if(!list.length)return null;
    return Math.round(100*list.filter(x=>ids.has(x.id)).length/list.length);
  }
  return Object.freeze({DEFAULT_STEPS,dayKey,validClock,normalizeSteps,reviewStatus,reportedAmount,sourceBadges,percentComplete});
});