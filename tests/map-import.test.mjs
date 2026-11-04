import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importMaps } from '../map-import.mjs';
import { encodeUnified, decodeUnified } from '../unified-workspace.mjs';
export const example=`p=[
1,0,8,11,6,0,
0,2,H,H,13,0,
15,0,0,3,4,0,

7,0,9,12,0,0,
0,0,H,H,14,0,
0,0,0,10,5,0,
]
e=[
1,2,3,4,5,6,
7,8,H,H,0,0,
0,0,0,0,0,0,

9,10,11,12,13,14,
15,0,H,H,0,0,
0,0,0,0,0,0,
]`;
test('provided 6x3 two-floor lists create both complete maps and default medium packs',()=>{
 const state=importMaps(example);
 assert.deepEqual(state.layers.map(l=>l?.size??0),[18,18,0]);
 assert.equal(state.placements.size,15); assert.equal(state.destination.size,15);
 assert.equal([...state.layers[0].values()].filter(c=>c.kind==='hole').length,2);
 assert.ok([...state.placements.values()].every(p=>p.id==='square-1'&&p.height===5));
 const pack=state.placements.get('4,2,0');
 assert.equal(pack.number,4);
 assert.equal(state.destination.get('3,0,0'),pack);
 Object.assign(pack,{id:'circle-2',shape:'circle',height:6});
 assert.equal(state.destination.get('3,0,0').number,4);
 assert.equal(decodeUnified(encodeUnified(state)).destination.get('3,0,0').id,'circle-2');
});
test('X, duplicate numbers, and special marks shared between maps',()=>{
 const state=importMaps('p=[\n1,1,X,H,\n]\ne=[\n1,1,X,H,\n]');
 assert.equal(state.layers[0].get('2,0').kind,'fixed');
 assert.equal(...state.placements.values());
 assert.ok([...state.placements.values()].every(p=>p.lying&&p.height===2&&p.length===6));
 assert.equal(state.destination.size,2);
});
test('invalid dimensions, unknown tokens, conflicting holes, missing packs and code are rejected',()=>{
 for(const text of ['p=[1,0]\ne=[1]', 'p=[1,0\n0]\ne=[1,0]', 'p=[1,H]\ne=[0,1]', 'p=[1,0]\ne=[2,0]', 'p=[evil()]\ne=[0]', 'p=[1]\np=[1]\ne=[1]'])assert.throws(()=>importMaps(text));
});
