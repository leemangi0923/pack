import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberCells, layerOffsets } from '../numbering.mjs';
import { prepareRoutes } from '../routes.mjs';
import { sceneModel } from '../scene-model.mjs';
test('each floor starts after the actual last number including gaps', () => {
 const lower=[{x:0,y:0},{x:3,y:3}];
 const upper=[{x:0,y:0},{x:1,y:0}];
 assert.deepEqual(layerOffsets([lower,upper,upper]),[0,16,18]);
 assert.deepEqual([...numberCells(upper,16).values()],[16,17]);
 assert.deepEqual(sceneModel(upper,new Map(),upper,16).map(c=>c.cellNumber),[16,17]);
 const pack={number:1};
 assert.equal(prepareRoutes('[[16,17]]',upper,new Map([['0,0',pack]]),16).result.get('1,0'),pack);
 assert.throws(()=>prepareRoutes('[[0,1]]',upper,new Map([['0,0',pack]]),16));
});
test('a complete 3 by 6 rectangle covers 0 through 17',()=>{
 const cells=Array.from({length:18},(_,i)=>({x:i%3,y:Math.floor(i/3)}));
 assert.deepEqual(layerOffsets([cells,cells,cells]),[0,18,36]);
});
test('round fixed packs block movement as square fixed packs do',()=>{
 const cells=[{x:0,y:0},{x:1,y:0,kind:'fixed-circle'},{x:2,y:0}];
 assert.throws(()=>prepareRoutes('[[0,2]]',cells,new Map([['0,0',{}]])),/X/);
});
