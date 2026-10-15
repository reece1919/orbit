/* VITA seven-day nutrition — a simple view of confirmed FUEL entries.
 * Read-only, authenticated, MFA-gated. No daily targets or estimated missing days.
 */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const chart = el('vita-nutrition-week-bars');
  const status = el('vita-nutrition-week-status');
  if (!chart || !status) return;

  const dayKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  const startOfDay = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const num = value => Number(value);
  const rounded = value => Math.round(value/50)*50;
  const approx = value => '≈ '+rounded(value).toLocaleString();
  const shortKcal = value => {
    const n=rounded(value);
    return n>=1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'k' : n.toLocaleString();
  };
  let inFlight=false, queued=false, lastLoad=0, ownerId='';

  function setText(id,value){const target=el(id);if(target)target.textContent=value;}
  function reset(message){
    chart.replaceChildren();
    setText('vita-nutrition-week-average','—');
    setText('vita-nutrition-week-days','—');
    setText('vita-week-overview','7-day trend unavailable');
    status.textContent=message;
  }
  function daysForToday(){
    const now=new Date(), today=startOfDay(now);
    return Array.from({length:7},(_,i)=>{
      const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6+i);
      return {key:dayKey(date),date,calories:0,count:0,today:i===6};
    });
  }
  function render(entries,range){
    const days=range.days;
    const byDate=new Map(days.map(day=>[day.key,day]));
    for(const entry of entries){
      const date=new Date(entry.consumed_at);
      const day=byDate.get(dayKey(date));
      const value=num(entry.calories_kcal);
      if(!day || !Number.isFinite(value) || value<0) continue;
      day.calories+=value;
      day.count+=1;
    }
    const logged=days.filter(d=>d.count>0);
    const sum=logged.reduce((total,d)=>total+d.calories,0);
    const average=logged.length ? sum/logged.length : null;
    setText('vita-nutrition-week-average',average===null?'—':approx(average));
    setText('vita-nutrition-week-days',logged.length+' of 7 days');
    setText('vita-week-overview',logged.length ? logged.length+' days logged this week · '+approx(average)+' kcal/logged day' : 'No food logged in the last 7 days');
    status.textContent=logged.length
      ? 'Showing food recorded in FUEL. Unlogged days are blank, not zero. Today is still in progress.'
      : 'No confirmed food entries in these seven days yet. Pending meals will appear after the hourly sync.';

    const max=Math.max(1,...logged.map(d=>d.calories));
    chart.replaceChildren();
    for(const day of days){
      const button=document.createElement('button');
      button.type='button';
      button.className='vita-nutrition-day'+(day.today?' is-today':'')+(day.count?' has-food':' is-empty');
      button.dataset.nutritionDate=day.key;
      const dateLabel=day.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
      button.setAttribute('aria-label',dateLabel+': '+(day.count?approx(day.calories)+' calories logged from '+day.count+' entries':'No food logged')+'. View this day');
      button.title='View '+dateLabel+' in your food journal';
      const amount=document.createElement('span');amount.className='vita-nutrition-day-value';
      amount.textContent=day.count?shortKcal(day.calories):'—';
      const track=document.createElement('span');track.className='vita-nutrition-day-track';track.setAttribute('aria-hidden','true');
      const bar=document.createElement('span');bar.className='vita-nutrition-day-fill';
      if(day.count)bar.style.height=Math.max(3,day.calories/max*100)+'%';
      track.appendChild(bar);
      const label=document.createElement('span');label.className='vita-nutrition-day-label';
      label.textContent=day.today?'Today':day.date.toLocaleDateString(undefined,{weekday:'short'});
      button.append(amount,track,label);
      chart.appendChild(button);
    }
  }

  async function load(force=false){
    if(inFlight){queued=queued||force;return;}
    if(!force && Date.now()-lastLoad<30000)return;
    inFlight=true;
    const refresh=el('vita-nutrition-week-reload');if(refresh)refresh.disabled=true;
    try{
      await window.ORBITAuth?.ready;
      const auth=window.ORBITAuth;
      if(!auth?.client||!auth.user){ownerId='';reset('Sign in to view your seven-day nutrition history.');return;}
      const owner=auth.user.id;
      if(ownerId!==owner){ownerId=owner;lastLoad=0;reset('Loading your private nutrition history…');}
      const assurance=await auth.client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(assurance.error || assurance.data?.currentLevel!=='aal2'){
        reset('Verify your authenticator to view nutrition history.');return;
      }
      status.textContent='Updating the last seven days…';
      const days=daysForToday();
      const begin=days[0].date;
      const end=new Date(days[6].date.getFullYear(),days[6].date.getMonth(),days[6].date.getDate()+1);
      const entries=[];
      const PAGE=400, MAX=4000;
      for(let offset=0;offset<MAX;offset+=PAGE){
        const {data,error}=await auth.client.from('fuel_food_entries')
          .select('id,consumed_at,calories_kcal')
          .eq('owner_id',owner)
          .gte('consumed_at',begin.toISOString()).lt('consumed_at',end.toISOString())
          .order('consumed_at',{ascending:true}).order('id',{ascending:true})
          .range(offset,offset+PAGE-1);
        if(error)throw error;
        entries.push(...(data||[]));
        if((data||[]).length<PAGE)break;
        if(offset+PAGE>=MAX)throw Error('More than 4,000 entries in seven days; totals cannot be verified.');
      }
      if(window.ORBITAuth?.user?.id!==owner)return;
      lastLoad=Date.now();
      render(entries,{days});
    }catch(error){
      reset('Could not load weekly nutrition: '+(error?.message||'Please retry.'));
    }finally{
      inFlight=false;if(refresh)refresh.disabled=false;
      if(queued){queued=false;void load(true);}
    }
  }

  el('vita-nutrition-week-reload')?.addEventListener('click',()=>void load(true));
  chart.addEventListener('click',event=>{
    const button=event.target.closest('[data-nutrition-date]');
    const input=el('fuel-date');
    if(!button||!input)return;
    input.value=button.dataset.nutritionDate;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.closest('.fuel-overview')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.addEventListener('orbit:auth-changed',()=>{ownerId='';lastLoad=0;void load(true);});
  document.addEventListener('fuel:inbox-processed',()=>void load(true));
  document.addEventListener('vita:food-changed',()=>void load(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
  document.addEventListener('click',event=>{if(event.target.closest('[data-view="fuel"]'))void load();});
  window.addEventListener('focus',()=>void load());
  if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>load(true));
})();
