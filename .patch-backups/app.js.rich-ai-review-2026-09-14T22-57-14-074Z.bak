import { SOURCE_GROUPS, completion as colourCompletion, generatedOverrides, normalizeHex, tones } from './colour-engine.js';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let latest = null;
let currentFlavour = null;
let currentStep = Number(localStorage.getItem('buffercore.studio.flavourStep') || 1);
let aiState = { available: false, models: [], model: null, checked: false };
let aiProposal = null;
let aiHistory = [];
let currentColourStage = Math.max(1,Math.min(9,Number(localStorage.getItem('buffercore.studio.colourStage')||1)));
let semanticState = { light:null, dark:null };
let semanticGroupFocus = { light: localStorage.getItem('buffercore.studio.semanticGroup.light') || 'Canvas', dark: localStorage.getItem('buffercore.studio.semanticGroup.dark') || 'Canvas' };
let semanticBusy = false;
let semanticBuildStatus = { light:null, dark:null };
let colourSemanticPreview = null;
let currentTypographyStage = Math.max(1,Math.min(7,Number(localStorage.getItem('buffercore.studio.typographyStage')||1)));
let typographyState = null;
let typographyBusy = false;

const steps = [
  ['Identity','Name, intent and starting point'],
  ['Colour','Identity, ground, neutral and status'],
  ['Typography','Families, scale and rhythm'],
  ['Shape','Radius, borders and stroke'],
  ['Spacing & Scale','Spacing, sizing and containers'],
  ['Depth','Shadows and effects'],
  ['Motion','Duration and easing'],
  ['Review','Validate the complete Flavour']
];
const stepFoundations = {2:['colour'],3:['typography'],4:['radius','borders','stroke'],5:['spacing','sizing','containers'],6:['shadows','effects'],7:['motion']};

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function short(c){return c?c.slice(0,10):'—'}
function slug(v){return String(v||'').trim().toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function titleCase(v){return String(v||'').replace(/^--bc-/,'').split(/[-_/]+/).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')}
async function api(url,opts={}){const r=await fetch(url,{headers:{'content-type':'application/json'},...opts});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||'Request failed');return d}

let studioDialogResolve = null;
function ensureStudioFeedback(){
  if(!document.querySelector('#studioDialog')){
    document.body.insertAdjacentHTML('beforeend',`
      <div class="studio-dialog-backdrop" id="studioDialog" aria-hidden="true">
        <section class="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studioDialogTitle">
          <button class="studio-dialog-close" type="button" data-studio-dialog-close aria-label="Close">×</button>
          <div class="studio-dialog-icon" data-studio-dialog-icon>!</div>
          <div class="studio-dialog-copy">
            <span class="studio-dialog-eyebrow" data-studio-dialog-eyebrow>BufferCore Studio</span>
            <h2 id="studioDialogTitle" data-studio-dialog-title>Notice</h2>
            <p data-studio-dialog-message></p>
            <div class="studio-dialog-detail hidden" data-studio-dialog-detail></div>
            <label class="studio-dialog-field hidden" data-studio-dialog-field>
              <span data-studio-dialog-field-label>Value</span>
              <input type="text" data-studio-dialog-input>
            </label>
          </div>
          <footer class="studio-dialog-actions">
            <button class="secondary hidden" type="button" data-studio-dialog-cancel>Cancel</button>
            <button class="primary" type="button" data-studio-dialog-confirm>OK</button>
          </footer>
        </section>
      </div>
      <div class="studio-toast-region" id="studioToasts" aria-live="polite" aria-atomic="false"></div>
    `);
    const host=document.querySelector('#studioDialog');
    const settle=(value)=>{if(!studioDialogResolve)return;const resolve=studioDialogResolve;studioDialogResolve=null;host.classList.remove('open');host.setAttribute('aria-hidden','true');resolve(value)};
    host.querySelector('[data-studio-dialog-close]').onclick=()=>settle(null);
    host.querySelector('[data-studio-dialog-cancel]').onclick=()=>settle(null);
    host.querySelector('[data-studio-dialog-confirm]').onclick=()=>{const field=host.querySelector('[data-studio-dialog-field]');settle(field.classList.contains('hidden')?true:host.querySelector('[data-studio-dialog-input]').value)};
    host.addEventListener('click',e=>{if(e.target===host)settle(null)});
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&host.classList.contains('open'))settle(null)});
  }
}
function studioToast(message,{tone='success',title=''}={}){
  ensureStudioFeedback();
  const region=document.querySelector('#studioToasts');
  const item=document.createElement('div');
  item.className=`studio-toast ${tone}`;
  item.innerHTML=`<span class="studio-toast-mark">${tone==='success'?'✓':tone==='warning'?'!':'i'}</span><div>${title?`<b>${escapeHtml(title)}</b>`:''}<p>${escapeHtml(message)}</p></div><button type="button" aria-label="Dismiss">×</button>`;
  item.querySelector('button').onclick=()=>item.remove();
  region.appendChild(item);
  requestAnimationFrame(()=>item.classList.add('show'));
  setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),180)},4200);
}
function studioDialog({title='Notice',message='',detail='',tone='warning',eyebrow='BufferCore Studio',confirmLabel='OK',cancelLabel='',inputLabel='',inputValue=''}={}){
  ensureStudioFeedback();
  const host=document.querySelector('#studioDialog');
  const dialog=host.querySelector('.studio-dialog');
  dialog.dataset.tone=tone;
  host.querySelector('[data-studio-dialog-eyebrow]').textContent=eyebrow;
  host.querySelector('[data-studio-dialog-title]').textContent=title;
  host.querySelector('[data-studio-dialog-message]').textContent=message;
  const detailEl=host.querySelector('[data-studio-dialog-detail]');
  detailEl.classList.toggle('hidden',!detail);
  detailEl.textContent=detail||'';
  const field=host.querySelector('[data-studio-dialog-field]');
  const input=host.querySelector('[data-studio-dialog-input]');
  field.classList.toggle('hidden',!inputLabel);
  host.querySelector('[data-studio-dialog-field-label]').textContent=inputLabel||'Value';
  input.value=inputValue||'';
  const cancel=host.querySelector('[data-studio-dialog-cancel]');
  cancel.classList.toggle('hidden',!cancelLabel);
  cancel.textContent=cancelLabel||'Cancel';
  const confirm=host.querySelector('[data-studio-dialog-confirm]');
  confirm.textContent=confirmLabel||'OK';
  host.classList.add('open');
  host.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>{(inputLabel?input:confirm).focus();if(inputLabel)input.select()});
  return new Promise(resolve=>{studioDialogResolve=resolve});
}
function errorDialog(error,{title='Could not complete that',detail=''}={}){
  return studioDialog({title,message:error?.message||String(error||'Something went wrong.'),detail,tone:'danger',confirmLabel:'OK'});
}
function confirmDialog(message,{title='Are you sure?',confirmLabel='Continue',cancelLabel='Cancel',tone='warning',detail=''}={}){
  return studioDialog({title,message,detail,tone,confirmLabel,cancelLabel});
}
function promptDialog(message,{title='Enter a value',label='Value',value='',confirmLabel='Continue',cancelLabel='Cancel'}={}){
  return studioDialog({title,message,tone:'info',confirmLabel,cancelLabel,inputLabel:label,inputValue:value});
}


function setView(name){$$('.view').forEach(v=>v.classList.remove('active'));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===name));$(`#view-${name}`).classList.add('active');localStorage.setItem('buffercore.studio.view',name)}
$$('.nav-item').forEach(button=>button.onclick=()=>setView(button.dataset.view));

function foundationCount(flavour, ids){return ids.reduce((sum,id)=>sum+(flavour?.foundationCounts?.[id]||0),0)}
function tokensForFoundation(id){return latest?.catalogue?.foundations?.find(f=>f.id===id)?.tokens||[]}
function currentValue(token){return currentFlavour?.overrides?.[token.cssVariable] ?? token.value ?? 'initial'}
function isOverridden(token){return Object.prototype.hasOwnProperty.call(currentFlavour?.overrides||{},token.cssVariable)}
function initialValue(token){return token?.value ?? 'initial'}
function tokenByVariable(cssVariable){for(const foundation of latest?.catalogue?.foundations||[]){const token=(foundation.tokens||[]).find(t=>t.cssVariable===cssVariable);if(token)return token}return null}
function tokenStateBadge(token){const overridden=isOverridden(token);return `<span class="token-mode ${overridden?'override':'initial'}">${overridden?'Override':'Initial'}</span>`}

function renderLibrary(){const root=$('#flavourLibrary');const items=latest?.flavours||[];if(!items.length){root.innerHTML=`<div class="empty"><h2>No Flavours yet</h2><p>Create the first reusable look-and-feel baseline for BufferCore.</p><button class="primary" data-new>New Flavour</button></div>`;root.querySelector('[data-new]').onclick=startNew;return}root.innerHTML=items.map(f=>`<article class="flavour-card" data-id="${escapeHtml(f.id)}"><div><h3>${escapeHtml(f.displayName)}</h3><div class="slug">${escapeHtml(f.id)}</div></div><p>${escapeHtml(f.description||'No description yet.')}</p><div class="foundation-chips">${Object.entries(f.foundationCounts||{}).slice(0,5).map(([k,v])=>`<span class="chip">${escapeHtml(k)} · ${v}</span>`).join('')}</div><div class="flavour-meta"><span>${f.overrideCount} primitive override${f.overrideCount===1?'':'s'}</span><span>Open →</span></div></article>`).join('');root.querySelectorAll('[data-id]').forEach(card=>card.onclick=()=>openFlavour(card.dataset.id))}

function renderCore(){const c=latest?.catalogue;$('#coreCatalogue').innerHTML=(c?.foundations||[]).map(f=>`<article class="catalogue-card"><h3>${escapeHtml(f.id)}</h3><div class="count">${f.primitiveCount}</div><p>Primitive tokens available to Flavours</p><div class="foundation-chips">${Object.entries(f.valueTypes||{}).map(([k,v])=>`<span class="chip">${escapeHtml(k)} ${v}</span>`).join('')}</div></article>`).join('')||'<div class="empty">Build the Engine manifest first.</div>'}

function renderSync(data){const labels={core:'BufferCore',flavours:'Flavours',engine:'Engine',figma:'Figma',studio:'Studio'};$('#statusPill').textContent=data.busy?'Working…':'Ready';$('#repos').innerHTML=Object.entries(data.repositories).map(([id,r])=>`<div class="repo"><div class="repo-name">${labels[id]}</div><div class="meta">${r.available?`${escapeHtml(r.branch||'detached')} · ${short(r.commit)}`:'Not a Git repo'}</div><div class="${r.dirty?'dirty':'clean'}">${r.dirty?`${r.status.length} change${r.status.length===1?'':'s'}`:'Clean'}</div></div>`).join('');const current=$('#flavour').value;$('#flavour').innerHTML='<option value="">Core baseline</option>'+data.flavours.map(f=>`<option value="${escapeHtml(f.id)}">${escapeHtml(f.displayName)}</option>`).join('');if([...$('#flavour').options].some(o=>o.value===current))$('#flavour').value=current;const f=data.manifests.figma;$('#resolved').innerHTML=f?`<b>${escapeHtml(f.flavour?.displayName||f.flavour?.id||'Core baseline')}</b><div class="meta">Generated ${escapeHtml(f.generatedAt||'—')}</div>`:'No generated Figma manifest yet.';$('#metrics').innerHTML=f?`<div class="metric"><b>${f.collections}</b><span>Collections</span></div><div class="metric"><b>${f.variables}</b><span>Variables</span></div><div class="metric"><b>${f.styles}</b><span>Styles</span></div>`:'';$('#changeList').innerHTML=Object.entries(data.repositories).flatMap(([id,r])=>(r.status||[]).map(s=>`<div class="meta">${labels[id]} · ${escapeHtml(s)}</div>`)).join('')||'<div class="meta">No uncommitted changes.</div>';const clean=Object.values(data.repositories).every(r=>!r.dirty);$('#repoHealth').textContent=clean?'Repositories clean':'Repository changes present'}

function renderAll(data){latest=data;renderLibrary();renderCore();renderSync(data)}
async function refresh(){try{renderAll(await api('/api/status'))}catch(e){$('#log').textContent=e.message}}

function startNew(){currentFlavour={id:'',displayName:'',description:'',notes:'',overrides:{},semanticMappings:{},isNew:true};currentStep=1;semanticState={light:null,dark:null};aiHistory=[];aiProposal=null;localStorage.removeItem('buffercore.studio.flavourId');renderBuilder();setView('builder')}
async function openFlavour(id){const d=await api(`/api/flavours/${encodeURIComponent(id)}`);currentFlavour={...d.flavour,isNew:false};semanticState={light:null,dark:null};aiHistory=[];aiProposal=null;localStorage.setItem('buffercore.studio.flavourId',id);renderBuilder();setView('builder');Promise.allSettled([loadSemanticMode('light'),loadSemanticMode('dark'),loadTypographySemantics()])}

function stepOverrideCount(n){const ids=stepFoundations[n]||[];return ids.reduce((sum,id)=>sum+tokensForFoundation(id).filter(isOverridden).length,0)}
function stepMeta(n){if(n===1)return currentFlavour?.isNew?'Not created':'Identity saved';if(n===8){const total=Object.keys(currentFlavour?.overrides||{}).length;return total?`${total} overrides`:'Initial'}const count=stepOverrideCount(n);return count?`${count} override${count===1?'':'s'}`:'Initial'}
function renderSteps(){$('#steps').innerHTML=steps.map((s,i)=>{const n=i+1;const count=stepOverrideCount(n);const complete=n===1?!currentFlavour?.isNew:(n===8?false:count>0);const mark=n===1&&!currentFlavour?.isNew?'✓':count>0?'●':'';return`<button class="step ${currentStep===n?'active':''} ${count?'has-overrides':''} ${complete?'is-complete':''}" data-step="${n}"><span class="step-num">${String(n).padStart(2,'0')}</span><span><strong>${s[0]}</strong><small>${stepMeta(n)}</small></span><span class="step-mark">${mark}</span></button>`}).join('');$('#steps').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{currentStep=Number(b.dataset.step);localStorage.setItem('buffercore.studio.flavourStep',String(currentStep));aiProposal=null;renderBuilder()})}

