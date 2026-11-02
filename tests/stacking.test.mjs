import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackScene } from '../scene-model.mjs';
test('packs touch exactly with actual heights and no artificial floor gap',()=>{
 const model=stackScene([{x:0,z:0,pack:{height:4}},{x:0,z:0,pack:{height:5}},{x:0,z:0,pack:{height:6}}]);
 assert.deepEqual(model.map(c=>c.elevation),[0,4,9]);
});
test('empty lower positions do not suspend upper packs; fixed packs support them',()=>{
 const model=stackScene([{x:0,z:0,kind:'hole'},{x:4,z:0,kind:'fixed-circle'},{x:0,z:0,pack:{height:4}},{x:4,z:0,pack:{height:4}}]);
 assert.deepEqual(model.map(c=>c.elevation),[0,0,0,6]);
});
