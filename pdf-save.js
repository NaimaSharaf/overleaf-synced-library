let pdfFolder=null,pdfBusy=false;
function pdfLocation(){document.getElementById('pdf-location').textContent=pdfFolder?'PDF folder: '+pdfFolder.name:'Choose a PDF folder once. Future PDFs will save there.';}
const pdfReady=(async()=>{await ready;if(!db)return;await new Promise(resolve=>{const read=db.transaction('settings').objectStore('settings').get('pdfFolder');read.onsuccess=()=>{pdfFolder=read.result||null;pdfLocation();resolve();};read.onerror=resolve;});})();
async function storePDFFolder(folder){
 await ready;if(!db)throw Error('Cannot remember the PDF folder. Reopen the extension and try again.');
 await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(folder,'pdfFolder');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Could not remember folder.'));});
 pdfFolder=folder;pdfLocation();
}
$('pdf-folder').onclick=async()=>{
 if(pdfBusy)return;
 try{const folder=await showDirectoryPicker({mode:'readwrite',id:'pdf-downloads',...(pdfFolder?{startIn:pdfFolder}:{})});await storePDFFolder(folder);tell('PDF folder remembered. Open a PDF and click Save current PDF.');}
 catch(error){if(error.name!=='AbortError')tell(error.message);}
};
function pdfSource(tab){
 let url;try{url=new URL(tab?.url);}catch{throw Error('Open a PDF in the active browser tab first.');}
 if(url.protocol==='chrome-extension:'){
  try{url=new URL(url.searchParams.get('file')||url.searchParams.get('src'));}catch{throw Error('Open the original PDF web address before saving.');}
 }
 if(!['https:','http:','file:'].includes(url.protocol))throw Error('Open an online PDF at its web address. Local files and temporary PDF previews must be saved with the browser’s download button.');
 url.hash='';return url;
}
function pdfFilename(title,year){
 const cleanTitle=String(title||'').trim().replace(/\.pdf$/i,'');
 if(!cleanTitle)throw Error('Select an entry with a title before saving the PDF.');
 const name=[cleanTitle,String(year||'').trim()].filter(Boolean).join(' ')
  .replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/^\.+/,'').trim();
 return (name||'Document')+'.pdf';
}
async function unusedPDFName(folder,name){
 const stem=name.slice(0,-4);
 for(let i=0;i<10000;i++){
  const candidate=i?stem+' ('+i+').pdf':name;
  try{await folder.getFileHandle(candidate);}catch(error){if(error.name==='NotFoundError')return candidate;throw error;}
 }
 throw Error('Too many files with this name. Choose another PDF folder.');
}
$('save-pdf').onclick=async()=>{
 if(pdfBusy)return;pdfBusy=true;
 try{
  await pdfReady;
  if(!pdfFolder)throw Error('Click Choose PDF folder first. You only need to choose it once.');
  const folder=pdfFolder;
  commit();const entry=currentRow();
  const filename=pdfFilename(entry?.keyword,entry?.year);
  if(await folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Allow access to your PDF folder to save files.');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true}),url=pdfSource(tab);
  let blob;
  if(url.protocol==='file:'){
   let sourceName;try{sourceName=decodeURIComponent(url.pathname.split('/').pop());}catch{sourceName='the open PDF';}
   tell('Select '+sourceName+' to save a renamed copy.');
   const [source]=await showOpenFilePicker({id:'local-pdf-source',startIn:'downloads',multiple:false,types:[{description:'PDF documents',accept:{'application/pdf':['.pdf']}}]});
   blob=await source.getFile();
   if(blob.name!==sourceName&&!confirm('The selected file has a different name from the open PDF. Save '+blob.name+' instead?'))return;
  }else{
   const origin=url.origin+'/*';
   if(!await chrome.permissions.contains({origins:[origin]})&&!await chrome.permissions.request({origins:[origin]}))throw Error('Allow access to this website to save its PDF.');
   tell('Downloading PDF…');
   const response=await fetch(url.href,{credentials:'include',signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw Error('The website did not provide the PDF ('+response.status+').');
   blob=await response.blob();
  }
  if(!new TextDecoder().decode(await blob.slice(0,1024).arrayBuffer()).includes('%PDF-'))throw Error('This tab did not return a PDF. Open the PDF itself, then try again. Some websites require their own download button.');
  const name=await unusedPDFName(folder,filename);
  await Library.write(folder,name,blob);
  tell('Saved '+name+' to '+folder.name+'.');
 }catch(error){tell(error.name==='AbortError'||error.name==='TimeoutError'?'PDF download timed out or was cancelled. Try again.':error.message);}
 finally{pdfBusy=false;}
};
pdfLocation();

// Open a page listing the PDFs in the chosen PDF folder
document.getElementById('open-pdf-folder').onclick=async()=>{await pdfReady;if(!pdfFolder){tell('Choose a PDF folder first.');return;}chrome.tabs.create({url:chrome.runtime.getURL('pdf-folder.html')});};