function moveStep(delta){const next=Math.max(1,Math.min(8,currentStep+delta));if(next===currentStep)return;currentStep=next;localStorage.setItem('buffercore.studio.flavourStep',String(currentStep));aiProposal=null;renderBuilder()}
function renderJourney(){const root=$('#stepContent');if(!root)return;const last=currentStep===8;const first=currentStep===1;const nextLabel=currentFlavour?.isNew&&currentStep===1?'Save & continue':last?'Save Flavour':'Save & continue';root.insertAdjacentHTML('beforeend',`<footer class="step-journey"><div class="journey-side">${first?'':`<button class="secondary journey-prev" id="journeyPrev">← Previous</button>`}<span class="journey-meta">Step ${currentStep} of 8</span></div><button class="primary journey-next" id="journeyNext">${nextLabel}${last?'':' →'}</button></footer>`);$('#journeyPrev')?.addEventListener('click',()=>moveStep(-1));$('#journeyNext')?.addEventListener('click',async()=>{const beforeNew=currentFlavour?.isNew;await saveCurrent();if($('#saveState').textContent==='Saved'&&!last)moveStep(1);else if(beforeNew&&!currentFlavour?.isNew&&!last)moveStep(1)})}

function decisionCards(ids){const library=latest?.flavours?.find(f=>f.id===currentFlavour?.id);const catalogue=latest?.catalogue?.foundations||[];return ids.map(id=>{const f=catalogue.find(x=>x.id===id);const count=library?.foundationCounts?.[id]||0;return`<article class="decision-card"><h3>${escapeHtml(id)}</h3><p>${count?`${count} Primitive value${count===1?'':'s'} overridden by this Flavour.`:'Using the Initial BufferCore value set.'}</p><footer><span>${f?.primitiveCount||0} available primitives</span><span>${count?'Override':'Initial'}</span></footer></article>`}).join('')}

function validHex(value){return Boolean(normalizeHex(value))}
function compactTokenLabel(token){const parts=Array.isArray(token.path)?token.path:[];if(parts.length)return parts.map(titleCase).join(' / ');return titleCase(token.cssVariable)}
function colourTokenMap(){return new Map(tokensForFoundation('colour').map(token=>[token.cssVariable,token]))}
function colourSourceValue(token){return normalizeHex(currentFlavour?.overrides?.[token]||'')}
function colourAllTokenNames(){return tokensForFoundation('colour').map(token=>token.cssVariable)}
function sourceLabel(token){return titleCase(token.replace('--bc-color-','').replace('identity-ramp-','ramp-').replace('status-','').replace('interaction-',''))}
function familyValues(baseToken){const base=colourSourceValue(baseToken);if(!base)return[];if(baseToken==='--bc-color-neutral-50')return Object.entries(generatedOverrides(baseToken,base,colourAllTokenNames())).sort((a,b)=>Number(a[0].match(/-(\d+)$/)?.[1]||0)-Number(b[0].match(/-(\d+)$/)?.[1]||0)).map(([token,value])=>({token,value,label:token.match(/-(\d+)$/)?.[1]||'50'}));if(baseToken.includes('identity-ramp')||baseToken.includes('status-'))return tones(base).map(t=>({token:t.kind==='base'?baseToken:`${baseToken}-${t.suffix}`,value:t.value,label:t.label}));return[{token:baseToken,value:base,label:sourceLabel(baseToken)}]}
function paletteStripFromValues(values,labels=false){if(!values.length)return`<div class="source-empty">Choose a source colour</div>`;return`<div class="generated-strip">${values.map(v=>`<div class="generated-tone" title="${escapeHtml(v.label)} · ${escapeHtml(v.value)}"><i style="background:${escapeHtml(v.value)}"></i>${labels?`<small>${escapeHtml(v.label)}</small>`:''}</div>`).join('')}</div>`}
function sourceCard(token,{family=true,description='' }={}){const value=colourSourceValue(token);return`<article class="colour-source-card ${value?'ready':''}" data-source-token="${escapeHtml(token)}"><div class="source-card-head"><div><span>${escapeHtml(sourceLabel(token))}</span>${description?`<small>${escapeHtml(description)}</small>`:''}</div><span class="source-state">${value?'Set':'Required'}</span></div><div class="source-input"><label class="source-swatch" style="${value?`background:${escapeHtml(value)}`:''}"><input type="color" value="${value||'#808080'}"></label><input class="source-hex" value="${escapeHtml(value)}" placeholder="#000000"><button class="ghost source-reset" type="button">Inherit</button></div>${family?paletteStripFromValues(familyValues(token),true):''}</article>`}
function colourStageMeta(){return[
  {id:1,key:'identity',title:'Identity',copy:'Choose the three expressive source colours. Studio deterministically generates each Tint/Base/Shade family.'},
  {id:2,key:'ground',title:'Ground',copy:'Set the three Canvas-only structural source colours. Ground is not a Surface ramp.'},
  {id:3,key:'neutral',title:'Neutral',copy:'Choose the character of Neutral 50. Studio generates the absolute 0–100 scale around it.'},
  {id:4,key:'status',title:'Status',copy:'Choose Success, Warning, Error and Info bases; each receives its own generated tonal family.'},
  {id:5,key:'interaction',title:'Interaction',copy:'Set direct-purpose link, visited and focus colours for normal and inverse contexts.'},
  {id:6,key:'primitive-review',title:'Meaning',copy:'Review the complete source palette, then see exactly how those Primitive families are allowed to become Semantic design material before Light and Dark diverge.'},
  {id:7,key:'semantic-light',title:'Light Semantics',copy:'BufferCore constrains the legal Primitive sources; AI chooses the best legal source for each Light Semantic role.'},
  {id:8,key:'semantic-dark',title:'Dark Semantics',copy:'Generate the Dark mappings independently within the same hard BufferCore rules.'},
  {id:9,key:'final-review',title:'Colour Review',copy:'Review Primitive material and both Semantic modes together before leaving Colour.'}
][currentColourStage-1]}
function setColourStage(stage){currentColourStage=Math.max(1,Math.min(9,Number(stage)));localStorage.setItem('buffercore.studio.colourStage',String(currentColourStage));aiProposal=null;colourSemanticPreview=null;renderBuilder();if(currentColourStage===7)queueMicrotask(()=>loadSemanticMode('light'));if(currentColourStage===8)queueMicrotask(()=>loadSemanticMode('dark'))}
function stageSourceTokens(key){return SOURCE_GROUPS[key]||[]}
function stageCompletion(key){const tokens=stageSourceTokens(key);const complete=tokens.filter(colourSourceValue).length;return{complete,total:tokens.length}}
function semanticMeta(mode){const state=semanticState[mode];return state?.completion||{mapped:0,mappable:0,complete:false}}
function colourMiniNav(){
  const total=colourCompletion(currentFlavour?.overrides||{}),l=semanticMeta('light'),d=semanticMeta('dark');
  const top=[
    {id:1,title:'Palette',meta:`${total.complete}/${total.total} sources`,done:total.complete===total.total,active:currentColourStage<=5},
    {id:6,title:'Meaning',meta:'Review source intent',done:total.complete===total.total,active:currentColourStage===6},
    {id:7,title:'Light',meta:`${l.mapped||0}/${l.mappable||0}`,done:!!l.complete,active:currentColourStage===7},
    {id:8,title:'Dark',meta:`${d.mapped||0}/${d.mappable||0}`,done:!!d.complete,active:currentColourStage===8},
    {id:9,title:'Review',meta:l.complete&&d.complete?'Complete':'Inspect system',done:!!(l.complete&&d.complete),active:currentColourStage===9}
  ];
  const palette=[['identity','Identity'],['ground','Ground'],['neutral','Neutral'],['status','Status'],['interaction','Interaction']];
  return`<nav class="colour-flow-nav" aria-label="Colour builder progress"><div class="colour-flow-primary">${top.map((item,i)=>`<button type="button" class="colour-flow-phase ${item.active?'active':''} ${item.done?'complete':''}" data-colour-stage="${item.id}"><span>${String(i+1).padStart(2,'0')}</span><b>${item.title}</b><small>${item.done?'Complete':item.meta}</small></button>`).join('')}</div>${currentColourStage<=5?`<div class="colour-flow-subnav">${palette.map(([key,title],i)=>{const c=stageCompletion(key);return`<button type="button" class="${currentColourStage===i+1?'active':''} ${c.complete===c.total?'complete':''}" data-colour-stage="${i+1}"><span>${String(i+1).padStart(2,'0')}</span><b>${title}</b><small>${c.complete}/${c.total}</small></button>`}).join('')}</div>`:''}</nav>`}
function stageBody(meta){if(meta.key==='identity')return`<div class="source-grid identity-sources">${SOURCE_GROUPS.identity.map((token,i)=>sourceCard(token,{description:`Expressive family ${i+1}`})).join('')}</div>`;
 if(meta.key==='ground')return`<div class="source-grid ground-sources">${SOURCE_GROUPS.ground.map((token,i)=>sourceCard(token,{family:false,description:`Canvas ${['Primary','Secondary','Tertiary'][i]} source`})).join('')}</div><div class="ground-preview">${SOURCE_GROUPS.ground.map((token,i)=>{const v=colourSourceValue(token);return`<div style="${v?`background:${escapeHtml(v)}`:''}"><span>Canvas ${['Primary','Secondary','Tertiary'][i]}</span><b>${v||'Unset'}</b></div>`}).join('')}</div>`;
 if(meta.key==='neutral')return`<div class="neutral-builder">${sourceCard('--bc-color-neutral-50',{family:false,description:'The character anchor for the absolute neutral scale'})}<section class="neutral-scale-preview"><header><strong>Generated Neutral 0–100</strong><span>White and black endpoints stay absolute; the centre can be warm, cool or chromatic.</span></header>${paletteStripFromValues(familyValues('--bc-color-neutral-50'),true)}</section></div>`;
 if(meta.key==='status')return`<div class="source-grid status-sources">${SOURCE_GROUPS.status.map(token=>sourceCard(token,{description:sourceLabel(token)})).join('')}</div>`;
 if(meta.key==='interaction')return`<div class="source-grid interaction-sources">${SOURCE_GROUPS.interaction.map(token=>sourceCard(token,{family:false})).join('')}</div>`;
 if(meta.key==='primitive-review')return renderPrimitiveReview();
 if(meta.key==='semantic-light')return renderSemanticStage('light');
 if(meta.key==='semantic-dark')return renderSemanticStage('dark');
 return renderFinalColourReview();}
