import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swapFloors } from '../swap-floors.mjs';
import { importMaps } from '../map-import.mjs';
import { encodeUnified,decodeUnified } from '../unified-workspace.mjs';
test('swaps shapes and shared lying pack identities, preserves third floor, renumbers routes',()=>{
 const state=importMaps('p=[\n1,1,0,H,\n\n2,X,0,\n\n3,0,\n]\ne=[\n0,1,1,H,\n\n0,X,2,\n\n0,3,\n]');
 state.routeText='[[0,1,2],[4,6],[7,8]]';
 const swapped=swapFloors(state);
 assert.equal(swapped.layers[0].size,3);assert.equal(swapped.layers[1].size,4);
 assert.equal(swapped.layers[0].get('1,0').kind,'fixed');
 assert.equal(swapped.layers[1].get('3,0').kind,'hole');
 assert.equal(swapped.placements.get('0,0,1'),state.placements.get('0,0,0'));
 assert.equal(swapped.placements.get('0,0,1'),swapped.placements.get('1,0,1'));
 assert.equal(swapped.destination.get('1,0,1'),swapped.placements.get('0,0,1'));
 assert.deepEqual(JSON.parse(swapped.routeText),[[3,4,5],[0,2],[7,8]]);
 assert.deepEqual(decodeUnified(encodeUnified(swapped)).layers,swapped.layers);
 const back=swapFloors(swapped);
 assert.deepEqual(back.layers,state.layers);assert.deepEqual(JSON.parse(back.routeText),JSON.parse(state.routeText));
 assert.equal(state.layers[0].size,4);
});
test('unfinished route text is retained with a warning and missing second floor is rejected',()=>{
 const state=importMaps('p=[\n1,0,\n\n0,0,\n]\ne=[\n1,0,\n\n0,0,\n]');
 state.routeText='[[0,';const swapped=swapFloors(state);
 assert.equal(swapped.routeText,state.routeText);assert.ok(swapped.warning);
 state.layers[1]=null;assert.throws(()=>swapFloors(state));
});
