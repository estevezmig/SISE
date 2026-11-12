/* Protección didáctica de acceso SISE. Es un control de interfaz: NO oculta el código público. */
(()=>{
 'use strict';
 const secret='SISE_2026',flag='sise_unlocked_v1';
 let passed=false;
 try{passed=sessionStorage.getItem(flag)==='yes';}catch(e){}
 if(passed){document.documentElement.classList.add('sise-unlocked');return;}
 document.documentElement.classList.add('sise-locked');
 function create(){
  if(document.getElementById('sise-gate'))return;
  const gate=document.createElement('section');gate.id='sise-gate';gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');gate.setAttribute('aria-labelledby','sise-gate-title');
  gate.innerHTML='<form id="sise-gate-form" autocomplete="off"><div class="sise-gate-logo">SISE</div><h1 id="sise-gate-title">Acceso al simulador</h1><p>Introduce la contraseña para utilizar esta herramienta didáctica.</p><label for="sise-gate-password">Contraseña</label><input type="password" id="sise-gate-password" required autocomplete="off" placeholder="Contraseña de SISE"><div class="sise-gate-error" id="sise-gate-error" aria-live="polite"></div><button type="submit">Entrar</button><a href="../" id="sise-gate-back">Volver a SISE</a></form>';
  document.body.appendChild(gate);
  const back=document.getElementById('sise-gate-back');back.href=location.pathname.replace(/\/(?:editor|convertidor)\/.*$/, '/') || '../';
  gate.querySelector('form').addEventListener('submit',e=>{
   e.preventDefault();const input=gate.querySelector('input');
   if(input.value!==secret){document.getElementById('sise-gate-error').textContent='Contraseña incorrecta';input.value='';input.focus();return;}
   try{sessionStorage.setItem(flag,'yes');}catch(e){}
   gate.remove();document.documentElement.classList.remove('sise-locked');document.documentElement.classList.add('sise-unlocked');
  });
  gate.querySelector('input').focus();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create,{once:true});else create();
})();