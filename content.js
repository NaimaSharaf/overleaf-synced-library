(() => {
 const pending=new Map();
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  const d=event.data,done=pending.get(d?.requestId);if(!done)return;
  if(d.type==='OVERLEAF_EVIDENCE_SELECTION'){pending.delete(d.requestId);done({ok:true,keyword:d.keyword,sentence:d.sentence,incomplete:d.incomplete});}
  else if(d.type==='OVERLEAF_EVIDENCE_FIND_RESULT'){pending.delete(d.requestId);done({ok:d.ok,matches:d.matches,error:d.error});}
  else if(d.type==='OVERLEAF_EVIDENCE_RESULT'){pending.delete(d.requestId);done({ok:false,error:d.error});}
 });
 chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(!['captureSelection','findInstances'].includes(m.type))return;
  const requestId=crypto.randomUUID();pending.set(requestId,reply);
  window.postMessage({type:m.type==='captureSelection'?'OVERLEAF_EVIDENCE_CAPTURE_REQUEST':'OVERLEAF_EVIDENCE_FIND_REQUEST',requestId,keyword:m.keyword},location.origin);
  setTimeout(()=>{if(pending.has(requestId)){pending.delete(requestId);reply({ok:false,error:'Reload Overleaf after updating the extension, then try again.'});}},4000);return true;
 });
})();
