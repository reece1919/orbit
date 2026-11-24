/* ORBIT calendar — one view of ORBIT events and existing live Todoist tasks. */
(()=>{
  'use strict';
  const root=document.querySelector('#orbit-calendar');
  const dialog=document.querySelector('#calendar-event-dialog');
  if(!root||!dialog)return;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const parseDay=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12)};
  const addDays=(key,n)=>{const d=parseDay(key);d.setDate(d.getDate()+n);return localDay(d)};
  const dateText=(key,style={weekday:'long',month:'long',day:'numeric',year:'numeric'})=>parseDay(key).toLocaleDateString(undefined,style);
  const today=()=>localDay(new Date());
  let selected=today(),mode='week',editId='';
  const weekday=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const assets={
    orbit:'assets/grimoire-mark.svg?v=1.1.0',
    gaia:'assets/systems/gaia.svg?v=2.0.0',
    echo:'assets/systems/echo.svg?v=2.0.0',
    rune:'assets/systems/rune-metal.png?v=2.0.0',
    vita:'assets/systems/vita-metal.webp?v=2.0.0',
    quill:'assets/systems/quill-blue-metal.png?v=2.0.0',
    driftmark:'assets/systems/quill-blue-metal.png?v=2.0.0',
    fuel:'assets/systems/fuel.svg?v=1.6.0',
    pulse:'assets/systems/pulse.svg?v=1.6.0'
  };
  const sourceName=value=>value==='driftmark'?'QUILL':value==='general'?'ORBIT':String(value||'orbit').toUpperCase();
  const sourceIcon=value=>assets[value]||assets.orbit;
  function events(){
    const store=window.ORBITLocal;
    return store?.getOwner()?(store.snapshot().calendarEvents||[]):[];
  }
  function tasks(){
    return window.ORBITLocal?.getOwner()?window.ORBITConnectedTodoist?.getCalendarTasks?.()||[]:[];
  }
  function allItems(){
    return [
      ...events().map(e=>({kind:'event',date:e.date,title:e.title,id:e.id,
        time:e.allDay?'All day':e.start||'',
        source:'orbit',event:e})),
      ...tasks().map(t=>({kind:'task',date:t.date,title:t.title,id:t.id,
        time:'',source:t.system||'orbit',url:t.url,recurring:t.recurring})),
      ...(window.ORBITGoogleCalendar?.getEvents?.()||[])
    ];
  }
  const order=(a,b)=>{
    const priority=x=>x.kind==='google'?0:x.kind==='task'?1:2;
    return priority(a)===priority(b)
      ?(a.event?.allDay?'':a.time||'').localeCompare(b.event?.allDay?'':b.time||'')||a.title.localeCompare(b.title)
      :priority(a)-priority(b);
  };
  function weeks(){
    if(mode==='week'){
      const start=parseDay(selected);
      start.setDate(start.getDate()-(start.getDay()+6)%7);
      return Array.from({length:7},(_,i)=>localDay(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i,12)));
    }
    const start=parseDay(selected.slice(0,7)+'-01');
    const offset=(start.getDay()+6)%7;
    const days=new Date(start.getFullYear(),start.getMonth()+1,0,12).getDate();
    const count=Math.ceil((offset+days)/7)*7;
    return Array.from({length:count},(_,i)=>localDay(new Date(start.getFullYear(),start.getMonth(),1+i-offset,12)));
  }
  function dayChip(item){
    const source=item.kind==='event'?'orbit':item.source;
    const name=item.kind==='event'?'Legacy ORBIT event':item.kind==='google'?'Google / '+item.event.calendarName:sourceName(source)+' task';
    const icon=item.kind==='google'?'<span class="cal-google-icon" aria-hidden="true">G</span>':
      '<img src="'+esc(sourceIcon(source))+'" alt="" loading="lazy" width="15" height="15">';
    return '<span class="cal-chip '+(item.kind==='google'?'cal-chip-google':item.kind==='event'?'cal-chip-event':'cal-chip-task')+'" title="'+esc(name+': '+item.title)+'">'+
      icon+'<span>'+esc(item.title)+'</span></span>';
  }
  // The homepage mirrors the same dates and event sources as the full calendar.
  // One state and one Google Calendar range: no duplicate requests or parallel data stores.
  function renderHomeCalendar({owner,days,byDate,month,now,count,header}){
    const home=$('#grimoire-home-calendar');
    if(!home)return;
    $('#grimoire-calendar-period').textContent=header;
    $('#home-week-heading').textContent=mode==='month'?'Month':days.includes(now)?'This Week':'Week outlook';
    $('#home-today-date').textContent=dateText(now,{weekday:'long',month:'long',day:'numeric'});
    const todayList=$('#home-today-events');
    const google=window.ORBITGoogleCalendar?.getStatus?.();
    const cachedGoogle=window.ORBITGoogleCalendar?.getTodayEvents?.();
    const currentEvents=(byDate.get(now)||[]).filter(item=>item.kind==='event');
    const todayEvents=[...currentEvents,...(cachedGoogle||[])].sort(order);
    const scheduleNotice=!owner?'Sign in to see your schedule.':!google?.connected?'Google Calendar is not connected.':cachedGoogle===null||cachedGoogle===undefined?(google.busy?'Checking Google Calendar…':'Today’s Google events are not loaded. Choose Today to refresh the range.'):google.error?'Google Calendar: '+google.error:'';
    todayList.innerHTML=!owner?'<p class="grimoire-calendar-empty">Sign in to see your schedule.</p>':
      (todayEvents.length?todayEvents.map(item=>{
        const source=item.kind==='google'?'Google Calendar':'ORBIT';
        const when=item.event?.allDay?'All day':item.time||'';
        return '<div class="grimoire-calendar-item"><span class="grimoire-calendar-item-dot is-'+(item.kind==='google'?'google':'event')+'"></span><div><strong>'+esc(item.title)+'</strong><small>'+esc([when,source,item.event?.location].filter(Boolean).join(' · '))+'</small></div></div>';
      }).join(''):!scheduleNotice?'<p class="grimoire-calendar-empty">Nothing scheduled today.</p>':'')+(scheduleNotice?'<p class="watch-detail">'+esc(scheduleNotice)+'</p>':'');
    const addToday=$('[data-home-today-new-task]');
    if(addToday)addToday.disabled=!owner||!window.ORBITConnectedTodoist?.active?.();

    $('#grimoire-calendar-selected').textContent=dateText(selected,{weekday:'long',month:'short',day:'numeric'});
    $('#grimoire-calendar-count').textContent=count.length+' item'+(count.length===1?'':'s');
    home.querySelectorAll('[data-home-cal-mode]').forEach(button=>{
      const active=button.dataset.homeCalMode===mode;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const weekdays=weekday.map(label=>'<span class="grimoire-calendar-weekday" aria-hidden="true">'+label+'</span>').join('');
    const cells=days.map(key=>{
      const group=byDate.get(key)||[];
      const day=parseDay(key).getDate();
      const other=mode==='month'&&key.slice(0,7)!==month;
      const classes='grimoire-calendar-day'+(key===selected?' is-selected':'')+
        (key===now?' is-today':'')+(other?' is-outside':'');
      const dots=group.slice(0,4).map(item=>'<i class="grimoire-calendar-dot is-'+
        (item.kind==='google'?'google':item.kind==='task'?'task':'event')+'"></i>').join('');
      const overflow=group.length>4?'<span class="grimoire-calendar-overflow">+'+(group.length-4)+'</span>':'';
      const first=mode==='week'&&group.length?
        '<small class="grimoire-calendar-preview">'+esc(group[0].title)+'</small>':'';
      return '<button type="button" class="'+classes+'" data-home-cal-day="'+key+
        '" aria-pressed="'+String(key===selected)+'" aria-label="'+
        esc(dateText(key)+', '+group.length+' item'+(group.length===1?'':'s'))+'">'+
        '<span class="grimoire-calendar-date">'+day+'</span>'+
        '<span class="grimoire-calendar-dots" aria-hidden="true">'+dots+overflow+'</span>'+first+
        '</button>';
    }).join('');
    const homeGrid=$('#grimoire-calendar-grid');
    homeGrid.dataset.mode=mode;
    homeGrid.innerHTML=weekdays+cells;
    const summary=$('#home-week-summary');
    if(summary){
      const weekDates=days.includes(now)?days.filter(d=>d>now):days;
      const populated=weekDates.filter(d=>(byDate.get(d)||[]).length);
      summary.hidden=mode!=='week'||!owner;
      summary.innerHTML=summary.hidden?'':populated.length?populated.map(d=>{
        const items=byDate.get(d)||[],shown=items.slice(0,2).map(item=>esc(item.title)).join(' · ');
        return '<button type="button" class="home-week-row" data-home-cal-day="'+d+'" aria-label="'+esc(dateText(d)+', '+items.length+' scheduled items')+'"><strong>'+esc(dateText(d,{weekday:'short',day:'numeric'}))+'</strong><span>'+shown+(items.length>2?' · +'+(items.length-2)+' more':'')+'</span></button>';
      }).join(''):'<p class="watch-detail">No other dated items in the loaded week.</p>';
    }
    const dayItems=$('#grimoire-calendar-day-list');
    dayItems.innerHTML=!owner?'<p class="grimoire-calendar-empty">Sign in to see your schedule.</p>':
      selected===now?'<p class="grimoire-calendar-empty">Today’s schedule and tasks are in the main panel.</p>':
      !count.length?'<p class="grimoire-calendar-empty">Nothing scheduled for this day.</p>':
      count.slice(0,5).map(item=>{
        const type=item.kind==='google'?'Google Calendar':item.kind==='task'?'Todoist':'Legacy ORBIT event';
        const time=item.kind==='google'?(item.event.allDay?'All day':item.time):
          item.kind==='event'?(item.event.allDay?'All day':item.event.start||''):'';
        const extra=time?' · '+time:'';
        return '<div class="grimoire-calendar-item"><span class="grimoire-calendar-item-dot is-'+
          (item.kind==='google'?'google':item.kind==='task'?'task':'event')+'"></span>'+
          (item.kind==='task'?'<input type="checkbox" data-todoist-done="'+esc(item.id)+'" aria-label="Complete '+esc(item.title)+' in Todoist">':'')+
          '<div><strong>'+esc(item.title)+'</strong><small>'+esc(type+extra)+'</small></div></div>';
      }).join('')+(count.length>5?'<button type="button" class="subtle-link" data-view="calendar">'+
      'View all '+count.length+' items</button>':'');
    const connection=$('#grimoire-google-status');
    if(connection){
      const google=window.ORBITGoogleCalendar?.getStatus?.();
      const title=$('#grimoire-google-title'),note=$('#grimoire-google-note');
      const connect=$('#grimoire-google-connect'),manage=$('#grimoire-google-manage');
      const refresh=$('#grimoire-google-refresh');
      const setup=$('#grimoire-google-setup');
      const linked=Boolean(owner&&google?.connected);
      const configured=Boolean(google?.configured);
      connection.dataset.connection=linked?'connected':!owner?'signed-out':configured?'ready':'setup';
      title.textContent=linked?'Google Calendar connected':'Google Calendar';
      note.textContent=!owner?'Sign in to view your Google calendars.':
        google?.busy?(linked?'Refreshing your events…':'Checking Google connection…'):
        linked?(google.error?'Sync issue: '+google.error:
          (google.email?'Connected to '+google.email+' · ':'')+
          (google.selected?.length||0)+' calendar(s) selected · Read only'):
        google?.error?google.error:
        configured?'Connect Google once to show your calendar events here.':
        'One-time Google OAuth setup required for Grimoire sync.';
      if(connect){connect.hidden=!owner||linked||!configured;connect.disabled=Boolean(google?.busy);}
      if(manage)manage.hidden=!linked;
      if(refresh){refresh.hidden=!linked;refresh.disabled=Boolean(google?.busy);}
      if(setup)setup.hidden=!owner||linked||configured;
    }
    const newTask=home.querySelector('[data-home-cal-new-task]');
    if(newTask)newTask.disabled=!owner||!window.ORBITConnectedTodoist?.active?.();
  }
  function render(){
    if(!root)return;
    const owner=window.ORBITLocal?.getOwner();
    const list=allItems(),byDate=new Map();
    for(const item of list){if(!byDate.has(item.date))byDate.set(item.date,[]);byDate.get(item.date).push(item)}
    for(const group of byDate.values())group.sort(order);
    const days=weeks(),month=selected.slice(0,7),now=today(),count=byDate.get(selected)||[];
    if(days.length){
      const first=days[0]<now?days[0]:now, last=days[days.length-1]>now?days[days.length-1]:now;
      const nearby=(parseDay(last)-parseDay(first))/86400000<=45;
      void window.ORBITGoogleCalendar?.ensureRange?.(nearby?first:days[0],addDays(nearby?last:days[days.length-1],1));
    }
    const header=mode==='month'
      ?dateText(month+'-01',{month:'long',year:'numeric'})
      :dateText(days[0],{month:'short',day:'numeric'})+' – '+dateText(days[6],{month:'short',day:'numeric',year:'numeric'});
    $('#calendar-period').textContent=header;
    $('#calendar-selected').textContent=dateText(selected);
    $('#calendar-day-count').textContent=count.length+' item'+(count.length===1?'':'s');
    const todoist=window.ORBITConnectedTodoist?.getCalendarStatus?.();
    const google=window.ORBITGoogleCalendar?.getStatus?.();
    $('#calendar-status').textContent=!owner?'Sign in to see your calendar.':
      (google?.connected?'Google Calendar connected (read only)':'Google Calendar not connected')+
      (todoist?.connected?' · Todoist due dates':' · Connect Todoist in Tasks for due dates')+
      (events().length?' · Legacy ORBIT entries shown read-only':'')+
      (todoist?.error?' · Todoist: '+todoist.error:'')+
      (google?.error?' · Google: '+google.error:'');
    document.querySelectorAll('[data-cal-mode]').forEach(b=>{b.classList.toggle('is-active',b.dataset.calMode===mode);b.setAttribute('aria-pressed',String(b.dataset.calMode===mode))});
    const heading=weekday.map(x=>'<div class="cal-weekday" aria-hidden="true">'+x+'</div>').join('');
    $('#calendar-grid').innerHTML=heading+days.map(key=>{
      const group=byDate.get(key)||[],day=parseDay(key).getDate(),other=mode==='month'&&key.slice(0,7)!==month;
      const classes='cal-cell'+(key===selected?' is-selected':'')+(key===now?' is-today':'')+(other?' is-outside':'');
      const chips=group.slice(0,3).map(dayChip).join('');
      const more=group.length>3?'<span class="cal-more">+'+(group.length-3)+' more</span>':'';
      return '<button type="button" class="'+classes+'" data-cal-day="'+key+'" aria-pressed="'+String(key===selected)+'" aria-label="'+esc(dateText(key)+', '+group.length+' items')+'">'+
        '<span class="cal-date">'+day+'</span><span class="cal-chips">'+chips+more+'</span></button>';
    }).join('');
    $('#calendar-day-list').innerHTML=count.length?count.map(item=>{
      const name=item.kind==='event'?'Legacy ORBIT event':item.kind==='google'?'Google · '+item.event.calendarName:sourceName(item.source)+' / Todoist';
      const icon=item.kind==='google'?'<span class="cal-google-agenda-icon" aria-label="Google Calendar">G</span>':
        '<img class="cal-agenda-icon" src="'+esc(sourceIcon(item.source))+'" alt="'+esc(name)+'" width="23" height="23">';
      if(item.kind==='task')return '<article class="cal-agenda-item"><input type="checkbox" data-todoist-done="'+esc(item.id)+'" aria-label="Complete '+esc(item.title)+' in Todoist">'+icon+
        '<div class="cal-agenda-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(name)+(item.recurring?' · Recurring':'')+'</small></div>'+
        '<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Open '+esc(item.title)+' in Todoist">Open ↗</a></article>';
      if(item.kind==='google'){
        const event=item.event;
        const when=event.allDay?'All day':esc(item.time);
        const link=event.url&&/^https:\/\/(www\.google\.com|calendar\.google\.com)\/calendar\//.test(event.url)
          ?'<a href="'+esc(event.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Open this event in Google Calendar">Open ↗</a>':'';
        return '<article class="cal-agenda-item cal-agenda-google">'+icon+
          '<div class="cal-agenda-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(name)+' · '+when+(event.location?' · '+esc(event.location):'')+'</small></div>'+link+'</article>';
      }
      return '<article class="cal-agenda-item"><span class="cal-event-dot" aria-hidden="true"></span>'+icon+
        '<div class="cal-agenda-copy"><strong>'+esc(item.title)+'</strong><small>'+esc((item.time==='All day'?'All day':item.event.start+'–'+item.event.end)+(item.event.location?' · '+item.event.location:''))+'</small>'+
        (item.event.notes?'<p>'+esc(item.event.notes)+'</p>':'')+'</div></article>';
    }).join(''):'<p class="cal-empty">Nothing scheduled for this day. Select another date or check Google Calendar.</p>';
    renderHomeCalendar({owner,days,byDate,month,now,count,header});
    document.dispatchEvent(new CustomEvent('orbit:calendar-selection',{detail:{selected,days,mode,today:now}}));
    $('#cal-new-task').disabled=!owner||!window.ORBITConnectedTodoist?.active?.();
    $('#cal-new-task').title=$('#cal-new-task').disabled?'Connect Todoist in Tasks to add tasks':'Add task to Todoist';
  }
  function setDay(key){selected=key;render()}
  function changePeriod(delta){
    if(mode==='week')selected=addDays(selected,delta*7);
    else{const d=parseDay(selected.slice(0,7)+'-01');d.setMonth(d.getMonth()+delta);selected=localDay(d)}
    render();
  }
  function toggleTimed(){
    const allDay=dialog.querySelector('[name="allDay"]').checked;
    dialog.querySelectorAll('.cal-time-field').forEach(x=>x.hidden=allDay);
    dialog.querySelectorAll('.cal-time-field input').forEach(x=>x.required=!allDay);
  }
  function openEvent(eventId=''){
    if(!window.ORBITLocal?.getOwner())return;
    const event=events().find(e=>e.id===eventId);
    editId=event?.id||'';
    const form=$('#calendar-event-form');
    form.reset();
    form.elements.title.value=event?.title||'';
    form.elements.date.value=event?.date||selected;
    form.elements.allDay.checked=event?.allDay??true;
    form.elements.start.value=event?.start||'09:00';
    form.elements.end.value=event?.end||'10:00';
    form.elements.location.value=event?.location||'';
    form.elements.notes.value=event?.notes||'';
    $('#cal-event-dialog-title').textContent=event?'Edit event':'New event';
    $('#cal-event-delete').hidden=!event;
    $('#cal-event-error').textContent='';
    toggleTimed();
    dialog.showModal();
    form.elements.title.focus();
  }
  $('#grimoire-home-calendar')?.addEventListener('click',e=>{
    const button=e.target.closest('button');
    if(!button)return;
    if(button.id==='grimoire-google-connect'){
      const google=window.ORBITGoogleCalendar;
      const status=google?.getStatus?.();
      if(status?.configured&&!status.connected&&!status.busy)void google.connect?.();
      return;
    }
    if(button.id==='grimoire-google-refresh'){
      const google=window.ORBITGoogleCalendar;
      const status=google?.getStatus?.();
      if(status?.connected&&!status.busy)void google.refresh?.();
      return;
    }
    if(button.dataset.homeCalDay){setDay(button.dataset.homeCalDay);return}
    if(button.dataset.homeCalMode){
      if(!['week','month'].includes(button.dataset.homeCalMode))return;
      mode=button.dataset.homeCalMode;render();return;
    }
    if(button.hasAttribute('data-home-cal-prev')){changePeriod(-1);return}
    if(button.hasAttribute('data-home-cal-next')){changePeriod(1);return}
    if(button.hasAttribute('data-home-cal-today')){selected=today();render();return}
    if(button.hasAttribute('data-home-cal-new-task')){
      const create=$('#todoist-add');
      if(!create||create.disabled)return;
      create.click();
      const date=$('#todoist-create-dialog [name="due_date"]');
      if(date)date.value=selected;
    }
  });
  $('[data-home-today-new-task]')?.addEventListener('click',()=>{
    const create=$('#todoist-add');if(!create||create.disabled)return;
    create.click();const date=$('#todoist-create-dialog [name="due_date"]');if(date)date.value=today();
  });
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.calDay){setDay(button.dataset.calDay);return}
    if(button.dataset.calMode){mode=button.dataset.calMode;render();return}
    if(button.hasAttribute('data-cal-prev')){changePeriod(-1);return}
    if(button.hasAttribute('data-cal-next')){changePeriod(1);return}
    if(button.hasAttribute('data-cal-today')){selected=today();render();return}
    if(button.hasAttribute('data-cal-new-task')){
      const taskButton=$('#todoist-add');
      if(taskButton?.disabled){$('#calendar-status').textContent='Connect Todoist in Tasks before adding a task.';return}
      taskButton?.click();
      const input=$('#todoist-create-dialog [name="due_date"]');
      if(input)input.value=selected;
    }
  });
  dialog.querySelector('[name="allDay"]').addEventListener('change',toggleTimed);
  $('#cal-event-cancel').addEventListener('click',()=>dialog.close());
  $('#cal-event-close').addEventListener('click',()=>dialog.close());
  $('#cal-event-delete').addEventListener('click',()=>{
    if(!editId||!window.confirm('Delete this event from ORBIT?'))return;
    try{window.ORBITLocal.deleteCalendarEvent(editId);dialog.close()}catch(err){$('#cal-event-error').textContent=err.message}
  });
  $('#calendar-event-form').addEventListener('submit',e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const event={id:editId||undefined,title:form.elements.title.value.trim(),date:form.elements.date.value,
      allDay:form.elements.allDay.checked,start:form.elements.start.value,end:form.elements.end.value,
      location:form.elements.location.value.trim(),notes:form.elements.notes.value.trim()};
    try{
      window.ORBITLocal.upsertCalendarEvent(event);
      selected=event.date;
      dialog.close();
      render();
    }catch(err){$('#cal-event-error').textContent=err.message||'Could not save event.'}
  });
  document.addEventListener('orbit:auth-changed',()=>{selected=today();render()});
  document.addEventListener('orbit:google-calendar-changed',render);
  window.ORBITCalendar=Object.freeze({render,getSelection:()=>({selected,days:weeks(),mode,today:today()})});
  render();
})();