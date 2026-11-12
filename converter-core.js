/* SISE · Conversor educativo GRAFCET → lógica LD/FBD.
 * Interpreta subconjuntos documentados de GrafcetMaker v4.
 * No es un compilador PLC. IEC 60848 requiere evaluación simultánea y búsqueda de estabilidad.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SISEConverter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX={steps:120,transitions:180,branches:48};
const ident=/^[A-Za-z_][A-Za-z0-9_]*$/;
function fail(s){throw Error(s);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const slug=s=>String(s).replace(/[^A-Za-z0-9_]/g,'_');
function fmtMs(n){if(n%3600000===0)return n/3600000+'h';if(n%60000===0)return n/60000+'min';if(n%1000===0)return n/1000+'s';return n+'ms';}
function parseExpr(source,variables=[],steps=[]){
  const src=String(source??'').trim();if(!src)fail('Receptividad vacía.');
  const allowed=variables.map(v=>typeof v==='string'?{name:v,type:'BOOL'}:v),byName=new Map(allowed.map(v=>[v.name.toLowerCase(),v]));
  const knownSteps=new Set(steps.map(s=>typeof s==='string'?s:`X${s.number}`));
  const re=/\s+|>=|<=|<>|!=|==|&&|\|\||↑|↓|¬|\bAND\b|\bOR\b|\bNOT\b|\bRE\b|\bFE\b|\bTRUE\b|\bFALSE\b|\d+(?:\.\d+)?(?:ms|min|s|h)\b|\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z_0-9]*|[()!+*\/·=<>]/giy;
  let i=0,m,tokens=[];while(i<src.length){re.lastIndex=i;m=re.exec(src);if(!m||m.index!==i)fail(`Símbolo no admitido cerca de «${src.slice(i)}»`);i=re.lastIndex;if(!/^\s+$/.test(m[0]))tokens.push(m[0]);}
  let ix=0,peek=()=>tokens[ix],tok=()=>tokens[ix++],upper=()=>String(peek()||'').toUpperCase();
  const resolve=name=>{if(knownSteps.has(name))return {name,type:'BOOL'};const v=byName.get(name.toLowerCase());if(!v)fail(`Variable desconocida «${name}»`);return v;};
  const ms=d=>{const x=/^(\d+(?:\.\d+)?)(ms|min|s|h)$/i.exec(d);if(!x)return null;return Math.round(Number(x[1])*({ms:1,s:1000,min:60000,h:3600000}[x[2].toLowerCase()]));};
  function atom(){
    const op=upper();
    if(['NOT','!','/','¬'].includes(op)){tok();return {op:'not',x:atom()};}
    if(['RE','FE','↑','↓'].includes(op)){tok();const name=tok();if(!name||!ident.test(name)||resolve(name).type!=='BOOL')fail('El flanco requiere una señal BOOL');return {op:'edge',edge:['RE','↑'].includes(op)?'rising':'falling',target:resolve(name).name};}
    if(peek()==='('){tok();const a=or();if(peek()!==')')fail(`Falta «)» en «${src}»`);tok();return a;}
    if(!peek())fail(`Expresión incompleta «${src}»`);
    const val=tok();
    if(/^(TRUE|FALSE|0|1)$/i.test(val)&&!['>=','<=','<>','!=','==','=','<','>'].includes(peek()))return {op:'const',v:/^(TRUE|1)$/i.test(val)};
    const duration=ms(val);
    if(duration!==null){if(peek()!=='/')fail(`Después de ${val} se esperaba /Xn`);tok();const step=tok();if(!step||!knownSteps.has(step))fail(`Temporizador ${val}/${step||'?'}: etapa no existente`);return {op:'timer',step,ms:duration};}
    if(!ident.test(val)&&!/^\d+(?:\.\d+)?$/.test(val))fail(`Token no admitido «${val}»`);
    const v=/^\d/.test(val)?{name:val,type:'NUM'}:resolve(val);
    if(['>=','<=','<>','!=','==','=','<','>'].includes(peek())){
      const cmp=tok();const b=tok();if(!b)fail('Comparador incompleto');
      let vv;if(/^\d+(?:\.\d+)?$/.test(b))vv={type:'NUM',name:b};else if(ident.test(b))vv=resolve(b);else fail(`Comparador no admite «${b}»`);
      return {op:'cmp',left:v.name,comparator:cmp,right:vv.name};
    }
    if(v.type!=='BOOL')fail(`La variable «${val}» es ${v.type}; requiere comparador`);
    return {op:'name',name:v.name};
  }
  function and(){let a=atom();while(['AND','*','·','&&'].includes(upper())){tok();a={op:'and',a,b:atom()};}return a;}
  function or(){let a=and();while(['OR','+','||'].includes(upper())){tok();a={op:'or',a,b:and()};}return a;}
  const tree=or();if(ix!==tokens.length)fail(`Token inesperado «${peek()}» en «${src}»`);return tree;
}
function helper(ast,helpers){
 if(ast.op==='timer'){
   const name=`TON_${ast.step}_${ast.ms}ms.Q`,key=name;if(!helpers.has(key))helpers.set(key,{kind:'timer',name,step:ast.step,ms:ast.ms});return name;
 }
 if(ast.op==='edge'){
   const name=`${ast.edge==='rising'?'R':'F'}_TRIG_${ast.target}.Q`;if(!helpers.has(name))helpers.set(name,{kind:'edge',name,target:ast.target,edge:ast.edge});return name;
 }
 if(ast.op==='cmp'){
   const ops={'>=':'GE','<=':'LE','>':'GT','<':'LT','=':'EQ','==':'EQ','<>':'NE','!=':'NE'};
   const name=`CMP_${slug(ast.left)}_${ops[ast.comparator]}_${slug(ast.right)}.Q`;if(!helpers.has(name))helpers.set(name,{kind:'cmp',name,left:ast.left,cmp:ast.comparator,right:ast.right});return name;
 }
 fail('Átomo auxiliar no reconocido');
}
function dnf(n,flip=false,helpers=new Map()){
 switch(n.op){
 case 'const':return n.v!==flip?[[]]:[];
 case 'name':return [[{name:n.name,neg:flip}]];
 case 'timer':case 'edge':case 'cmp':return [[{name:helper(n,helpers),neg:flip}]];
 case 'not':return dnf(n.x,!flip,helpers);
 case 'and':case 'or':{
   const op=flip?(n.op==='and'?'or':'and'):n.op,aa=dnf(n.a,flip,helpers),bb=dnf(n.b,flip,helpers);
   if(op==='or'){const r=aa.concat(bb);if(r.length>MAX.branches)fail(`Exceso de ramas lógicas (más de ${MAX.branches})`);return r;}
   const r=[];for(const a of aa)for(const b of bb){r.push([...a,...b]);if(r.length>MAX.branches)fail(`Exceso de ramas lógicas (más de ${MAX.branches})`);}return r;
 }
 }fail('Expresión no reconocida');
}
const L=(name,neg=false)=>({name,neg});
function fmtDNF(branches){if(!branches.length)return 'FALSE';return branches.map(b=>b.length?b.map(l=>(l.neg?'NOT ':'')+l.name).join(' AND '):'TRUE').join(' OR ');}
function fmtAst(n){switch(n.op){case 'const':return n.v?'TRUE':'FALSE';case 'name':return n.name;case 'not':return 'NOT ('+fmtAst(n.x)+')';case 'and':return '('+fmtAst(n.a)+' AND '+fmtAst(n.b)+')';case 'or':return '('+fmtAst(n.a)+' OR '+fmtAst(n.b)+')';case 'timer':return `${fmtMs(n.ms)}/${n.step}`;case 'edge':return `${n.edge==='rising'?'↑':'↓'}${n.target}`;case 'cmp':return `${n.left} ${n.comparator} ${n.right}`;default:return '?';}}
function parseAssignment(raw,variables){const m=/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*:=\s*(.*?)\s*$/.exec(raw);if(!m)fail(`Acción memorizada «${raw}»: se requiere destino := expresión`);
 const v=variables.find(v=>v.name.toLowerCase()===m[1].toLowerCase());if(!v||v.direction==='input')fail(`Destino no declarado o de entrada: «${m[1]}»`);
 const e=m[2];if(!/^(TRUE|FALSE|0|1)$/i.test(e)&&!/^[A-Za-z_][A-Za-z0-9_]*\s*[+\-]\s*\d+$/.test(e))fail(`Asignación «${raw}»: esta versión admite 0, 1 o incrementos/decrementos de constante`);
 if(v.type!=='BOOL'&&!/^[A-Za-z_][A-Za-z0-9_]*\s*[+\-]\s*\d+$/.test(e)&&!/^\d+$/.test(e))fail(`Tipo de acción incompatible con ${v.type}`);
 if(/[+\-]/.test(e)&&v.type!=='INT')fail(`Incrementar requiere variable INT: ${v.name}`);
 const numeric=/^([A-Za-z_][A-Za-z0-9_]*)\s*([+\-])\s*(\d+)$/.exec(e);if(numeric&&numeric[1].toLowerCase()!==v.name.toLowerCase())fail(`Acción «${raw}»: el incremento debe emplear la misma variable`);
 return {target:v.name,type:v.type,op:numeric?(numeric[2]==='+'?'ADD':'SUB'):'MOVE',value:numeric?Number(numeric[3]):e.toUpperCase()==='TRUE'?true:e.toUpperCase()==='FALSE'?false:Number(e),raw};}
function classify(p){
 if(!p||typeof p!=='object')fail('No es un proyecto GRAFCET JSON');if(p.schemaVersion!==4)fail('Se requiere formato GrafcetMaker v4');
 const gs=Object.values(p.grafcets||{});if(gs.length!==1||gs[0].kind!=='partial')fail('Solo se admite un GRAFCET parcial; macroetapas, encapsulamientos y forzados aún no están soportados');
 const g=gs[0],steps=Object.values(g.steps||{}),trans=Object.values(g.transitions||{}),actions=Object.values(g.actions||{}),variables=Object.values(p.variables||{}),helpers=new Map();
 if(!steps.length||steps.length>MAX.steps||trans.length>MAX.transitions)fail('Número de etapas o transiciones fuera del límite del prototipo');
 if(steps.some(s=>!['normal','initial'].includes(s.kind)))fail('Macroetapas y encapsulamientos no admitidos');
 if(steps.filter(s=>s.kind==='initial').length!==1)fail('Se necesita una única etapa inicial');
 if(new Set(steps.map(s=>s.number)).size!==steps.length)fail('Números de etapa repetidos');
 const byId=new Map(steps.map(s=>[s.id,s]));if(byId.size!==steps.length)fail('Identificadores de etapa repetidos');
 const sorted=steps.slice().sort((a,b)=>a.number-b.number).map(s=>({id:s.id,number:s.number,name:`X${s.number}`,initial:s.kind==='initial',label:s.label||''}));
 const names=new Map(steps.map(s=>[s.id,`X${s.number}`]));const warnings=[];
 const translated=trans.map((t,i)=>{
  if(!t.from?.length||!t.to?.length)fail(`Transición ${t.number||i+1}: transiciones fuente/sumidero pendientes de implementar`);
  if([...t.from,...t.to].some(x=>!byId.has(x)))fail('Transición con etapa inexistente');
  let expr;try{expr=parseExpr(t.receptivity,variables,steps);}catch(e){fail(`Transición ${t.from.map(x=>names.get(x)).join('+')}→${t.to.map(x=>names.get(x)).join('+')}: ${e.message}`);}
  const from=t.from.map(x=>names.get(x)),to=t.to.map(x=>names.get(x)),branches=dnf(expr,false,helpers).map(b=>[...from.map(x=>L(x)),...b]);
  return {id:t.id,name:`T${t.number??i+1}`,from,to,expr,raw:t.receptivity,branches};
 });
 if(new Set(translated.map(x=>x.name)).size!==translated.length)translated.forEach((x,i)=>x.name=`T${i+1}`);
 const incoming={},outgoing={};sorted.forEach(s=>{incoming[s.name]=[];outgoing[s.name]=[];});
 for(const t of translated){for(const x of t.from)outgoing[x].push(t.name);for(const x of t.to)incoming[x].push(t.name);}
 const reachable=new Set([sorted.find(s=>s.initial).name]);let changed=true;while(changed){changed=false;for(const t of translated)if(t.from.every(x=>reachable.has(x)))for(const x of t.to)if(!reachable.has(x)){reachable.add(x);changed=true;}}
 if(reachable.size!==sorted.length)warnings.push('Existen etapas no alcanzables desde la etapa inicial (pueden estar desconectadas).');
 for(const s of sorted)if(outgoing[s.name].length>1)warnings.push(`${s.name} tiene divergencia alternativa: comprobar que las receptividades sean mutuamente excluyentes.`);
 const outputActions=[],storedActions=[];
 for(const a of actions){
  if(!a.stepId||!byId.has(a.stepId))fail('Acciones sin etapa y acciones de forzado pendientes de implementar');const step=names.get(a.stepId);
  if(a.kind==='continuous'){
   const v=variables.find(v=>v.name.toLowerCase()===String(a.text).toLowerCase());if(!v||v.type!=='BOOL'||v.direction!=='output')fail(`Acción «${a.text}»: requiere una salida BOOL declarada`);
   let cond=null;try{if(a.condition)cond=parseExpr(a.condition,variables,steps);}catch(e){fail(`Acción ${a.text}: ${e.message}`);}
   if(cond)dnf(cond,false,helpers);outputActions.push({step,name:v.name,condition:cond});continue;
  }
  if(['storedOnActivation','storedOnDeactivation','storedOnEvent'].includes(a.kind)){
   const assign=parseAssignment(a.text,variables);let cond=null;
   if(a.kind==='storedOnEvent'){if(!a.condition)fail(`Acción en evento ${a.text}: falta evento`);try{cond=parseExpr(a.condition,variables,steps);}catch(e){fail(`Acción de evento ${a.text}: ${e.message}`);}dnf(cond,false,helpers);}
   storedActions.push({step,kind:a.kind,event:cond,...assign});continue;
  }
  fail(`Acción de tipo ${a.kind}: todavía no compatible`);
 }
 const nextStates={};for(const s of sorted){
  let br=[];const src=[L(s.name),...outgoing[s.name].map(x=>L(x,true))];br.push(src);
  for(const t of incoming[s.name])br.push([L(t)]);
  if(s.initial)br.unshift([L('INIT')]);else br=br.map(x=>[L('INIT',true),...x]);
  nextStates[s.name]=br;
 }
 const grouped={};for(const a of outputActions){const br=dnf(a.condition||{op:'const',v:true},false,helpers).map(z=>[L(a.step),...z]);(grouped[a.name]??=[]).push(...br);}
 return {title:p.name||'GRAFCET',steps:sorted,transitions:translated,actions:outputActions,storedActions,helpers:[...helpers.values()],incoming,outgoing,nextStates,grouped,variables,warnings};
}
function generateLogic(m){
 const lines=[`// SISE 0.2 · ${m.title}`,'// CONVERSOR DIDÁCTICO EXPERIMENTAL — NO FUNCIONAL COMO PROGRAMA PLC','// Ejecutar las marcas T con los estados anteriores. Calcular todos los X_next.','// Transferir simultáneamente X_next → X. Las transiciones inmediatas necesitan iteración hasta estabilidad.','// INIT es el primer ciclo: solo X inicial se activa.',''];
 lines.push('// BLOQUES AUXILIARES');for(const h of m.helpers){if(h.kind==='timer')lines.push(`${h.name} ← TON(IN=${h.step}, PT=${fmtMs(h.ms)});`);if(h.kind==='edge')lines.push(`${h.name} ← ${h.edge==='rising'?'R_TRIG':'F_TRIG'}(CLK=${h.target});`);if(h.kind==='cmp')lines.push(`${h.name} ← (${h.left} ${h.cmp} ${h.right});`);}
 lines.push('','// TRANSICIONES (calcular antes de cambiar etapas)');for(const t of m.transitions)lines.push(`${t.name} := ${fmtDNF(t.branches)};`);
 lines.push('','// ACTUALIZACIÓN DE ETAPAS (todas calculadas sobre estado previo)');for(const s of m.steps)lines.push(`${s.name}_next := ${fmtDNF(m.nextStates[s.name])};`);
 lines.push('','// ACCIONES CONTINUAS');for(const [out,br] of Object.entries(m.grouped))lines.push(`${out} := ${fmtDNF(br)};`);
 lines.push('','// MARCAS DE ENTRADA Y SALIDA DE ETAPA');for(const st of m.steps){lines.push(`ENTRA_${st.name} := NOT ${st.name} AND ${st.name}_next;`);lines.push(`SALE_${st.name} := ${st.name} AND NOT ${st.name}_next;`);}
 lines.push('','// ACCIONES MEMORIZADAS (evento y asignación)');for(const a of m.storedActions){const event=a.kind==='storedOnActivation'?`ENTRA_${a.step}`:a.kind==='storedOnDeactivation'?`SALE_${a.step}`:fmtDNF(dnf(a.event).map(z=>[L(a.step),...z]));lines.push(`IF ${event} THEN ${a.raw}; END_IF;`);}
 lines.push('','// AVISO: adaptar prioridades de asignación, TON, contadores, flancos, ciclo y estabilidad IEC 60848.');return lines.join('\n');
}
function line(a,x1,y1,x2,y2,c='#d3e8e5',sw=2){a.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}"/>`);}
function text(a,x,y,t,opt={}){a.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${opt.size||13}" text-anchor="${opt.anchor||'start'}" fill="${opt.color||'#e4f3ee'}" font-weight="${opt.bold?'bold':'normal'}">${esc(t)}</text>`);}
function rect(a,x,y,w,h,fill='#19323b',stroke='#88dbc5'){a.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);}
function svgDoc(a,w,h){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#0b1722"/>${a.join('')}</svg>`;}
function svgLadder(m){
 const a=[],W=1550,left=58;let y=95;
 text(a,27,33,`SISE · LADDER genérico · ${m.title}`,{size:23,bold:true,color:'#72e4b6'});
 function rung(title,branches,coil,note){const b=branches.length?branches:[[L('FALSE')]];const pitch=64,start=y,n=b.length;
  text(a,28,start-54,title,{size:14,color:'#a8d0ce'});
  const ends=[];
  for(let j=0;j<n;j++){
   const yy=start+j*pitch;line(a,left,yy,96,yy);
   let x=96;for(const lit of b[j]){
    const label=lit.name.length>33?lit.name.slice(0,33)+'…':lit.name;
    const cellW=Math.max(60,Math.ceil(label.length*7.4)+22);
    line(a,x,yy,x+13,yy);const cx=x+13;
    line(a,cx,yy-14,cx,yy+14);line(a,cx+15,yy-14,cx+15,yy+14);
    if(lit.neg)line(a,cx-4,yy+18,cx+19,yy-18,'#ffc285',2);
    text(a,x+cellW/2,yy-22,label,{size:12,anchor:'middle'});
    line(a,cx+15,yy,x+cellW,yy);x+=cellW;
   }
   ends.push(x);
  }
  const junction=Math.max(...ends)+23;const cy=start+(n-1)*pitch/2;
  if(n>1){line(a,left,start,left,start+(n-1)*pitch,'#82b6a9',3);line(a,junction,start,junction,start+(n-1)*pitch,'#dce9e5',2);}
  for(let j=0;j<n;j++)line(a,ends[j],start+j*pitch,junction,start+j*pitch);
  const coilX=Math.min(W-175,junction+85);line(a,junction,cy,coilX-25,cy);a.push(`<circle cx="${coilX}" cy="${cy}" r="25" fill="#193541" stroke="#75e6bb" stroke-width="2"/>`);const shortCoil=coil.length>9?(coil.startsWith('TON_')?'TON':coil.startsWith('CMP_')?'CMP':coil.startsWith('R_TRIG')?'R_TRIG':coil.startsWith('F_TRIG')?'F_TRIG':coil.split(' ')[0]):coil;
  text(a,coilX,cy+4,shortCoil,{size:shortCoil.length>5?10:12,bold:true,anchor:'middle'});line(a,coilX+25,cy,coilX+50,cy);line(a,coilX+50,cy-26,coilX+50,cy+26,'#82b6a9',3);
  if(note)text(a,34,start+n*pitch+10,note,{size:12,color:'#a7b7c1'});
  y=start+n*pitch+115;
 }
 for(const h of m.helpers){const title=h.kind==='timer'?`Temporizador · ${h.step} ≥ ${fmtMs(h.ms)}`:h.kind==='edge'?`Detector ${h.edge==='rising'?'↑':'↓'} · ${h.target}`:`Comparador · ${h.left} ${h.cmp} ${h.right}`;rung(title,[[L(h.kind==='timer'?h.step:h.kind==='edge'?h.target:h.left)]],h.name,'Bloque TON / flanco / comparador: el contacto ilustrado indica la entrada, no implementa el bloque.');}
 for(const t of m.transitions)rung(`Transición ${t.from.join(' + ')} → ${t.to.join(' + ')} · ${t.raw}`,t.branches,t.name,'Marcar todas las transiciones antes de actualizar las memorias de etapa.');
 for(const s of m.steps)rung(`Estado siguiente ${s.name}`,m.nextStates[s.name],`${s.name}⁺`,'Calcular X_next; transferir a las memorias tras evaluar TODAS las etapas.');
 for(const [name,branches] of Object.entries(m.grouped))rung(`Acción continua ${name}`,branches,name,'Salida activa únicamente mientras se cumple la condición de etapa.');
 for(const a0 of m.storedActions){let branches;if(a0.kind==='storedOnActivation')branches=[[L('ENTRA_'+a0.step)]];else if(a0.kind==='storedOnDeactivation')branches=[[L('SALE_'+a0.step)]];else branches=dnf(a0.event).map(z=>[L(a0.step),...z]);rung(`Acción memorizada ${a0.kind} · ${a0.raw}`,branches,a0.op+' '+a0.target,'Operación MOVE/ADD/SUB habilitada por evento (no bobina directa).');}
 text(a,28,y+5,'CONVERSOR NO FUNCIONAL COMO PROGRAMA PLC · SOLO REFERENCIA DIDÁCTICA',{size:14,color:'#fbc484',bold:true});return svgDoc(a,W,y+38);
}
function svgFup(m){
 const a=[],W=1300;let y=75;text(a,30,34,`SISE · FUP genérico · ${m.title}`,{size:23,color:'#72e4b6',bold:true});
 function gate(x,yy,w,h,name){rect(a,x,yy,w,h);text(a,x+w/2,yy+h/2+5,name,{size:18,bold:true,anchor:'middle',color:'#bbffdf'});}
 function block(title,branches,target,note){const b=branches.length?branches:[[L('FALSE')]],start=y;
  text(a,30,start-14,title,{size:14,color:'#acd4cf'});let yy=start+5,mids=[];
  for(const branch of b){const count=Math.max(1,branch.length),h=Math.max(65,24*count+22);gate(460,yy,130,h,branch.length>1?'&':'BUF');
   branch.forEach((lit,k)=>{const p=yy+22+k*24; text(a,65,p+5,(lit.neg?'NOT ':'')+lit.name,{size:13});line(a,302,p,460,p);});mids.push(yy+h/2);yy+=h+15;
  }
  let mid=(mids[0]+mids[mids.length-1])/2;
  if(b.length>1){gate(680,mids[0]-30,120,Math.max(65,mids[mids.length-1]-mids[0]+60),'≥1');for(const p of mids)line(a,590,p,680,p);line(a,800,mid,904,mid);}else line(a,590,mid,904,mid);
  gate(904,mid-26,176,52,target);line(a,1080,mid,1110,mid);text(a,1130,mid+4,'Q',{size:13});if(note)text(a,35,yy+2,note,{size:12,color:'#9db8bb'});y=yy+55;
 }
 for(const h of m.helpers){let op=h.kind==='timer'?`TON ${fmtMs(h.ms)}`:h.kind==='edge'?(h.edge==='rising'?'R_TRIG':'F_TRIG'):`CMP ${h.cmp}`;let input=h.kind==='timer'?h.step:h.kind==='edge'?h.target:`${h.left}, ${h.right}`;block(`Auxiliar ${op}`,[[L(input)]],h.name,`Bloque ${op}: entrada y parámetro temporal/umbral pendientes de parametrizar en PLC.`);}
 for(const t of m.transitions)block(`Transición ${t.from.join('+')} → ${t.to.join('+')} · ${t.raw}`,t.branches,t.name,'Se evalúa con las memorias X previas.');
 for(const s of m.steps)block(`Etapa ${s.name} · siguiente estado`,m.nextStates[s.name],`${s.name}_NEXT`,'Transferir todos los X_NEXT a las memorias simultáneamente.');
 for(const [out,b] of Object.entries(m.grouped))block(`Salida continua ${out}`,b,out,'Acción continua.');
 for(const x of m.storedActions){const b=x.kind==='storedOnActivation'?[[L('ENTRA_'+x.step)]]:x.kind==='storedOnDeactivation'?[[L('SALE_'+x.step)]]:dnf(x.event).map(z=>[L(x.step),...z]);block(`Acción memorizada ${x.raw}`,b,`${x.op} ${x.target}`,'Función con habilitación por evento; no es asignación combinacional.');}
 text(a,30,y+10,'PROTOTIPO EXPERIMENTAL · NO VALIDADO PARA PLC',{size:14,color:'#fbc484',bold:true});return svgDoc(a,W,y+40);
}
return {classify,parseExpr,dnf,generateLogic,svgLadder,svgFup};
});