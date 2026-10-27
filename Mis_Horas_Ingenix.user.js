// ==UserScript==
// @name         Mis Horas Ingenix
// @description  Mis Horas dentro de box.ingenix.es: lee tu carpeta de empleado y guarda tus Excel de semana en 1. Timesheets
// @version      8.0
// @match        https://box.ingenix.es/*
// @match        *://box.ingenix.es/*
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==
/* Con el acceso directo (box.ingenix.es/?mishoras) se abre sola al iniciar sesión.
   Si entras a box sin más, aparece un botón «Mis Horas» abajo a la derecha (con un número si hay avisos) y Drive se usa con normalidad.
   La app solo lee Timesheets de este año (y tus nóminas/informes/contratos la primera vez o cuando lo pides).
   Solo escribe Excel de semana en «1. Timesheets/AAMM». */
(()=>{
if(window.top!==window||window.__mhIniciado>=80)return;window.__mhIniciado=80;document.getElementById('mhApp')?.remove();document.getElementById('mhAviso')?.remove();
/* Cargador fijo: la app se descarga de GitHub Pages (solo código), se verifica con la firma y se guarda en este navegador. */
const REPO='https://deividru.github.io/mh-app-7k2q/';
const CLAVE={"kty":"EC","x":"sQklEcXP8L17og3DLdsE09Ds3svdm__8sZ_TLDvhpo4","y":"2DmD5hobSsnm7jgZ3XiwvJ0aH3PPErJMAkiL0osmLx4","crv":"P-256"};
const b64u=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const hex=buf=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
const idb=()=>new Promise((ok,ko)=>{const r=indexedDB.open('mishoras_app',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
const idbGet=async()=>{try{const d=await idb();return await new Promise(ok=>{const q=d.transaction('k').objectStore('k').get('app');q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null)})}catch(e){return null}};
const idbSet=async v=>{try{const d=await idb();await new Promise(ok=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,'app');t.oncomplete=ok;t.onerror=ok})}catch(e){}};
const conTiempo=(url,ms)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(url,{cache:'no-store',signal:c.signal}).finally(()=>clearTimeout(t))};
let novedad='';
/* devuelve {ver,html} de la app guardada, actualizándola si hay versión nueva y la firma es válida */
async function obtenerApp(){
 let c=await idbGet();
 try{
  const vj=await (await conTiempo(REPO+'version.json?t='+Date.now(),5000)).json();
  if(!c||c.ver!==vj.version){
   const buf=await (await conTiempo(REPO+vj.app.file+'?v='+encodeURIComponent(vj.version),30000)).arrayBuffer();
   if(hex(await crypto.subtle.digest('SHA-256',buf))!==vj.app.sha256)throw new Error('huella');
   const key=await crypto.subtle.importKey('jwk',CLAVE,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,b64u(vj.app.firma),buf))throw new Error('firma');
   const nuevo={ver:vj.version,html:new TextDecoder().decode(buf),notas:vj.notas||''};
   await idbSet(nuevo);if(c)novedad='Actualizada a la versión '+vj.version+(vj.notas?' · '+vj.notas:'');c=nuevo}
 }catch(e){ultimoErr='actualización: '+e.message}
 return c}
let cerrada=false,vpOrig=null;
/* acceso directo: ?mishoras o #mishoras (se recuerda durante el inicio de sesión) */
/* en el móvil se abre sola siempre (si la cierres con «Ir a Synology Drive», durante 10 minutos queda solo el botón);
   en el ordenador solo con ?mishoras. Si la última apertura acabó mal (Safari recargó la página), no se abre sola. */
const MOVIL=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform));
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v)}catch(e){}}};
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
if(/mishoras/i.test(location.search+location.hash))ss.set('mhAuto','1');
/* solo se considera fallo si Safari recargó la página DOS veces seguidas justo al abrir (una navegación normal limpia la marca) */
const fallo=(()=>{const t=+ls.get('mhAbriendo')||0,n=+ls.get('mhFallos')||0;if(t&&Date.now()-t<60000){ls.set('mhFallos',String(n+1));return n+1>=2}ls.set('mhFallos','0');return false})();
addEventListener('pagehide',()=>ls.set('mhAbriendo',null));
const cerradaHace=Date.now()-(+ls.get('mhCerradaTs')||0);
let auto=!fallo&&cerradaHace>10*60000&&(MOVIL||ss.get('mhAuto')==='1');
/* avisos sin tocar el servidor: se calculan con lo que la app guardó en este navegador */
function avisos(){try{const DB=JSON.parse(localStorage.getItem('ingenix_movil_v1')||'null');if(!DB||!DB.dias)return 0;let n=0;
  const k=iso=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+3);const y=d.getUTCFullYear(),j=new Date(Date.UTC(y,0,4));return y+'-W'+String(1+Math.round(((d-j)/864e5-3+((j.getUTCDay()+6)%7))/7)).padStart(2,'0')};
  const mod=DB.mod||{},gen=DB.gen||{};n+=Object.keys(mod).filter(x=>mod[x]>(gen[x]||0)&&gen[x]).length;
  const hoy=new Date(),fest=(DB.cfg&&DB.cfg.fest)||[];for(let i=1;i<=7;i++){const d=new Date(hoy.getTime()-i*864e5),iso=new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10),w=(d.getDay()+6)%7;
    if(w<5&&!fest.includes(iso)&&!(DB.dias[iso]&&Object.keys(DB.dias[iso]).length))n++}
  return n}catch(e){return 0}}