function renderPrimitiveReview(){const c=colourCompletion(currentFlavour?.overrides||{});const sections=[['Identity',SOURCE_GROUPS.identity],['Ground',SOURCE_GROUPS.ground],['Neutral',SOURCE_GROUPS.neutral],['Status',SOURCE_GROUPS.status],['Interaction',SOURCE_GROUPS.interaction]];const bridge=[['Primary','Identity Ramp 1','Primary design material'],['Secondary','Identity Ramp 2','Secondary design material'],['Accent','Identity Ramp 3','Accent design material'],['Neutral','Neutral 0–100','General structural/readable material'],['Ground','Ground Ramp 1/2/3','Canvas only']];return`<div class="colour-review meaning-stage"><section class="palette-completion ${c.complete===c.total?'complete':''}"><div><span class="eyebrow">02 · Meaning</span><h3>${c.complete===c.total?'Give the source palette purpose':'Finish the source palette first'}</h3><p>${c.complete} of ${c.total} required source colours are set. This bridge does not invent new colours: it defines what each Primitive family may be used for before mode-specific Semantic selection begins.</p></div><strong>${c.complete}/${c.total}</strong></section><section class="meaning-map"><header><div><span class="eyebrow">Primitive → design material</span><h3>What each family is allowed to mean</h3></div></header><div>${bridge.map(([role,source,purpose])=>`<article><span>${escapeHtml(role)}</span><b>${escapeHtml(source)}</b><small>${escapeHtml(purpose)}</small></article>`).join('')}</div><p>Ground remains Canvas-only. General Surfaces come from Neutral. Identity and Status families stay inside their own family when used for coloured Surface, Fill, Border and readable Strong Text roles.</p></section><details class="meaning-palette-review"><summary>Review the source palette</summary><div class="review-palette-sections">${sections.map(([title,tokens])=>`<section><header><strong>${title}</strong><span>${tokens.filter(colourSourceValue).length}/${tokens.length} sources</span></header>${tokens.map(token=>`<div class="review-family"><b>${escapeHtml(sourceLabel(token))}</b>${paletteStripFromValues(familyValues(token),false)}</div>`).join('')}</section>`).join('')}</div></details>${c.complete===c.total?'<div class="semantic-callout"><strong>Next: build Light</strong><p>BufferCore now constructs coherent family options using contrast + OKLab/OKLCH evidence. Local AI judges between already-good options instead of mapping 150 roles independently.</p></div>':''}</div>`}
function semanticHexFor(state,semanticToken){let primitive=state?.mappings?.[semanticToken]||'';if(!primitive){const fixed=(state?.candidateSets||[]).find(s=>s.token===semanticToken&&s.fixed&&s.candidates?.length===1);primitive=fixed?.candidates?.[0]||''}return primitive?colourSourceValue(primitive):''}
function contrastRatio(a,b){const hex=v=>normalizeHex(v);a=hex(a);b=hex(b);if(!a||!b)return null;const lum=h=>{const rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}
function ratioNumber(value){const n=parseFloat(String(value||'').replace(':1',''));return Number.isFinite(n)?n:null}
function accessibilityRule(set){return set?.accessibilityMinimum?{minimum:set.accessibilityMinimum,recommended:set.accessibilityRecommended||''}:null}
function semanticContrastContext(state,set){if(!accessibilityRule(set))return null;const inverse=/Inverse/i.test(set.name||'');const target=inverse?'--bc-color-surface-general-primary-strong':'--bc-color-surface-general-primary';let value='';if(set.accessibilityBackground)value=colourSourceValue(set.accessibilityBackground);if(!value)value=semanticHexFor(state,target);if(!value)return null;return{target,value,label:inverse?'Surface General Primary Strong':'Surface General Primary'}}
function accessibilityStatus(state,set,selected){const rule=accessibilityRule(set);if(!rule)return null;const minimum=ratioNumber(rule.minimum),recommended=ratioNumber(rule.recommended);const foreground=selected?colourSourceValue(selected):'';const context=semanticContrastContext(state,set);const ratio=foreground&&context?contrastRatio(foreground,context.value):null;if(ratio===null||minimum===null)return{stateClass:'pending',label:'PENDING',detail:'Background unavailable',ratio:null,rule,context,foreground};if(recommended!==null&&ratio>=recommended)return{stateClass:'recommended',label:'PASS',detail:'Recommended',ratio,rule,context,foreground};if(ratio>=minimum){const familyPreserving=set?.group==='Text'&&/ Strong(?: Inverse)?$/i.test(set?.name||'')&&!/Neutral/i.test(set?.name||'');return{stateClass:'minimum',label:'PASS',detail:familyPreserving?'Minimum · family-preserving':'Minimum only',ratio,rule,context,foreground};}return{stateClass:'fail',label:'FAIL',detail:'Below minimum',ratio,rule,context,foreground}}
function semanticAccessibility(state,set,selected){const result=accessibilityStatus(state,set,selected);if(!result)return'';const{stateClass,label,detail,ratio,rule,context,foreground}=result;const preview=context&&foreground?`<div class="semantic-contrast-preview" style="background:${escapeHtml(context.value)};color:${escapeHtml(foreground)}"><b>Aa</b><span>${escapeHtml(context.label)}</span></div>`:'';return`<div class="semantic-accessibility ${stateClass}">${preview}<div class="semantic-accessibility-copy"><div class="semantic-accessibility-head"><strong>${label}</strong><b>${ratio!==null?`${ratio.toFixed(2)}:1 · ${detail}`:detail}</b></div><div class="semantic-accessibility-thresholds"><span>Minimum <b>${escapeHtml(rule.minimum)}</b></span>${rule.recommended?`<span>Recommended <b>${escapeHtml(rule.recommended)}</b></span>`:''}</div>${context?'':`<small>Map the representative Surface before this can be tested.</small>`}</div></div>`}
function semanticAccessibilityBadge(state,set,selected){const result=accessibilityStatus(state,set,selected);if(!result)return'';const ratio=result.ratio!==null?` ${result.ratio.toFixed(2)}:1`:'';return`<span class="semantic-a11y-badge ${result.stateClass}" title="${escapeHtml(result.detail)}">${result.label}${ratio}</span>`}
function semanticSubgroup(group,set){const n=set.name.replace(/^(Fill|Border|Text|Surface)\s+/i,'').trim();const first=n.split(/\s+/)[0]||'General';if(group==='Fill'||group==='Border'){if(['Success','Warning','Error','Info'].includes(first))return'Status';return first}if(group==='Text'){if(['Primary','Secondary','Accent'].includes(first))return first;if(['Success','Warning','Error','Info'].includes(first))return'Status';return'General'}if(group==='Surface'){if(first==='General')return'General';if(first==='Identity')return'Identity';return'Status'}if(group==='Tones / Design Material'){const x=set.name.replace(/^Tone(?:s)?\s+/i,'').trim();return x.split(/\s+/)[0]||'Other'}return''}
function semanticRuleDetails(set){const rules=[set.purpose&&`<div><b>Purpose</b><span>${escapeHtml(set.purpose)}</span></div>`,set.context&&`<div><b>Context</b><span>${escapeHtml(set.context)}</span></div>`,set.sourceRule&&`<div><b>Primitive source</b><span>${escapeHtml(set.sourceRule)}</span></div>`,set.appearanceRule&&`<div><b>Appearance</b><span>${escapeHtml(set.appearanceRule)}</span></div>`,set.relationshipRule&&`<div><b>Relationship</b><span>${escapeHtml(set.relationshipRule)}</span></div>`,set.notes&&`<div><b>Notes</b><span>${escapeHtml(set.notes)}</span></div>`].filter(Boolean).join('');if(!rules)return'';return`<details class="semantic-rules"><summary>Role rules</summary><div class="semantic-rules-grid">${rules}</div></details>`}
function semanticMappingRow(state,set,mappings){const selected=mappings[set.token]||(set.fixed&&set.candidates?.length===1?set.candidates[0]:'');const swatch=selected?colourSourceValue(selected):'';const source=selected?selected.replace('--bc-color-',''):'';const choice=set.fixed?`<div class="semantic-fixed-source">${selected?`<i style="background:${escapeHtml(swatch)}"></i><span><b>${escapeHtml(source)}</b><small>${escapeHtml(swatch||'')}</small></span>`:'<span>Fixed source unavailable</span>'}<em>Fixed</em></div>`:`<div class="semantic-choice-control"><select data-semantic-target="${escapeHtml(set.token)}" aria-label="Primitive source for ${escapeHtml(set.name)}"><option value="">${set.candidates.length?'Choose Primitive…':'No legal Primitive available'}</option>${set.candidates.map(sourceToken=>`<option value="${escapeHtml(sourceToken)}" ${sourceToken===selected?'selected':''}>${escapeHtml(sourceToken.replace('--bc-color-',''))}</option>`).join('')}</select>${selected?`<div class="semantic-source-value" title="${escapeHtml(source)} ${escapeHtml(swatch||'')}"><i style="background:${escapeHtml(swatch)}"></i><b>${escapeHtml(swatch||'')}</b></div>`:''}</div>`;return`<label class="semantic-mapping ${set.fixed?'fixed':''}" title="${escapeHtml(set.token)}"><span class="semantic-role"><i class="semantic-role-swatch ${swatch?'':'empty'}" style="${swatch?`background:${escapeHtml(swatch)}`:''}"></i><span><b>${escapeHtml(set.name)}</b>${semanticAccessibilityBadge(state,set,selected)}</span></span><div class="semantic-choice">${choice}${semanticAccessibility(state,set,selected)}${semanticRuleDetails(set)}</div></label>`}
function semanticGroups(state,onlyGroup=null){const sets=state?.candidateSets||[];const mappings=state?.mappings||{};const order=['Canvas','Surface','Fill','Border','Text','Interaction','Tones / Design Material'];return order.filter(group=>!onlyGroup||group===onlyGroup).map(group=>[group,sets.filter(s=>s.group===group)]).filter(([,items])=>items.length).map(([group,items])=>{const title=group.replace('Tones / Design Material','Tones');const mapped=items.filter(i=>mappings[i.token]).length;const mappable=items.filter(i=>i.candidates.length).length;const grouped=new Map();for(const set of items){const sub=semanticSubgroup(group,set)||'';if(!grouped.has(sub))grouped.set(sub,[]);grouped.get(sub).push(set)}const content=[...grouped.entries()].map(([sub,subItems])=>`${sub?`<div class="semantic-subgroup-head"><strong>${escapeHtml(sub)}</strong><span>${subItems.filter(i=>mappings[i.token]).length}/${subItems.filter(i=>i.candidates.length).length}</span></div>`:''}<div class="semantic-mapping-list">${subItems.map(set=>semanticMappingRow(state,set,mappings)).join('')}</div>`).join('');return`<section class="semantic-group ${group==='Fill'?'semantic-group-fill':''}"><header><div><strong>${escapeHtml(title)}</strong><small>Technical mapping editor · legal Primitive sources only.</small></div><span>${mapped}/${mappable}</span></header>${content}</section>`}).join('')}
function semanticGroupOrder(state){const available=new Set((state?.candidateSets||[]).map(s=>s.group));return['Canvas','Surface','Fill','Border','Text','Interaction','Tones / Design Material'].filter(g=>available.has(g))}
function semanticGroupTabs(mode,state){const groups=semanticGroupOrder(state);if(!groups.includes(semanticGroupFocus[mode]))semanticGroupFocus[mode]=groups[0]||'Canvas';return`<nav class="semantic-chapter-tabs">${groups.map((group,i)=>{const title=group.replace('Tones / Design Material','Tones');const items=(state.candidateSets||[]).filter(s=>s.group===group),mapped=items.filter(s=>state.mappings?.[s.token]).length;return`<button type="button" class="${semanticGroupFocus[mode]===group?'active':''}" data-semantic-group="${escapeHtml(group)}" data-semantic-mode="${mode}"><span>${String(i+1).padStart(2,'0')}</span><b>${escapeHtml(title)}</b><small>${mapped}/${items.filter(s=>s.candidates.length).length}</small></button>`}).join('')}</nav>`}
function semanticVisualLane(state,group){const sets=(state?.candidateSets||[]).filter(s=>s.group===group),mappings=state?.mappings||{};const buckets=new Map();for(const set of sets){const sub=semanticSubgroup(group,set)||'General';if(!buckets.has(sub))buckets.set(sub,[]);buckets.get(sub).push(set)}return`<section class="semantic-visual-review"><header><div><span class="eyebrow">Visual hierarchy</span><h3>${escapeHtml(group.replace('Tones / Design Material','Tones'))}</h3><p>Review relationships first. Open Technical mappings only when you need to make a manual exception.</p></div></header><div class="semantic-family-lanes">${[...buckets.entries()].map(([label,items])=>`<article><header><strong>${escapeHtml(label)}</strong></header><div class="semantic-family-strip">${items.map(set=>{const source=mappings[set.token]||(set.fixed&&set.candidates?.length===1?set.candidates[0]:'');const value=source?colourSourceValue(source):'';const a11y=source?accessibilityStatus(state,set,source):null;return`<div class="semantic-family-chip"><i style="${value?`background:${escapeHtml(value)}`:''}"></i><span><b>${escapeHtml(set.name.replace(/^(Fill|Border|Text|Surface)\s+/i,''))}</b><small>${escapeHtml(source?source.replace('--bc-color-',''):'Unmapped')}</small>${a11y?`<em class="${a11y.stateClass}">${a11y.label}${a11y.ratio!==null?` ${a11y.ratio.toFixed(2)}:1`:''}</em>`:''}</span></div>`}).join('')}</div></article>`).join('')}</div></section>`}
function semanticFindingPanel(state,group){const findings=(state?.findings||[]).filter(f=>f.group===group||f.group==='Cross-family');if(!findings.length)return`<div class="semantic-quality-clear"><b>✓ No deterministic quality warnings for this chapter</b><span>Accessibility, sibling separation and family character checks are clear.</span></div>`;return`<section class="semantic-quality-findings"><header><b>${findings.length} design-quality signal${findings.length===1?'':'s'}</b></header>${findings.map(f=>`<article><strong>${escapeHtml(f.issue)}</strong><span>${escapeHtml(f.recommendation||'')}</span></article>`).join('')}</section>`}

function semanticAccessibilitySummary(mode){
  const state=semanticState[mode];
  const sets=state?.candidateSets||[],mappings=state?.mappings||{};
  const rows=sets.filter(set=>accessibilityRule(set)).map(set=>{
    const selected=mappings[set.token]||(set.fixed&&set.candidates?.length===1?set.candidates[0]:'');
    return{set,selected,result:accessibilityStatus(state,set,selected)}
  });
  const summary={total:rows.length,pass:0,minimum:0,recommended:0,fail:0,pending:0,fixable:0,fixedFail:0};
  for(const row of rows){
    const r=row.result;
    if(!r||r.stateClass==='pending'){summary.pending++;continue}
    if(r.stateClass==='fail'){summary.fail++;if(row.set.fixed)summary.fixedFail++;else if(row.set.candidates?.length)summary.fixable++;continue}
    summary.pass++;
    if(r.stateClass==='minimum')summary.minimum++;
    if(r.stateClass==='recommended')summary.recommended++;
  }
  return summary;
}
async function fixSemanticAccessibility(mode){
  const state=semanticState[mode];
  if(!state||semanticBusy)return;
  const mappings={...(state.mappings||{})};
  let changed=0;
  for(const set of state.candidateSets||[]){
    if(set.fixed||!accessibilityRule(set)||!set.candidates?.length)continue;
    const current=mappings[set.token]||'';
    const currentResult=accessibilityStatus(state,set,current);
    if(currentResult&&currentResult.stateClass!=='fail'&&currentResult.stateClass!=='pending')continue;
    const replacement=set.candidates.find(candidate=>{
      const result=accessibilityStatus(state,set,candidate);
      return result&&result.stateClass!=='fail'&&result.stateClass!=='pending';
    });
    if(replacement&&replacement!==current){mappings[set.token]=replacement;changed++}
  }
  if(!changed)return;
  semanticBusy=true;renderBuilder();
  try{
    const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`,{method:'PATCH',body:JSON.stringify({mappings})});
    currentFlavour={...result.flavour,isNew:false};
    semanticState[mode]=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`);
    latest=result.status||latest;
    $('#saveState').textContent='Saved';
  }catch(e){await errorDialog(e,{title:'Could not repair accessibility issues'});}
  finally{semanticBusy=false;renderAll(latest);renderBuilder()}
}

function semanticBuildProvenance(mode){
  const p=semanticBuildStatus[mode]||semanticState[mode]?.buildProvenance;
  if(!p)return'';
  if(p.state==='building'){
    return`<div class="semantic-build-provenance building"><strong>${p.buildMode==='ai'?'Local AI is reviewing family options…':'BufferCore is scoring deterministic options…'}</strong><span>${p.buildMode==='ai'?'This will only be labelled an AI build if the model actually completes.':'No AI is used for this build.'}</span></div>`;
  }
  if(p.state==='error'){
    return`<div class="semantic-build-provenance error"><strong>${p.buildMode==='ai'?'AI build failed':'Build failed'}</strong><span>${escapeHtml(p.error||'')}</span></div>`;
  }
  const ai=p.mode==='ai';
  const seconds=((p.elapsedMs||0)/1000).toFixed(1);
  const choices=p.aiChoiceCounts||{};const choiceText=['O1','O2','O3'].filter(key=>choices[key]!==undefined).map(key=>`${key} ${choices[key]}`).join(' · ');return`<div class="semantic-build-provenance ${ai?'ai':'deterministic'}"><strong>${ai?'AI build verified':'Deterministic build'}</strong><span>${ai?`${escapeHtml(p.model||'Local model')} · ${p.aiSelectionCount||0}/${p.batchCount||0} AI decisions · ${p.aiRequestCount||0} passes · ${p.aiDifferentFromDeterministic||0} differed from deterministic${choiceText?` · ${choiceText}`:''} · ${seconds}s`:`${p.batchCount||0} family batches · ${seconds}s · no AI used`}</span></div>`;
}
function renderSemanticStage(mode){const c=colourCompletion(currentFlavour?.overrides||{});const state=semanticState[mode];if(c.complete!==c.total)return`<div class="semantic-callout warning"><strong>Primitive palette incomplete</strong><p>Finish all required source colours before generating ${mode} Semantics.</p><button class="secondary" data-colour-stage="6">Return to Meaning</button></div>`;if(!state)return`<div class="semantic-loading">Loading ${mode} Semantic contract…</div>`;const comp=state.completion||{},a11y=semanticAccessibilitySummary(mode),group=semanticGroupFocus[mode];const health=a11y.total?`<div class="semantic-a11y-summary ${a11y.fail?'has-fail':'all-pass'}"><span><b>${a11y.fail?`${a11y.fail} accessibility issue${a11y.fail===1?'':'s'}`:'Accessibility passes'}</b><small>${a11y.recommended} recommended · ${a11y.minimum} valid minimum-pass${a11y.pending?` · ${a11y.pending} pending`:''}</small></span>${a11y.fixedFail?`<small class="semantic-a11y-fixed-note">${a11y.fixedFail} fixed-source issue${a11y.fixedFail===1?'':'s'} must be corrected in Primitives.</small>`:''}</div>`:'';return`<div class="semantic-builder guided-semantic-workspace"><section class="semantic-generation-head"><div><span class="eyebrow">${mode} mode</span><h3>${comp.complete?'Semantic system ready for review':'Build the Semantic system'}</h3><p>BufferCore constructs coherent family options using real HEX, contrast and OKLab/OKLCH evidence. Local AI judges those options; deterministic best choices remain the fallback.</p></div><div class="semantic-generation-actions"><span>${comp.mapped||0}/${comp.mappable||0}</span><button class="ghost" type="button" data-reset-colour-set="semantic-group" data-semantic-mode="${mode}" data-semantic-group="${escapeHtml(group)}">Reset ${escapeHtml(group==='Tones / Design Material'?'Tones':group)}</button><button class="ghost semantic-mode-reset" type="button" data-reset-colour-set="semantic-mode" data-semantic-mode="${mode}">Reset ${mode==='light'?'Light':'Dark'}</button><button class="ghost" type="button" data-build-deterministic="${mode}" ${semanticBusy?'disabled':''}>Build deterministic</button><button class="primary" type="button" data-generate-semantics="${mode}" ${semanticBusy?'disabled':''}>${semanticBusy&&semanticBuildStatus[mode]?.buildMode==='ai'?'AI is reviewing…':`Build ${mode==='light'?'Light':'Dark'} with AI`}</button></div>${semanticBuildProvenance(mode)}</section>${health}${semanticGroupTabs(mode,state)}${semanticVisualLane(state,group)}${semanticFindingPanel(state,group)}<details class="semantic-technical"><summary><span>Technical mappings</span><small>Open for manual token-level adjustments</small></summary>${semanticGroups(state,group)}</details></div>`}

