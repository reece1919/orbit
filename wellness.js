/* ORBIT WELLNESS: owner-private, read-only Apple Health daily summaries.
 * No credentials or wellness samples are embedded in this public repository.
 * Writes are performed separately by authorized, verified sync workflows.
 */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const displayDay = d => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return 'No date';
    return new Date(d + 'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  };
  const shortDay = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined,{month:'numeric',day:'numeric'});
  const show = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  const n = (value, decimals = 0) => Number(value).toLocaleString(undefined,{maximumFractionDigits:decimals});
  let busy = false;
  const metrics = [
    {column:'steps',id:'steps',format:v=>n(v),suffix:'steps'},
    {column:'resting_heart_rate_bpm',id:'rhr',format:v=>n(v,1)+' bpm'},
    {column:'weight_lb',id:'weight',format:v=>n(v,1)+' lb'},
    {column:'body_fat_percent',id:'fat',format:v=>n(v,1)+'%'},
    {column:'sleep_minutes',id:'sleep',format:v=>n(v/60,1)+' hr'}
  ];
  function reset(message){
    for (const m of metrics){show('#wellness-'+m.id,'—');show('#wellness-'+m.id+'-date','No synced reading');}
    show('#wellness-last-sync','');
    show('#wellness-status',message);
    $('#wellness-step-chart').replaceChildren();
    $('#wellness-history').replaceChildren();
  }
  function render(rows){
    if(!rows.length){reset('No wellness snapshots yet. The first approved import is required.');return;}
    for(const metric of metrics){
      const newest=rows.find(r=>r[metric.column]!==null && r[metric.column]!==undefined);
      show('#wellness-'+metric.id,newest?metric.format(newest[metric.column]):'—');
      show('#wellness-'+metric.id+'-date',newest?displayDay(newest.metric_date):'No recent synced reading');
    }
    const latestSync=rows.map(r=>r.synced_at).filter(Boolean).sort().at(-1);
    show('#wellness-last-sync',latestSync?'Imported '+new Date(latestSync).toLocaleString():'Sync date unavailable');
    const chart=$('#wellness-step-chart');chart.replaceChildren();
    const days=rows.filter(r=>r.steps!==null && r.steps!==undefined).slice(0,10).reverse();
    const max=Math.max(1,...days.map(r=>r.steps));
    for(const r of days){
      const col=document.createElement('div');col.className='wellness-step-col';col.setAttribute('aria-label',displayDay(r.metric_date)+': '+n(r.steps)+' steps');
      const value=document.createElement('span');value.textContent=n(r.steps);
      const holder=document.createElement('div');holder.className='wellness-step-bar-wrap';
      const bar=document.createElement('div');bar.className='wellness-step-bar';bar.style.height=Math.max(2,100*r.steps/max)+'%';
      holder.appendChild(bar);
      const day=document.createElement('small');day.textContent=shortDay(r.metric_date);
      col.append(value,holder,day);chart.appendChild(col);
    }
    const history=$('#wellness-history');history.replaceChildren();
    for(const row of rows.slice(0,10)){
      const item=document.createElement('div');item.className='wellness-history-row';
      const parts=[displayDay(row.metric_date),row.steps==null?'—':n(row.steps)+' steps',row.resting_heart_rate_bpm==null?'—':n(row.resting_heart_rate_bpm)+' bpm',row.weight_lb==null?'—':n(row.weight_lb,1)+' lb',row.body_fat_percent==null?'—':n(row.body_fat_percent,1)+'%'];
      for(const part of parts){const s=document.createElement('span');s.textContent=part;item.appendChild(s);}
      history.appendChild(item);
    }
    show('#wellness-status','Read-only Apple Health summaries. Dates are measurement dates, not live readings.');
  }
  async function load(){
    if(busy)return;
    busy=true;
    const button=$('#wellness-reload');
    if(button)button.disabled=true;
    try{
      const auth=window.ORBITAuth;
      if(!auth?.client || !auth.user){reset('Sign in to ORBIT to view private wellness data.');return;}
      const level=await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(level.error || level.data?.currentLevel!=='aal2'){reset('Verify your authenticator to view wellness data.');return;}
      show('#wellness-status','Loading your private wellness data…');
      const {data,error}=await auth.client.from('wellness_daily')
        .select('metric_date,steps,resting_heart_rate_bpm,weight_lb,body_fat_percent,sleep_minutes,synced_at')
        .order('metric_date',{ascending:false}).limit(30);
      if(error)throw error;
      render(data||[]);
    }catch(e){
      reset('Could not retrieve the wellness snapshot. Check your verified sign-in and try again.');
    }finally{busy=false;if(button)button.disabled=false;}
  }
  $('#wellness-reload')?.addEventListener('click',()=>void load());
  document.addEventListener('orbit:auth-changed',()=>void load());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && !$('#wellness-panel')?.hidden)void load();});
  if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load());
})();