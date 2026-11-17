/* Interpretación didáctica combinacional de contactos, no un PLC. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SISEFlow=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function assertSupported(m){
 if(m.helpers.length || m.storedActions.length) throw Error('Esta prueba admite contactos booleanos y acciones continuas. Flancos, temporizadores, comparaciones y acciones memorizadas aún no están disponibles.');
}
function evaluate(m,inputs,activeIds,on){
 assertSupported(m);
 const values={...inputs,INIT:false};
 for(const s of m.steps) values[s.name]=on && activeIds.includes(s.id);
 const rungs=[];
 function rung(title,branches,coil){
   const resolved=branches.map(branch=>{let power=on;const contacts=branch.map(l=>{const raw=values[l.name];if(typeof raw!=='boolean')throw Error(`Valor desconocido: ${l.name}`);const closed=l.neg?!raw:raw;const before=power;power=before&&closed;return {name:l.name,neg:l.neg,closed,before,after:power};});return {contacts,power};});
   const result=resolved.some(b=>b.power);values[coil]=result;rungs.push({title,coil,branches:resolved,result});
 }
 for(const t of m.transitions)rung(`Transición ${t.from.join(' + ')} → ${t.to.join(' + ')}`,t.branches,t.name);
 for(const s of m.steps)rung(`Estado siguiente ${s.name}`,m.nextStates[s.name],`${s.name}⁺`);
 for(const [name,b] of Object.entries(m.grouped))rung(`Acción continua ${name}`,b,name);
 return {values,rungs};
}
function render(flow){
 const out=[], width=1060,left=45,right=1010;let y=65;
 const text=(x,y,s,size=13,anchor='start',fill='#c8d9d3')=>out.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" font-family="Arial">${esc(s)}</text>`);
 const line=(x1,y1,x2,y2,on)=>out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on?'#4fff98':'#7e9691'}" stroke-width="${on?4:2}"/>`);
 for(const rung of flow.rungs){
   const n=Math.max(rung.branches.length,1), start=y, gap=70, end=start+(n-1)*gap, middle=(start+end)/2; text(25,start-32,rung.title,15,'start','#d3e8df');
   line(left,start,left,end,true);line(870,start,870,end,rung.result);
   rung.branches.forEach((b,j)=>{
     const yy=start+j*gap;let x=left;
     if(!b.contacts.length){line(left,yy,870,yy,b.power);return;}
     const spacing=Math.min(140,800/b.contacts.length);
     b.contacts.forEach(c=>{
       const cx=x+spacing/2;line(x,yy,cx-11,yy,c.before);line(cx-11,yy-13,cx-11,yy+13,c.before);line(cx+11,yy-13,cx+11,yy+13,c.after);if(c.neg)line(cx-15,yy+17,cx+15,yy-17,c.closed);line(cx+11,yy,x+spacing,yy,c.after);text(cx,yy-21,c.name,12,'middle',c.closed?'#a6ffcc':'#c8d9d3');x+=spacing;
     });line(x,yy,870,yy,b.power);
   });
   line(870,middle,920,middle,rung.result);out.push(`<circle cx="940" cy="${middle}" r="20" fill="${rung.result?'#147e50':'#19323b'}" stroke="${rung.result?'#4fff98':'#7e9691'}" stroke-width="3"/>`);text(940,middle+4,rung.coil,11,'middle');line(960,middle,right,middle,rung.result);line(right,middle-23,right,middle+23,true);
   y=end+105;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y}" width="${width}" height="${y}"><rect width="${width}" height="${y}" fill="#0b1722"/>${out.join('')}</svg>`;
}
return {assertSupported,evaluate,render};
});