function colourAiReviewCard(mode,label){
  const state=semanticState?.[mode]||{};
  const review=state.aiReview||semanticBuildStatus?.[mode]?.aiReview;
  const provenance=state.buildProvenance||semanticBuildStatus?.[mode];
  if(!review||provenance?.mode!=='ai')return'';
  const choices=review.choiceCounts||{};
  const totals=review.totals||{};
  const seconds=((totals.wallMs||provenance?.elapsedMs||0)/1000).toFixed(1);
  const generated=Number(totals.eval_count||0);
  const prompted=Number(totals.prompt_eval_count||0);
  const different=Number(review.differentFromDeterministic||0);
  return`<article class="colour-ai-audit-card">
    <header><div><span class="eyebrow">${escapeHtml(label)} AI audit</span><h4>${escapeHtml(review.model||provenance?.model||'Local model')}</h4></div><strong>${different}/${review.familyCount||0}</strong></header>
    <p>AI changed ${different} of ${review.familyCount||0} family decisions from BufferCore's deterministic first choice.</p>
    <div class="colour-ai-audit-stats">
      <span><b>${review.requestCount||0}</b><small>Local AI passes</small></span>
      <span><b>${prompted}</b><small>Prompt tokens</small></span>
      <span><b>${generated}</b><small>Generated tokens</small></span>
      <span><b>${seconds}s</b><small>AI wall time</small></span>
    </div>
    <div class="colour-ai-audit-choices"><span>O1 <b>${choices.O1||0}</b></span><span>O2 <b>${choices.O2||0}</b></span><span>O3 <b>${choices.O3||0}</b></span></div>
    <details><summary>Family decisions</summary><div class="colour-ai-audit-families">${(review.families||[]).map(item=>`<div><span>${escapeHtml(item.label||item.batchId)}</span><b>${escapeHtml(item.selectedOption||'—')}${item.differedFromDeterministic?' ≠ ':' = '}${escapeHtml(item.deterministicOption||'—')}</b><small>${escapeHtml(item.reason||'No reason returned.')}</small></div>`).join('')}</div></details>
  </article>`;
}

function renderFinalColourReview(){const c=colourCompletion(currentFlavour?.overrides||{}),l=semanticMeta('light'),d=semanticMeta('dark'),la=semanticState.light?semanticAccessibilitySummary('light'):{total:0,pass:0,fail:0,pending:0,recommended:0,minimum:0},da=semanticState.dark?semanticAccessibilitySummary('dark'):{total:0,pass:0,fail:0,pending:0,recommended:0,minimum:0},lf=semanticState.light?.findings||[],df=semanticState.dark?.findings||[];const attention=[...lf.map(f=>({...f,mode:'Light'})),...df.map(f=>({...f,mode:'Dark'}))];const hardIssues=la.fail+da.fail+la.pending+da.pending;const ready=c.complete===c.total&&l.complete&&d.complete&&!hardIssues&&!attention.length;const modeCard=(name,meta,a11y,findings)=>`<article class="colour-review-mode ${a11y.fail||a11y.pending||findings.length?'attention':'clear'}"><span>${name}</span><b>${meta.mapped}/${meta.mappable}</b><small>${meta.complete?'Mappings complete':'Needs generation/review'}</small><div><em>${a11y.pass}/${a11y.total} accessibility pass</em>${a11y.minimum?`<em>${a11y.minimum} minimum-only</em>`:''}${findings.length?`<em>${findings.length} visual finding${findings.length===1?'':'s'}</em>`:'<em>Visual hierarchy clear</em>'}</div></article>`;return`<div class="colour-review"><section class="palette-completion colour-review-completion ${ready?'complete':''}"><div><span class="eyebrow">05 · Review</span><h3>${ready?'Colour system ready':'Review the exceptions, not every token'}</h3><p>Primitive material: ${c.complete}/${c.total}. Light: ${l.mapped}/${l.mappable}. Dark: ${d.mapped}/${d.mappable}. BufferCore has already checked hard contrast, hierarchy, perceptual separation, family character and endpoint collapse.</p></div><div class="colour-review-completion-actions"><button class="ghost" type="button" data-export-colour-review>Export Review</button><strong>${ready?'✓':'!'}</strong></div></section><div class="semantic-mode-summary colour-review-mode-grid">${modeCard('Light',l,la,lf)}${modeCard('Dark',d,da,df)}</div><div class="colour-ai-audit-grid">${colourAiReviewCard('light','Light')}${colourAiReviewCard('dark','Dark')}</div>${attention.length||hardIssues?`<section class="colour-review-attention"><header><div><span class="eyebrow">Attention</span><h3>${hardIssues+attention.length} item${hardIssues+attention.length===1?'':'s'} worth checking</h3><p>These are the exceptions that need human judgement. The rest of the generated system already satisfies the executable Colour contract.</p></div></header>${hardIssues?`<div class="colour-review-hard-issues">${la.fail||la.pending?`<button type="button" data-colour-stage="7">Light · ${la.fail} failed · ${la.pending} pending</button>`:''}${da.fail||da.pending?`<button type="button" data-colour-stage="8">Dark · ${da.fail} failed · ${da.pending} pending</button>`:''}</div>`:''}<div class="semantic-quality-findings">${attention.map(f=>`<article><span>${escapeHtml(f.mode)} · ${escapeHtml(f.group||'System')}</span><b>${escapeHtml(f.issue)}</b><small>${escapeHtml(f.recommendation||'Review this relationship.')}</small></article>`).join('')}</div></section>`:`<section class="semantic-quality-clear"><b>No generated Colour issues need attention.</b><span>Hard accessibility minimums pass and the deterministic visual-quality review found no hierarchy, family-character or cross-family collision warnings.</span></section>`}<section class="semantic-preview"><header><div><span class="eyebrow">Resolved result</span><h3>Light + Dark implementation preview</h3><p>Review the actual resolved system visually. Technical mapping tables stay inside the Light/Dark chapters if you need a manual exception.</p></div><button class="secondary" type="button" id="refreshColourSemantic">Refresh preview</button></header><div id="semanticPreviewBody"><div class="source-empty">Loading resolved semantics…</div></div></section></div>`}
async function loadSemanticMode(mode){if(currentFlavour?.isNew)return;try{semanticState[mode]=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`);renderBuilder()}catch(e){semanticState[mode]={error:e.message,candidateSets:[],mappings:{},completion:{}};renderBuilder()}}
async function generateSemanticMode(mode,buildMode='ai'){if(semanticBusy)return;semanticBusy=true;semanticBuildStatus[mode]={state:'building',buildMode,startedAt:Date.now()};renderBuilder();try{if($('#saveState')?.textContent==='Unsaved changes'){await saveCurrent();if($('#saveState')?.textContent!=='Saved')throw new Error('Studio could not save the current Primitive palette before building Semantics.');}const model=$('#aiModel')?.value||aiState.model;const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}/generate`,{method:'POST',body:JSON.stringify({model,buildMode,fresh:true,message:`Generate the ${mode} Semantic colour system for ${currentFlavour.displayName}. This is a fresh rebuild: judge every supplied family batch independently of any previously saved Semantic mapping. Respect all BufferCore hard mappings and legal candidate bands. Choose for hierarchy, readability and coherent family character.`})});currentFlavour={...result.flavour,isNew:false};semanticState[mode]={...result,mappings:result.flavour.semanticMappings?.colour?.[mode]||{}};semanticBuildStatus[mode]={state:'complete',...result.buildProvenance,model:result.model||null,reply:result.reply||'',aiReview:result.aiReview||null};latest=result.status||latest;$('#saveState').textContent='Saved';renderAll(latest);renderBuilder();const p=result.buildProvenance||{};studioToast(buildMode==='ai'?`AI reviewed ${p.aiSelectionCount||0}/${p.batchCount||0} colour families across ${p.aiRequestCount||1} Local AI pass${(p.aiRequestCount||1)===1?'':'es'} in ${((p.elapsedMs||0)/1000).toFixed(1)}s.`:`Deterministic colour build completed in ${((p.elapsedMs||0)/1000).toFixed(1)}s.`,{title:buildMode==='ai'?'AI Semantic build complete':'Deterministic Semantic build complete'});}catch(e){semanticBuildStatus[mode]={state:'error',buildMode,error:e.message};if(buildMode==='ai'){const useFallback=await confirmDialog(e.message,{title:`AI did not build ${titleCase(mode)} Semantics`,detail:'Nothing was saved from this failed AI attempt. You can retry Local AI, or explicitly use BufferCore’s deterministic best-scoring family options instead.',confirmLabel:'Use deterministic build',cancelLabel:'Keep current mappings',tone:'warning'});if(useFallback){semanticBusy=false;renderBuilder();return generateSemanticMode(mode,'deterministic')}}else await errorDialog(e,{title:`Could not build ${mode} Semantics`});}finally{semanticBusy=false;renderBuilder()}}
async function saveSemanticManual(mode,target,source){const state=semanticState[mode];if(!state)return;const mappings={...(state.mappings||{})};if(source)mappings[target]=source;else delete mappings[target];try{const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`,{method:'PATCH',body:JSON.stringify({mappings})});currentFlavour={...result.flavour,isNew:false};semanticState[mode]={...state,...result,mappings:currentFlavour.semanticMappings?.colour?.[mode]||{},candidateSets:result.candidateSets||state.candidateSets,findings:result.findings||[]};latest=result.status||latest;$('#saveState').textContent='Saved';renderAll(latest);renderBuilder()}catch(e){await errorDialog(e,{title:'Invalid Semantic colour choice',detail:'Studio kept the previous legal mapping. Choose one of the allowed Primitive sources for this role.'});semanticState[mode]=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`);renderBuilder()}}


const COLOUR_PALETTE_EXPORT_TYPE='buffercore-colour-source-palette';
const COLOUR_PALETTE_EXPORT_VERSION=1;

function colourSourceTokens(){
  return [...SOURCE_GROUPS.identity,...SOURCE_GROUPS.ground,...SOURCE_GROUPS.neutral,...SOURCE_GROUPS.status,...SOURCE_GROUPS.interaction];
}
function colourPaletteExportDocument(){
  const sources={};
  for(const token of colourSourceTokens()){
    const value=normalizeHex(currentFlavour?.overrides?.[token]);
    if(value)sources[token]=value;
  }
  return{
    schemaVersion:COLOUR_PALETTE_EXPORT_VERSION,
    type:COLOUR_PALETTE_EXPORT_TYPE,
    flavour:{id:currentFlavour?.id||null,displayName:currentFlavour?.displayName||null},
    exportedAt:new Date().toISOString(),
    sources
  };
}
function downloadColourPalette(){
  const paletteDocument=colourPaletteExportDocument();
  const missing=colourSourceTokens().filter(token=>!paletteDocument.sources[token]);
  if(missing.length){
    return errorDialog(
      new Error(`The Palette is incomplete. ${missing.length} source colour${missing.length===1?' is':'s are'} still missing.`),
      {title:'Could not export Palette'}
    );
  }
  const json=JSON.stringify(paletteDocument,null,2)+'\n';
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=globalThis.document.createElement('a');
  const id=(currentFlavour?.id||'buffercore').replace(/[^a-z0-9-]+/gi,'-').toLowerCase();
  link.href=url;
  link.download=`${id}-colour-palette.json`;
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  studioToast('Exported the 17 Colour source values only.',{title:'Palette exported'});
}
function validateColourPaletteImport(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Palette JSON must be an object.');
  if(value.type!==COLOUR_PALETTE_EXPORT_TYPE)throw new Error(`Expected type "${COLOUR_PALETTE_EXPORT_TYPE}".`);
  if(Number(value.schemaVersion)!==COLOUR_PALETTE_EXPORT_VERSION)throw new Error(`Unsupported Palette schemaVersion "${value.schemaVersion}".`);
  if(!value.sources||typeof value.sources!=='object'||Array.isArray(value.sources))throw new Error('Palette JSON is missing its sources object.');
  const required=colourSourceTokens();
  const unknown=Object.keys(value.sources).filter(token=>!required.includes(token));
  if(unknown.length)throw new Error(`Palette contains unknown source token${unknown.length===1?'':'s'}: ${unknown.slice(0,4).join(', ')}${unknown.length>4?` (+${unknown.length-4} more)`:''}.`);
  const missing=required.filter(token=>!(token in value.sources));
  if(missing.length)throw new Error(`Palette is incomplete: ${missing.length} required source colour${missing.length===1?' is':'s are'} missing.`);
  const invalid=required.filter(token=>!normalizeHex(value.sources[token]));
  if(invalid.length)throw new Error(`Palette contains invalid HEX value${invalid.length===1?'':'s'} for: ${invalid.slice(0,4).join(', ')}${invalid.length>4?` (+${invalid.length-4} more)`:''}.`);
  return Object.fromEntries(required.map(token=>[token,normalizeHex(value.sources[token])]));
}
async function importColourPaletteFile(file){
  if(!file)return;
  let parsed;
  try{
    parsed=JSON.parse(await file.text());
    const sources=validateColourPaletteImport(parsed);
    const all=colourAllTokenNames();
    for(const [token,value] of Object.entries(sources)){
      for(const [variable,generated] of Object.entries(generatedOverrides(token,value,all))){
        currentFlavour.overrides[variable]=generated;
      }
    }
    semanticState={light:null,dark:null};
    semanticBuildStatus={light:null,dark:null};
    $('#saveState').textContent='Unsaved changes';
    renderBuilder();
    studioToast('Imported 17 source colours and regenerated their derived ramps. Existing Light/Dark mappings were preserved but should be rebuilt against the new Palette.',{title:'Palette imported',tone:'info'});
  }catch(error){
    await errorDialog(error,{title:'Could not import Palette'});
  }
}
function openColourPaletteImport(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.hidden=true;
  input.addEventListener('change',async()=>{const[file]=input.files||[];await importColourPaletteFile(file);input.remove()},{once:true});
  document.body.appendChild(input);
  input.click();
}


