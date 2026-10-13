// ORBIT PULSE service worker. Web Push works when ORBIT is closed.
self.addEventListener("push",event=>{
 let payload={};try{payload=event.data?event.data.json():{}}catch(_){}
 const title=typeof payload.title==="string"?payload.title:"PULSE · Check-in";
 const body=typeof payload.body==="string"?payload.body:"Your PULSE check-in is ready.";
 const tag=typeof payload.tag==="string"?payload.tag:"orbit-pulse";
 event.waitUntil(self.registration.showNotification(title,{
  body,tag,icon:"./orbit-icon.svg",badge:"./orbit-icon.svg",data:{url:"https://reece1919.github.io/orbit/?view=pulse"},
  renotify:false
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url="https://reece1919.github.io/orbit/?view=pulse";
 event.waitUntil((async()=>{
  const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clientsList){
   if(client.url.startsWith("https://reece1919.github.io/orbit/")){
    if(typeof client.navigate==="function")await client.navigate(url);
    return client.focus();
   }
  }
  return self.clients.openWindow(url);
 })());
});