import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeUnified,decodeUnified } from '../unified-workspace.mjs';
import { encodeWorkspace } from '../autosave.mjs';
import { prepareRoutes } from '../routes.mjs';
import { nextPackKey } from '../pack-order.mjs';
import { packs } from '../packs.mjs';
const cells=[{x:0,y:0},{x:1,y:0}];
function legacy(){const p={...packs[0],number:'○'};return encodeWorkspace({selected:new Map(cells.map(c=>[`${c.x},${c.y}`,c])),placements:new Map([['0,0',p]]),destination:new Map([['1,0',p]]),mode:'idle',showingDestination:false,placementComplete:true,numberingComplete:true,chosenPack:packs[0],routeText:'',numberDraft:null})}
test('legacy floors become one workspace and pack identities remain distinct',()=>{
 const state=decodeUnified(JSON.stringify({schema:2,activeLayer:1,layers:[legacy(),legacy(),null]}));
 assert.equal(state.placements.size,2);
 assert.notEqual(state.placements.get('0,0,0'),state.placements.get('0,0,1'));
 assert.equal(state.destination.get('1,0,1'),state.placements.get('0,0,1'));
 state.destination=new Map([['1,0,1',state.placements.get('0,0,0')],['1,0,0',state.placements.get('0,0,1')]]);
 const restored=decodeUnified(encodeUnified(state));
 assert.equal(restored.destination.get('1,0,1'),restored.placements.get('0,0,0'));
});
test('one route moves between floors and preserves pack identity',()=>{
 const p={...packs[0],number:1};
 const all=[...cells.map(c=>({...c,level:0})),...cells.map(c=>({...c,level:1}))];
 const plan=prepareRoutes('[[0,2,3],[3,1]]',all,new Map([['0,0,0',p]]));
 assert.equal(plan.result.get('1,0,0'),p);
 assert.equal(plan.steps[0].to,'0,0,1');
 assert.equal(plan.steps.length,3);
 assert.equal(nextPackKey(['1,0,1','0,0,0'],'0,0,0'),'1,0,1');
});
test('cross-floor H endpoints and fixed obstacles remain blocked',()=>{
 const p={...packs[0],number:1};
 const all=[{x:0,y:0,level:0},{x:0,y:0,level:1,kind:'hole'}];
 assert.throws(()=>prepareRoutes('[[0,1]]',all,new Map([['0,0,0',p]])),/H/);
 all[1].kind='fixed-circle';
 assert.throws(()=>prepareRoutes('[[0,1]]',all,new Map([['0,0,0',p]])),/X/);
});
