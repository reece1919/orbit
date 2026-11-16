// ORBIT push service worker: only opens approved ORBIT check-in views.
const ROOT="https://reece1919.github.io/orbit/";
function target(raw){
  try{
    const url=new URL(raw||ROOT+"?view=pulse");
    return url.origin==="https://reece1919.github.io"&&url.pathname==="/orbit/"&&
      ["pulse","review","habits"].includes(url.searchParams.get("view"))?
      url.origin+url.pathname+"?view="+url.searchParams.get("view"):ROOT+"?view=pulse";
  }catch{return ROOT+"?view=pulse";}
}
self.addEventListener("push",event=>{
 let payload={};try{payload=event.data?event.data.json():{}}catch(_){}
 const title=typeof payload.title==="string"?payload.title:"ORBIT · Check-in";
 const body=typeof payload.body==="string"?payload.body:"Your check-in is ready.";
 const tag=typeof payload.tag==="string"?payload.tag:"orbit-check-in";
 event.waitUntil(self.registration.showNotification(title,{
  body,tag,icon:"./orbit-icon.svg",badge:"./orbit-icon.svg",
  data:{url:target(payload.url)},renotify:false
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=target(event.notification.data?.url);
 event.waitUntil((async()=>{
  const clientsList=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clientsList){
   if(client.url.startsWith(ROOT)){
    if(typeof client.navigate==="function")await client.navigate(url);
    return client.focus();
   }
  }
  return self.clients.openWindow(url);
 })());
});