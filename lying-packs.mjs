// Adjacent duplicate labels form pairs only within the same floor.
export function findLyingPairs(placements) {
  const visited = new Set(), pairs = [];
  for (const [key, pack] of placements) {
    if (visited.has(key) || pack.number === null) continue;
    const component = [], pending = [key];
    visited.add(key);
    while (pending.length) {
      const current = pending.pop();
      component.push(current);
      const [x,y,level] = current.split(',').map(Number);
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const next = level === undefined ? `${x+dx},${y+dy}` : `${x+dx},${y+dy},${level}`;
        if (!visited.has(next) && placements.get(next)?.number === pack.number) {
          visited.add(next); pending.push(next);
        }
      }
    }
    if (component.length === 2) {
      component.sort((a,b)=>{const[ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);return ay-by||ax-bx});
      const [a,b] = component.map(k=>k.split(',').map(Number));
      pairs.push({ keys:component, orientation:a[1]===b[1]?'x':'y', number:pack.number });
    }
  }
  return pairs;
}

export const uniquePacks = map => [...new Set(map.values())];
export function poseOf(map, key) {
  const pack=map.get(key);
  if(!pack?.lying)return {anchor:key,keys:[key],axis:null};
  const keys=[...map].filter(([,p])=>p===pack).map(([k])=>k).sort((a,b)=>{const[ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);return ay-by||ax-bx});
  const [a,b]=keys.map(k=>k.split(',').map(Number));
  return {anchor:keys[0],keys,axis:b&&a[1]===b[1]?'x':'y'};
}
export function footprint(key,axis){
 const [x,y,l]=key.split(',').map(Number);
 return axis?[key,l===undefined?`${x+(axis==='x'?1:0)},${y+(axis==='y'?1:0)}`:`${x+(axis==='x'?1:0)},${y+(axis==='y'?1:0)},${l}`]:[key];
}
export function changePackType(pack,type){
 Object.assign(pack,type);
 if(pack.lying){pack.id=`${type.shape}-2`;pack.size='대';pack.name=`${type.shape==='square'?'사각팩':'원형팩'} 대 (눕힘)`;pack.height=2;pack.length=6;}
}
export function mergeLying(map){
 const replacements=new Map();
 for(const pair of findLyingPairs(map)){
  const first=map.get(pair.keys[0]),second=map.get(pair.keys[1]);
  first.lying=true;changePackType(first,first);map.set(pair.keys[1],first);replacements.set(second,first);
 }
 return replacements;
}
export function normalizeLayouts(source,goal){
 const replacements=mergeLying(source);
 for(const[key,p]of goal)if(replacements.has(p))goal.set(key,replacements.get(p));
 for(const p of uniquePacks(goal))if(p.lying){
  const pose=poseOf(goal,[...goal].find(([,v])=>v===p)[0]);
  const[a,b]=pose.keys.map(k=>k.split(',').map(Number));
  if(pose.keys.length!==2||a[2]!==b[2]||Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])!==1)for(const[k,v]of goal)if(v===p)goal.delete(k);
 }
}
