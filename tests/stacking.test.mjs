import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackScene,layerElevations } from '../scene-model.mjs';
test('layer heights use original floor heights and remain constant across empty columns',()=>{
 const elevations=layerElevations([{cells:[],placements:new Map([['a',{height:5}]])},{cells:[],placements:new Map([['b',{height:4}]])},{cells:[],placements:new Map()}]);
 assert.deepEqual(elevations,[0,5,9]);
 const model=stackScene([{x:0,z:0,level:0},{x:4,z:0,level:1,pack:{height:4}},{x:8,z:0,level:1,pack:{height:4}},{x:0,z:0,level:2}],elevations);
 assert.deepEqual(model.map(c=>c.elevation),[0,5,5,9]);
});
test('empty lower floors still retain a nonzero upper-floor elevation',()=>{
 assert.deepEqual(layerElevations([0,1,2].map(()=>({cells:[],placements:new Map()}))),[0,6,12]);
});
