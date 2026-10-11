(() => {
function preceding(text, position) {
 let prefix=text.slice(0,position);
 // A citation may contain optional arguments and several keys.
 const cite=/\\[A-Za-z]*cite[A-Za-z]*\*?(?:\s*\[[^\]]*\])*\s*\{[^}]*$/.exec(prefix);
 if(cite) prefix=prefix.slice(0,cite.index);
 prefix=prefix.replace(/(?<!\\)%[^\n]*/g,'').replace(/\\(?:sub)*section\*?\{[^}]*\}/g,'\n\n');
 prefix=prefix.split(/\n\s*\n/).filter(x=>x.trim()).pop()||'';
 prefix=prefix.replace(/\\[A-Za-z]*cite[A-Za-z]*\*?(?:\s*\[[^\]]*\])*\{[^}]*\}/g,'')
 .replace(/\\(?:textbf|textit|emph|underline)\{([^{}]*)\}/g,'$1').replace(/\s+/g,' ').trim();
 if(!prefix) return '';
 const segments=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(prefix)];
 return (segments.at(-1)?.segment||prefix).trim();
}
 globalThis.evidencePreceding=preceding;
})();

// Literal, case-insensitive keyword matching with citation-key boundaries.
globalThis.evidenceFindAll=function(text,keyword){
 if(typeof keyword!=='string'||!keyword.trim()||keyword.length>150)throw Error('Choose a keyword first.');
 const escaped=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp(escaped,'giu'),matches=[];
 const keyChar=char=>!!char&&/[\p{L}\p{N}_:.+\/-]/u.test(char);
 let line=1,lineStart=0;
 for(const match of text.matchAll(re)){
  const from=match.index,to=from+match[0].length;
  if(keyChar(text[from-1])||keyChar(text[to]))continue;
  while(true){const newline=text.indexOf('\n',lineStart);if(newline<0||newline>=from)break;line++;lineStart=newline+1;}
  const lineEnd=text.indexOf('\n',to);
  const start=Math.max(lineStart,from-180),end=Math.min(lineEnd<0?text.length:lineEnd,to+180);
  matches.push({line,from,to,sentence:globalThis.evidencePreceding(text,from),before:text.slice(start,from),match:match[0],after:text.slice(to,end)});
 }
 return matches;
};
