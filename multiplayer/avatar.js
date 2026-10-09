import * as THREE from 'three';
import {t,textureNames,getLang} from './i18n.js?v=38';

export const textures=['Óleo iridescente','Ouro contaminado','Espelho fragmentado','Pele de onça','Escamas de sereia','Raízes','Micélio','Cimento urbano','Cinza vulcânica','Sangue pulsante','Circuitos','Glitch orgânico'];

export function texture(index, color) {
 const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
 g.fillStyle=color;g.fillRect(0,0,256,256);
 let seed=1907+index;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<180;i++){
  const x=rand()*256,y=rand()*256,r=3+rand()*23;
  g.strokeStyle=i%2?'rgba(255,255,255,.48)':'rgba(0,0,0,.6)';g.fillStyle=g.strokeStyle;g.lineWidth=1+rand()*3;
  g.beginPath();
  switch(index){
   case 0:g.strokeStyle=`hsla(${(x+y)*2},85%,65%,.5)`;g.ellipse(x,y,r*3,r,0,0,7);g.stroke();break;
   case 1:g.fillStyle=i%3?'rgba(255,204,65,.5)':'#332510';g.fillRect(x,y,r,r/2);break;
   case 2:g.moveTo(x,y);g.lineTo(x+r*2,y+r);g.lineTo(x-r,y+r*2);g.closePath();g.fill();break;
   case 3:g.lineWidth=5;g.ellipse(x,y,r*.7,r,.6,0,5.4);g.stroke();break;
   case 4:g.arc((i%12)*24,Math.floor(i/12)*20,14,0,Math.PI);g.stroke();break;
   case 5:case 6:g.lineWidth=index===5?4:1;g.moveTo(x,y);g.lineTo(x+r,y-r*2);g.lineTo(x+r*2,y-r);g.moveTo(x+r,y-r*2);g.lineTo(x,y-r*3);g.stroke();break;
   case 7:case 8:g.globalAlpha=.4;g.fillRect(x,y,index===7?r:2,2+rand()*4);g.globalAlpha=1;break;
   case 9:g.lineWidth=4;g.moveTo(0,y);for(let j=0;j<256;j+=4)g.lineTo(j,y+Math.sin(j*.08+y)*r);g.stroke();break;
   case 10:g.moveTo(x,y);g.lineTo(x+r,y);g.lineTo(x+r,y+r);g.stroke();g.fillRect(x+r-2,y+r-2,4,4);break;
   default:g.fillRect(x,y,r*3,2+rand()*7);
  }
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function defaultFaceTexture(color='#b62435'){
 const c=document.createElement('canvas');c.width=160;c.height=120;const g=c.getContext('2d');
 const grad=g.createLinearGradient(0,0,160,120);grad.addColorStop(0,'#090b10');grad.addColorStop(1,'#1a1d24');g.fillStyle=grad;g.fillRect(0,0,160,120);
 g.strokeStyle='rgba(255,255,255,.16)';g.lineWidth=2;g.strokeRect(3,3,154,114);
 g.fillStyle=color;g.globalAlpha=.86;g.beginPath();g.arc(80,45,19,0,Math.PI*2);g.fill();
 g.beginPath();g.arc(65,87,17,Math.PI/2,Math.PI*1.5);g.arc(95,87,17,Math.PI*1.5,Math.PI/2);g.closePath();g.fill();g.globalAlpha=1;
 g.fillStyle='rgba(255,255,255,.78)';g.font='700 11px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('ORORO',80,108);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function faceMesh(color){
 const frame=new THREE.Mesh(new THREE.PlaneGeometry(.38,.29),new THREE.MeshBasicMaterial({color:0x07090d,side:THREE.DoubleSide}));
 frame.position.set(0,0,-.47);frame.rotation.y=Math.PI;
 const fallback=defaultFaceTexture(color);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.34,.255),new THREE.MeshBasicMaterial({map:fallback,side:THREE.DoubleSide,toneMapped:false}));
 screen.position.set(0,0,.006);frame.add(screen);
 frame.userData.avatarFace={screen,fallback,dynamic:null,version:0};
 return frame;
}

function faceState(group){
 let state=null;group.traverse(o=>{if(!state&&o.userData?.avatarFace)state=o.userData.avatarFace;});return state;
}
function replaceFaceTexture(state,next){
 if(state.dynamic&&state.dynamic!==state.fallback){try{state.dynamic.dispose();}catch{}}
 state.dynamic=next===state.fallback?null:next;state.screen.material.map=next;state.screen.material.needsUpdate=true;
}
export function setAvatarFaceDefault(group){const s=faceState(group);if(!s)return;s.version++;replaceFaceTexture(s,s.fallback);}
export function setAvatarFacePhoto(group,dataUrl){
 const s=faceState(group);if(!s||typeof dataUrl!=='string'||!dataUrl.startsWith('data:image/')||dataUrl.length>50000)return Promise.resolve(false);
 const version=++s.version;
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>{if(version!==s.version)return resolve(false);const t=new THREE.Texture(img);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;replaceFaceTexture(s,t);resolve(true);};
  img.onerror=()=>resolve(false);img.src=dataUrl;
 });
}
export function setAvatarFaceVideo(group,video){
 const s=faceState(group);if(!s||!video)return false;s.version++;
 const t=new THREE.VideoTexture(video);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;
 replaceFaceTexture(s,t);return true;
}

