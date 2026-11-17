import { useEffect, useState } from 'react';
import { useDoc } from '@/editor/store/document';
import { useSim } from '@/editor/simulation/simStore';

type Model = {steps:{id:string;number:number}[]};
type Flow = {rungs:unknown[]};
declare global { interface Window { SISEConverter?: { classify: (p: unknown) => Model; svgLadder:(m:Model)=>string }; SISEFlow?: {assertSupported:(m:Model)=>void;evaluate:(m:Model, v:Record<string,boolean|number>, ids:string[],on:boolean)=>Flow;render:(f:Flow)=>string} } }

export function SiseLadder() {
 const [open,setOpen]=useState(false), [model,setModel]=useState<Model|null>(null), [error,setError]=useState('');
 const [revision,setRevision]=useState(-1), [svg,setSvg]=useState(''), [staticOnly,setStaticOnly]=useState(false);
 const project=useDoc(s=>s.project), currentRevision=useDoc(s=>s.revision);
 const on=useSim(s=>s.on), snapshot=useSim(s=>s.snapshot);
 const generate=()=>{setOpen(true);try{if(!window.SISEConverter||!window.SISEFlow)throw Error('No se pudo cargar el conversor.');const m=window.SISEConverter.classify(project);try { window.SISEFlow.assertSupported(m); setStaticOnly(false);setSvg('');setError(''); } catch { setStaticOnly(true);setSvg(window.SISEConverter.svgLadder(m));setError('Diagrama generado sin simulación de flujo: todavía no se admiten flancos, temporizadores, comparaciones ni acciones memorizadas.'); } setModel(m);setRevision(currentRevision);}catch(e){setModel(null);setSvg('');setError(e instanceof Error?e.message:String(e));}};
 useEffect(()=>{if(!model || !window.SISEFlow || staticOnly)return;try{const vals={};for(const v of Object.values(project.variables)) if(v.type==='BOOL') Object.assign(vals,{[v.name]:snapshot?.values[v.name]===true});const flow=window.SISEFlow.evaluate(model,vals,snapshot?.active??[],on && !!snapshot);setSvg(window.SISEFlow.render(flow));setError('');}catch(e){setSvg('');setError(e instanceof Error?e.message:String(e));}},[model,project,on,snapshot,staticOnly]);
 return <><button onClick={generate} style={{position:'fixed',top:70,right:20,zIndex:80,background:'#12674c',color:'white',padding:'9px 13px',borderRadius:8}}>Ver Ladder</button>
 {open&&<aside style={{position:'fixed',right:0,top:112,bottom:0,width:'min(46vw, 700px)',minWidth:300,zIndex:70,background:'#102634',color:'white',display:'flex',flexDirection:'column',boxShadow:'-3px 0 16px #0007'}}><div style={{padding:12,display:'flex',gap:8,alignItems:'center'}}><strong style={{flex:1}}>Ladder · prueba didáctica</strong><button onClick={generate}>Actualizar</button><button onClick={()=>setOpen(false)}>Cerrar</button></div><p style={{margin:'0 12px 8px',fontSize:13}}>El verde muestra la continuidad lógica en los casos compatibles. X⁺ indica el siguiente estado calculado. No es un PLC independiente.</p>{currentRevision!==revision&&model&&<p style={{color:'#ffd082',margin:'0 12px'}}>El GRAFCET ha cambiado. Pulsa Actualizar.</p>}{error&&<p role="alert" style={{color:staticOnly?'#ffda81':'#ffb0a6',margin:10}}>{error}</p>}<div style={{overflow:'auto',flex:1}} dangerouslySetInnerHTML={{__html:svg}} /></aside>}</>;
}
