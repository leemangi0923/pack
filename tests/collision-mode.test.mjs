import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRoutes,routeState } from '../routes.mjs';
const cells=[0,1,2,3].map(x=>({x,y:0}));
const moving={height:5,width:2,number:1},obstacle={height:6,width:2,number:2};
const start=new Map([['0,0',moving],['1,0',obstacle]]);
test('stop mode detects occupied waypoints and skipped-over packs',()=>{
 assert.throws(()=>prepareRoutes('[[0,1,2]]',cells,start),/부딪힘이 감지되었습니다/);
 assert.throws(()=>prepareRoutes('[[0,2]]',cells,start),/부딪힘이 감지되었습니다/);
});
test('climb preserves the obstacle and carries the traveller through intermediate occupied cells',()=>{
 const plan=prepareRoutes('[[0,1,2]]',cells,start,0,'climb');
 assert.equal(plan.steps[0].landed,false);
 assert.ok(plan.steps[0].travelHeight>6);
 const intermediate=routeState(start,plan.steps,1);
 assert.equal(intermediate.map.get('1,0'),obstacle);
 assert.equal(intermediate.traveller.pack,moving);
 assert.ok(intermediate.traveller.elevation>6);
 const end=routeState(start,plan.steps,2);
 assert.equal(end.map.get('1,0'),obstacle);assert.equal(end.map.get('2,0'),moving);
 assert.equal(end.traveller,null);assert.equal(end.map.size,2);
 assert.equal(start.get('0,0'),moving);
});
test('climb lifts over straight-line obstacles but rejects occupied final positions',()=>{
 const plan=prepareRoutes('[[0,2]]',cells,start,0,'climb');
 assert.ok(plan.steps[0].over);assert.ok(plan.steps[0].travelHeight>6);
 assert.equal(plan.result.size,2);
 assert.throws(()=>prepareRoutes('[[0,1]]',cells,start,0,'climb'),/최종 도착 칸/);
});
