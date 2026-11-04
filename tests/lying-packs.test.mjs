import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLyingPairs } from '../lying-packs.mjs';
const map=entries=>new Map(entries.map(([key,number])=>[key,{number}]));
test('recognises horizontal and vertical pairs',()=>{
 const pairs=findLyingPairs(map([['0,0,0',1],['1,0,0',1],['4,0,0',2],['4,1,0',2]]));
 assert.deepEqual(pairs.map(p=>p.orientation),['x','y']);
});
test('separated duplicates, diagonals, and different floors remain independent',()=>{
 assert.deepEqual(findLyingPairs(map([['0,0,0',1],['2,0,0',1],['4,0,0',2],['5,1,0',2],['7,0,0',3],['7,0,1',3]])),[]);
});
test('only components of exactly two are treated as a single lying pack',()=>{
 assert.deepEqual(findLyingPairs(map([['0,0,0',1],['1,0,0',1],['2,0,0',1]])),[]);
});

import { importMaps } from '../map-import.mjs';
import { encodeUnified,decodeUnified } from '../unified-workspace.mjs';
import { prepareRoutes,routeState } from '../routes.mjs';
import { poseOf,uniquePacks } from '../lying-packs.mjs';
import { sceneModel } from '../scene-model.mjs';
test('import makes a single large lying pack and supports different goal orientations',()=>{
 const state=importMaps('p=[\n1,1,0,\n0,0,0,\n]\ne=[\n0,0,1,\n0,0,1,\n]');
 assert.equal(uniquePacks(state.placements).length,1);
 const pack=state.placements.get('0,0,0');
 assert.equal(pack,state.placements.get('1,0,0'));
 assert.equal(pack.id,'square-2');assert.equal(pack.height,2);assert.equal(pack.length,6);
 assert.equal(poseOf(state.placements,'0,0,0').axis,'x');
 assert.equal(poseOf(state.destination,'2,0,0').axis,'y');
 const restored=decodeUnified(encodeUnified(state));
 assert.equal(restored.destination.get('2,1,0'),restored.placements.get('0,0,0'));
 assert.equal(restored.placements.get('0,0,0'),restored.placements.get('1,0,0'));
 const local=new Map([...state.placements].map(([k,p])=>[k.split(',').slice(0,2).join(','),p]));
 const model=sceneModel([...state.layers[0].values()],local);
 assert.equal(model.filter(c=>c.pack).length,1);assert.equal(model[1].supportPack,pack);
});
test('lying routes reserve and move both cells, reject footprint collision and boundary overflow',()=>{
 const state=importMaps('p=[\n1,1,0,0,\n]\ne=[\n0,0,1,1,\n]');
 const cells=[...state.layers[0].values()].map(c=>({...c,level:0}));
 const plan=prepareRoutes('[[0,1,2]]',cells,state.placements);
 const after=routeState(state.placements,plan.steps,2);
 assert.equal(after.map.size,2);assert.equal(uniquePacks(after.map).length,1);
 assert.equal(after.map.get('2,0,0'),after.map.get('3,0,0'));
 assert.throws(()=>prepareRoutes('[[0,3]]',cells,state.placements),/두 칸/);
 const blocked=new Map(state.placements);blocked.set('3,0,0',{number:2,height:5,width:2});
 assert.throws(()=>prepareRoutes('[[0,2]]',cells,blocked),/부딪힘/);
});