export function avatar(p,label=true){
 const group=new THREE.Group();
 const geometry=p.shape==='sphere'?new THREE.SphereGeometry(.43,24,16):p.shape==='cone'?new THREE.ConeGeometry(.48,.95,24):new THREE.BoxGeometry(.75,.75,.75);
 const map=texture(p.texture,p.color);const material=new THREE.MeshStandardMaterial({map,roughness:.55,metalness:.22,emissive:p.color,emissiveIntensity:.12});
 const body=new THREE.Mesh(geometry,material);
 // O grupo do avatar passa a representar a altura real dos olhos/câmera.
 // O corpo fica abaixo dessa origem e a tela-rosto fica exatamente na linha da câmera.
 body.position.y=-.56;group.add(body);
 const face=faceMesh(p.color);face.position.y=0;group.add(face);
 if(label){const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.clearRect(0,0,512,96);g.font='32px sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.lineWidth=5;g.strokeStyle='rgba(0,0,0,.82)';g.strokeText(p.name,256,48,480);g.fillStyle='#fff';g.fillText(p.name,256,48,480);const t=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:true,transparent:true}));sprite.scale.set(2.4,.45,1);sprite.position.y=.47;group.add(sprite);}
 return group;
}

export function disposeAvatar(group){
 group.traverse(o=>{
  if(o.userData?.avatarFace){const s=o.userData.avatarFace;try{s.dynamic?.dispose();}catch{}try{s.fallback?.dispose();}catch{}}
  o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}
 });group.removeFromParent();
}

const key='ororo-avatar-v25';
function validFacePhoto(v){return typeof v==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(v)&&v.length<=50000;}
export function profile(){
 try{
  const p=JSON.parse(localStorage.getItem(key));
  if(!(p&&typeof p.name==='string'&&p.name.trim()&&['cube','sphere','cone'].includes(p.shape)&&/^#[\da-f]{6}$/i.test(p.color)&&Number.isInteger(p.texture)&&p.texture>=0&&p.texture<12))return null;
  return {...p,faceMode:p.faceMode==='photo'&&validFacePhoto(p.facePhoto)?'photo':'default',facePhoto:validFacePhoto(p.facePhoto)?p.facePhoto:''};
 }catch{return null;}
}
export function saveProfile(p){
 if(!p)return false;
 const safe={name:String(p.name||'').trim().slice(0,24),shape:['cube','sphere','cone'].includes(p.shape)?p.shape:'sphere',color:/^#[\da-f]{6}$/i.test(p.color||'')?p.color:'#b62435',texture:Number.isInteger(p.texture)?Math.max(0,Math.min(11,p.texture)):0,faceMode:p.faceMode==='photo'&&validFacePhoto(p.facePhoto)?'photo':'default',facePhoto:validFacePhoto(p.facePhoto)?p.facePhoto:''};
 try{localStorage.setItem(key,JSON.stringify(safe));return true;}catch{return false;}
}

const accessStorageKey='ororo-access-v34';
const accessEndpoint=new URL('./api.php',import.meta.url);
export function accessKey(){try{return sessionStorage.getItem(accessStorageKey)||'';}catch{return '';}}
export function clearAccessKey(){try{sessionStorage.removeItem(accessStorageKey);}catch{}}
async function authorizeAccess(value,room){
 const r=await fetch(accessEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'authorize',room,accessKey:value,lang:getLang()}),cache:'no-store'});
 let b={};try{b=await r.json();}catch{}
 if(!r.ok){const e=new Error(r.status===403?t('access_denied'):(b.error||t('notice.connection_fail')));e.status=r.status;throw e;}
 return true;
}

