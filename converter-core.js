/* SISE - conversor GRAFCET a Ladder/FUP genéricos (prototipo educativo).
 * Compatible con archivos GrafcetMaker .grafcet.json (modelo v4).
 * No contiene código fuente del proyecto GrafcetMaker.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SISEConverter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = { bytes: 10*1024*1024, steps: 80, transitions: 80, dnf: 24 };
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function fail(s) { throw new Error(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function parseExpr(source, allowedNames) {
    const original=String(source).trim();
    if (!original) fail('Receptividad vacía');
    const re=/\s+|&&|\|\||\bAND\b|\bOR\b|\bNOT\b|\bTRUE\b|\bFALSE\b|[A-Za-z_][A-Za-z0-9_]*|[01]|[()+*\/!¬·]/gi;
    const tokens=[]; let pos=0,m;
    while(pos<original.length){re.lastIndex=pos;m=re.exec(original);if(!m||m.index!==pos) fail(`Expresión no admitida: «${original.slice(pos)}». Se admiten señales BOOL, AND, OR y NOT; no temporizadores, flancos ni comparadores.`);pos=re.lastIndex;if(!/^\s+$/.test(m[0])) tokens.push(m[0]);}
    let at=0;
    const peek=()=>tokens[at]?.toUpperCase();const take=()=>tokens[at++];
    function atom(){let p=peek();if(p==='NOT'||p==='!'||p==='/'||p==='¬'){take();return {op:'not',x:atom()};}if(p==='('){take();let n=or();if(peek()!==')')fail(`Falta ')' en «${original}»`);take();return n;}if(!p)fail(`Expresión incompleta «${original}»`);if(['RE','FE'].includes(p))fail('Los flancos RE/FE todavía no se convierten a lógica genérica.');let name=take();if(/^(1|TRUE)$/i.test(name))return {op:'const',v:true};if(/^(0|FALSE)$/i.test(name))return {op:'const',v:false};if(!ident.test(name))fail(`Elemento no admitido «${name}»`);let canonical=allowedNames.find(x=>x.toLowerCase()===name.toLowerCase());if(!canonical)fail(`Señal «${name}» no declarada como BOOL de entrada/interna`);return {op:'name',name:canonical};}
    function and(){let n=atom();while(['AND','*','·','&&'].includes(peek())){take();n={op:'and',a:n,b:atom()};}return n;}
    function or(){let n=and();while(['OR','+','||'].includes(peek())){take();n={op:'or',a:n,b:and()};}return n;}
    let ast=or();if(at!==tokens.length)fail(`Token inesperado «${tokens[at]}» en «${original}»`);return ast;
  }
  function dnf(ast, flip=false){switch(ast.op){case 'const':return ast.v!==flip?[[]]:[];case 'name':return [[{name:ast.name,neg:flip}]];case 'not':return dnf(ast.x,!flip);case 'and':case 'or':{const op=flip?(ast.op==='and'?'or':'and'):ast.op;const a=dnf(ast.a,flip),b=dnf(ast.b,flip);if(op==='or'){const n=a.concat(b);if(n.length>LIMIT.dnf)fail(`Expresión con más de ${LIMIT.dnf} ramas Ladder. Simplifícala.`);return n;}const out=[];for(const x of a)for(const y of b){out.push(x.concat(y));if(out.length>LIMIT.dnf)fail(`Expresión con más de ${LIMIT.dnf} ramas Ladder. Simplifícala.`);}return out;}}fail('AST no reconocido');}
  function classify(project) {
    if(!project||typeof project!=='object')fail('El archivo no contiene un proyecto JSON válido.');
    const version=Number(project.schemaVersion);if(version!==4)fail(`Esquema de archivo ${version}: este prototipo acepta el formato GrafcetMaker v4. Convierte el archivo abriéndolo y guardándolo con GrafcetMaker actualizado.`);
    const grafcets=Object.values(project.grafcets||{});if(grafcets.length!==1)fail('Esta primera versión admite exactamente un GRAFCET parcial, sin macroetapas.');
    const g=grafcets[0];if(g.kind!=='partial')fail('Las macroetapas, encapsulamientos y forzados aún no se convierten.');
    const steps=Object.values(g.steps||{}),trans=Object.values(g.transitions||{}),actions=Object.values(g.actions||{});
    if(!steps.length)fail('El GRAFCET no tiene etapas.');if(steps.length>LIMIT.steps||trans.length>LIMIT.transitions)fail('Proyecto demasiado grande para este prototipo.');
    if(steps.some(s=>!['normal','initial'].includes(s.kind)))fail('Etapa macro/encapsulante no admitida.');
    if(steps.filter(s=>s.kind==='initial').length!==1)fail('Se requiere exactamente una etapa inicial.');
    const ids=new Set(steps.map(s=>s.id));if(ids.size!==steps.length)fail('Identificadores de etapa duplicados.');
    if(new Set(steps.map(s=>s.number)).size!==steps.length)fail('Números de etapa repetidos.');
    const incoming=new Map(steps.map(s=>[s.id,[]])),outgoing=new Map(steps.map(s=>[s.id,[]]));
    for(const t of trans){if(t.from?.length!==1||t.to?.length!==1)fail(`Transición ${t.number??t.id}: la versión inicial admite solo una etapa de entrada y una de salida (sin divergencias ni convergencias).`);
      if(!ids.has(t.from[0])||!ids.has(t.to[0]))fail('Transición con referencias a etapas inexistentes.');
      incoming.get(t.to[0]).push(t);outgoing.get(t.from[0]).push(t);
    }
    for(const s of steps){if(incoming.get(s.id).length>1||outgoing.get(s.id).length>1)fail(`Etapa X${s.number}: se detecta bifurcación/convergencia. Aún no se admite.`);}
    const start=steps.find(s=>s.kind==='initial');const visited=new Set();let cursor=start;
    // Recorre el grafo y comprueba que no existen cadenas inconexas ni ciclos distintos del retorno al inicio.
    while(cursor&&!visited.has(cursor.id)){visited.add(cursor.id);const ts=outgoing.get(cursor.id);cursor=ts.length?steps.find(s=>s.id===ts[0].to[0]):null;}
    if(visited.size!==steps.length)fail('Hay etapas desconectadas o un ciclo ajeno a la etapa inicial.');
    if(cursor && cursor.id!==start.id)fail('El ciclo no vuelve a la etapa inicial: configuración no admitida en esta versión.');
    const variables=Object.values(project.variables||{});const symbols=variables.filter(v=>v.type==='BOOL').map(v=>v.name);
    const byId=new Map(steps.map(s=>[s.id,s]));
    const translated=trans.map((t,i)=>{
      const from=byId.get(t.from[0]),to=byId.get(t.to[0]);
      let expr;try{expr=parseExpr(t.receptivity,symbols);}catch(e){fail(`Transición X${from.number}→X${to.number}: ${e.message}`);}
      const conditions=dnf(expr).map(branch=>[{name:`X${from.number}`,neg:false},...branch]);
      return {id:t.id,name:`T${i+1}`,from:`X${from.number}`,to:`X${to.number}`,raw:t.receptivity,expr,branches:conditions};
    });
    const outputActions=[];
    for(const a of actions){if(a.kind!=='continuous'||!a.stepId||!a.text||!ident.test(a.text))fail(`Acción «${a.text||a.kind}»: solamente se admiten acciones continuas de salida BOOL asociadas a etapas.`);
      const s=byId.get(a.stepId);if(!s)fail('Acción de una etapa inexistente.');const v=variables.find(v=>v.name.toLowerCase()===a.text.toLowerCase());
      if(!v||v.type!=='BOOL'||v.direction!=='output')fail(`La acción «${a.text}» debe corresponder a una salida BOOL declarada.`);
      let extra=null;if(a.condition?.trim()){try{extra=parseExpr(a.condition,symbols);}catch(e){fail(`Condición de acción ${a.text}: ${e.message}`);}}
      outputActions.push({step:`X${s.number}`,name:v.name,condition:extra,rawCondition:a.condition||''});
    }
    const sorted=steps.slice().sort((a,b)=>a.number-b.number).map(s=>({id:s.id,number:s.number,name:`X${s.number}`,initial:s.kind==='initial',label:s.label||''}));
    const incomingByName={},outgoingByName={};for(const s of sorted){incomingByName[s.name]=translated.find(t=>t.to===s.name)?.name||'FALSE';outgoingByName[s.name]=translated.find(t=>t.from===s.name)?.name||'FALSE';}
    return {title:project.name||'GRAFCET',steps:sorted,transitions:translated,actions:outputActions,incomingByName,outgoingByName,variables};
  }
  function fmtDNF(branches){if(!branches.length)return 'FALSE';return branches.map(branch=>branch.length?branch.map(l=>(l.neg?'NOT ':'')+l.name).join(' AND '):'TRUE').join(' OR ');}
  function fmtAst(n){switch(n.op){case 'const':return n.v?'TRUE':'FALSE';case 'name':return n.name;case 'not':return `NOT (${fmtAst(n.x)})`;case 'and':return `(${fmtAst(n.a)} AND ${fmtAst(n.b)})`;case 'or':return `(${fmtAst(n.a)} OR ${fmtAst(n.b)})`;}}
  function generateLogic(model){
    const lines=['// SISE · Conversión genérica educativa GRAFCET → LD/FBD','// IMPORTANTE: lógica propuesta, NO archivo importable en un PLC.','// Evaluar TODAS las transiciones sobre el estado del inicio del ciclo,','// guardar las T en marcas, y DESPUÉS actualizar memorias de etapas.','// INIT = pulso de primer ciclo (obligatorio; depende del PLC).','','// REDES DE TRANSICIÓN'];
    for(const t of model.transitions)lines.push(`${t.name} := ${fmtDNF(t.branches)};`);
    lines.push('','// REDES DE ETAPA: biestable RS (reset dominante)');
    for(const s of model.steps){const inc=model.incomingByName[s.name],out=model.outgoingByName[s.name];const set=s.initial?`(INIT OR ${inc})`:inc;const reset=s.initial?out:`(INIT OR ${out})`;lines.push(`${s.name}: S=${set}; R=${reset}; Q=${s.name};`);}
    lines.push('','// REDES DE SALIDA');
    const grouped=new Map();for(const a of model.actions){const term=a.condition?`(${a.step} AND ${fmtAst(a.condition)})`:a.step;let list=grouped.get(a.name)||[];list.push(term);grouped.set(a.name,list);}for(const [out,ls] of grouped)lines.push(`${out} := ${ls.join(' OR ')};`);
    lines.push('','// La equivalencia con IEC 60848 exige revisar orden de ejecución,','// inicialización, simultaneidad y ciclo de scan del PLC destino.');return lines.join('\n');
  }
  function add(arr,type,attr){arr.push(`<${type} ${Object.entries(attr).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}/>`);}
  function textTag(arr,x,y,str,opt={}){arr.push(`<text x="${x}" y="${y}" fill="${opt.color||'#dbe6ed'}" font-size="${opt.size||15}" font-family="Arial, sans-serif" ${opt.anchor?`text-anchor="${opt.anchor}"`:''} ${opt.weight?`font-weight="${opt.weight}"`:''}>${esc(str)}</text>`);}
  function svgPage(width,height,parts){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0b1722"/>${parts.join('')}</svg>`;}
  function svgLadder(m){const a=[];let y=120;const w=1220;
    textTag(a,30,35,`SISE · LADDER · ${m.title}`,{size:23,color:'#71e6bc',weight:'bold'});
    function branchContacts(b,top,xBase){let x=xBase;for(const l of b){add(a,'line',{x1:x,y1:top,x2:x+20,y2:top,stroke:'#dce9ec','stroke-width':2});x+=20;
        add(a,'line',{x1:x,y1:top-14,x2:x,y2:top+14,stroke:'#e7eef2','stroke-width':2});add(a,'line',{x1:x+14,y1:top-14,x2:x+14,y2:top+14,stroke:'#e7eef2','stroke-width':2});if(l.neg)add(a,'line',{x1:x-3,y1:top+18,x2:x+17,y2:top-18,stroke:'#f2b45e','stroke-width':2});textTag(a,x+7,top-23,l.name,{size:12,anchor:'middle'});x+=25;}return x;}
    function rung(title,branches,coil,sub){const start=y;const bh=branches.length?Math.min(branches.length,24)*56:56;const h=Math.max(94,bh+30);
      textTag(a,30,start-52,title,{size:14,color:'#acc3d0'});const left=56,right=1090;add(a,'line',{x1:left,y1:start-10,x2:left,y2:start+bh-25,stroke:'#7cb5ad','stroke-width':3});add(a,'line',{x1:right,y1:start-10,x2:right,y2:start+bh-25,stroke:'#7cb5ad','stroke-width':3});const list=branches.length?branches:[[{name:'FALSE',neg:false}]];
      list.forEach((b,j)=>{const yy=start+j*56,xx=branchContacts(b,yy,76);add(a,'line',{x1:left,y1:yy,x2:76,y2:yy,stroke:'#cde0e5','stroke-width':2});add(a,'line',{x1:xx,y1:yy,x2:1010,y2:yy,stroke:'#cde0e5','stroke-width':2});add(a,'line',{x1:1010,y1:yy,x2:1010,y2:start+((list.length-1)*56)/2,stroke:'#cde0e5','stroke-width':2});});const cy=start+((list.length-1)*56)/2;
      add(a,'line',{x1:1010,y1:cy,x2:1024,y2:cy,stroke:'#cde0e5','stroke-width':2});add(a,'circle',{cx:1046,cy,r:22,fill:'#182c39',stroke:'#71e6bc','stroke-width':2});textTag(a,1046,cy+5,coil,{size:12,anchor:'middle',color:'#e5fff3',weight:'bold'});add(a,'line',{x1:1068,y1:cy,x2:right,y2:cy,stroke:'#cde0e5','stroke-width':2});if(sub)textTag(a,34,start+bh+11,sub,{size:12,color:'#9db6c1'});y+=h+58;}
    for(const t of m.transitions)rung(`Transición ${t.from} → ${t.to} · ${t.raw}`,t.branches,t.name,'Marca temporal: calcular antes de actualizar las etapas');
    for(const s of m.steps){let inc=m.incomingByName[s.name],out=m.outgoingByName[s.name];rung(`SET ${s.name}`,(s.initial?[[{name:'INIT',neg:false}]]:[]).concat(inc==='FALSE'?[]:[[{name:inc,neg:false}]]),`S ${s.name}`,'Bobina SET; ejecutar después de calcular T.');rung(`RESET ${s.name}`,(s.initial?[]:[[{name:'INIT',neg:false}]]).concat(out==='FALSE'?[]:[[{name:out,neg:false}]]),`R ${s.name}`,'La etapa usa memoria reset-dominante.');}
    const groups=new Map();for(const c of m.actions){const b=dnf(c.condition||{op:'const',v:true}).map(br=>[{name:c.step,neg:false},...br]);groups.set(c.name,(groups.get(c.name)||[]).concat(b));}
    for(const [name,branches]of groups)rung(`Salida ${name}`,branches,name,'Acción continua mientras la etapa esté activa.');
    textTag(a,28,y+5,'SOLO USO DIDÁCTICO · Comprobar secuencias y temporización de scan en el PLC elegido.',{size:13,color:'#f8bd7a'});return svgPage(w,y+35,a);}
  function svgFup(m){
    const a=[];let y=80;const w=1220;
    textTag(a,30,35,`SISE · FUP / FBD · ${m.title}`,{size:23,color:'#71e6bc',weight:'bold'});
    const wire=(x1,y1,x2,y2)=>add(a,'line',{x1,y1,x2,y2,stroke:'#d2ece6','stroke-width':2});
    const gate=(x,top,width,height,label)=>{add(a,'rect',{x,y:top,width,height,rx:3,fill:'#1b3340',stroke:'#93d8bc','stroke-width':2});textTag(a,x+width/2,top+height/2+6,label,{size:20,anchor:'middle',weight:'bold',color:'#c6ffe9'});};
    const input=(name,x,y)=>{textTag(a,x-4,y-9,name,{size:14,color:'#edf7f3'});wire(x,y,x+88,y);};
    const output=(name,x,y)=>{wire(x,y,x+60,y);add(a,'circle',{cx:x+65,cy:y,r:5,fill:'#82ebbe'});textTag(a,x+85,y+5,name,{size:17,color:'#e8fff2',weight:'bold'});};
    function logicNet(title,branches,target){
      textTag(a,30,y-14,title,{size:15,color:'#b4cfc6'});
      let b=branches.length?branches:[[{name:'FALSE',neg:false}]];
      const heights=b.map(z=>Math.max(83,z.length*27+26));
      let gY=y,mid=[];
      for(let k=0;k<b.length;k++){
        const literals=b[k];const bh=heights[k];const gy=gY+bh/2;
        gate(312,gY,135,bh,'&');
        literals.forEach((lit,i)=>{let ly=gY+24+i*27;input(`${lit.neg?'¬':''}${lit.name}`,92,ly);wire(180,ly,312,ly);});
        wire(447,gy,581,gy);mid.push(gy);gY+=bh+20;
      }
      let joinY=(mid[0]+mid[mid.length-1])/2;
      if(b.length>1){gate(610,Math.min(...mid)-27,122,Math.max(...mid)-Math.min(...mid)+54,'≥1');mid.forEach(my=>wire(581,my,610,my));output(target,732,joinY);}
      else{wire(581,joinY,732,joinY);output(target,732,joinY);}
      y=gY+35;
    }
    for(const t of m.transitions)logicNet(`Transición ${t.from} → ${t.to} · ${t.raw}`,t.branches,t.name);
    for(const s of m.steps){
      const inc=m.incomingByName[s.name],out=m.outgoingByName[s.name];
      textTag(a,30,y-14,`Etapa ${s.name}${s.initial?' · inicial':''}`,{size:15,color:'#b4cfc6'});
      const set=s.initial?`INIT OR ${inc}`:inc;
      const reset=s.initial?`INIT OR ${out}`:out;
      const t=y+10;
      add(a,'rect',{x:290,y:t,width:165,height:112,rx:3,fill:'#1b3340',stroke:'#93d8bc','stroke-width':2});
      textTag(a,301,t+20,'SEÑALES S/R',{size:12,color:'#b4f1df',weight:'bold'});
      textTag(a,302,t+46,`S: ${set}`,{size:12});
      textTag(a,302,t+91,`R: ${reset}`,{size:12});
      wire(455,t+48,610,t+48);wire(455,t+86,610,t+86);
      gate(610,t-1,170,133,'RS');
      textTag(a,619,t+45,'S',{size:13,color:'#b4f1df'});
      textTag(a,619,t+91,'R',{size:13,color:'#b4f1df'});
      textTag(a,743,t+70,'Q',{size:13,color:'#b4f1df'});
      output(s.name,780,t+63);
      y+=205;
    }
    const byOutput=new Map();
    for(const ac of m.actions){
      const branches=dnf(ac.condition||{op:'const',v:true}).map(branch=>[{name:ac.step,neg:false},...branch]);
      byOutput.set(ac.name,(byOutput.get(ac.name)||[]).concat(branches));
    }
    for(const [name,branches]of byOutput)logicNet(`Salida de acción continua: ${name}`,branches,name);
    textTag(a,30,y+9,'Esquema genérico educativo: comprobar inicialización y ciclo de scan antes de programar un PLC.',{size:13,color:'#ffbf83'});
    return svgPage(w,y+54,a);
  }
  return {classify,parseExpr,dnf,generateLogic,svgLadder,svgFup};
});