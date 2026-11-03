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

test('upper packs rest on the exact lower pack height for each column',()=>{
 const model=stackScene([
  {key:'a0',x:0,z:0,level:0,pack:{height:4}},
  {key:'b0',x:4,z:0,level:0,pack:{height:6}},
  {key:'a1',x:0,z:0,level:1,pack:{height:5}},
  {key:'b1',x:4,z:0,level:1,pack:{height:5}},
  {key:'a2',x:0,z:0,level:2,pack:{height:4}},
 ],[0,6,11]);
 assert.deepEqual(model.map(c=>c.elevation),[0,0,4,6,9]);
 const reference=new Map(model.map(c=>[c.key,c.elevation]));
 model[0].pack=null;
 stackScene(model,[0,6,11],reference);
 assert.equal(model[2].elevation,4,'removing support must not drop upper pack to floor 1');
});