export function chooseAvatar(room='sala-01-genese'){return new Promise(resolve=>{
 const old=profile()||{name:'',shape:'sphere',color:'#b62435',texture:0,faceMode:'default',facePhoto:''};
 const names=textureNames();
 const dialog=document.createElement('dialog');dialog.className='panel mp-entry is-open';dialog.setAttribute('aria-label',t('entry.aria'));dialog.innerHTML=`<form><button type="button" class="mp-entry-close">×</button><p class="mp-eyebrow"></p><h2 class="panel-title"></h2><canvas></canvas><label><span class="mp-field-label" data-field="name"></span><input name="name" maxlength="24" required autocomplete="nickname"></label><div class="mp-row"><label><span class="mp-field-label" data-field="shape"></span><select name="shape"><option value="cube"></option><option value="sphere"></option><option value="cone"></option></select></label><label><span class="mp-field-label" data-field="color"></span><input name="color" type="color"></label></div><label><span class="mp-field-label" data-field="texture"></span><select name="texture"></select></label><label><span class="mp-field-label" data-field="access"></span><input name="access" type="password" required autocomplete="current-password" spellcheck="false" autocapitalize="none"></label><p class="mp-access-error" role="alert" hidden></p><button type="submit"></button></form>`;
 document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());dialog.showModal();
 const form=dialog.querySelector('form');
 const error=dialog.querySelector('.mp-access-error'),submit=form.querySelector('button[type=submit]');
 function applyEntryLang(){
  const lang=getLang();document.documentElement.lang={pt:'pt-BR',en:'en',es:'es',de:'de',zh:'zh-CN'}[lang]||'en';
  dialog.setAttribute('aria-label',t('entry.aria'));const closeBtn=dialog.querySelector('.mp-entry-close');closeBtn.setAttribute('aria-label',t('entry.close'));closeBtn.title=t('entry.close');dialog.querySelector('.mp-eyebrow').textContent=t('entry.eyebrow');dialog.querySelector('.panel-title').textContent=t('entry.title');
  dialog.querySelector('canvas').setAttribute('aria-label',t('entry.preview'));
  dialog.querySelector('[data-field="name"]').textContent=t('entry.name');form.elements.name.placeholder=t('entry.name_ph');
  dialog.querySelector('[data-field="shape"]').textContent=t('entry.shape');form.elements.shape.options[0].textContent=t('entry.cube');form.elements.shape.options[1].textContent=t('entry.sphere');form.elements.shape.options[2].textContent=t('entry.cone');
  dialog.querySelector('[data-field="color"]').textContent=t('entry.color');dialog.querySelector('[data-field="texture"]').textContent=t('entry.texture');dialog.querySelector('[data-field="access"]').textContent=t('entry.access');form.elements.access.placeholder=t('entry.access_ph');
  const rawTexture=form.elements.texture.value;const selected=rawTexture!==''&&Number.isInteger(+rawTexture)?+rawTexture:old.texture;const localized=textureNames();form.elements.texture.innerHTML=localized.map((name,i)=>`<option value="${i}">${name}</option>`).join('');form.elements.texture.value=String(selected);
  submit.textContent=t('entry.enter');
 }
 for(const k of ['name','shape','color'])form.elements[k].value=old[k];form.elements.texture.value=String(old.texture);form.elements.access.value=accessKey();applyEntryLang();
 const canvas=dialog.querySelector('canvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});const previewWidth=canvas.clientWidth||280,previewHeight=canvas.clientHeight||160;renderer.setSize(previewWidth,previewHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,previewWidth/previewHeight,.1,10);camera.position.set(0,.3,2.7);camera.lookAt(0,0,0);scene.add(new THREE.HemisphereLight(0xffffff,0x555555,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,3,4);scene.add(light);
 let mesh,raf;const value=()=>({name:form.elements.name.value.trim(),shape:form.elements.shape.value,color:form.elements.color.value,texture:+form.elements.texture.value,faceMode:old.faceMode||'default',facePhoto:old.facePhoto||''});
 function rebuild(){if(mesh)disposeAvatar(mesh);mesh=avatar(value(),false);scene.add(mesh);if(old.faceMode==='photo'&&old.facePhoto)setAvatarFacePhoto(mesh,old.facePhoto);}rebuild();form.addEventListener('input',e=>{if(e.target.name!=='access')rebuild();if(e.target.name==='access'){error.hidden=true;error.textContent='';}});
 function draw(){raf=requestAnimationFrame(draw);mesh.rotation.y=performance.now()*.00035;renderer.render(scene,camera);}draw();
 dialog.querySelector('.mp-entry-close').addEventListener('click',()=>{cancelAnimationFrame(raf);disposeAvatar(mesh);renderer.dispose();dialog.close();dialog.remove();resolve(null);});
 form.addEventListener('submit',async e=>{
  e.preventDefault();const p=value(),keyValue=form.elements.access.value;
  if(!p.name){form.elements.name.focus();return;}if(!keyValue){form.elements.access.focus();return;}
  submit.disabled=true;submit.textContent=t('entry.checking');error.hidden=true;error.textContent='';
  try{
   await authorizeAccess(keyValue,room);
   try{sessionStorage.setItem(accessStorageKey,keyValue);}catch{}
   saveProfile(p);cancelAnimationFrame(raf);disposeAvatar(mesh);renderer.dispose();dialog.close();dialog.remove();resolve(p);
  }catch(err){
   clearAccessKey();error.textContent=err?.message||t('access_denied');error.hidden=false;form.elements.access.select();form.elements.access.focus();
  }finally{submit.disabled=false;submit.textContent=t('entry.enter');}
 });
 });}
