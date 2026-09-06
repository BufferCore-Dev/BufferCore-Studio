export const TONE_AMOUNTS=[90,80,70,60,50,40,30,20,10];
export const SOURCE_GROUPS={
  identity:['--bc-color-identity-ramp-1','--bc-color-identity-ramp-2','--bc-color-identity-ramp-3'],
  ground:['--bc-color-ground-ramp-1','--bc-color-ground-ramp-2','--bc-color-ground-ramp-3'],
  neutral:['--bc-color-neutral-50'],
  status:['--bc-color-status-success','--bc-color-status-warning','--bc-color-status-error','--bc-color-status-info'],
  interaction:['--bc-color-interaction-link','--bc-color-interaction-link-inverse','--bc-color-interaction-link-visited','--bc-color-interaction-link-visited-inverse','--bc-color-interaction-focus','--bc-color-interaction-focus-inverse']
};

export function normalizeHex(value){const raw=String(value||'').trim().replace(/^#/,'').toLowerCase();return /^[0-9a-f]{6}$/.test(raw)?`#${raw}`:''}
const clamp=n=>Math.max(0,Math.min(255,Math.round(n)));
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const hx=n=>clamp(n).toString(16).padStart(2,'0');
function tint(base,amount){return'#'+rgb(base).map(v=>hx(v+((255-v)*amount))).join('')}
function shade(base,amount){return'#'+rgb(base).map(v=>hx(v*(1-amount))).join('')}

export function tones(base){const normal=normalizeHex(base);if(!normal)return[];return[
  ...TONE_AMOUNTS.map(amount=>({kind:'tint',amount,label:`T${amount}`,value:tint(normal,amount/100),suffix:`tint-${amount}`})),
  {kind:'base',amount:0,label:'Base',value:normal,suffix:'base'},
  ...[10,20,30,40,50,60,70,80,90].map(amount=>({kind:'shade',amount,label:`S${amount}`,value:shade(normal,amount/100),suffix:`shade-${amount}`}))
]}

export function neutralScale(base='#808080'){const normal=normalizeHex(base)||'#808080';const out={};for(let step=0;step<=100;step+=5){out[`--bc-color-neutral-${step}`]=step===50?normal:step<50?tint(normal,(50-step)/50):shade(normal,(step-50)/50)}return out}

export function generatedFamily(baseToken,base){const normal=normalizeHex(base);if(!normal)return{};const out={[baseToken]:normal};for(const tone of tones(normal)){if(tone.kind==='base')continue;out[`${baseToken}-${tone.suffix}`]=tone.value}return out}

export function generatedOverrides(sourceToken,value,availableTokens=[]){const available=new Set(availableTokens);let generated={};if(sourceToken==='--bc-color-neutral-50')generated=neutralScale(value);else if(/^--bc-color-(?:identity-ramp-[123]|status-(?:success|warning|error|info))$/.test(sourceToken))generated=generatedFamily(sourceToken,value);else generated={[sourceToken]:normalizeHex(value)||String(value||'').trim()};return Object.fromEntries(Object.entries(generated).filter(([token])=>!available.size||available.has(token)))}

export function sourceTokens(){return Object.values(SOURCE_GROUPS).flat()}
export function completion(overrides={}){const required=sourceTokens();const complete=required.filter(token=>normalizeHex(overrides[token])).length;return{complete,total:required.length,missing:required.filter(token=>!normalizeHex(overrides[token]))}}
