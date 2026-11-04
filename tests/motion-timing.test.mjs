import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionDuration } from '../motion-timing.mjs';
import { createRoutePlayer } from '../route-player.mjs';
test('one and three cells take proportional time and settings scale both',()=>{
 const one={from:'0,0,0',to:'1,0,0',fromHeight:0,toHeight:0};
 assert.equal(motionDuration(one),1000);
 assert.equal(motionDuration({...one,to:'3,0,0'}),3000);
 assert.equal(motionDuration({...one,to:'3,0,0'},.5),1500);
 assert.equal(motionDuration({...one,over:true,travelHeight:4}),3000);
});
test('automatic replay waits 500ms between pack routes before starting next motion',t=>{
 const queue=new Map();let id=0;const seen=[],wait=[];
 globalThis.requestAnimationFrame=fn=>{queue.set(++id,fn);return id};globalThis.cancelAnimationFrame=id=>queue.delete(id);
 t.after(()=>{delete globalThis.requestAnimationFrame;delete globalThis.cancelAnimationFrame});
 const frame=time=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(time));};
 const steps=[{route:0,from:'0,0,0',to:'1,0,0'},{route:1,from:'1,0,0',to:'4,0,0'}];
 const player=createRoutePlayer({onFrame:(s,p)=>seen.push([s.route,p]),onStep:()=>{},onSeek:()=>{},onState:()=>{},onComplete:()=>{},getDuration:s=>motionDuration(s,.2),getDelay:(a,b)=>a.route!==b.route?500:0,onWait:ms=>wait.push(ms)});
 player.load(steps);player.play();frame(0);frame(200);assert.equal(player.position,1);
 frame(201);frame(500);assert.ok(seen.every(([route])=>route===0));frame(701);
 assert.equal(wait.at(-1),0);frame(702);assert.deepEqual(seen.at(-1),[1,0]);
 frame(1002);assert.equal(seen.at(-1)[0],1);assert.ok(Math.abs(seen.at(-1)[1]-.5)<1e-9);frame(1302);assert.equal(player.position,2);assert.equal(player.running,false);
});
