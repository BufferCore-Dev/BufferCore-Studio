const FAMILY_KEYS = ['neutral','primary','secondary','accent','success','warning','error','info'];

function hex(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  const short = raw.match(/^#([0-9a-f]{3})$/);
  return short ? `#${short[1].split('').map(c => c + c).join('')}` : null;
}
function rgb(value){const h=hex(value);if(!h)return null;return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function linearChannel(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
export function luminance(value){const c=rgb(value);if(!c)return null;const [r,g,b]=c.map(linearChannel);return .2126*r+.7152*g+.0722*b}
export function contrastRatio(a,b){const A=luminance(a),B=luminance(b);if(A===null||B===null)return null;return (Math.max(A,B)+.05)/(Math.min(A,B)+.05)}
export function oklab(value){const c=rgb(value);if(!c)return null;const [r,g,b]=c.map(linearChannel);const l=.4122214708*r+.5363325363*g+.0514459929*b;const m=.2119034982*r+.6806995451*g+.1073969566*b;const s=.0883024619*r+.2817188376*g+.6299787005*b;const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);return{L:.2104542553*l_+.793617785*m_-.0040720468*s_,a:1.9779984951*l_-2.428592205*m_+.4505937099*s_,b:.0259040371*l_+.7827717662*m_-.808675766*s_}}
export function oklch(value){const lab=oklab(value);if(!lab)return null;const C=Math.hypot(lab.a,lab.b);let h=C<1e-6?null:Math.atan2(lab.b,lab.a)*180/Math.PI;if(h!==null&&h<0)h+=360;return{L:lab.L,C,h}}
export function deltaE(a,b){const A=oklab(a),B=oklab(b);if(!A||!B)return null;return Math.hypot(A.L-B.L,A.a-B.a,A.b-B.b)*100}

function sourceBaseToken(source=''){
  if(source.startsWith('--bc-color-neutral-')) return '--bc-color-neutral-50';
  return source.replace(/-(?:tint|shade)-\d+$/,'');
}
function threshold(value){const n=parseFloat(String(value||'').replace(':1',''));return Number.isFinite(n)?n:null}
export function roleRank(name='',group=''){
  if(group==='Text'){if(/Muted/i.test(name))return 0;if(/Subtle/i.test(name))return 1;if(/Default/i.test(name))return 2;if(/Strong/i.test(name))return 3;return 2}
  if(group==='Fill'){if(/Subtle/i.test(name))return 0;if(/Soft/i.test(name))return 1;if(/Strong/i.test(name))return 3;if(/Bold/i.test(name))return 4;return 2}
  if(group==='Border'){if(/Subtle/i.test(name))return 0;if(/Strong/i.test(name))return 2;if(/Bold/i.test(name))return 3;return 1}
  if(group==='Surface')return /Strong$/i.test(name)?1:0;
  return 0;
}
export function familyForName(name='') { const lower=name.toLowerCase(); return FAMILY_KEYS.find(k=>lower.includes(k)) || 'general'; }
export function semanticBatchKey(group,name=''){
  const family=familyForName(name);const inverse=/Inverse/i.test(name)?'inverse':'normal';
  if(group==='Text')return `${family}-${inverse}`;
  if(group==='Fill'||group==='Border')return family;
  if(group==='Surface')return name.replace(/ Strong$/i,'');
  return group;
}

export function candidateEvidence(flavour,set,source,backgroundSource=null){
  const value=hex(flavour?.overrides?.[source]);if(!value)return null;
  const baseSource=sourceBaseToken(source);const baseValue=hex(flavour?.overrides?.[baseSource])||value;
  const metric=oklch(value),base=oklch(baseValue);const background=backgroundSource?hex(flavour?.overrides?.[backgroundSource]):null;
  const ratio=background?contrastRatio(value,background):null;
  const minimum=threshold(set.accessibilityMinimum),recommended=threshold(set.accessibilityRecommended);
  const perceptual=metric&&base?{
    lightness:metric.L,chroma:metric.C,hue:metric.h,
    baseLightness:base.L,baseChroma:base.C,
    chromaRetention:base.C>.008?metric.C/base.C:1,
    hueDrift:metric.h===null||base.h===null?0:Math.min(Math.abs(metric.h-base.h),360-Math.abs(metric.h-base.h)),
    baseDistance:deltaE(value,baseValue),
    distanceWhite:deltaE(value,'#ffffff'),distanceBlack:deltaE(value,'#000000'),
    backgroundDistance:background?deltaE(value,background):null
  }:null;
  return {source,value,contrast:ratio,meetsMinimum:minimum===null||ratio===null?null:ratio>=minimum,meetsRecommended:recommended===null||ratio===null?null:ratio>=recommended,perceptual};
}

function textTarget(set){const min=threshold(set.accessibilityMinimum)||0,rec=threshold(set.accessibilityRecommended)||min;const n=set.name||'';if(/Muted/i.test(n))return min+.15;if(/Subtle/i.test(n))return Math.max(min+.9,min+(rec-min)*.58);if(/Default/i.test(n))return Math.max(11,rec+4);if(isChromaticTextStrong(set))return rec;if(/Strong/i.test(n))return Math.max(min+.35,rec);return rec}
function siblingMinimum(set){
  const configured=Number(set?.selection?.visual?.minimumSiblingDeltaE);
  if(Number.isFinite(configured))return configured;
  if(set?.group==='Surface')return 10;
  if(set?.group==='Border')return 5;
  if(set?.group==='Fill')return 4;
  if(set?.group==='Text')return 4;
  return 0;
}
function siblingPreferred(set){
  const configured=Number(set?.selection?.visual?.preferredSiblingDeltaE);
  return Number.isFinite(configured)?configured:siblingMinimum(set);
}
function isChromaticTextStrong(set){
  return set?.group==='Text'&&/ Strong(?: Inverse)?$/i.test(set?.name||'')&&familyForName(set?.name)!=='neutral';
}

export function familyPreservingDesignCandidates(set,candidates=[]){
  if(!isChromaticTextStrong(set))return candidates;
  const passing=candidates.filter(c=>c.meetsMinimum!==false&&c.perceptual);
  if(!passing.length)return candidates;

  // Quality frontier: the nearest valid tone establishes the family-identity
  // baseline, but stronger tones remain viable when they buy real semantic
  // strength / contrast without materially damaging that identity.
  const anchor=[...passing].sort((a,b)=>{
    const Ad=a.perceptual?.baseDistance??Infinity,Bd=b.perceptual?.baseDistance??Infinity;
    if(Ad!==Bd)return Ad-Bd;
    return (b.perceptual?.chromaRetention??0)-(a.perceptual?.chromaRetention??0);
  })[0];

  const anchorRetention=anchor.perceptual?.chromaRetention??1;
  const identityFloor=Math.min(anchorRetention,Math.max(.55,anchorRetention-.25));
  const anchorHue=anchor.perceptual?.hueDrift??0;
  const anchorEndpoint=Math.min(anchor.perceptual?.distanceWhite??99,anchor.perceptual?.distanceBlack??99);

  const eligible=passing.filter(candidate=>{
    if(candidate===anchor)return true;
    const p=candidate.perceptual;
    const endpoint=Math.min(p.distanceWhite??99,p.distanceBlack??99);
    if((p.chromaRetention??0)<identityFloor)return false;
    if((p.hueDrift??0)>Math.max(14,anchorHue+12))return false;
    if(endpoint<Math.max(8,anchorEndpoint-14))return false;
    return true;
  });

  const rec=threshold(set.accessibilityRecommended)||7;
  const utility=c=>({
    contrast:Math.min(c.contrast??0,rec),
    chroma:c.perceptual?.chromaRetention??0,
    hue:-(c.perceptual?.hueDrift??0),
    endpoint:Math.min(c.perceptual?.distanceWhite??0,c.perceptual?.distanceBlack??0),
    strength:Math.min(c.perceptual?.baseDistance??0,26)
  });
  const eps={contrast:.12,chroma:.025,hue:.75,endpoint:.8,strength:1.25};
  const dominates=(a,b)=>{
    const A=utility(a),B=utility(b);
    const noWorse=
      A.contrast>=B.contrast-eps.contrast &&
      A.chroma>=B.chroma-eps.chroma &&
      A.hue>=B.hue-eps.hue &&
      A.endpoint>=B.endpoint-eps.endpoint &&
      A.strength>=B.strength-eps.strength;
    const better=
      A.contrast>B.contrast+eps.contrast ||
      A.chroma>B.chroma+eps.chroma ||
      A.hue>B.hue+eps.hue ||
      A.endpoint>B.endpoint+eps.endpoint ||
      A.strength>B.strength+eps.strength;
    return noWorse&&better;
  };

  const frontier=eligible.filter(candidate=>!eligible.some(other=>other!==candidate&&dominates(other,candidate)));
  return frontier.length?frontier:eligible.length?eligible:[anchor];
}
function visualPenalty(set,c){const p=c.perceptual;if(!p)return 0;let score=0;const chromatic=!c.source.startsWith('--bc-color-neutral-')&&/(identity-ramp|status-)/.test(c.source);
  if(chromatic&&p.chromaRetention<.16)score+=(.16-p.chromaRetention)*65;
  if(chromatic&&Math.min(p.distanceWhite??99,p.distanceBlack??99)<2.5)score+=9;
  if(set.group==='Text'&&typeof c.contrast==='number')score+=Math.abs(c.contrast-textTarget(set))*1.5;
  if(isChromaticTextStrong(set)&&typeof p.baseDistance==='number'){
    const preferred=siblingPreferred(set);
    if(p.baseDistance<preferred)score+=(preferred-p.baseDistance)*2.25;
    // Once the 4.5:1 hard floor is met, protect family personality before chasing 7:1.
    // Very dark/light endpoints can make vivid client colours technically excellent but visually generic.
    if(typeof p.chromaRetention==='number'&&p.chromaRetention<.55)score+=(.55-p.chromaRetention)*48;
    if(typeof p.hueDrift==='number'&&p.hueDrift>12)score+=(p.hueDrift-12)*.32;
    if(typeof p.baseDistance==='number'&&p.baseDistance<18)score+=(18-p.baseDistance)*.42;
    const endpointDistance=Math.min(p.distanceWhite??99,p.distanceBlack??99);
    if(endpointDistance<5)score+=(5-endpointDistance)*2.5;
  }
  if(set.group==='Fill'){const targets=set.mode==='light'?[.94,.86,.68,.46,.26]:[.12,.22,.38,.60,.78];score+=Math.abs(p.lightness-targets[Math.min(roleRank(set.name,set.group),4)])*8}
  if(set.group==='Border'&&typeof c.contrast==='number'){const rank=roleRank(set.name,set.group);const targets=[1.7,3.5,5.5,8];score+=Math.abs(c.contrast-targets[rank])*1.05}
  if(set.group==='Surface'){
    const strong=/Strong$/i.test(set.name);const wantsLight=(set.mode==='light'&&!strong)||(set.mode==='dark'&&strong);const endpoint=wantsLight?p.distanceWhite:p.distanceBlack;
    if(endpoint!==null&&endpoint<(wantsLight?4:18))score+=((wantsLight?4:18)-endpoint)*6;
    if(chromatic&&p.chromaRetention<(wantsLight?.08:.28))score+=((wantsLight?.08:.28)-p.chromaRetention)*110;
  }
  return score;
}
function hierarchyMetric(set,c){if(set.group==='Text')return c.contrast??0;const L=c.perceptual?.lightness??.5;return set.mode==='light'?1-L:L}
function candidateScore(set,c,rank,count){let score=visualPenalty(set,c);if(c.meetsMinimum===false)score+=500;
  if(c.meetsRecommended===true){
    const retention=c.perceptual?.chromaRetention??1;
    score-=isChromaticTextStrong(set)?(retention>=.55?.25:0):.8;
  }
  if(set.group==='Text')score+=Math.abs((c.contrast??0)-textTarget(set))*1.2;
  const metric=hierarchyMetric(set,c);const target=(rank+1)/(count+1);if(set.group!=='Text'&&set.group!=='Surface')score+=Math.abs(metric-target)*3;
  return score;
}

export function enrichCandidateSet(flavour,set){
  const background=set.accessibilityBackground||null;
  const candidateEvidenceList=(set.candidates||[]).map(source=>candidateEvidence(flavour,set,source,background)).filter(Boolean).map(c=>({...c,visualPenalty:visualPenalty(set,c)}));
  return {...set,candidateEvidence:candidateEvidenceList};
}

export function semanticSequenceOptions(sets,limit=5){
  if(!sets?.length)return[];
  const group=sets[0].group;const ordered=[...sets].sort((a,b)=>roleRank(a.name,a.group)-roleRank(b.name,b.group));
  let states=[{score:0,choices:[],used:new Set(),lastMetric:Number.NEGATIVE_INFINITY,allMinimumsMet:true}];
  for(let i=0;i<ordered.length;i++){
    const set=ordered[i];const rawCandidates=(set.candidateEvidence||[]).length?set.candidateEvidence:[];const candidates=familyPreservingDesignCandidates(set,rawCandidates);if(!candidates.length)return[];
    const next=[];
    for(const state of states){for(const c of candidates){if(state.used.has(c.source)&&ordered.length>1)continue;const metric=hierarchyMetric(set,c);if(state.lastMetric!==Number.NEGATIVE_INFINITY&&metric<=state.lastMetric+.005)continue;
      if(state.choices.length){const d=deltaE(state.choices[state.choices.length-1].value,c.value);const previousSet=ordered[i-1];const minDelta=Math.max(siblingMinimum(previousSet),siblingMinimum(set));if(d!==null&&d<minDelta)continue;}
      const used=new Set(state.used);used.add(c.source);next.push({score:state.score+candidateScore(set,c,i,ordered.length),choices:[...state.choices,{token:set.token,name:set.name,...c}],used,lastMetric:metric,allMinimumsMet:state.allMinimumsMet&&c.meetsMinimum!==false});}}
    if(!next.length){for(const state of states){for(const c of candidates){const metric=hierarchyMetric(set,c);if(state.lastMetric!==Number.NEGATIVE_INFINITY&&metric<=state.lastMetric)continue;const used=new Set(state.used);used.add(c.source);next.push({score:state.score+candidateScore(set,c,i,ordered.length)+25,choices:[...state.choices,{token:set.token,name:set.name,...c}],used,lastMetric:metric,allMinimumsMet:state.allMinimumsMet&&c.meetsMinimum!==false});}}}
    states=next.sort((a,b)=>a.score-b.score).slice(0,80);if(!states.length)return[];
  }
  const passing=states.filter(s=>s.allMinimumsMet);const pool=passing.length?passing:states;
  return pool.sort((a,b)=>a.score-b.score).slice(0,limit).map((s,i)=>{const ds=s.choices.slice(1).map((c,j)=>deltaE(s.choices[j].value,c.value)).filter(v=>v!==null);const chroma=s.choices.map(c=>c.perceptual?.chromaRetention??1);const endpoint=s.choices.filter(c=>Math.min(c.perceptual?.distanceWhite??99,c.perceptual?.distanceBlack??99)<2.5).length;return{id:`O${i+1}`,score:Number(s.score.toFixed(3)),allMinimumsMet:s.allMinimumsMet,choices:s.choices,visualQuality:{minSiblingDistance:ds.length?Number(Math.min(...ds).toFixed(1)):null,averageChromaRetention:Number((chroma.reduce((a,b)=>a+b,0)/chroma.length).toFixed(2)),endpointCollapses:endpoint}}});
}

export function buildSemanticDesignBatches(candidateSets){
  const groups=new Map();
  // Keep fixed siblings inside a family batch as anchors. The old Studio path
  // removed them before scoring, which let Strong/Bold choices bunch up against
  // a fixed Base even though the individual candidate was technically legal.
  for(const set of candidateSets.filter(s=>s.candidates?.length)){
    const key=`${set.group}:${semanticBatchKey(set.group,set.name)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(set);
  }
  let n=0;const batches=[];
  for(const [key,items] of groups){
    if(items.every(item=>item.fixed))continue;
    n++;const [group,...rest]=key.split(':');const label=rest.join(':');const adjustable=items.filter(item=>!item.fixed);const sequenceEligible=['Text','Fill','Border','Surface'].includes(group)&&items.length>1;let options=sequenceEligible?semanticSequenceOptions(items,5):[];
    if(!options.length&&adjustable.length===1&&items.length===1){const set=adjustable[0];options=(set.candidateEvidence||[]).map((c,i)=>({id:`O${i+1}`,score:Number(candidateScore(set,c,0,1).toFixed(3)),allMinimumsMet:c.meetsMinimum!==false,choices:[{token:set.token,name:set.name,...c}],visualQuality:{minSiblingDistance:null,averageChromaRetention:Number((c.perceptual?.chromaRetention??1).toFixed(2)),endpointCollapses:Math.min(c.perceptual?.distanceWhite??99,c.perceptual?.distanceBlack??99)<2.5?1:0}})).sort((a,b)=>a.score-b.score).slice(0,5);}
    if(!options.length){const choices=items.map(set=>set.candidateEvidence?.[0]).filter(Boolean).map((c,i)=>({token:items[i].token,name:items[i].name,...c}));if(choices.length)options=[{id:'O1',score:999,allMinimumsMet:choices.every(c=>c.meetsMinimum!==false),choices,visualQuality:{minSiblingDistance:null,averageChromaRetention:1,endpointCollapses:0}}]}
    batches.push({id:`B${n}`,group,label,items,adjustable,options});
  }
  return batches;
}

export function deterministicSemanticSelections(candidateSets,existing={},batchSelections=[]){
  const selected={};const batchChoice=new Map((batchSelections||[]).map(x=>[x.batchId,x.optionId]));const batches=buildSemanticDesignBatches(candidateSets);
  for(const set of candidateSets){if(set.fixed&&set.candidates?.[0])selected[set.token]=set.candidates[0]}
  for(const batch of batches){const requested=batchChoice.get(batch.id);const option=batch.options.find(o=>o.id===requested)||batch.options[0];if(!option)continue;for(const choice of option.choices)selected[choice.token]=choice.source}
  for(const set of candidateSets){const existingSource=existing?.[set.token];if(!selected[set.token]&&existingSource&&set.candidates.includes(existingSource))selected[set.token]=existingSource;if(!selected[set.token]&&set.candidates?.[0])selected[set.token]=set.candidates[0]}
  return{selected,batches};
}

export function semanticVisualFindings(flavour,mode,mappings,candidateSets){
  const setsByToken=new Map(candidateSets.map(s=>[s.token,s]));const findings=[];const mapped=(token)=>{const source=mappings?.[token];const value=source?hex(flavour?.overrides?.[source]):null;return source&&value?{source,value}:null};
  const groups=new Map();for(const set of candidateSets){const key=`${set.group}:${semanticBatchKey(set.group,set.name)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(set)}
  for(const [key,sets] of groups){if(!['Text','Fill','Border','Surface'].includes(sets[0]?.group)||sets.length<2)continue;const ordered=[...sets].sort((a,b)=>roleRank(a.name,a.group)-roleRank(b.name,b.group)).map(s=>({set:s,map:mapped(s.token)})).filter(x=>x.map);for(let i=1;i<ordered.length;i++){const d=deltaE(ordered[i-1].map.value,ordered[i].map.value);const threshold=Math.max(siblingMinimum(ordered[i-1].set),siblingMinimum(ordered[i].set));if(d!==null&&d<threshold)findings.push({kind:'hierarchy',severity:'warning',group:ordered[i].set.group,tokens:[ordered[i-1].set.token,ordered[i].set.token],issue:`${ordered[i-1].set.name} and ${ordered[i].set.name} are only ΔE ${d.toFixed(1)} apart.`,recommendation:`Increase perceptual separation to at least ΔE ${threshold.toFixed(1)} while keeping the semantic order and accessibility floor.`})}}
  for(const set of candidateSets){const m=mapped(set.token);if(!m||!/(identity-ramp|status-)/.test(m.source))continue;const base=hex(flavour?.overrides?.[sourceBaseToken(m.source)]);if(!base)continue;const b=oklch(base),v=oklch(m.value);if(b&&v&&b.C>.008){const retention=v.C/b.C;if(retention<.12)findings.push({kind:'character',severity:'warning',group:set.group,tokens:[set.token],issue:`${set.name} retains only ${Math.round(retention*100)}% of its source chroma.`,recommendation:'Prefer a nearby valid tone that keeps more family character instead of collapsing towards black/white.'})}}
  const collisionFamilies=[
    ['Fill Primary','Fill Secondary','Fill Accent'],
    ['Text Primary Strong','Text Secondary Strong','Text Accent Strong'],
    ['Text Primary Strong Inverse','Text Secondary Strong Inverse','Text Accent Strong Inverse'],
    ['Text Success Strong','Text Warning Strong','Text Error Strong','Text Info Strong'],
    ['Text Success Strong Inverse','Text Warning Strong Inverse','Text Error Strong Inverse','Text Info Strong Inverse']
  ];
  for(const likeForLike of collisionFamilies)for(let i=0;i<likeForLike.length;i++)for(let j=i+1;j<likeForLike.length;j++){const a=candidateSets.find(s=>s.name===likeForLike[i]),b=candidateSets.find(s=>s.name===likeForLike[j]);if(!a||!b)continue;const A=mapped(a.token),B=mapped(b.token);if(!A||!B)continue;const d=deltaE(A.value,B.value);if(d!==null&&d<6)findings.push({kind:'collision',severity:'warning',group:'Cross-family',tokens:[a.token,b.token],issue:`${a.name} and ${b.name} are visually converging (ΔE ${d.toFixed(1)}).`,recommendation:'Choose alternatives that preserve clearer family distinction.'})}
  return findings;
}