const escala=()=>{const vw=(window.visualViewport&&window.visualViewport.width)||innerWidth,sw=Math.min(screen.width,screen.height)||vw;return MOVIL?Math.max(1,Math.min(4,vw/sw)):1};
const marca=(txt,col)=>{if(!document.body)return;let a=document.getElementById('mhAviso');if(!a){a=document.createElement('button');a.id='mhAviso';a.type='button';document.body.appendChild(a)}
 const k=escala(),px=n=>Math.round(n*k)+'px';
 a.style.cssText='position:fixed;right:'+px(14)+';bottom:'+px(18)+';z-index:2147483646;background:'+(col||'#14284a')+';color:#fff;font:600 '+px(17)+'/1.2 -apple-system,system-ui,sans-serif;padding:'+px(14)+' '+px(20)+';border:0;border-radius:'+px(28)+';box-shadow:0 '+px(6)+' '+px(20)+' #0005;cursor:pointer;max-width:80vw';a.textContent=txt};
const quitaMarca=()=>document.getElementById('mhAviso')?.remove();
const tokenSesion=async()=>{try{const t=await (await fetch('/webman/login.cgi?enable_syno_token=yes',{credentials:'same-origin'})).text();const m=t.match(/"SynoToken"\s*:\s*"([^"]+)"/);return m?m[1]:''}catch(e){return''}};
let ultimoErr='';
const conectado=async()=>{const tok=await tokenSesion();if(!tok)return false;
 try{const r=await fetch('/webapi/entry.cgi',{method:'POST',credentials:'same-origin',headers:{'X-SYNO-TOKEN':tok,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({api:'SYNO.SynologyDrive.TeamFolders',version:'1',method:'list',offset:0,limit:1})});const j=await r.json();
  if(!j.success)ultimoErr='código '+(j.error&&j.error.code);return j.success===true}catch(e){ultimoErr=e.message;return false}};
/* la web de Drive en el móvil no es «móvil»: mientras la app está abierta se fuerza el ancho del teléfono */
const vpMovil=on=>{let m=document.querySelector('meta[name=viewport]');if(on){if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);vpOrig=''}else if(vpOrig===null)vpOrig=m.content;m.content='width=device-width,initial-scale=1,viewport-fit=cover'}else if(m&&vpOrig!==null){m.content=vpOrig||'width=1024'}};
let abriendo=false;
async function abrir(){if(document.getElementById('mhApp')||abriendo)return;abriendo=true;marca('Cargando…');const cur=await obtenerApp();abriendo=false;
 if(!cur){marca('Sin conexión: no se pudo cargar Mis Horas (toca para reintentar)','#c0392b');document.getElementById('mhAviso').onclick=abrir;return}
 const APP=cur.html;quitaMarca();cerrada=false;ls.set('mhCerradaTs',null);vpMovil(true);
 ls.set('mhAbriendo',String(Date.now()));setTimeout(()=>ls.set('mhAbriendo',null),8000);
 const f=document.createElement('iframe');f.id='mhApp';f.title='Mis Horas';f.setAttribute('allow','clipboard-write; web-share');
 f.style.cssText='position:fixed;inset:0;width:100vw;height:100%;border:0;z-index:2147483647;background:#f3f6fb';f.srcdoc=APP;document.body.appendChild(f);document.documentElement.style.overflow='hidden';
 if(novedad){const t=document.createElement('div');t.id='mhNovedad';t.textContent=novedad;t.style.cssText='position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2147483647;background:#14284a;color:#fff;font:600 14px/1.3 -apple-system,system-ui,sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 6px 20px #0005;text-align:center';document.body.appendChild(t);setTimeout(()=>t.remove(),7000);novedad=''}}
function boton(){const n=avisos();marca(n?'Mis Horas  ● '+n:'Mis Horas',n?'#c0392b':'#14284a');document.getElementById('mhAviso').onclick=abrir}
function cerrar(){ss.set('mhAuto',null);ls.set('mhCerradaTs',String(Date.now()));auto=false;document.getElementById('mhApp')?.remove();document.documentElement.style.overflow='';vpMovil(false);cerrada=true;boton()}
window.addEventListener('message',e=>{if(e.data&&e.data.ing==='cerrar')cerrar()});
let intentos=0;
/* espera a que inicies sesión (sin llamar al servidor más de lo necesario) y entonces enseña el botón */
const vigila=async()=>{if(document.getElementById('mhApp'))return;intentos++;
 if(await conectado()){if(auto&&!cerrada)abrir();else boton();return}
 if(document.getElementById('mhAviso'))quitaMarca();setTimeout(vigila,Math.min(3000+intentos*500,10000))};
setTimeout(vigila,1500);
})();