const COLOUR_REVIEW_EXPORT_TYPE='buffercore-studio-colour-review';
const COLOUR_REVIEW_EXPORT_VERSION=1;

function colourReviewModeSnapshot(mode){
  const state=semanticState?.[mode]||{};
  const mappings={
    ...(currentFlavour?.semanticMappings?.colour?.[mode]||{}),
    ...(state.mappings||{})
  };
  const resolvedMappings={};
  for(const [target,source] of Object.entries(mappings)){
    resolvedMappings[target]={
      source,
      value:colourSourceValue(source)||null
    };
  }
  let accessibility={total:0,pass:0,fail:0,pending:0,recommended:0,minimum:0};
  try{
    if(state?.candidateSets?.length)accessibility=semanticAccessibilitySummary(mode);
  }catch{}
  return{
    mappings:resolvedMappings,
    accessibility,
    findings:Array.isArray(state.findings)?state.findings:[],
    buildProvenance:state.buildProvenance||semanticBuildStatus?.[mode]||null,
    aiReview:state.aiReview||semanticBuildStatus?.[mode]?.aiReview||null
  };
}

function colourReviewExportDocument(){
  const palette=colourPaletteExportDocument();
  return{
    schemaVersion:COLOUR_REVIEW_EXPORT_VERSION,
    type:COLOUR_REVIEW_EXPORT_TYPE,
    studioOnly:true,
    note:'Studio review snapshot only. Not a BufferCore Core, Flavour, Engine, Figma or Git artifact.',
    flavour:{
      id:currentFlavour?.id||null,
      displayName:currentFlavour?.displayName||null
    },
    exportedAt:new Date().toISOString(),
    palette:{
      schemaVersion:palette.schemaVersion,
      type:palette.type,
      sources:palette.sources
    },
    semantics:{
      light:colourReviewModeSnapshot('light'),
      dark:colourReviewModeSnapshot('dark')
    }
  };
}

function downloadColourReview(){
  try{
    const snapshot=colourReviewExportDocument();
    const json=JSON.stringify(snapshot,null,2)+'\n';
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=globalThis.document.createElement('a');
    const id=(currentFlavour?.id||'buffercore').replace(/[^a-z0-9-]+/gi,'-').toLowerCase();
    link.href=url;
    link.download=`${id}-colour-review.json`;
    globalThis.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    studioToast('Downloaded a Studio-only Colour Review snapshot.',{title:'Colour Review exported'});
  }catch(error){
    errorDialog(error,{title:'Could not export Colour Review'});
  }
}

function colourStageResetLabel(meta){
  if(meta.id<=5)return`Reset ${meta.title}`;
  if(meta.id===7||meta.id===8){
    const mode=meta.id===7?'light':'dark';
    const group=semanticGroupFocus[mode]||'current group';
    return`Reset ${titleCase(mode)} ${group.replace('Tones / Design Material','Tones')}`;
  }
  return'';
}
function primitiveResetTokens(stageKey){
  const sources=SOURCE_GROUPS[stageKey]||[];
  const all=colourAllTokenNames();
  const tokens=new Set();
  for(const source of sources){
    tokens.add(source);
    for(const variable of Object.keys(generatedOverrides(source,'#808080',all)))tokens.add(variable);
  }
  return[...tokens];
}
async function resetPrimitiveColourStage(stageKey,title){
  const tokens=primitiveResetTokens(stageKey);
  const affected=tokens.filter(token=>Object.prototype.hasOwnProperty.call(currentFlavour?.overrides||{},token));
  const ok=await confirmDialog(`Reset ${title} only?`,{
    title:`Reset ${title}?`,
    detail:`This resets only the ${title} Primitive set to Core inheritance. The rest of your palette and your Light/Dark Semantic mappings are kept.`,
    confirmLabel:`Reset ${title}`,
    cancelLabel:'Keep changes',
    tone:'danger'
  });
  if(!ok)return;
  for(const token of tokens)delete currentFlavour.overrides[token];
  semanticState={light:null,dark:null};
  $('#saveState').textContent='Unsaved changes';
  renderBuilder();
  studioToast(affected.length?`${title} reset to Core inheritance.`:`${title} already inherits Core.`,{tone:'info'});
}
async function resetSemanticColourGroup(mode,group){
  const state=semanticState[mode];
  if(!state)return;
  const targetSets=(state.candidateSets||[]).filter(set=>set.group===group);
  const mappings={...(state.mappings||{})};
  const targets=new Set(targetSets.map(set=>set.token));
  const removed=Object.keys(mappings).filter(token=>targets.has(token)).length;
  const displayGroup=group==='Tones / Design Material'?'Tones':group;
  const modeTitle=titleCase(mode);
  const ok=await confirmDialog(`Reset ${modeTitle} ${displayGroup} only?`,{
    title:`Reset ${modeTitle} ${displayGroup}?`,
    detail:`This clears only the ${displayGroup} Semantic mappings in ${modeTitle} mode. Your Primitive palette, other ${modeTitle} groups and the entire ${mode==='light'?'Dark':'Light'} mode stay untouched.`,
    confirmLabel:`Reset ${displayGroup}`,
    cancelLabel:'Keep mappings',
    tone:'danger'
  });
  if(!ok)return;
  for(const token of targets)delete mappings[token];
  try{
    const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`,{method:'PATCH',body:JSON.stringify({mappings})});
    currentFlavour={...result.flavour,isNew:false};
    semanticState[mode]={
      ...state,
      ...result,
      mappings:currentFlavour.semanticMappings?.colour?.[mode]||{},
      candidateSets:result.candidateSets||state.candidateSets,
      findings:result.findings||[],
      buildProvenance:null
    };
    semanticBuildStatus[mode]=null;
    latest=result.status||latest;
    $('#saveState').textContent='Saved';
    renderAll(latest);
    renderBuilder();
    studioToast(removed?`${modeTitle} ${displayGroup} reset.`:`${modeTitle} ${displayGroup} had no saved mappings.`,{tone:'info'});
  }catch(e){
    await errorDialog(e,{title:`Could not reset ${modeTitle} ${displayGroup}`});
  }
}
async function resetSemanticColourMode(mode){
  const modeTitle=titleCase(mode);
  const ok=await confirmDialog(`Reset all ${modeTitle} Semantic mappings?`,{
    title:`Reset ${modeTitle} Semantics?`,
    detail:`This clears the whole ${modeTitle} Semantic mode only. Your Primitive palette and ${mode==='light'?'Dark':'Light'} Semantic mode remain untouched.`,
    confirmLabel:`Reset ${modeTitle}`,
    cancelLabel:'Keep mappings',
    tone:'danger'
  });
  if(!ok)return;
  try{
    const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`,{method:'PATCH',body:JSON.stringify({mappings:{}})});
    currentFlavour={...result.flavour,isNew:false};
    semanticState[mode]={
      ...result,
      mappings:currentFlavour.semanticMappings?.colour?.[mode]||{}
    };
    semanticBuildStatus[mode]=null;
    latest=result.status||latest;
    $('#saveState').textContent='Saved';
    renderAll(latest);
    renderBuilder();
    studioToast(`${modeTitle} Semantics reset.`,{tone:'info'});
  }catch(e){
    await errorDialog(e,{title:`Could not reset ${modeTitle} Semantics`});
  }
}

