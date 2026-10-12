/* ORBIT v0.4 — shared GAIA Supabase authentication. Public publishable key only. */
(() => {
  'use strict';
  const URL='https://zdurujqwhxqrwbhwzzxg.supabase.co';
  const KEY='sb_publishable_Xa0DTx_PbvtynbiQN6_xNQ_l1D55vzK';
  const $=selector=>document.querySelector(selector);
  let client=null,user=null,resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  let initialized=false,busy=false;
  const api={ready,get client(){return client;},get user(){return user;},retry:()=>initialize()};
  window.ORBITAuth=api;
  function message(value){const el=$('#auth-message');el.textContent=value||'';el.hidden=!value;}
  function setUser(next){
    const oldId=user?.id||'',newId=next?.id||'';
    user=next||null;
    if(oldId!==newId) document.dispatchEvent(new CustomEvent('orbit:auth-changed',{detail:{user}}));
    document.body.dataset.authState=user?'signed-in':'signed-out';
    $('#auth-loading').hidden=true;
    $('#orbit-login').hidden=!!user;
    const email=user?.email||'Account';
    $('#orbit-account-label').textContent=email;
    $('#orbit-settings-email').textContent=user?.email||'Not signed in';
  }
  async function loadSdk(){
    if(window.supabase?.createClient)return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0';
      script.async=true;script.onload=()=>window.supabase?.createClient?resolve():reject(new Error('Supabase unavailable'));
      script.onerror=()=>reject(new Error('Supabase script blocked'));document.head.appendChild(script);
    });
  }
  async function initialize(){
    if(initialized)return;initialized=true;message('');$('#auth-retry').hidden=true;
    document.body.dataset.authState='checking';$('#auth-loading').hidden=false;$('#orbit-login').hidden=true;
    try{
      await loadSdk();
      client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='INITIAL_SESSION')return;
        if(event==='SIGNED_OUT')setUser(null);
        else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED')setUser(session?.user||null);
      });
      const {data,error}=await client.auth.getUser();
      if(error && !/session missing|auth session missing/i.test(error.message||''))throw error;
      setUser(data?.user||null);
    }catch(err){
      document.body.dataset.authState='error';
      $('#auth-loading').hidden=true;$('#orbit-login').hidden=true;$('#auth-retry').hidden=false;
      message('Could not connect to your GAIA sign-in. Check your internet connection and try again.');
      client=null;initialized=false;
    }finally{resolveReady(api);}
  }
  async function signIn(event){
    event.preventDefault();if(!client||busy)return;
    const f=event.currentTarget;const email=String(f.elements.email.value||'').trim();
    const password=f.elements.password.value;
    if(!email||!password)return;
    busy=true;message('');$('#orbit-signin').disabled=true;$('#orbit-signin').textContent='Signing in…';
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Sign-in did not return a user.');
      f.elements.password.value='';setUser(data.user);
    }catch(err){message('Sign-in failed. Check your GAIA email and password, then try again.');f.elements.password.value='';}
    finally{busy=false;$('#orbit-signin').disabled=false;$('#orbit-signin').textContent='Sign in to ORBIT';}
  }
  async function signOut(){
    if(!client||busy)return;
    if(!window.confirm('Sign out of ORBIT and GAIA on this browser? Your local ORBIT data will remain on this device.'))return;
    busy=true;
    try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;setUser(null);}
    catch(err){alert('Could not sign out. Please try again.');}
    finally{busy=false;}
  }
  $('#orbit-login').addEventListener('submit',signIn);
  $('#orbit-signout').addEventListener('click',signOut);
  $('#orbit-account-button').addEventListener('click',signOut);
  $('#auth-retry').addEventListener('click',initialize);
  void initialize();
})();