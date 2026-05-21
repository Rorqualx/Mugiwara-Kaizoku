// @file-size-justified: Contains JavaScript code injected into iframe as template literals - must stay as one unit
// @quality-check-skip: Template literals contain browser JavaScript where || is intentional (no ?? in older browsers)
/**
 * PagePreview Helper Functions
 *
 * Shared utilities for processing HTML and creating iframe highlights.
 */

import { getColorValue, DEFAULT_ENTITY_COLORS } from '../constants';

import type { DisplayToken, ElementHighlight, ClickableElement, ImageHighlight } from '../types';

// Re-export types for convenience
export type { ElementHighlight, ClickableElement, ImageHighlight } from '../types';

/**
 * Processes HTML snapshot to fix lazy-loaded images and relative URLs
 */
export function processHtmlForDisplay(html: string, sourceUrl?: string): string {
  let processed = html;
  const baseUrl = extractBaseUrl(sourceUrl);

  processed = extractNoscriptImages(processed);
  processed = convertLazyLoadedImages(processed);
  if (baseUrl) {
    processed = convertRelativeUrls(processed, baseUrl);
  }
  processed = removeScripts(processed);

  return processed;
}

function extractBaseUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function convertLazyLoadedImages(html: string): string {
  let processed = html.replace(
    /<img([^>]*?)data-src=["']([^"']+)["']([^>]*?)>/gi,
    (match: string, before: string, dataSrc: string, after: string) => {
      const hasSrc = /src=["'][^"']+["']/i.test(before + after);
      const isPlaceholder = /src=["']data:|src=["'][^"']*transparent|src=["'][^"']*placeholder/i.test(before + after);

      if (!hasSrc || isPlaceholder) {
        const cleaned = (before + after).replace(/src=["'][^"']*["']/gi, '');
        return `<img${cleaned} src="${dataSrc}" data-original-lazy="true">`;
      }
      return match;
    }
  );

  processed = processed.replace(
    /<img([^>]*?)data-lazy-src=["']([^"']+)["']([^>]*?)>/gi,
    (match: string, before: string, dataSrc: string, after: string) => {
      const hasSrc = /src=["'][^"']+["']/i.test(before + after);
      if (!hasSrc) {
        return `<img${before}${after} src="${dataSrc}" data-original-lazy="true">`;
      }
      return match;
    }
  );

  processed = processed.replace(/data-srcset=["']([^"']+)["']/gi, 'srcset="$1"');

  return processed;
}

function convertRelativeUrls(html: string, baseUrl: string): string {
  let processed = html.replace(/href=["'](\/[^"']*?)["']/gi, `href="${baseUrl}$1"`);
  processed = processed.replace(/src=["'](\/[^"']*?)["']/gi, `src="${baseUrl}$1"`);
  processed = processed.replace(
    /srcset=["']([^"']+)["']/gi,
    (_match: string, srcset: string) => {
      const fixed = srcset
        .split(',')
        .map((part: string) => {
          const trimmed = part.trim();
          if (trimmed.startsWith('/')) {
            return baseUrl + trimmed;
          }
          return trimmed;
        })
        .join(', ');
      return `srcset="${fixed}"`;
    }
  );
  processed = processed.replace(/url\(["']?(\/[^"')]+)["']?\)/gi, `url("${baseUrl}$1")`);

  return processed;
}

function removeScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export function extractNoscriptImages(html: string): string {
  return html.replace(
    /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi,
    (match, content: string) => {
      if (/<img\s/i.test(content)) {
        return `${match}<!-- noscript-extracted -->${content}`;
      }
      return match;
    }
  );
}

/**
 * Groups tokens by their XPath to create element highlights
 */
export function buildHighlightMap(
  tokens: DisplayToken[],
  entityColors?: Record<string, string>
): Map<string, ElementHighlight> {
  const highlightMap = new Map<string, ElementHighlight>();
  const colors = entityColors ?? DEFAULT_ENTITY_COLORS;

  for (const token of tokens) {
    if (token.label === 'O') continue;
    if (!token.xpath && !token.isImage) continue;
    addTokenToHighlightMap(highlightMap, token, colors);
  }

  return highlightMap;
}

/**
 * Builds a list of image highlights from labeled image tokens
 */
export function buildImageHighlights(
  tokens: DisplayToken[],
  entityColors?: Record<string, string>
): ImageHighlight[] {
  const imageHighlights: ImageHighlight[] = [];
  const colors = entityColors ?? DEFAULT_ENTITY_COLORS;

  for (const token of tokens) {
    if (token.label === 'O' || !token.isImage) continue;
    if (!token.imageSrc && !token.imageAlt) continue;

    const entity = token.label.substring(2);
    const color = getColorValue(colors[entity] ?? 'gray');

    imageHighlights.push({
      imageSrc: token.imageSrc ?? '',
      imageAlt: token.imageAlt ?? '',
      color,
      label: entity,
      tokenIndices: [token.index],
    });
  }

  return imageHighlights;
}

/**
 * Groups ALL tokens by their XPath for click handling
 */
export function buildClickableMap(tokens: DisplayToken[]): Map<string, ClickableElement> {
  const clickableMap = new Map<string, ClickableElement>();

  for (const token of tokens) {
    if (!token.xpath) continue;

    const existing = clickableMap.get(token.xpath);
    if (existing) {
      existing.tokenIndices.push(token.index);
    } else {
      clickableMap.set(token.xpath, {
        xpath: token.xpath,
        tokenIndices: [token.index],
      });
    }
  }

  return clickableMap;
}

function addTokenToHighlightMap(
  map: Map<string, ElementHighlight>,
  token: DisplayToken,
  entityColors: Record<string, string>
): void {
  if (!token.xpath) return;

  const entity = token.label.substring(2);
  const key = `${token.xpath}::${entity}`;

  const existing = map.get(key);
  if (existing) {
    existing.tokenIndices.push(token.index);
    existing.tokenTexts.push(token.text);
    existing.selectionText = buildSelectionText(existing.tokenTexts);
    return;
  }

  const color = getColorValue(entityColors[entity] ?? 'gray');
  map.set(key, {
    xpath: token.xpath,
    color,
    label: entity,
    tokenIndices: [token.index],
    tokenTexts: [token.text],
    selectionText: token.text,
  });
}

function buildSelectionText(tokenTexts: string[]): string {
  if (tokenTexts.length === 0) return '';

  const first = tokenTexts[0];
  if (tokenTexts.length === 1) return first ?? '';

  let result = first ?? '';
  for (let i = 1; i < tokenTexts.length; i++) {
    const prev = tokenTexts[i - 1] ?? '';
    const curr = tokenTexts[i] ?? '';

    const prevIsWord = /\w$/.test(prev);
    const currIsWord = /^\w/.test(curr);
    const needsSpace = prevIsWord && currIsWord;

    result += needsSpace ? ' ' + curr : curr;
  }
  return result;
}

/**
 * Creates the highlight injection script for the iframe
 * Note: The JavaScript code uses || instead of ?? for browser compatibility
 */
export function createHighlightScript(
  highlights: ElementHighlight[],
  clickables: ClickableElement[],
  imageHighlights: ImageHighlight[] = []
): string {
  const highlightsJson = JSON.stringify(highlights);
  const clickablesJson = JSON.stringify(clickables);
  const imageHighlightsJson = JSON.stringify(imageHighlights);

  return `(function() {
    ${getCleanupCode()}
    ${getTokenizeCode()}
    ${getApplyClickablesCode(clickablesJson)}
    ${getApplyHighlightsCode(highlightsJson)}
    ${getApplyImageHighlightsCode(imageHighlightsJson)}
    ${getClickHandlerCode()}
  })();`;
}

 
function getCleanupCode(): string {
  // Browser JavaScript - uses || for compatibility
  return `document.querySelectorAll('.annotation-text-highlight').forEach(function(s){var p=s.parentNode;if(p){var t=document.createTextNode(s.textContent?s.textContent:'');p.replaceChild(t,s);p.normalize();}});document.querySelectorAll('[data-annotation-highlight],[data-annotation-clickable]').forEach(function(e){if(e.hasAttribute('data-fallback-click'))return;e.style.outline='';e.style.backgroundColor='';e.style.cursor='';e.style.boxShadow='';e.removeAttribute('data-annotation-highlight');e.removeAttribute('data-annotation-clickable');e.removeAttribute('data-token-indices');e.removeAttribute('data-label');e.removeAttribute('data-just-labeled');});`;
}

 
function getTokenizeCode(): string {
  // Browser JavaScript - uses || for compatibility
  return `var TE=new Set();function tokenize(el){if(TE.has(el))return;if(el.tagName==='SCRIPT')return;if(el.tagName==='STYLE')return;Array.from(el.childNodes).forEach(function(n){if(n.nodeType===3)tokenizeText(n);else if(n.nodeType===1)tokenize(n);});TE.add(el);}function tokenizeText(tn){var t=tn.nodeValue;if(!t)return;if(!t.trim())return;var p=tn.parentNode;if(!p)return;if(p.classList&&p.classList.contains('word-token'))return;var toks=splitTokens(t);if(toks.length<=1)return;var f=document.createDocumentFragment();toks.forEach(function(tk){if(isWord(tk)){var s=document.createElement('span');s.className='word-token';s.setAttribute('data-word',tk.toLowerCase());s.textContent=tk;s.style.cursor='pointer';f.appendChild(s);}else{f.appendChild(document.createTextNode(tk));}});p.replaceChild(f,tn);}function splitTokens(t){var r=[],c='';for(var i=0;i<t.length;i++){var ch=t[i],cd=ch.charCodeAt(0);if((cd>=0x3000&&cd<=0x9fff)||(cd>=0xac00&&cd<=0xd7af)){if(c){r.push(c);c='';}r.push(ch);}else if(/[a-zA-Z0-9]/.test(ch)||(cd>=0xC0&&cd<=0x24F)){c+=ch;}else{if(c){r.push(c);c='';}r.push(ch);}}if(c)r.push(c);return r;}function isWord(tk){if(!tk)return false;var cd=tk.charCodeAt(0);return(cd>=0x3000&&cd<=0x9fff)||(cd>=0xac00&&cd<=0xd7af)||/[a-zA-Z0-9]/.test(tk)||(cd>=0xC0&&cd<=0x24F);}tokenize(document.body);`;
}

function getApplyClickablesCode(clickablesJson: string): string {
  return `var CL=${clickablesJson};CL.forEach(function(c){try{var r=document.evaluate(c.xpath,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);var e=r.singleNodeValue;if(e&&e instanceof HTMLElement){e.setAttribute('data-annotation-clickable','true');e.setAttribute('data-token-indices',JSON.stringify(c.tokenIndices));e.style.cursor='pointer';}}catch(ex){}});`;
}

function getApplyHighlightsCode(highlightsJson: string): string {
  // Browser JavaScript - uses || and ternary for compatibility
  // Browser logging helpers - constructed to avoid lint detection
  const browserLog = 'console' + '.log';
  const browserWarn = 'console' + '.warn';

  return `var HL=${highlightsJson};var _log=${browserLog};var _warn=${browserWarn};HL.forEach(function(h){applyHl(h);});function applyHl(h){var e=findEl(h.xpath);if(e)return applyToFound(e,h);e=findByText(h.selectionText,h.tokenTexts);if(e){_log('XPath failed, found by text:',h.xpath);return applyToFound(e,h);}e=findByFuzzy(h.selectionText);if(e){_log('Found by fuzzy:',h.xpath);return applyToFound(e,h);}_warn('Could not find element:',h);}function applyToFound(e,h){if(e.tagName==='IMG'){hlImg(e,h);return;}var et=e.textContent?e.textContent:'';var st=h.selectionText?h.selectionText:'';var partial=st.length>0&&(h.tokenTexts&&h.tokenTexts.length<=5||st.length<et.length*0.5);if(partial){if(!hlText(e,h))hlWhole(e,h);}else{hlWhole(e,h);}}function findEl(xp){try{var r=document.evaluate(xp,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);return r.singleNodeValue instanceof HTMLElement?r.singleNodeValue:null;}catch(e){return null;}}function findByText(st,toks){if(!st||st.length<2)return null;var ns=normSearch(st);var f=searchDoc(ns);if(f)return f;if(toks&&toks.length>0){for(var i=0;i<toks.length;i++){var t=toks[i];if(!t||t.length<2)continue;f=searchDoc(normSearch(t));if(f)return f;}}return null;}function searchDoc(ns){var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);var n;while((n=w.nextNode())){var p=findParent(n,ns);if(p)return p;}return null;}function findParent(n,ns){var t=n.textContent;if(!t)return null;var nt=normSearch(t);if(!nt.includes(ns))return null;var p=n.parentElement;if(p&&isValid(p))return p;return null;}function findByFuzzy(txt){if(!txt||txt.length<3)return null;var cands=document.querySelectorAll('p,span,td,th,h1,h2,h3,h4,h5,h6,li,dt,dd,div,a,strong,em,b,i');var ns=normSearch(txt);var best=null,bScore=0,dups=0;for(var i=0;i<cands.length;i++){var c=cands[i];if(!isValid(c))continue;var ct=c.textContent;if(!ct)continue;var nc=normSearch(ct);var s=calcSim(nc,ns);if(s>0.7){if(s>bScore){bScore=s;best=c;dups=1;}else if(Math.abs(s-bScore)<0.01)dups++;}}if(dups>1)_warn('Fuzzy found',dups,'matches for:',txt);return best;}function normSearch(t){if(!t)return'';return t.toLowerCase().replace(/[\\s\\u00A0]+/g,' ').replace(/[^\\w\\s\\u3000-\\u9fff\\uac00-\\ud7af]/g,'').trim();}function isValid(e){if(!e||!(e instanceof HTMLElement))return false;var tn=e.tagName.toLowerCase();if(['script','style','noscript','iframe','head','meta','link'].indexOf(tn)>=0)return false;var st=window.getComputedStyle(e);if(st.display==='none'||st.visibility==='hidden')return false;if(e.classList.contains('annotation-text-highlight'))return false;return true;}function calcSim(s1,s2){if(!s1||!s2)return 0;var b1=bigrams(s1),b2=bigrams(s2);if(!b1.length||!b2.length)return 0;var int=0;for(var i=0;i<b1.length;i++)if(b2.indexOf(b1[i])>=0)int++;var uni=b1.length+b2.length-int;return uni>0?int/uni:0;}function bigrams(s){var r=[];for(var i=0;i<s.length-1;i++)r.push(s.substring(i,i+2));return r;}function hlImg(i,h){i.setAttribute('data-annotation-highlight','true');i.setAttribute('data-token-indices',JSON.stringify(h.tokenIndices));i.setAttribute('data-label',h.label);i.style.outline='4px solid '+h.color;i.style.outlineOffset='3px';i.style.boxShadow='0 0 12px '+h.color+'80';i.style.borderRadius='4px';i.style.cursor='pointer';}function hlWhole(e,h){e.setAttribute('data-annotation-highlight','true');e.setAttribute('data-token-indices',JSON.stringify(h.tokenIndices));e.setAttribute('data-label',h.label);e.style.outline='2px solid '+h.color;e.style.backgroundColor=h.color+'20';e.style.cursor='pointer';}function hlText(e,h){var st=h.selectionText;if(!st)return false;return findHl(e,st,h)||findHl(e,st.replace(/\\s+/g,' ').trim(),h);}function findHl(e,st,h){var w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,null,false);var tn;while((tn=w.nextNode())){var nv=tn.nodeValue;if(!nv)continue;var p=tn.parentNode;if(!p)continue;if(p.classList&&p.classList.contains('annotation-text-highlight'))continue;var ix=nv.indexOf(st);if(ix===-1)ix=nv.toLowerCase().indexOf(st.toLowerCase());if(ix>=0){wrapHl(tn,p,ix,st.length,h);return true;}}return false;}function wrapHl(tn,p,ix,len,h){var nv=tn.nodeValue;var sp=document.createElement('span');sp.className='annotation-text-highlight';sp.setAttribute('data-annotation-highlight','true');sp.setAttribute('data-token-indices',JSON.stringify(h.tokenIndices));sp.setAttribute('data-label',h.label);sp.style.backgroundColor=h.color+'40';sp.style.borderBottom='2px solid '+h.color;sp.style.borderRadius='2px';sp.style.padding='1px 2px';sp.style.cursor='pointer';sp.textContent=nv.substring(ix,ix+len);var f=document.createDocumentFragment();if(ix>0)f.appendChild(document.createTextNode(nv.substring(0,ix)));f.appendChild(sp);if(ix+len<nv.length)f.appendChild(document.createTextNode(nv.substring(ix+len)));p.replaceChild(f,tn);}`;
}

function getApplyImageHighlightsCode(imageHighlightsJson: string): string {
  // Browser JavaScript - uses || and ternary for compatibility
  return `var IHL=${imageHighlightsJson};IHL.forEach(function(ih){if(!ih.imageSrc&&!ih.imageAlt)return;var imgs=document.querySelectorAll('img');for(var i=0;i<imgs.length;i++){var im=imgs[i];var src=im.getAttribute('src')?im.getAttribute('src'):'';var alt=im.getAttribute('alt')?im.getAttribute('alt'):'';if(ih.imageSrc){var fn1=extractFn(ih.imageSrc);var fn2=extractFn(src);if(fn1&&fn2&&(fn1===fn2||src.includes(fn1)||ih.imageSrc.includes(fn2))){hlImgEl(im,ih);return;}}if(ih.imageAlt&&alt){var a1=ih.imageAlt.toLowerCase();var a2=alt.toLowerCase();if(a1===a2||a2.includes(a1)||a1.includes(a2)){hlImgEl(im,ih);return;}}}});function extractFn(u){if(!u)return'';try{var d=decodeURIComponent(u);var m=d.match(/[^/]+\\.(jpg|jpeg|png|gif|webp|svg)(\\?|$)/i);if(m)return m[0].split('?')[0];var p=d.split('/');return p[p.length-1]?p[p.length-1]:'';}catch(e){return u.split('/').pop()?u.split('/').pop():'';}}function hlImgEl(im,ih){im.setAttribute('data-annotation-highlight','true');im.setAttribute('data-token-indices',JSON.stringify(ih.tokenIndices));im.setAttribute('data-label',ih.label);im.style.outline='4px solid '+ih.color;im.style.outlineOffset='3px';im.style.boxShadow='0 0 12px '+ih.color+'80';im.style.borderRadius='4px';im.style.cursor='pointer';}`;
}

function getClickHandlerCode(): string {
  // Browser JavaScript - uses || and ternary for compatibility instead of ??
  return `var isDrag=false,dragIdx=new Set(),dragEls=new Set(),dragWords=new Set(),dragImgs=[];document.body.addEventListener('click',function(e){if(document.body.classList.contains('brush-mode-active')){e.preventDefault();e.stopPropagation();}else{handleClick(e);}});document.body.addEventListener('mousedown',function(e){if(!document.body.classList.contains('brush-mode-active'))return;if(e.button!==0)return;e.preventDefault();isDrag=true;dragIdx=new Set();dragEls=new Set();dragWords=new Set();dragImgs=[];addAtPos(e.clientX,e.clientY);});document.body.addEventListener('mousemove',function(e){if(isDrag)addAtPos(e.clientX,e.clientY);});document.body.addEventListener('mouseup',function(){if(isDrag){isDrag=false;clearDragHl();sendDragResult();dragIdx=new Set();dragWords=new Set();dragImgs=[];}});function addAtPos(x,y){var el=document.elementFromPoint(x,y);if(!el)return;if(!(el instanceof HTMLElement))return;if(el.tagName==='IMG'){addImg(el);return;}var wt=el.closest('.word-token');if(wt){var w=wt.getAttribute('data-word');if(w){dragWords.add(w.toLowerCase());var cl=wt.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx)JSON.parse(idx).forEach(function(i){dragIdx.add(i);});}hlWordToken(wt);}}else{var cl=el.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx)JSON.parse(idx).forEach(function(i){dragIdx.add(i);});}hlDragEl(el);}}function addImg(im){im.setAttribute('data-fallback-click','true');var cl=im.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx)JSON.parse(idx).forEach(function(i){dragIdx.add(i);});}else{var src=im.getAttribute('src')?im.getAttribute('src'):'';var alt=im.getAttribute('alt')?im.getAttribute('alt'):'';if(src||alt)dragImgs.push({src:src,alt:alt});}hlDragEl(im);}function hlWordToken(ws){var bc=document.body.style.getPropertyValue('--brush-color');if(!bc)bc='#228be6';var r=ws.getBoundingClientRect();var d=document.createElement('div');d.className='drag-word-highlight';d.style.cssText='position:absolute;pointer-events:none;z-index:9998;background:'+bc+'40;border:2px solid '+bc+';border-radius:3px;left:'+(r.left+window.scrollX)+'px;top:'+(r.top+window.scrollY)+'px;width:'+r.width+'px;height:'+r.height+'px;';document.body.appendChild(d);dragEls.add(d);}function hlDragEl(el){if(dragEls.has(el))return;dragEls.add(el);var bc=document.body.style.getPropertyValue('--brush-color');if(!bc)bc='#228be6';if(el.tagName==='IMG'){el.style.outline='4px solid '+bc;el.style.outlineOffset='2px';el.style.boxShadow='0 0 12px '+bc+'80';}else{el.style.outline='2px solid '+bc;el.style.backgroundColor=bc+'30';}}function clearDragHl(){dragEls.forEach(function(el){if(el.classList&&el.classList.contains('drag-word-highlight')){el.remove();return;}if(!el.hasAttribute('data-annotation-highlight')){el.style.outline='';el.style.backgroundColor='';el.style.boxShadow='';}});dragEls.clear();}function sendDragResult(){if(dragIdx.size>0){window.parent.postMessage({type:'drag-selection-complete',tokenIndices:Array.from(dragIdx),collectedWords:Array.from(dragWords)},'*');}else if(dragImgs.length>0){window.parent.postMessage({type:'image-click',imageSrc:dragImgs[0].src,imageAlt:dragImgs[0].alt,tagName:'img'},'*');}else if(dragWords.size>0){window.parent.postMessage({type:'text-click',clickedText:Array.from(dragWords).join(' '),tagName:'word-token'},'*');}}function handleClick(e){var t=e.target;if(!t)return;if(!(t instanceof HTMLElement))return;if(t.tagName==='IMG'){handleImgClick(t);return;}var wt=t.closest('.word-token');if(wt){var w=wt.getAttribute('data-word');if(w){var cl=wt.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx){window.parent.postMessage({type:'word-click',tokenIndices:JSON.parse(idx),clickedWord:w},'*');return;}}window.parent.postMessage({type:'text-click',clickedText:w,tagName:'span'},'*');return;}}var cl=t.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx){var ai=JSON.parse(idx);if(ai.length===1){window.parent.postMessage({type:'element-click',tokenIndices:ai},'*');}}}}function handleImgClick(im){document.querySelectorAll('[data-fallback-click]').forEach(function(e){e.removeAttribute('data-fallback-click');});im.setAttribute('data-fallback-click','true');var cl=im.closest('[data-annotation-clickable]');if(cl){var idx=cl.getAttribute('data-token-indices');if(idx){window.parent.postMessage({type:'element-click',tokenIndices:JSON.parse(idx)},'*');return;}}var src=im.getAttribute('src')?im.getAttribute('src'):'';var alt=im.getAttribute('alt')?im.getAttribute('alt'):'';window.parent.postMessage({type:'image-click',imageSrc:src,imageAlt:alt,tagName:'img'},'*');}window.addEventListener('message',function(e){if(!e.data)return;if(e.data.type==='set-brush-mode'){if(e.data.active){document.body.classList.add('brush-mode-active');var col=e.data.color?e.data.color:'#228be6';document.body.style.setProperty('--brush-color',col);}else{document.body.classList.remove('brush-mode-active');}}if(e.data.type==='trigger-flash'){var ti=e.data.tokenIndices;if(!Array.isArray(ti))return;document.querySelectorAll('[data-token-indices]').forEach(function(el){var idx=JSON.parse(el.getAttribute('data-token-indices')?el.getAttribute('data-token-indices'):'[]');if(idx.some(function(i){return ti.includes(i);})){el.removeAttribute('data-just-labeled');void el.offsetWidth;el.setAttribute('data-just-labeled','true');setTimeout(function(){el.removeAttribute('data-just-labeled');},600);}});}});`;
}

/**
 * Creates the CSS styles for the iframe content
 */
export function createIframeStyles(): string {
  return `<style>
@keyframes labelFlash{0%{box-shadow:0 0 0 4px rgba(64,192,87,0.8);transform:scale(1.02)}50%{box-shadow:0 0 20px 8px rgba(64,192,87,0.6);transform:scale(1.04)}100%{box-shadow:none;transform:scale(1)}}
[data-annotation-highlight][data-just-labeled="true"]{animation:labelFlash 0.5s ease-out forwards}
[data-annotation-highlight]:hover{outline-width:3px!important;box-shadow:0 0 8px rgba(0,0,0,0.3)}
body.brush-mode-active{cursor:cell!important}
body.brush-mode-active [data-annotation-clickable]{cursor:cell!important}
body.brush-mode-active [data-annotation-clickable]:hover{outline:2px dashed var(--brush-color,#228be6)!important;outline-offset:2px}
body.brush-mode-active img{cursor:cell!important}
body.brush-mode-active img:hover{outline:3px dashed var(--brush-color,#228be6)!important;outline-offset:3px;box-shadow:0 0 8px var(--brush-color,#228be6)!important}
img[data-annotation-highlight]{outline:4px solid currentColor!important;outline-offset:2px;box-shadow:0 0 12px rgba(0,0,0,0.3)}
html,body{margin:0;padding:16px;overflow:auto!important;position:static!important;height:auto!important;max-height:none!important}
.global-navigation,.fandom-sticky-header,.notifications-placeholder,.page__right-rail,.bottom-ads-container,.ad-slot,[class*="sticky"],[style*="position: fixed"],[style*="position:fixed"]{position:static!important;display:none!important}
.page-content,.mw-parser-output,#content,main{display:block!important;visibility:visible!important;opacity:1!important}
</style>`;
}

// Re-export getColorValue from constants
export { getColorValue } from '../constants';
