(() => {
 const selector='.cm-editor,.CodeMirror,.ace_editor';
 let lastRoot=null;
 const element=node=>node?.nodeType===3?node.parentElement:node;
 function read(root,allowEmpty=false){
  const content=root.querySelector('.cm-content');
  for(const node of [content,root,...root.querySelectorAll('.cm-line')]){
   const internal=node?.cmView||node?.cmTile;
   const view=internal?.view||internal?.rootView?.view||internal?.root?.view;
   if(view?.state?.doc){const r=view.state.selection.main;if(allowEmpty||r.from!==r.to)return {text:view.state.doc.toString(),from:r.from,to:r.to,complete:true};}
  }
  if(root.CodeMirror){const cm=root.CodeMirror;return {text:cm.getValue(),from:cm.indexFromPos(cm.getCursor('from')),to:cm.indexFromPos(cm.getCursor('to')),complete:true};}
  if(root.env?.editor){const ed=root.env.editor,r=ed.getSelectionRange();return {text:ed.getValue(),from:ed.session.doc.positionToIndex(r.start),to:ed.session.doc.positionToIndex(r.end),complete:true};}
  const sel=window.getSelection();
  if(sel?.rangeCount&&!sel.isCollapsed&&content?.contains(sel.anchorNode)&&content.contains(sel.focusNode)){
   const range=sel.getRangeAt(0),before=document.createRange();before.selectNodeContents(content);before.setEnd(range.startContainer,range.startOffset);
   const prefix=before.toString(),selected=sel.toString();return {text:prefix+selected,from:prefix.length,to:prefix.length+selected.length,complete:false};
  }
  return null;
 }
 function capture(requestId){
  if(!requestId)return;
  const forced=true;
  const respond=error=>{if(forced)window.postMessage({type:'OVERLEAF_EVIDENCE_RESULT',requestId,error},location.origin);};
  try{
   const selection=window.getSelection();
   const roots=[element(selection?.anchorNode)?.closest?.(selector),document.activeElement?.closest?.(selector),...document.querySelectorAll(selector)].filter(Boolean);
   let found;
   for(const root of new Set(roots)){const candidate=read(root);if(candidate&&candidate.from!==candidate.to){found=candidate;lastRoot=root;break;}}
   if(!found){respond('Select a citation key in Overleaf’s Code Editor first.');return;}
   const {text,from,to,complete}=found;
   let keyword=text.slice(from,to).trim();
   // Accept either a bare key, {key}, or a complete single-key cite command.
   keyword=keyword.replace(/^\\[A-Za-z]*cite[A-Za-z]*\*?(?:\s*\[[^\]]*\])*\s*\{([^{}]+)\}$/,'$1').replace(/^\{([^{}]+)\}$/,'$1').trim();
   if(!keyword||keyword.length>150||/[\s,{}\\]/.test(keyword)){respond('Highlight one citation key, without selecting multiple comma-separated keys.');return;}
   window.postMessage({type:'OVERLEAF_EVIDENCE_SELECTION',requestId,keyword,sentence:complete?globalThis.evidencePreceding(text,from):'',incomplete:!complete},location.origin);
  }catch(error){respond('Could not read the editor selection: '+error.message);}
 }

 function findAll(keyword,requestId){
  try{
   const active=document.activeElement?.closest?.(selector);
   const selection=element(window.getSelection()?.anchorNode)?.closest?.(selector);
   const roots=[...document.querySelectorAll(selector)];
   const root=active||selection||(roots.includes(lastRoot)?lastRoot:null)||(roots.length===1?roots[0]:null);
   if(!root)throw Error('Click in the Overleaf Code Editor, then try Find all instances again.');
   const source=read(root,true);
   if(!source?.complete)throw Error('Cannot read the complete source file. Reload Overleaf and use the Code Editor, then try again.');
   const matches=Array.isArray(keyword)?keyword.map(key=>{const found=globalThis.evidenceFindAll(source.text,key);return {keyword:key,sentence:found[0]?.sentence||'',count:found.length};}):globalThis.evidenceFindAll(source.text,keyword);
   window.postMessage({type:'OVERLEAF_EVIDENCE_FIND_RESULT',requestId,ok:true,matches},location.origin);
  }catch(error){window.postMessage({type:'OVERLEAF_EVIDENCE_FIND_RESULT',requestId,ok:false,error:error.message},location.origin);}
 }
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='OVERLEAF_EVIDENCE_CAPTURE_REQUEST')capture(event.data.requestId);if(event.source===window&&event.origin===location.origin&&event.data?.type==='OVERLEAF_EVIDENCE_FIND_REQUEST')findAll(event.data.keyword,event.data.requestId);});
})();