function wireColourSources(root){root.querySelectorAll('[data-source-token]').forEach(card=>{const token=card.dataset.sourceToken;const text=card.querySelector('.source-hex');const picker=card.querySelector('input[type=color]');const apply=value=>{const normal=normalizeHex(value);const all=colourAllTokenNames();if(!normal)return;const generated=generatedOverrides(token,normal,all);for(const [variable,generatedValue] of Object.entries(generated))currentFlavour.overrides[variable]=generatedValue;semanticState={light:null,dark:null};$('#saveState').textContent='Unsaved changes';renderBuilder()};text?.addEventListener('change',()=>apply(text.value));picker?.addEventListener('change',()=>apply(picker.value));card.querySelector('.source-reset')?.addEventListener('click',()=>{const generated=generatedOverrides(token,'#808080',colourAllTokenNames());for(const variable of Object.keys(generated))delete currentFlavour.overrides[variable];delete currentFlavour.overrides[token];semanticState={light:null,dark:null};$('#saveState').textContent='Unsaved changes';renderBuilder()})});root.querySelectorAll('[data-colour-stage]').forEach(button=>button.onclick=()=>setColourStage(button.dataset.colourStage));root.querySelectorAll('[data-colour-ai]').forEach(button=>button.onclick=()=>{const input=$('#aiPrompt');if(!input)return;input.value=button.dataset.colourAi;input.focus();$('#assistant').classList.remove('hidden');$('#openAssistant').classList.add('hidden')});root.querySelectorAll('[data-generate-semantics]').forEach(button=>button.onclick=()=>generateSemanticMode(button.dataset.generateSemantics,'ai'));root.querySelectorAll('[data-build-deterministic]').forEach(button=>button.onclick=()=>generateSemanticMode(button.dataset.buildDeterministic,'deterministic'));root.querySelectorAll('[data-fix-semantic-a11y]').forEach(button=>button.onclick=()=>fixSemanticAccessibility(button.dataset.fixSemanticA11y));root.querySelectorAll('[data-semantic-group]').forEach(button=>button.onclick=()=>{const mode=button.dataset.semanticMode,group=button.dataset.semanticGroup;semanticGroupFocus[mode]=group;localStorage.setItem(`buffercore.studio.semanticGroup.${mode}`,group);renderBuilder()});root.querySelectorAll('[data-semantic-target]').forEach(select=>select.onchange=()=>saveSemanticManual(currentColourStage===7?'light':'dark',select.dataset.semanticTarget,select.value));root.querySelectorAll('[data-import-colour-palette]').forEach(button=>button.onclick=openColourPaletteImport);root.querySelectorAll('[data-export-colour-palette]').forEach(button=>button.onclick=downloadColourPalette);root.querySelectorAll('[data-export-colour-review]').forEach(button=>button.onclick=downloadColourReview);root.querySelectorAll('[data-reset-colour-set]').forEach(button=>button.onclick=()=>{const scope=button.dataset.resetColourSet;if(scope==='primitive')return resetPrimitiveColourStage(button.dataset.stageKey,button.dataset.stageTitle);if(scope==='semantic-group')return resetSemanticColourGroup(button.dataset.semanticMode,button.dataset.semanticGroup);if(scope==='semantic-mode')return resetSemanticColourMode(button.dataset.semanticMode)});$('#refreshColourSemantic')?.addEventListener('click',loadColourSemanticPreview);if(currentColourStage===9&&colourCompletion(currentFlavour?.overrides||{}).complete===colourCompletion(currentFlavour?.overrides||{}).total)queueMicrotask(loadColourSemanticPreview)}
function renderColourEditor(root){if(currentFlavour.isNew){root.innerHTML+=`<div class="coming"><b>Save Identity first.</b> Colour values are written directly into the canonical Flavour file, so the Flavour needs an id before editing.</div>`;return}const meta=colourStageMeta();const total=colourCompletion(currentFlavour.overrides||{});let stage;if(meta.id<=5)stage=stageCompletion(meta.key);else if(meta.id===6)stage=total;else if(meta.id===7||meta.id===8){const c=semanticMeta(meta.id===7?'light':'dark');stage={complete:c.mapped||0,total:c.mappable||0}}else stage={complete:(semanticMeta('light').complete?1:0)+(semanticMeta('dark').complete?1:0),total:2};const phase=meta.id<=5?{name:'Palette',step:meta.id,total:5}:meta.id===6?{name:'Meaning',step:1,total:1}:meta.id===7?{name:'Light',step:1,total:1}:meta.id===8?{name:'Dark',step:1,total:1}:{name:'Review',step:1,total:1};const sourceValues=[...SOURCE_GROUPS.identity,...SOURCE_GROUPS.ground,...SOURCE_GROUPS.status,...SOURCE_GROUPS.interaction,'--bc-color-neutral-50'].map(colourSourceValue).filter(Boolean);const paletteContext=sourceValues.length?`<div class="colour-palette-context"><span>Palette so far</span><div>${sourceValues.map(value=>`<i style="background:${escapeHtml(value)}" title="${escapeHtml(value)}"></i>`).join('')}</div><small>${total.complete}/${total.total} source colours set</small></div>`:'';const aiPrompts={identity:'Help me choose/refine the three Identity source colours. Judge hierarchy and distinction between the families; preserve good anchors. Any concrete proposals should target source/base Identity primitives only.',ground:'Help me choose the three Ground colours for Canvas Primary, Secondary and Tertiary. Ground is Canvas-only and should not be treated like Surface.',neutral:'Help me choose Neutral 50 so the generated 0–100 scale has the right warm/cool/chromatic character and stays useful for readable UI.',status:'Review Success, Warning, Error and Info source colours as a set. Keep them recognisable, distinct and coherent with the Identity palette.',interaction:'Review link, visited and focus source colours for normal and inverse contexts. Prioritise clarity and accessibility.','primitive-review':'Review this complete Primitive palette as one system before Semantic generation.','semantic-light':'Explain or critique the generated Light Semantic choices. Semantic generation itself uses the dedicated constrained generator.','semantic-dark':'Explain or critique the generated Dark Semantic choices. Semantic generation itself uses the dedicated constrained generator.','final-review':'Review the complete Primitive + Light/Dark Semantic colour system.'};root.innerHTML+=`<div class="colour-guided-shell">${colourMiniNav()}${meta.id<=6?paletteContext:''}<section class="colour-stage"><header class="colour-stage-head"><div class="colour-stage-heading"><span class="eyebrow">${escapeHtml(phase.name)} · ${String(phase.step).padStart(2,'0')} / ${String(phase.total).padStart(2,'0')}</span><h3>${escapeHtml(meta.title)}</h3><p>${escapeHtml(meta.copy)}</p></div><div class="colour-stage-actions"><span class="stage-progress"><b>${stage.complete}</b><span>/ ${stage.total}</span></span>${meta.id<=5?`<div class="palette-io-actions"><button class="ghost" type="button" data-import-colour-palette>Import Palette</button><button class="ghost" type="button" data-export-colour-palette>Export Palette</button></div><button class="ghost colour-set-reset" type="button" data-reset-colour-set="primitive" data-stage-key="${escapeHtml(meta.key)}" data-stage-title="${escapeHtml(meta.title)}">Reset ${escapeHtml(meta.title)}</button>`:''}<button class="secondary colour-ai-button" type="button" data-colour-ai="${escapeHtml(aiPrompts[meta.key])}">Ask AI about this step</button></div></header><div class="colour-stage-body">${stageBody(meta)}</div><footer class="colour-stage-nav"><button class="secondary" type="button" data-colour-stage="${Math.max(1,currentColourStage-1)}" ${currentColourStage===1?'disabled':''}>← Previous</button><div><span>${escapeHtml(meta.title)}</span><small>${meta.id<=5?`Palette ${meta.id}/5`:meta.id===6?'Meaning':meta.id===7?'Light':meta.id===8?'Dark':'Review'}</small></div><button class="primary" type="button" data-colour-stage="${Math.min(9,currentColourStage+1)}" ${currentColourStage===9?'disabled':''}>${currentColourStage===9?'Colour complete':'Continue →'}</button></footer></section><div class="colour-footer-actions"><button class="secondary" data-colour-ai="Review my complete Colour system. Focus on the most important design-quality risks.">AI review colour</button><button class="danger-subtle" data-reset-foundation="colour">Reset entire Colour Foundation</button></div></div>`;wireColourSources(root);root.querySelector('[data-reset-foundation="colour"]')?.addEventListener('click',async()=>{const ok=await confirmDialog('Reset the entire Colour Foundation?',{title:'Reset entire Colour Foundation?',detail:'This is the full reset: every Colour Primitive override and all Light/Dark Semantic mappings will be cleared. Use the scoped Reset controls inside each Palette or Semantic set when you only want to reset one area.',confirmLabel:'Reset entire Colour Foundation',cancelLabel:'Keep Colour system',tone:'danger'});if(!ok)return;for(const token of tokensForFoundation('colour'))delete currentFlavour.overrides[token.cssVariable];try{for(const mode of ['light','dark'])await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/colour-semantics/${mode}`,{method:'PATCH',body:JSON.stringify({mappings:{}})})}catch(e){await errorDialog(e,{title:'Colour reset was only partially completed'});return}currentFlavour.semanticMappings={...(currentFlavour.semanticMappings||{}),colour:{light:{},dark:{}}};semanticState={light:null,dark:null};$('#saveState').textContent='Unsaved changes';renderBuilder()})}
function renderSemanticPreview(data){const root=$('#semanticPreviewBody');if(!root)return;if(!data?.modes){root.innerHTML='<div class="source-empty">No resolved semantic preview available.</div>';return}const order=['Fill','Text','Border','Surface','Canvas','Interaction','Tones','Overlay','Shadow'];const renderMode=(mode,items)=>{const groups=new Map();for(const item of items){const g=item.group||'Other';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(item)}const keys=[...groups.keys()].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return(ai<0?99:ai)-(bi<0?99:bi)||a.localeCompare(b)});return`<section class="semantic-mode"><header><strong>${mode}</strong><span>${items.length} semantic values</span></header>${keys.map(g=>`<details ${['Fill','Text','Surface'].includes(g)?'open':''}><summary>${escapeHtml(g)} <small>${groups.get(g).length}</small></summary><div class="semantic-swatches">${groups.get(g).slice(0,80).map(item=>`<div title="${escapeHtml(item.cssVariable)} · ${escapeHtml(item.value)}"><i style="background:${escapeHtml(item.value)}"></i><span>${escapeHtml(item.label)}</span></div>`).join('')}</div></details>`).join('')}</section>`};root.innerHTML=`<div class="semantic-mode-grid">${renderMode('Light',data.modes.light||[])}${renderMode('Dark',data.modes.dark||[])}</div>`}
async function loadColourSemanticPreview(){const c=colourCompletion(currentFlavour?.overrides||{});if(c.complete!==c.total)return;const root=$('#semanticPreviewBody');if(root)root.innerHTML='<div class="source-empty">Resolving Core + current Flavour…</div>';try{colourSemanticPreview=await api('/api/colour-preview',{method:'POST',body:JSON.stringify({flavour:currentFlavour})});renderSemanticPreview(colourSemanticPreview)}catch(e){if(root)root.innerHTML=`<div class="source-empty">${escapeHtml(e.message)}</div>`}}
function typographyStageMeta(){return[
 {id:1,key:'typefaces',title:'Typefaces',copy:'Choose the primary and secondary font-family material.'},
 {id:2,key:'weights',title:'Weights',copy:'Review the available weight scale and override only what this Flavour needs.'},
 {id:3,key:'sizes',title:'Size Scale',copy:'Tune the fluid Primitive size scale that all role sizes draw from.'},
 {id:4,key:'leading',title:'Line Height',copy:'Set the vertical rhythm material used by Display, Heading, Paragraph, Label and Overline.'},
 {id:5,key:'tracking',title:'Tracking',copy:'Set the letter-spacing material for compact, neutral and expressive roles.'},
 {id:6,key:'roles',title:'Semantic Roles',copy:"Start from BufferCore\'s complete baseline role mapping, then make targeted manual or AI-assisted changes only where this Flavour needs them."},
 {id:7,key:'review',title:'Review',copy:'Review the Primitive material and complete Semantic role hierarchy together.'}
][currentTypographyStage-1]}
function setTypographyStage(stage){currentTypographyStage=Math.max(1,Math.min(7,Number(stage)));localStorage.setItem('buffercore.studio.typographyStage',String(currentTypographyStage));aiProposal=null;renderBuilder();if(currentTypographyStage>=6&&!typographyState)queueMicrotask(loadTypographySemantics)}
function typographyStageTokens(key){const tokens=tokensForFoundation('typography');const match={typefaces:/--bc-type-font-family-/,weights:/--bc-type-weight-/,sizes:/--bc-type-size-/,leading:/--bc-type-leading-/,tracking:/--bc-type-tracking-/}[key];return match?tokens.filter(t=>match.test(t.cssVariable)):tokens}
function typographyMiniNav(){const defs=['Typefaces','Weights','Size Scale','Line Height','Tracking','Semantic Roles','Review'];const comp=typographyState?.completion||{mapped:0,mappable:0,complete:false};return`<nav class="type-mini-nav">${defs.map((title,i)=>{const id=i+1;const key=['typefaces','weights','sizes','leading','tracking'][i];const tokens=key?typographyStageTokens(key):[];const customised=tokens.filter(isOverridden).length;const done=id===6?comp.complete:id===7?comp.complete:(id===1?tokens.every(t=>String(currentValue(t)).trim()&&currentValue(t)!=='initial'):true);const meta=id===6?`${comp.mapped}/${comp.mappable}`:id===7?(comp.complete?'Complete':'Review'):(customised?`${customised} overrides`:'Core material');return`<button type="button" class="type-mini-step ${currentTypographyStage===id?'active':''} ${done?'complete':''}" data-type-stage="${id}"><span>${String(id).padStart(2,'0')}</span><strong>${title}</strong><small>${meta}</small></button>`}).join('')}</nav>`}
function renderTypographyTokenRows(tokens){return`<div class="type-token-grid guided">${tokens.map(token=>`<div class="type-token ${isOverridden(token)?'custom':''}" data-token="${escapeHtml(token.cssVariable)}"><div class="token-identity"><label>${escapeHtml(compactTokenLabel(token))}</label><code>${escapeHtml(token.cssVariable)}</code></div><div class="token-control"><input class="token-value" value="${escapeHtml(currentValue(token))}" placeholder="${escapeHtml(String(initialValue(token)))}"><div class="token-control-meta">${tokenStateBadge(token)}<button class="token-reset ${isOverridden(token)?'':'is-hidden'}" title="Remove this Flavour override and use the Initial BufferCore value" type="button">↶ Initial</button></div></div></div>`).join('')}</div>`}
function typePreview(){const tokens=tokensForFoundation('typography');const val=(needle,fallback)=>{const t=tokens.find(x=>x.cssVariable.includes(needle));return t?currentValue(t):fallback};return`<div class="type-specimen type-guided-preview" id="typeSpecimen"><div class="specimen-display">Build character, not clutter.</div><div class="specimen-heading">A clear hierarchy should feel intentional.</div><p>Readable body copy establishes the baseline while headings, labels and overlines can carry their own visual prominence.</p><span>LABEL / SUPPORTING TEXT</span><div class="type-material-meta"><span>Primary ${escapeHtml(val('font-family-primary','inherit'))}</span><span>Secondary ${escapeHtml(val('font-family-secondary','inherit'))}</span></div></div>`}
function typographyRoleGroups(){const state=typographyState;if(!state)return'<div class="semantic-loading">Loading Typography role contract…</div>';const mappings=state.mappings||{};const effective=state.effectiveMappings||{};const roles=['display','heading','paragraph','label','overline'];const propLabel={'font-family':'Family','font-size':'Size','font-weight':'Weight','line-height':'Line height','letter-spacing':'Tracking'};return roles.map(role=>{const sets=(state.candidateSets||[]).filter(s=>s.role===role);const levels=[...new Set(sets.map(s=>s.level))].sort((a,b)=>a-b);const overridden=sets.filter(s=>mappings[s.token]).length;return`<section class="type-role-group"><header><div><strong>${titleCase(role)}</strong><span>${overridden?`${overridden} override${overridden===1?'':'s'}`:'Initial'}</span></div></header><div class="type-role-levels">${levels.map(level=>`<article><div class="type-role-title"><b>${titleCase(role)} ${level}</b><button type="button" class="type-role-reset" data-type-role-reset="${role}:${level}">Reset role</button></div><div class="type-role-properties">${sets.filter(s=>s.level===level).map(set=>{const selected=effective[set.token]||set.effective||set.baseline||set.current||'';const modified=!!mappings[set.token];return`<label class="${modified?'modified':'inherited'}"><span>${propLabel[set.property]||titleCase(set.property)} <em>${modified?'Override':'Initial'}</em></span><select data-type-semantic-target="${escapeHtml(set.token)}"><option value="${escapeHtml(set.baseline||set.current||'')}">${escapeHtml((set.baseline||set.current||'').replace('--bc-type-',''))} · Initial</option>${set.candidates.filter(source=>source!==(set.baseline||set.current)).map(source=>`<option value="${escapeHtml(source)}" ${source===selected?'selected':''}>${escapeHtml(source.replace('--bc-type-',''))}</option>`).join('')}</select><button type="button" class="type-property-reset" data-type-property-reset="${escapeHtml(set.token)}" ${modified?'':'disabled'}>Reset</button></label>`}).join('')}</div></article>`).join('')}</div></section>`}).join('')}
function renderTypographyStage(meta){if(meta.key==='roles'){const comp=typographyState?.completion||{};return`<div class="type-role-builder"><section class="semantic-generation-head"><div><span class="eyebrow">Semantic typography</span><h3>Initial mapping loaded</h3><p>Every role already inherits BufferCore's semantic wiring. Change only what this Flavour needs, manually or by giving Local AI a direction.</p></div><div class="semantic-generation-actions"><span>${comp.overridden||0} overrides · ${comp.inherited||0} initial</span><button class="secondary" type="button" id="generateTypographyAI" ${typographyBusy?'disabled':''}>${typographyBusy?'Reviewing…':'Ask AI to refine'}</button></div></section><div class="semantic-ai-note"><strong>Initial first, overrides only.</strong><span>Studio stores only differences from Core. Resetting a property removes the Flavour mapping and immediately restores the Core role alias.</span></div>${typographyRoleGroups()}</div>`}
 if(meta.key==='review'){const c=typographyState?.completion||{};return`<div class="type-review"><section class="palette-completion ${c.complete?'complete':''}"><div><span class="eyebrow">Typography system</span><h3>${c.complete?'Typography Flavour complete':'Semantic role mapping still needs attention'}</h3><p>${tokensForFoundation('typography').filter(isOverridden).length} Primitive overrides · ${c.mapped||0}/${c.mappable||0} Semantic role properties mapped.</p></div><strong>${c.complete?'✓':'!'}</strong></section>${typePreview()}<div class="semantic-callout"><strong>Role contract</strong><p>Display and Heading remain descending hierarchies; Paragraph keeps readable body roles; Labels can be independently sized; Overline remains intentionally prominent.</p></div></div>`}
 const tokens=typographyStageTokens(meta.key);return`${typePreview()}<section class="type-guided-section"><header><div><span class="eyebrow">Primitive material</span><h3>${meta.title}</h3><p>${meta.copy}</p></div><button class="secondary" data-type-ai="Help me refine ${meta.title.toLowerCase()} for ${escapeHtml(currentFlavour.displayName)}">Ask AI</button></header>${renderTypographyTokenRows(tokens)}</section>`}
function renderTypographyEditor(root){if(currentFlavour.isNew){root.innerHTML+=`<div class="coming"><b>Save Identity first.</b> Typography overrides need a canonical Flavour id before they can be written.</div>`;return}const meta=typographyStageMeta();root.innerHTML+=`<div class="type-guided-shell">${typographyMiniNav()}<section class="type-stage"><header class="type-stage-head"><div><div class="eyebrow">Typography · ${String(meta.id).padStart(2,'0')} of 07</div><h3>${meta.title}</h3><p>${meta.copy}</p></div><button class="secondary" data-reset-foundation="typography">Reset Typography overrides</button></header><div class="type-stage-body">${renderTypographyStage(meta)}</div><footer class="type-stage-nav"><button class="secondary" data-type-prev ${meta.id===1?'disabled':''}>← Previous</button><button class="primary" data-type-next ${meta.id===7?'disabled':''}>${meta.id===6?'Review hierarchy':'Continue'} →</button></footer></section></div>`;wireTokenEditors(root);updateTypeSpecimen();root.querySelectorAll('[data-type-stage]').forEach(b=>b.onclick=()=>setTypographyStage(b.dataset.typeStage));root.querySelector('[data-type-prev]')?.addEventListener('click',()=>setTypographyStage(currentTypographyStage-1));root.querySelector('[data-type-next]')?.addEventListener('click',()=>setTypographyStage(currentTypographyStage+1));root.querySelectorAll('[data-type-ai]').forEach(button=>button.onclick=()=>{const input=$('#aiPrompt');if(input){input.value=button.dataset.typeAi;input.focus();$('#assistant').classList.remove('hidden');$('#openAssistant').classList.add('hidden')}});root.querySelector('#generateTypographyAI')?.addEventListener('click',generateTypographySemantics);root.querySelectorAll('[data-type-semantic-target]').forEach(select=>select.onchange=()=>saveTypographySemantic(select.dataset.typeSemanticTarget,select.value));root.querySelectorAll('[data-type-property-reset]').forEach(button=>button.onclick=()=>saveTypographySemantic(button.dataset.typePropertyReset,''));root.querySelectorAll('[data-type-role-reset]').forEach(button=>button.onclick=()=>resetTypographyRole(button.dataset.typeRoleReset))}
async function loadTypographySemantics(){if(currentFlavour?.isNew)return;try{typographyState=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/typography-semantics`);if(currentStep===3)renderBuilder()}catch(e){typographyState={error:e.message,candidateSets:[],mappings:{},completion:{}};if(currentStep===3)renderBuilder()}}
async function generateTypographySemantics(){if(typographyBusy)return;const direction=await promptDialog('What should AI change about the inherited typography?',{title:'Refine Typography with AI',label:'Direction',value:'Refine the hierarchy only where needed. Keep Paragraph 2 as the body baseline and preserve clear role distinction.',confirmLabel:'Review Typography',cancelLabel:'Cancel'});if(direction===null)return;typographyBusy=true;renderBuilder();try{await saveCurrent();const model=$('#aiModel')?.value||aiState.model;const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/typography-semantics/generate`,{method:'POST',body:JSON.stringify({model,message:direction})});currentFlavour={...result.flavour,isNew:false};typographyState={...result,mappings:result.mappings||result.flavour.semanticMappings?.typography||{}};latest=result.status||latest;renderAll(latest);renderBuilder();$('#saveState').textContent='Saved'}catch(e){await errorDialog(e,{title:'Could not refine Typography'});}finally{typographyBusy=false;renderBuilder()}}
async function saveTypographySemantic(target,source){if(!typographyState)return;const mappings={...(typographyState.mappings||{})};if(source)mappings[target]=source;else delete mappings[target];try{const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/typography-semantics`,{method:'PATCH',body:JSON.stringify({mappings})});currentFlavour={...result.flavour,isNew:false};typographyState={...typographyState,...result,mappings:result.mappings||currentFlavour.semanticMappings?.typography||{},completion:result.completion};latest=result.status||latest;renderAll(latest);renderBuilder()}catch(e){await errorDialog(e,'Typography mapping rejected')}}

async function resetTypographyRole(key){if(!typographyState)return;const [role,level]=String(key||'').split(':');const mappings={...(typographyState.mappings||{})};for(const set of typographyState.candidateSets||[])if(set.role===role&&String(set.level)===String(level))delete mappings[set.token];try{const result=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/typography-semantics`,{method:'PATCH',body:JSON.stringify({mappings})});currentFlavour={...result.flavour,isNew:false};typographyState={...typographyState,...result,mappings:result.mappings||{}};latest=result.status||latest;renderAll(latest);renderBuilder()}catch(e){await errorDialog(e,'Typography reset failed')}}


function guidedFoundationSection(foundations, titles, copy){
 return `<div class="guided-foundation-shell">${foundations.map((foundation,index)=>{const tokens=tokensForFoundation(foundation);const overridden=tokens.filter(isOverridden).length;return `<section class="guided-foundation-section"><header><div><span class="eyebrow">${String(index+1).padStart(2,'0')} · ${escapeHtml(titles[foundation]||titleCase(foundation))}</span><h3>${escapeHtml(titles[foundation]||titleCase(foundation))}</h3><p>${escapeHtml(copy[foundation]||'Tune this Primitive material while inheriting everything else from Core.')}</p></div><div class="guided-foundation-actions"><span>${overridden?`${overridden} overrides`:'Initial'}</span><button class="secondary" type="button" data-foundation-ai="${escapeHtml(foundation)}">Ask AI</button><button class="ghost" type="button" data-reset-foundation="${escapeHtml(foundation)}">Reset</button></div></header><div class="guided-token-list">${tokens.map(token=>`<div class="type-token ${isOverridden(token)?'custom':''}" data-token="${escapeHtml(token.cssVariable)}"><div class="token-identity"><label>${escapeHtml(compactTokenLabel(token))}</label><code>${escapeHtml(token.cssVariable)}</code></div><div class="token-control"><input class="token-value" value="${escapeHtml(currentValue(token))}" placeholder="${escapeHtml(String(initialValue(token)))}"><div class="token-control-meta">${tokenStateBadge(token)}<button class="token-reset ${isOverridden(token)?'':'is-hidden'}" title="Remove this Flavour override and use the Initial BufferCore value" type="button">↶ Initial</button></div></div></div>`).join('')}</div></section>`}).join('')}</div>`
}
function renderGuidedFoundationEditor(root,{foundations,titles,copy,preview}){
 root.innerHTML+=`${preview?preview():''}${guidedFoundationSection(foundations,titles,copy)}`;
 wireTokenEditors(root);
 root.querySelectorAll('[data-foundation-ai]').forEach(button=>button.onclick=()=>{const input=$('#aiPrompt');if(!input)return;const label=titles[button.dataset.foundation]||titleCase(button.dataset.foundation);input.value=`Help me refine ${label.toLowerCase()} for ${currentFlavour.displayName}. Keep BufferCore semantics intact and propose only useful Primitive changes.`;input.focus();$('#assistant').classList.remove('hidden');$('#openAssistant').classList.add('hidden')});
}

function shapePreview(){return`<div class="design-preview shape-preview"><div class="preview-copy"><span>Shape preview</span><strong>Sharp, soft or somewhere between.</strong><p>Radius, border and stroke primitives define the physical character without changing semantic component structure.</p></div><div class="shape-demo"><div class="shape-card"></div><div class="shape-control"></div><div class="shape-pill"></div></div></div>`}
function scalePreview(){return`<div class="design-preview scale-preview"><div class="preview-copy"><span>Spacing & scale preview</span><strong>Control rhythm without rebuilding layouts.</strong><p>Spacing, sizing and container primitives set density and proportion. Untouched values continue to inherit Core.</p></div><div class="scale-demo"><i></i><i></i><i></i><i></i><i></i></div></div>`}
function depthPreview(){return`<div class="design-preview depth-preview"><div class="preview-copy"><span>Depth preview</span><strong>Give surfaces a consistent elevation language.</strong><p>Shadow and effect primitives should work as a family rather than isolated decorations.</p></div><div class="depth-demo"><div>Soft</div><div>Medium</div><div>Strong</div></div></div>`}
function motionPreview(){return`<div class="design-preview motion-preview"><div class="preview-copy"><span>Motion preview</span><strong>Set the pace and personality of interaction.</strong><p>Duration and easing primitives remain separate so semantic motion roles stay composable.</p></div><button class="motion-demo" id="motionDemo" type="button"><span></span>Preview motion</button></div>`}
function wireMotionPreview(){const button=$('#motionDemo');if(!button)return;button.onclick=()=>{button.classList.remove('playing');void button.offsetWidth;button.classList.add('playing')}}

function setLocalOverride(cssVariable,value){const trimmed=String(value??'').trim();if(!trimmed||trimmed==='initial')delete currentFlavour.overrides[cssVariable];else currentFlavour.overrides[cssVariable]=trimmed;$('#saveState').textContent='Unsaved changes'}
function wireTokenEditors(root){root.querySelectorAll('[data-token]').forEach(row=>{const variable=row.dataset.token;const token=tokenByVariable(variable);const text=row.querySelector('.token-value');const picker=row.querySelector('.colour-picker');const mode=row.querySelector('.token-mode');const reset=row.querySelector('.token-reset');const syncState=()=>{const overridden=Object.prototype.hasOwnProperty.call(currentFlavour?.overrides||{},variable);row.classList.toggle('custom',overridden);if(mode){mode.textContent=overridden?'Override':'Initial';mode.classList.toggle('override',overridden);mode.classList.toggle('initial',!overridden)}if(reset)reset.classList.toggle('is-hidden',!overridden)};text.oninput=()=>{setLocalOverride(variable,text.value);syncState();if(picker&&validHex(text.value)){picker.value=text.value;row.querySelector('.swatch').style.background=text.value}if(currentStep===3)updateTypeSpecimen()};if(picker)picker.oninput=()=>{text.value=picker.value;row.querySelector('.swatch').style.background=picker.value;text.dispatchEvent(new Event('input'))};if(reset)reset.onclick=()=>{delete currentFlavour.overrides[variable];text.value=String(initialValue(token));$('#saveState').textContent='Unsaved changes';syncState();if(picker)row.querySelector('.swatch').style.background='';if(currentStep===3)updateTypeSpecimen()};syncState()});root.querySelectorAll('[data-reset-foundation]').forEach(button=>button.onclick=async()=>{const name=button.dataset.resetFoundation;const ok=await confirmDialog(`Reset all ${name} overrides to Initial?`,{title:`Reset ${titleCase(name)}?`,detail:'The Flavour will inherit these values from Core again.',confirmLabel:'Reset overrides',cancelLabel:'Keep changes',tone:'danger'});if(!ok)return;for(const token of tokensForFoundation(name))delete currentFlavour.overrides[token.cssVariable];$('#saveState').textContent='Unsaved changes';renderBuilder()})}

function updateTypeSpecimen(){const specimen=$('#typeSpecimen');if(!specimen)return;const tokens=tokensForFoundation('typography');const family=tokens.find(t=>t.cssVariable.includes('font-family-primary'));const secondary=tokens.find(t=>t.cssVariable.includes('font-family-secondary'));const weight=tokens.find(t=>t.cssVariable.includes('weight-')&&String(currentValue(t)).match(/^[5-9]00$/));const fam=family?currentValue(family):'inherit';const sec=secondary?currentValue(secondary):fam;specimen.style.setProperty('--specimen-family',fam);specimen.style.setProperty('--specimen-secondary',sec);if(weight)specimen.style.setProperty('--specimen-weight',currentValue(weight))}

function renderStepContent(){const root=$('#stepContent');const [title,desc]=steps[currentStep-1];$('#assistantContext').textContent=`Context: ${currentFlavour?.displayName||'New Flavour'} · ${title}${currentStep===2?` · ${colourStageMeta().title}`:currentStep===3?` · ${typographyStageMeta().title}`:''}`;if(currentStep===1){root.innerHTML=`<div class="step-head"><div><div class="eyebrow">01 · Identity</div><h2>Give the Flavour a clear identity.</h2><p>Name the design baseline and capture enough intent to guide later decisions.</p></div><span class="step-status">${currentFlavour?.isNew?'Not created':'Canonical'}</span></div><div class="form-grid"><div class="field"><label>Display name</label><input id="flavourName" value="${escapeHtml(currentFlavour?.displayName||'')}" placeholder="e.g. Wallwood"><span class="help">Human-facing name used in Studio and Figma provenance.</span></div><div class="field"><label>Canonical id</label><div class="id-preview" id="idPreview">${escapeHtml(currentFlavour?.id||'generated-from-name')}</div><span class="help">Permanent after creation. Lowercase kebab-case.</span></div><div class="field full"><label>Description</label><textarea id="flavourDescription" placeholder="What should this Flavour feel like?">${escapeHtml(currentFlavour?.description||'')}</textarea></div><div class="field full"><label>Design notes</label><textarea id="flavourNotes" placeholder="Constraints, references or decisions worth keeping with the Flavour.">${escapeHtml(currentFlavour?.notes||'')}</textarea></div></div>`;const name=$('#flavourName');if(currentFlavour?.isNew)name.oninput=()=>{$('#idPreview').textContent=slug(name.value)||'generated-from-name'};return}
 if(currentStep===2){const c=colourCompletion(currentFlavour?.overrides||{});root.innerHTML=`<div class="step-head"><div><div class="eyebrow">02 · Colour</div><h2>Build the Flavour palette.</h2><p>Choose source colours first, then let BufferCore rules + Local AI assign those Primitives to Light and Dark Semantic jobs.</p></div><span class="step-status">${c.complete}/${c.total} sources</span></div>`;renderColourEditor(root);return}
 if(currentStep===3){const c=typographyState?.completion||{};root.innerHTML=`<div class="step-head"><div><div class="eyebrow">03 · Typography</div><h2>Build the typographic system.</h2><p>Define Primitive type material first. BufferCore&#39;s Semantic role wiring is inherited automatically; refine only the mappings this Flavour genuinely needs to change.</p></div><span class="step-status">${c.complete?'Roles complete':`${tokensForFoundation('typography').filter(isOverridden).length} overrides`}</span></div>`;renderTypographyEditor(root);return}
 if(currentStep===4){root.innerHTML=`<div class="step-head"><div><div class="eyebrow">04 · Shape</div><h2>Define the physical character.</h2><p>Work through corner language, border weight and stroke material as related design decisions. Core remains the baseline until this Flavour deliberately overrides it.</p></div><span class="step-status">${stepOverrideCount(4)} overrides</span></div>`;renderGuidedFoundationEditor(root,{foundations:['radius','borders','stroke'],titles:{radius:'Radius',borders:'Borders',stroke:'Stroke'},copy:{radius:'Set how sharp or soft the system feels. Start here before tuning line weight.',borders:'Tune border widths as structural material rather than component-specific styling.',stroke:'Control stroke weight independently for icons, decoration and authored graphics.'},preview:shapePreview});return}
 if(currentStep===5){root.innerHTML=`<div class="step-head"><div><div class="eyebrow">05 · Spacing & Scale</div><h2>Set density, proportion and content rhythm.</h2><p>Shape the overall density first, then object scale and finally content containment. Only intentional differences are stored in the Flavour.</p></div><span class="step-status">${stepOverrideCount(5)} overrides</span></div>`;renderGuidedFoundationEditor(root,{foundations:['spacing','sizing','containers'],titles:{spacing:'Spacing rhythm',sizing:'Sizing scale',containers:'Containers'},copy:{spacing:'Establish the rhythm between content, controls and sections.',sizing:'Tune the reusable size material without coupling it to particular components.',containers:'Adjust content-width material only when the Flavour genuinely needs a different spatial character.'},preview:scalePreview});return}
 if(currentStep===6){root.innerHTML=`<div class="step-head"><div><div class="eyebrow">06 · Depth</div><h2>Shape elevation and atmospheric effects.</h2><p>Review shadows as a family, then supporting effects. AI can help judge softness, separation and overall character without inventing new semantic roles.</p></div><span class="step-status">${stepOverrideCount(6)} overrides</span></div>`;renderGuidedFoundationEditor(root,{foundations:['shadows','effects'],titles:{shadows:'Shadow language',effects:'Effects'},copy:{shadows:'Keep Soft, Medium and Strong elevation related so surfaces read as one system.',effects:'Use blur and supporting effects sparingly to reinforce—not replace—the depth hierarchy.'},preview:depthPreview});return}
 if(currentStep===7){root.innerHTML=`<div class="step-head"><div><div class="eyebrow">07 · Motion</div><h2>Set the interaction tempo.</h2><p>Duration and easing remain Primitive material. Core semantic motion roles stay inherited unless we later make a deliberate contract-level decision.</p></div><span class="step-status">${stepOverrideCount(7)} overrides</span></div>`;renderGuidedFoundationEditor(root,{foundations:['motion'],titles:{motion:'Duration & easing'},copy:{motion:'Tune pace and easing together. Ask AI for directional refinement such as snappier feedback or calmer entrances.'},preview:motionPreview});wireMotionPreview();return}
 if(currentStep===8){const count=Object.keys(currentFlavour?.overrides||{}).length;const repo=latest?.repositories?.flavours;root.innerHTML=`<div class="step-head"><div><div class="eyebrow">08 · Review</div><h2>Review and finish the Flavour.</h2><p>Confirm the override footprint, validate it against the live Primitive catalogue, then prepare the resolved Figma manifest.</p></div><span class="step-status">${count} overrides</span></div><div class="review-summary"><div class="review-stat"><b>${count}</b><span>Primitive overrides</span></div><div class="review-stat"><b>${Object.keys(latest?.flavours?.find(f=>f.id===currentFlavour?.id)?.foundationCounts||{}).length}</b><span>Foundations customised</span></div><div class="review-stat"><b>${repo?.dirty?'Uncommitted':'Clean'}</b><span>Flavours repository</span></div></div><div class="decision-grid">${decisionCards(['colour','typography','radius','borders','stroke','spacing','sizing','containers','shadows','effects','motion'])}</div><section class="completion-panel"><div><div class="eyebrow">Completion</div><h3>Validate → build → commit → pull in Figma</h3><p>Studio writes only the canonical Flavour. Building resolves Core + this Flavour and generates the Figma manifest without creating another source of truth.</p></div><div class="completion-actions"><button class="secondary" id="reviewValidate">Validate Flavour</button><button class="secondary" id="reviewBuild">Build for Figma</button><button class="primary" id="reviewCommit">Commit + push Flavour</button></div><pre class="review-output" id="reviewOutput">Ready to validate.</pre></section>`;wireReviewActions();return}
 const ids=stepFoundations[currentStep]||[];root.innerHTML=`<div class="step-head"><div><div class="eyebrow">${String(currentStep).padStart(2,'0')} · ${escapeHtml(title)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(desc)}. This step is scaffolded against the live Engine primitive catalogue.</p></div><span class="step-status">Wizard foundation</span></div><div class="decision-grid">${decisionCards(ids)}</div><div class="coming">The visual editor for this step comes in the next Studio batch. Existing overrides are preserved; Studio never edits semantic values.</div>`}


function formatReview(review){
 const issues=review?.issues||[];
 const foundations=Object.entries(review?.foundationCounts||{}).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Initial only';
 return `${review?.ok?'Valid':'Needs attention'}\n${review?.overrideCount||0} primitive overrides\n${foundations}${issues.length?`\n\n${issues.map(i=>`[${i.level}] ${i.message}`).join('\n')}`:''}`;
}

function wireReviewActions(){
 $('#reviewValidate')?.addEventListener('click',async()=>{
   const out=$('#reviewOutput');out.textContent='Validating…';
   try{await saveCurrent();const d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/review`);out.textContent=formatReview(d.review)}catch(e){out.textContent=e.message}
 });
 $('#reviewBuild')?.addEventListener('click',async()=>{
   const out=$('#reviewOutput');out.textContent='Saving and building resolved Engine + Figma state…';
   try{await saveCurrent();const d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/build-figma`,{method:'POST',body:'{}'});latest=d.status;renderAll(latest);out.textContent=`${formatReview(d.review)}\n\nFigma manifest built successfully.\nUse the Figma plugin Repository flow to pull/inspect/apply this Flavour.`}catch(e){out.textContent=e.message}
 });
 $('#reviewCommit')?.addEventListener('click',async()=>{
   const out=$('#reviewOutput');
   try{await saveCurrent();const d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/review`);if(!d.review.ok){out.textContent=formatReview(d.review);return}const message=await promptDialog('Enter the Git commit message for this Flavour.',{title:'Commit and push Flavour',label:'Commit message',value:`Add ${currentFlavour.displayName} Flavour`,confirmLabel:'Commit & push',cancelLabel:'Cancel'});if(!message)return;out.textContent='Committing and pushing BufferCore-Flavours…';const pushed=await api('/api/commit-push',{method:'POST',body:JSON.stringify({repository:'flavours',message})});latest=pushed.status;renderAll(latest);out.textContent='Committed and pushed.\nNow open the Figma plugin, choose this Flavour, then Pull + build → Inspect → Apply.'}catch(e){out.textContent=e.message}
 });
}

function assistantPlaceholder(){const prompts={1:'Ask about naming, design intent or what this Flavour should communicate.',2:`e.g. ${currentColourStage===1?'Help me choose three distinct Identity source colours.':currentColourStage===2?'Make the Ground colours support a warm Canvas system.':currentColourStage===3?'Make Neutral 50 slightly warmer without becoming beige.':currentColourStage===4?'Check whether these Status colours are distinct enough.':currentColourStage===5?'Review interaction colours for clarity and inverse contexts.':currentColourStage===6?'Review the complete Primitive palette before Semantic generation.':currentColourStage===7?'Explain the Light Semantic choices and hierarchy.':currentColourStage===8?'Explain the Dark Semantic choices and hierarchy.':'Review the complete Primitive + Semantic colour system.'}`,3:'e.g. Increase hierarchy while keeping body copy comfortable.',4:'e.g. Make the shape language softer without making it playful.',5:'e.g. Make the system feel more spacious while preserving a sensible scale.',6:'e.g. Make the depth feel softer and more premium.',7:'e.g. Make interaction motion snappier but keep entrances calm.',8:'Ask for a review of consistency, trade-offs or anything worth revisiting.'};return prompts[currentStep]||'Ask about this Flavour.'}
function renderAssistant(){const body=$('.assistant-body');const compose=$('.assistant-compose');const models=aiState.models||[];const saved=currentFlavour&&!currentFlavour.isNew;const stepAllowsProposals=Boolean((stepFoundations[currentStep]||[]).length);const conversations=aiHistory.map(item=>`<div class="assistant-turn ${item.role==='user'?'user':'assistant'}"><span>${item.role==='user'?'You':'Assistant'}</span><p>${escapeHtml(item.content)}</p></div>`).join('');body.innerHTML=`<div class="assistant-message"><strong>${aiState.available?'Shared Local AI ready':'Shared Local AI'}</strong><p>${aiState.checked?(aiState.available?`Connected through ${escapeHtml(aiState.source==='shared-registry'?'C:\\LocalAI\\registry.json':'configured local endpoint')}. ${stepAllowsProposals?'It can suggest Primitive changes here; nothing changes until you approve it.':'This step is guidance-only; the assistant will not alter tokens.'}`:'No shared local model server detected. The wizard remains fully usable manually.'):'Checking shared Local AI…'}</p></div><div id="aiConversation">${conversations}</div>`;compose.innerHTML=`<div class="assistant-model"><select id="aiModel" ${!aiState.available?'disabled':''}>${models.map(m=>`<option value="${escapeHtml(m)}" ${m===aiState.model?'selected':''}>${escapeHtml(m)}</option>`).join('')}</select><button class="ghost" id="refreshAi" type="button">↻</button></div><textarea id="aiPrompt" ${!aiState.available?'disabled':''} placeholder="${escapeHtml(assistantPlaceholder())}"></textarea><button id="sendAi" ${!aiState.available?'disabled':''}>Ask</button><span>${aiState.available?(saved?'Context includes the saved Flavour and current wizard step.':'You can ask for guidance now; save the Flavour before applying token proposals.'):`Looking for shared Local AI through ${escapeHtml(latest?.ai?.source||'C:\\LocalAI\\registry.json')}.`}</span>`;$('#refreshAi').onclick=loadAiStatus;$('#aiModel')?.addEventListener('change',async e=>{aiState.model=e.target.value;try{await api('/api/ai/model',{method:'POST',body:JSON.stringify({model:aiState.model})})}catch{}});$('#sendAi')?.addEventListener('click',askAi);if(aiProposal)renderAiProposal()}
function renderAiProposal(){const host=$('#aiConversation');if(!host||!aiProposal)return;host.innerHTML=`<div class="assistant-reply">${escapeHtml(aiProposal.reply||'Proposal ready.')}</div>${aiProposal.proposals?.length?`<div class="proposal-list">${aiProposal.proposals.map((p,i)=>`<label class="proposal"><input type="checkbox" data-proposal="${i}" checked><span><code>${escapeHtml(p.cssVariable)}</code><b>${escapeHtml(p.value)}</b><small>${escapeHtml(p.reason||'')}</small></span></label>`).join('')}</div><button class="primary proposal-apply" id="applyAi">Apply selected proposals</button>`:'<div class="assistant-message"><p>No value changes proposed.</p></div>'}`;$('#applyAi')?.addEventListener('click',()=>{host.querySelectorAll('[data-proposal]:checked').forEach(input=>{const p=aiProposal.proposals[Number(input.dataset.proposal)];if(currentStep===2&&normalizeHex(p.value)){for(const [variable,value] of Object.entries(generatedOverrides(p.cssVariable,p.value,colourAllTokenNames())))currentFlavour.overrides[variable]=value;$('#saveState').textContent='Unsaved changes'}else setLocalOverride(p.cssVariable,p.value)});aiProposal=null;renderBuilder()})}

async function loadAiStatus(){aiState={...aiState,checked:false};renderAssistant();try{const d=await api('/api/ai/status');aiState={available:d.available,models:d.models||[],model:d.model||d.models?.[0]||null,checked:true,source:d.source,registryPath:d.registryPath,modelStore:d.modelStore,appRegistered:d.appRegistered}}catch{aiState={available:false,models:[],model:null,checked:true}}renderAssistant()}
async function askAi(){const prompt=$('#aiPrompt')?.value.trim();if(!prompt)return;const send=$('#sendAi');send.disabled=true;send.textContent='Thinking…';aiHistory.push({role:'user',content:prompt});try{const d=await api('/api/ai/assist',{method:'POST',body:JSON.stringify({step:steps[currentStep-1][0],flavourId:currentFlavour.isNew?null:currentFlavour.id,flavour:currentFlavour.isNew?currentFlavour:null,message:prompt,history:aiHistory.slice(-10),model:$('#aiModel')?.value||aiState.model})});aiProposal=d;aiState.model=d.model||aiState.model;if(d.reply)aiHistory.push({role:'assistant',content:d.reply});aiHistory=aiHistory.slice(-12);renderAssistant()}catch(e){aiProposal={reply:e.message,proposals:[]};aiHistory.push({role:'assistant',content:e.message});aiHistory=aiHistory.slice(-12);renderAssistant()}}

function renderBuilder(){if(!currentFlavour)return;$('#builderEyebrow').textContent=currentFlavour.isNew?'New Flavour':currentFlavour.id;$('#builderTitle').textContent=currentFlavour.displayName||'Create a Flavour';$('#duplicateFlavour').classList.toggle('hidden',!!currentFlavour.isNew);$('#deleteFlavour').classList.toggle('hidden',!!currentFlavour.isNew);if(!['Unsaved changes','Saving…'].includes($('#saveState').textContent))$('#saveState').textContent=currentFlavour.isNew?'Not saved':'Saved';renderSteps();renderStepContent();renderJourney();renderAssistant()}

async function saveCurrent(){if(!currentFlavour)return;try{$('#saveState').textContent='Saving…';let d;if(currentFlavour.isNew){const name=$('#flavourName')?.value??currentFlavour.displayName;const payload={displayName:name,id:slug(name),description:$('#flavourDescription')?.value??currentFlavour.description,notes:$('#flavourNotes')?.value??currentFlavour.notes};d=await api('/api/flavours',{method:'POST',body:JSON.stringify(payload)})}else if(currentStep===1){const payload={displayName:$('#flavourName')?.value??currentFlavour.displayName,description:$('#flavourDescription')?.value??currentFlavour.description,notes:$('#flavourNotes')?.value??currentFlavour.notes};d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}`,{method:'PATCH',body:JSON.stringify(payload)})}else{d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/overrides`,{method:'PATCH',body:JSON.stringify({overrides:currentFlavour.overrides||{}})})}currentFlavour={...d.flavour,isNew:false};latest=d.status;localStorage.setItem('buffercore.studio.flavourId',currentFlavour.id);renderAll(latest);renderBuilder();$('#saveState').textContent='Saved'}catch(e){$('#saveState').textContent=e.message}}

$('#newFlavour').onclick=startNew;$('#backToFlavours').onclick=()=>{setView('flavours');currentFlavour=null};$('#saveFlavour').onclick=saveCurrent;$('#duplicateFlavour').onclick=async()=>{const name=await promptDialog('Choose a name for the duplicated Flavour.',{title:'Duplicate Flavour',label:'Flavour name',value:`${currentFlavour.displayName} Copy`,confirmLabel:'Duplicate',cancelLabel:'Cancel'});if(!name)return;try{const d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}/duplicate`,{method:'POST',body:JSON.stringify({displayName:name})});latest=d.status;renderAll(latest);studioToast('Flavour duplicated.',{title:name});await openFlavour(d.flavour.id)}catch(e){await errorDialog(e,{title:'Could not duplicate Flavour'})}};$('#deleteFlavour').onclick=async()=>{const ok=await confirmDialog(`Delete ${currentFlavour.displayName}?`,{title:'Delete Flavour?',detail:'This permanently removes its Flavour folder. This action cannot be undone from Studio.',confirmLabel:'Delete Flavour',cancelLabel:'Keep Flavour',tone:'danger'});if(!ok)return;try{const d=await api(`/api/flavours/${encodeURIComponent(currentFlavour.id)}`,{method:'DELETE'});latest=d.status;renderAll(latest);currentFlavour=null;setView('flavours');studioToast('Flavour deleted.',{tone:'info'})}catch(e){await errorDialog(e,{title:'Could not delete Flavour'})}};

