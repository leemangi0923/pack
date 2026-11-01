import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRoutes } from '../routes.mjs';
import { encodeWorkspace, decodeWorkspace } from '../autosave.mjs';
import { packs } from '../packs.mjs';
test('H permits transit but not the final destination', () => {
 const cells=[{x:0,y:0},{x:1,y:0,kind:'hole'},{x:2,y:0}];
 const start=new Map([['0,0',{number:1}]]);
 assert.equal(prepareRoutes('[[0,1,2]]',cells,start).result.size,1);
 assert.throws(()=>prepareRoutes('[[0,1]]',cells,start),/H/);
});
test('X blocks waypoints and crossing segments', () => {
 const cells=[{x:0,y:0},{x:1,y:0,kind:'fixed'},{x:2,y:0}];
 const start=new Map([['0,0',{number:1}]]);
 assert.throws(()=>prepareRoutes('[[0,1,2]]',cells,start),/X/);
 assert.throws(()=>prepareRoutes('[[0,2]]',cells,start),/X/);
});
test('special cells persist and cannot contain movable packs', () => {
 const state={selected:new Map([['0,0',{x:0,y:0,kind:'hole'}]]),placements:new Map(),destination:new Map(),mode:'drawing',showingDestination:false,placementComplete:false,numberingComplete:false,chosenPack:packs[0],routeText:'',numberDraft:null};
 assert.equal(decodeWorkspace(encodeWorkspace(state)).selected.get('0,0').kind,'hole');
 state.placements.set('0,0',{...packs[0],number:1});
 assert.throws(()=>decodeWorkspace(encodeWorkspace(state)));
});
