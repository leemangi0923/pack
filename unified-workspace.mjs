import { poseOf } from './lying-packs.mjs';
import { packs } from './packs.mjs';
import { decodeWorkspace, encodeWorkspace } from './autosave.mjs';
import { parsePackLabel } from './pack-labels.mjs';
export const placeKey = (key, level) => `${key},${level}`;
export function decodeUnified(text) {
 const data=JSON.parse(text);
 if(data.schema!==3){
  const layers=data.schema===2?data.layers:[text,null,null];
  if(!Array.isArray(layers)||layers.length!==3)throw Error('Invalid layers');
  const decoded=layers.map(layer=>layer===null?null:decodeWorkspace(layer));
  const activeLayer=data.schema===2?data.activeLayer:0;
  if(!Number.isInteger(activeLayer)||activeLayer<0||activeLayer>2||!decoded[activeLayer])throw Error('Invalid active layer');
  const source=new Map(),dest=new Map();
  decoded.forEach((layer,i)=>{if(layer){for(const[k,p]of layer.placements)source.set(placeKey(k,i),p);for(const[k,p]of layer.destination)dest.set(placeKey(k,i),p)}});
  const routes=[];
  decoded.forEach(layer=>{try{const r=JSON.parse(layer?.routeText);if(Array.isArray(r))routes.push(...r)}catch{}});
  const current=decoded[activeLayer];
  return {...current,activeLayer,layers:decoded.map(l=>l?.selected??null),placements:source,destination:dest,
   placementComplete:source.size>0,numberingComplete:source.size>0&&[...source.values()].every(p=>p.number!==null),
   routeText:routes.length?JSON.stringify(routes):current.routeText,
   numberDraft:current.numberDraft?{...current.numberDraft,key:placeKey(current.numberDraft.key,activeLayer)}:null};
 }
 const check=c=>{if(!c)throw Error('Invalid workspace')};
 check(Array.isArray(data.layers)&&data.layers.length===3&&Number.isInteger(data.activeLayer)&&data.activeLayer>=0&&data.activeLayer<3);
 const layers=data.layers.map(cells=>cells===null?null:decodeWorkspace(encodeWorkspace({selected:new Map(cells.map(c=>[`${c.x},${c.y}`,c])),placements:new Map(),destination:new Map(),mode:'drawing',showingDestination:false,placementComplete:false,numberingComplete:false,chosenPack:packs[0],routeText:'',numberDraft:null})).selected);
 check(layers[data.activeLayer]);
 const valid=k=>{const[x,y,l]=String(k).split(',').map(Number);return String(k)===`${x},${y},${l}`&&Number.isInteger(l)&&layers[l]?.has(`${x},${y}`)&&!layers[l].get(`${x},${y}`).kind};
 const source=new Map(),dest=new Map(),identities=[];
 check(Array.isArray(data.packs)&&Array.isArray(data.destination));
 for(const[k,id,number,lying,alias]of data.packs){const type=packs.find(p=>p.id===id);check(type&&valid(k)&&!source.has(k)&&(number===null||parsePackLabel(number)===number));check(lying===undefined||typeof lying==='boolean');const p=lying&&Number.isInteger(alias)&&alias<identities.length?identities[alias]:{...type,number,...(lying?{lying:true,height:2,length:6}: {})};check(p.id===id&&p.number===number&&!!p.lying===!!lying);source.set(k,p);identities.push(p)}
 const used=new Set();for(const[k,i]of data.destination){check(valid(k)&&!dest.has(k)&&Number.isInteger(i)&&identities[i]&&(!used.has(i)||identities[i].lying));used.add(i);dest.set(k,identities[i])}
 check(['drawing','idle','start','numbering','destination','destination-numbering','replace'].includes(data.mode)&&typeof data.routeText==='string'&&data.routeText.length<=1000000);
 check(typeof data.showingDestination==='boolean'&&typeof data.placementComplete==='boolean'&&typeof data.numberingComplete==='boolean');
 for(const map of [source,dest])for(const[k,p]of map)if(p.lying){const pose=poseOf(map,k),[a,b]=pose.keys.map(v=>v.split(',').map(Number));check(pose.keys.length===2&&a[2]===b[2]&&Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1);}
 const chosenPack=packs.find(p=>p.id===data.chosenPack);check(chosenPack);
 const numberDraft=data.numberDraft??null;if(numberDraft)check((data.showingDestination?dest:source).has(numberDraft.key)&&typeof numberDraft.value==='string'&&numberDraft.value.length<=6);
 return {...data,layers,placements:source,destination:dest,chosenPack,numberDraft};
}
export function encodeUnified(state){
 const source=[...state.placements],ids=new Map();source.forEach(([,p],i)=>{if(!ids.has(p))ids.set(p,i)});
 return JSON.stringify({...state,schema:3,layers:state.layers.map(l=>l?[...l.values()]:null),placements:undefined,
  packs:source.map(([k,p])=>p.lying?[k,p.id,p.number,true,ids.get(p)]:[k,p.id,p.number]),destination:[...state.destination].map(([k,p])=>[k,ids.get(p)]),chosenPack:state.chosenPack.id});
}