$('#closeAssistant').onclick=()=>{$('#assistant').classList.add('hidden');$('#openAssistant').classList.remove('hidden')};$('#openAssistant').onclick=()=>{$('#assistant').classList.remove('hidden');$('#openAssistant').classList.add('hidden')};

async function operation(fn){for(const b of $$('button'))b.disabled=true;$('#statusPill').textContent='Working…';try{const d=await fn();if(d.status)renderAll(d.status);$('#log').textContent=[d.stdout,d.engine,d.figma,d.stderr].filter(Boolean).join('\n\n')||'Complete.'}catch(e){$('#log').textContent=e.message;await refresh()}finally{for(const b of $$('button'))b.disabled=false}}
$('#refresh').onclick=refresh;$('#validate').onclick=()=>operation(()=>api('/api/validate',{method:'POST',body:'{}'}));$('#pull').onclick=()=>operation(()=>api('/api/pull-build',{method:'POST',body:JSON.stringify({flavour:$('#flavour').value||null})}));$('#commitPush').onclick=()=>operation(()=>api('/api/commit-push',{method:'POST',body:JSON.stringify({repository:$('#commitRepo').value,message:$('#commitMessage').value})}));

await refresh();
loadAiStatus();
const remembered=localStorage.getItem('buffercore.studio.flavourId');
if(remembered&&latest?.flavours?.some(f=>f.id===remembered)){try{await openFlavour(remembered)}catch{localStorage.removeItem('buffercore.studio.flavourId')}}else{const initial=localStorage.getItem('buffercore.studio.view')||'flavours';if(['flavours','core','sync'].includes(initial))setView(initial)}
