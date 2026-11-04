export function motionDuration(step, secondsPerCell = 1) {
 const [fx,fy]=step.from.split(',').map(Number),[tx,ty]=step.to.split(',').map(Number);
 const horizontal=Math.hypot(tx-fx,ty-fy)*4;
 const from=step.fromHeight??0,to=step.toHeight??from;
 const length=step.over?Math.abs(step.travelHeight-from)+horizontal+Math.abs(step.travelHeight-to):Math.hypot(horizontal,to-from);
 return Math.max(1,Math.round(length/4*secondsPerCell*1000));
}
