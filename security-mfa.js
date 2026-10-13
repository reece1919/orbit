/* Shared ORBIT + GAIA MFA v1. MFA enforcement at database/API layer is NOT active until backup-factor review. */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const name = location.pathname.startsWith("/gaia") ? "GAIA" : "ORBIT";
  let client = null, userId = "", verified = [], activeId = "", busy = false, enrollment = null, activeDialog = false;
  const el = document.createElement("section");
  el.id = "shared-mfa";
  el.className = "mfa-shell";
  el.hidden = true;
  el.innerHTML = [
    '<div class="mfa-window" role="dialog" aria-modal="true" aria-labelledby="mfa-heading">',
    '<div class="mfa-headingline"><span class="mfa-symbol" aria-hidden="true">✦</span><div><p class="mfa-eyebrow">ACCOUNT SECURITY</p><h2 id="mfa-heading">Authenticator verification</h2></div></div>',
    '<p id="mfa-explain">Protect your private workspace with an authenticator app.</p>',
    '<div id="mfa-factors"></div>',
    '<div id="mfa-enroll" hidden><p>Scan this QR code with your authenticator app, or enter the setup key manually.</p><img id="mfa-qr" width="174" height="174" alt="Scan this QR code with your authenticator app"><label>Setup key <input id="mfa-secret" type="text" readonly autocomplete="off"></label></div>',
    '<form id="mfa-code-form" hidden><label id="mfa-factor-choice" hidden>Use authenticator <select id="mfa-factor-select"></select></label><label>6-digit authenticator code <input id="mfa-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" id="mfa-verify">Verify code</button></form>',
    '<p class="mfa-status" id="mfa-result" role="status" aria-live="polite"></p>',
    '<p class="mfa-recovery">Recovery codes are not provided by Supabase. Before requiring MFA, add a second authenticator on a separate device and confirm both work.</p>',
    '<div class="mfa-actions"><button type="button" id="mfa-add">Add authenticator</button><button type="button" id="mfa-cancel" hidden>Cancel setup</button><button type="button" id="mfa-done">Close</button></div>',
    "</div>"
  ].join("");
  document.body.appendChild(el);
  const message = text => {$("#mfa-result").textContent = text || "";};
  const validated = c => /^[0-9]{6}$/.test(c);
  function changeBusy(v) {
    busy = v;
    for(const button of el.querySelectorAll("button")) button.disabled = v;
  }
  function resetEnrollment() {
    enrollment = null;
    $("#mfa-enroll").hidden = true;
    $("#mfa-qr").removeAttribute("src");
    $("#mfa-secret").value = "";
    $("#mfa-code").value = "";
    $("#mfa-code-form").hidden = true;
    $("#mfa-factor-choice").hidden = true;
    $("#mfa-cancel").hidden = true;
  }
  function show() {
    el.hidden = false;
    document.body.classList.add("mfa-dialog-visible");
    activeDialog = true;
    if(!$("#mfa-code-form").hidden) $("#mfa-code").focus();
    else $("#mfa-add").focus();
  }
  function hide() {
    if(enrollment) return;
    el.hidden = true;
    document.body.classList.remove("mfa-dialog-visible");
    activeDialog = false;
  }
  async function refresh() {
    if(!client || !userId) return;
    const id = userId;
    try{
      const [factors,assurance] = await Promise.all([
        client.auth.mfa.listFactors(),
        client.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);
      if(id !== userId) return;
      if(factors.error) throw factors.error;
      if(assurance.error) throw assurance.error;
      verified = (factors.data?.totp || []).filter(f => f.status === "verified");
      const current = assurance.data?.currentLevel || "aal1";
      const next = assurance.data?.nextLevel || current;
      const pending = verified.length > 0 && next === "aal2" && current !== "aal2";
      if(pending) {
        $("#mfa-heading").textContent = "Verify your sign-in";
        $("#mfa-explain").textContent = "Your account has an authenticator. Enter its current code to finish signing in to " + name + ".";
        resetEnrollment();
        fillFactors();
        $("#mfa-code-form").hidden = false;
        $("#mfa-add").hidden = true;
        $("#mfa-done").hidden = false; // Setup stage: do not lock out a lost-factor account
        show();
      } else if(!activeDialog) hide();
      const status = $("#mfa-settings-status");
      if(status) status.textContent = verified.length ? verified.length + " verified authenticator" + (verified.length === 1 ? "" : "s") + " · " + (verified.length < 2 ? "Add a separate backup before mandatory enforcement" : "Backup factors available") + " · " + (current==="aal2" ? "Verified session" : "Verification available") : "No authenticator added · MFA enrollment is optional during setup.";
      if(!pending && activeDialog && !enrollment) {
        $("#mfa-add").hidden = false;
        $("#mfa-done").hidden = false;
        $("#mfa-code-form").hidden = true;
        $("#mfa-heading").textContent = "Account security";
        $("#mfa-explain").textContent = "Add a backup authenticator on a second device before enforcement is enabled.";
        fillFactors();
      }
    }catch(error){message("Security status unavailable: " + (error?.message || "Retry later"));}
  }
  function fillFactors(){
    const place=$("#mfa-factors");
    const chooser=$("#mfa-factor-select");
    place.replaceChildren();
    chooser.replaceChildren();
    const previous=activeId;
    for(const f of verified){
      const row=document.createElement("p");
      row.className="mfa-factor";
      row.textContent="Verified: " + (f.friendly_name || "Authenticator") + " · " + f.id.slice(0,8);
      place.appendChild(row);
      const option=document.createElement("option");
      option.value=f.id;
      option.textContent=f.friendly_name || "Authenticator";
      chooser.appendChild(option);
    }
    if(!verified.length) place.textContent="No verified authenticator yet.";
    activeId=verified.some(f=>f.id===previous) ? previous : (verified[0]?.id || "");
    chooser.value=activeId;
    $("#mfa-factor-choice").hidden=verified.length<2 || Boolean(enrollment);
  }

  async function beginEnrollment(){
    if(!client || !userId || busy)return;
    changeBusy(true);message("");
    try{
      const {data,error}=await client.auth.mfa.enroll({factorType:"totp",friendlyName: name+" authenticator "+(verified.length+1)});
      if(error)throw error;
      enrollment={id:data.id};
      const qr=data.totp?.qr_code;
      const uri=typeof qr==="string" && qr.startsWith("data:image/svg+xml") ? qr : "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(qr||"");
      $("#mfa-qr").src=uri;
      $("#mfa-secret").value=data.totp?.secret || "";
      $("#mfa-enroll").hidden=false;
      $("#mfa-code-form").hidden=false;
      $("#mfa-factor-choice").hidden=true;
      $("#mfa-cancel").hidden=false;
      $("#mfa-add").hidden=true;
      $("#mfa-done").hidden=true;
      $("#mfa-explain").textContent="Scan the QR code and enter a new six-digit code to finish enrollment. This setup key is not saved by "+name+".";
      $("#mfa-heading").textContent="Add authenticator";
      $("#mfa-code").focus();
    }catch(e){message("Could not begin setup: "+(e?.message||"Check that TOTP is enabled in Supabase Auth."));}
    finally{changeBusy(false)}
  }
  async function verify(e){
    e.preventDefault();
    if(!client||busy)return;
    const code=$("#mfa-code").value.trim();
    if(!validated(code)){message("Enter exactly six digits.");return}
    const factorId=enrollment?.id || $("#mfa-factor-select").value || activeId;
    if(!factorId){message("No factor is available. Refresh and try again.");return}
    changeBusy(true);message("");
    try{
      const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});
      if(error)throw error;
      resetEnrollment();
      message("Authenticator verified. Your current session is protected.");
      await refresh();
      if(!enrollment && !($("#mfa-add").hidden))setTimeout(()=>{if(!enrollment)hide()},850);
    }catch(err){message("Could not verify code: "+(err?.message||"Please try the next code."));}
    finally{changeBusy(false)}
  }
  function openSettings(){
    if(!client||!userId){message("Sign in first.");return}
    resetEnrollment();
    $("#mfa-add").hidden=false;
    $("#mfa-done").hidden=false;
    $("#mfa-heading").textContent="Account security";
    $("#mfa-explain").textContent="Enroll your authenticator app, then add a backup on a different device. No mandatory requirement is active yet.";
    fillFactors();show();void refresh();
  }
  function accountChanged(nextClient,nextUser){
    const next=nextUser?.id || "";
    if(!nextClient||!next) {client=nextClient||null;userId="";verified=[];activeId="";resetEnrollment();hide();return;}
    client=nextClient;
    if(userId!==next){userId=next;verified=[];activeDialog=false;resetEnrollment();}
    void refresh();
  }
  $("#mfa-code-form").addEventListener("submit",e=>void verify(e));
  $("#mfa-factor-select").addEventListener("change",e=>{activeId=e.target.value;$("#mfa-code").value="";message("");});
  $("#mfa-add").addEventListener("click",()=>void beginEnrollment());
  $("#mfa-cancel").addEventListener("click",async()=>{
    const id=enrollment?.id;
    resetEnrollment();
    if(id && client) await client.auth.mfa.unenroll({factorId:id}).catch(()=>{});
    message("Setup canceled.");
    void refresh();
  });
  $("#mfa-done").addEventListener("click",hide);
  document.addEventListener("click", e=>{
    if(e.target.closest("#mfa-open") || e.target.closest("#gaia-mfa-open"))openSettings();
  });
  document.addEventListener("orbit:auth-changed", e=>accountChanged(window.ORBITAuth?.client,e.detail?.user));
  document.addEventListener("gaia:auth",e=>accountChanged(e.detail?.client,e.detail?.user));
  if(window.ORBITAuth?.ready)void window.ORBITAuth.ready.then(()=>accountChanged(window.ORBITAuth.client,window.ORBITAuth.user));
  else if(window.GAIA_CLOUD)accountChanged(window.GAIA_CLOUD.client,window.GAIA_CLOUD.user);
})();