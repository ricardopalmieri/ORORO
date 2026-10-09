import * as THREE from 'three';
import {avatar,disposeAvatar,setAvatarFaceDefault,setAvatarFacePhoto,setAvatarFaceVideo,saveProfile,accessKey,clearAccessKey} from './avatar.js?v=38';
import {SfuMedia} from './sfu.js?v=38';
import {createChat} from './chat.js?v=38';
import {t,getLang,locale} from './i18n.js?v=38';

const endpoint=new URL('./api.php',import.meta.url);
const sfuEndpoint=new URL('./sfu.php',import.meta.url);
const ROOM_LIMIT=8;
let ACTIVE_CLIENT=null;

export async function connectRoom({scene,camera,room,profile,onModal=()=>{},onCapture=()=>{},getLaserTarget=()=>null}) {
 if(ACTIVE_CLIENT&&!ACTIVE_CLIENT.isStopped()){
  await ACTIVE_CLIENT.attach({scene,camera,room,onModal,onCapture,getLaserTarget});
  return ACTIVE_CLIENT;
 }
 let currentScene=scene,currentCamera=camera,currentRoom=room,currentOnModal=onModal,currentOnCapture=onCapture,currentGetLaserTarget=getLaserTarget;
 let transitioning=false;
 const hud=document.createElement('details');
 hud.className='mp-hud';
 hud.innerHTML=`<summary><span class="mp-dot"></span><span class="mp-count">${t('hud.connecting')}</span><span class="mp-badge" hidden></span></summary><div class="mp-tools"><p class="mp-eyebrow">${t('hud.presence')}</p><button type="button" class="mp-button mp-mic" aria-pressed="false">${t('hud.mic_on')}</button><button type="button" class="mp-button mp-listen" aria-pressed="true">${t('hud.listen_yes')}</button><button type="button" class="mp-button mp-unlock" hidden>${t('hud.unlock')}</button><section class="mp-face-tools"><p class="mp-eyebrow">${t('hud.face')}</p><div class="mp-face-preview"><div class="mp-face-placeholder"><span></span><b>${t('hud.thumbnail')}</b></div><img alt="${t('entry.preview')}" hidden><video muted playsinline webkit-playsinline hidden></video></div><div class="mp-face-actions"><button type="button" class="mp-button mp-face-photo">${t('hud.photo')}</button><button type="button" class="mp-button mp-face-camera" aria-pressed="false">${t('hud.camera_on')}</button><button type="button" class="mp-button mp-face-default">${t('hud.default_face')}</button></div><input class="mp-face-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><p class="mp-face-hint">${t('hud.face_hint')}</p></section><section class="mp-laser-tools"><p class="mp-eyebrow">${t('hud.laser')}</p><div class="mp-laser-actions"><button type="button" class="mp-button mp-laser" aria-pressed="false">${t('hud.laser_on')}</button><label class="mp-laser-color-wrap"><span>${t('hud.laser_color')}</span><input class="mp-laser-color" type="color" value="#ff334d" aria-label="${t('hud.laser_color')}"></label></div></section><p class="mp-notice" role="status"></p><ul class="mp-users"></ul><button type="button" class="mp-button mp-reconnect">${t('hud.reconnect_media')}</button><button type="button" class="mp-button mp-exit">${t('hud.exit')}</button></div>`;
 document.body.append(hud);

 const activity=document.createElement('details');
 activity.className='mp-activity';
 activity.open=true;
 activity.innerHTML=`<summary><span>${t('hud.activity')}</span><span class="mp-activity-count">0</span></summary><ol class="mp-activity-list" aria-live="polite"></ol>`;
 document.body.append(activity);

 const connectionGuard=document.createElement('section');
 connectionGuard.className='mp-connection-guard';
 connectionGuard.hidden=true;
 connectionGuard.setAttribute('role','alertdialog');
 connectionGuard.setAttribute('aria-modal','true');
 connectionGuard.innerHTML=`<div class="mp-connection-card"><p class="mp-eyebrow">${t('hud.connection')}</p><h2>${t('hud.lost')}</h2><p class="mp-connection-copy">${t('hud.lost_copy')}</p><p class="mp-connection-detail">${t('hud.auto_retry')}</p><button type="button" class="mp-button mp-connection-retry">${t('hud.retry')}</button></div>`;
 document.body.append(connectionGuard);

 const status=hud.querySelector('.mp-count');
 const notice=hud.querySelector('.mp-notice');
 const mic=hud.querySelector('.mp-mic');
 const list=hud.querySelector('ul');
 const unlock=hud.querySelector('.mp-unlock');
 const facePhotoBtn=hud.querySelector('.mp-face-photo');
 const faceCameraBtn=hud.querySelector('.mp-face-camera');
 const faceDefaultBtn=hud.querySelector('.mp-face-default');
 const faceFile=hud.querySelector('.mp-face-file');
 const facePreview=hud.querySelector('.mp-face-preview');
 const facePreviewImage=facePreview.querySelector('img');
 const facePreviewVideo=facePreview.querySelector('video');
 const facePlaceholder=facePreview.querySelector('.mp-face-placeholder');
 const laserBtn=hud.querySelector('.mp-laser');
 const laserColorInput=hud.querySelector('.mp-laser-color');
 const connectionDetail=connectionGuard.querySelector('.mp-connection-detail');
 const connectionRetry=connectionGuard.querySelector('.mp-connection-retry');
 const isMobile=window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=800;
 const peers=new Map(),users=new Map(),captureUses=new Set();
 let id,token,chatAck=0,stopped=false,rawStream=null,capturePending=null,live=false,listening=true,micBusy=false,timer,failures=0,lastSent=0,listKey='',spawnApplied=false,eventKey='';
 let pollBusy=false,retryRequested=false,connectionLost=false,lastServerOk=Date.now();
 let cameraStream=null,cameraPending=null,facePhoto=typeof profile.facePhoto==='string'?profile.facePhoto:'',faceMode=profile.faceMode==='photo'&&profile.facePhoto?'photo':'default',faceFallback=profile.faceMode==='photo'&&profile.facePhoto?'photo':'default',faceDirty=true,faceSyncPending=null;
 let laserActive=false,laserColor=localStorage.getItem('ororo_laser_color')||'#ff334d';
 const laserTarget=new THREE.Vector3(),laserOrigin=new THREE.Vector3();
 laserColorInput.value=laserColor;

 const sfu=new SfuMedia({
  endpoint:sfuEndpoint,
  getAuth:()=>({room:currentRoom,id,token}),
  onAudioTrack:(ownerId,track)=>{
   const p=peers.get(ownerId);if(!p)return;p.state='connected';p.audio.srcObject=new MediaStream([track]);track.onunmute=()=>playPeer(p);playPeer(p);renderUsers();
  },
  onVideoTrack:(ownerId,track)=>{
   const p=peers.get(ownerId);if(!p)return;p.video.srcObject=new MediaStream([track]);
   const show=()=>{p.video.play().catch(()=>{});if(p.faceMode==='camera')applyPeerFace(p);};track.addEventListener('unmute',show);p.video.addEventListener('loadeddata',show,{once:true});show();
  },
  onState:state=>{
   for(const p of peers.values())p.state=state==='connected'||state==='completed'?'connected':state;
   renderUsers();
   if(state==='connected'||state==='completed'){for(const p of peers.values())playPeer(p);}
   if(state==='unavailable'||state==='failed')notice.textContent=t('notice.sfu_unavailable');
  },
  onError:e=>{console.warn('ORORO SFU:',e);if(!stopped)notice.textContent=e?.message||t('notice.sfu_fail');}
 });

 async function request(data){
  const controller=new AbortController();
  const timeoutMs=data?.action==='poll'?5000:15000;
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:currentRoom,id,token,lang:getLang(),...data}),signal:controller.signal,cache:'no-store'});
   let b;
   try{b=await r.json();}catch{throw new Error(t('notice.server_unavailable'));}
   if(!r.ok){const e=new Error(b.error||t('notice.connection_fail'));e.status=r.status;throw e;}
   return b;
  }finally{clearTimeout(timeout);}
 }

 function syncCapture(){currentOnCapture(captureUses.size>0);}
 function releaseMic(use){
  captureUses.delete(use);syncCapture();
  if(!captureUses.size&&rawStream){
   const s=rawStream;rawStream=null;s.getTracks().forEach(t=>t.stop());
  }
 }

 async function acquireMic(use){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error(t('notice.mic_https'));
  captureUses.add(use);syncCapture();
  try{
   if(rawStream?.getAudioTracks().some(t=>t.readyState==='live'))return rawStream;
   if(!capturePending){
    capturePending=navigator.mediaDevices.getUserMedia({
     audio:{
      echoCancellation:true,
      noiseSuppression:true,
      autoGainControl:!isMobile,
      channelCount:1
     },
     video:false
    }).then(s=>{
     if(stopped||!captureUses.size){s.getTracks().forEach(t=>t.stop());throw new Error(t('notice.capture_cancelled'));}
     rawStream=s;
     const track=s.getAudioTracks()[0];
     if(track)track.contentHint='speech';
     track?.addEventListener('ended',()=>{
      if(rawStream!==s)return;
      rawStream=null;live=false;captureUses.clear();syncCapture();refreshMic();
      sfu?.setAudioTrack(null).catch(()=>{});
      notice.textContent=t('notice.mic_interrupted');
     });
     return s;
    }).finally(()=>{capturePending=null;});
   }
   return await capturePending;
  }catch(e){captureUses.delete(use);syncCapture();throw e;}
 }

 const chat=createChat({
  request,
  getId:()=>id,
  getUser:key=>users.get(key),
  acquireMic,
  releaseMic,
  onModal:(open)=>currentOnModal(open),
  onUnread:count=>{
   const b=hud.querySelector('.mp-badge');
   b.hidden=!count;b.textContent=String(count);renderUsers();
  }
 });

 function refreshMic(){mic.textContent=live?t('hud.mic_off'):t('hud.mic_on');mic.setAttribute('aria-pressed',String(live));}
 function getTrack(){return live?rawStream?.getAudioTracks().find(t=>t.readyState==='live')||null:null;}
 function getVideoTrack(){return faceMode==='camera'?cameraStream?.getVideoTracks().find(t=>t.readyState==='live')||null:null;}
 function persistFace(){saveProfile({...profile,faceMode:faceMode==='photo'?'photo':'default',facePhoto});}
 async function syncFaceServer(){
  if(!id||!token||stopped)return false;
  if(faceSyncPending)return faceSyncPending;
  const payload={action:'face',mode:faceMode};
  if(faceMode==='photo'&&facePhoto)payload.photo=facePhoto;
  faceSyncPending=request(payload).then(()=>{faceDirty=false;return true;}).catch(()=>{faceDirty=true;return false;}).finally(()=>{faceSyncPending=null;});
  return faceSyncPending;
 }
 function publishFaceState(){faceDirty=true;syncFaceServer();}
 async function fetchPeerFace(user,p){
  const version=Number(user.faceVersion)||0,mode=user.faceMode||'default';
  if(p.serverFaceVersion===version&&p.serverFaceMode===mode)return;
  p.serverFaceMode=mode;
  if(mode!=='photo'){p.serverFaceVersion=version;p.faceMode=mode;p.facePhoto='';applyPeerFace(p);return;}
  if(p.faceLoadingVersion===version)return;
  p.faceLoadingVersion=version;
  try{
   const r=await request({action:'face_get',userId:user.id});
   if(!peers.has(user.id)||p.faceLoadingVersion!==version)return;
   const f=r.face;if(f?.mode==='photo'&&Number(f.version)===version&&typeof f.photo==='string'){p.facePhoto=f.photo;p.faceMode='photo';p.serverFaceVersion=version;applyPeerFace(p);}
  }catch{}finally{if(p.faceLoadingVersion===version)p.faceLoadingVersion=null;}
 }
 function updateFaceUI(){
  const isCamera=faceMode==='camera',isPhoto=faceMode==='photo'&&!!facePhoto;
  facePlaceholder.hidden=isCamera||isPhoto;
  facePreviewImage.hidden=!isPhoto;facePreviewVideo.hidden=!isCamera;
  if(isPhoto)facePreviewImage.src=facePhoto;else facePreviewImage.removeAttribute('src');
  if(isCamera&&cameraStream){facePreviewVideo.srcObject=cameraStream;facePreviewVideo.play().catch(()=>{});}else{facePreviewVideo.pause();facePreviewVideo.srcObject=null;}
  facePhotoBtn.textContent=facePhoto?(faceMode==='photo'?t('hud.photo_change'):t('hud.photo_saved')):t('hud.photo');
  faceCameraBtn.textContent=isCamera?t('hud.camera_off'):t('hud.camera_on');faceCameraBtn.setAttribute('aria-pressed',String(isCamera));
  facePhotoBtn.setAttribute('aria-pressed',String(isPhoto));faceDefaultBtn.setAttribute('aria-pressed',String(faceMode==='default'));
 }
 function stopCameraCapture(){
  const stream=cameraStream;cameraStream=null;
  if(stream)stream.getVideoTracks().forEach(t=>t.stop());
  facePreviewVideo.pause();facePreviewVideo.srcObject=null;
 }
 async function updateVideoPeers(){await sfu?.setVideoTrack(getVideoTrack());}
 async function useFallbackFace(){
  stopCameraCapture();faceMode=faceFallback==='photo'&&facePhoto?'photo':'default';persistFace();updateFaceUI();
  await updateVideoPeers();publishFaceState();
 }
 async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error(t('notice.camera_https'));
  if(faceMode==='camera'){await useFallbackFace();return;}
  faceFallback=faceMode==='photo'&&facePhoto?'photo':'default';
  if(!cameraPending){
   cameraPending=navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:320,max:320},height:{ideal:240,max:240},frameRate:{ideal:10,max:12},facingMode:'user'}}).finally(()=>{cameraPending=null;});
  }
  const stream=await cameraPending;
  if(stopped){stream.getTracks().forEach(t=>t.stop());return;}
  stopCameraCapture();cameraStream=stream;const track=stream.getVideoTracks()[0];
  if(track){try{track.contentHint='detail';}catch{}track.addEventListener('ended',()=>{if(cameraStream!==stream)return;cameraStream=null;faceMode=faceFallback==='photo'&&facePhoto?'photo':'default';updateFaceUI();updateVideoPeers();publishFaceState();});}
  faceMode='camera';updateFaceUI();await updateVideoPeers();publishFaceState();
 }
 async function imageToFaceData(file){
  if(!file||!/^image\/(?:png|jpeg|webp)$/i.test(file.type))throw new Error(t('notice.image_type'));
  if(file.size>12*1024*1024)throw new Error(t('notice.image_big'));
  let source,cleanup=()=>{};
  if('createImageBitmap' in window){source=await createImageBitmap(file);cleanup=()=>source.close?.();}
  else{const url=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(t('notice.image_open')));img.src=url;});cleanup=()=>URL.revokeObjectURL(url);}
  try{
   const sw=source.width,sh=source.height;if(!sw||!sh)throw new Error(t('notice.image_invalid'));
   const encode=(w,h,q)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{alpha:false});g.fillStyle='#090b10';g.fillRect(0,0,w,h);const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;g.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);let data=c.toDataURL('image/webp',q);if(!data.startsWith('data:image/webp'))data=c.toDataURL('image/jpeg',q);return data;};
   let data=encode(256,192,.76);if(data.length>45000)data=encode(192,144,.66);if(data.length>45000)data=encode(160,120,.58);if(data.length>50000)throw new Error(t('notice.image_optimize'));return data;
  }finally{cleanup();}
 }
 updateFaceUI();

 function makeLaserVisual(){
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(6);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.LineBasicMaterial({color:laserColor,transparent:true,opacity:.95,depthTest:true,depthWrite:false});
  const line=new THREE.Line(geometry,material);line.frustumCulled=false;line.renderOrder=12;
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:laserColor,depthTest:true,depthWrite:false}));dot.renderOrder=13;
  const group=new THREE.Group();group.visible=false;group.userData.noLaser=true;line.userData.noLaser=true;dot.userData.noLaser=true;group.add(line,dot);currentScene.add(group);
  return {group,line,dot,positions};
 }
 function setLaserVisual(v,active,origin,target,color){
  if(!v)return;v.group.visible=!!active;if(!active)return;
  const c=new THREE.Color(color||'#ff334d');v.line.material.color.copy(c);v.dot.material.color.copy(c);
  v.positions[0]=origin.x;v.positions[1]=origin.y;v.positions[2]=origin.z;v.positions[3]=target.x;v.positions[4]=target.y;v.positions[5]=target.z;
  v.line.geometry.attributes.position.needsUpdate=true;v.line.geometry.computeBoundingSphere();v.dot.position.copy(target);
 }
 function disposeLaser(v){if(!v)return;v.group.removeFromParent();v.line.geometry.dispose();v.line.material.dispose();v.dot.geometry.dispose();v.dot.material.dispose();}
 let localLaser=makeLaserVisual();

 async function playPeer(p){
  if(!p.audio.srcObject)return;
  p.audio.muted=!listening;
  if(isMobile)p.audio.volume=.58;
  try{await p.audio.play();p.blocked=false;}
  catch(e){if(e.name==='NotAllowedError'){p.blocked=true;unlock.hidden=false;notice.textContent=t('notice.tap_audio');}}
 }
 function resumeAudio(){for(const p of peers.values())playPeer(p);}
 function removePeer(key){
  const p=peers.get(key);if(!p)return;
  p.audio.pause();p.audio.srcObject=null;p.audio.remove();
  if(p.video){p.video.pause();p.video.srcObject=null;p.video.remove();}
  disposeLaser(p.laser);disposeAvatar(p.mesh);peers.delete(key);
 }
 function updatePose(p,pose){
  if(!Array.isArray(pose)||pose.length!==4||!pose.every(v=>Number.isFinite(v)&&Math.abs(v)<1000))return;
  p.target.set(pose[0],pose[1],pose[2]);p.yaw=pose[3];
 }

 function renderActivity(events=[]){
  const latest=events.slice(-30);
  const key=JSON.stringify(latest.map(e=>[e.seq,e.name,e.type,e.text,e.from,e.to]));
  if(key===eventKey)return;eventKey=key;
  const list=activity.querySelector('.mp-activity-list');list.replaceChildren();
  activity.querySelector('.mp-activity-count').textContent=String(latest.length);
  for(const e of latest.slice().reverse()){
   const li=document.createElement('li');
   const who=document.createElement('strong');who.textContent=e.name||t('hud.system');
   const legacyType={'entrou na sala':'joined','saiu da sala':'left','desconectou':'disconnected','ligou o microfone':'mic_on','desligou o microfone':'mic_off','mandou uma mensagem':'chat','enviou uma mensagem de voz':'voice'}[e.text];
   const eventType=e.type||legacyType;const what=document.createElement('span');let detail=eventType?t('activity.'+eventType):(e.text||'');if(eventType==='room_changed'&&e.to)detail+=` · ${String(e.to).replace(/^sala-\d+[a-z]?-?/,'').replace(/-/g,' ')}`;what.textContent=' '+detail;
   li.append(who,what);list.append(li);
  }
  if(!latest.length){const li=document.createElement('li');li.className='mp-activity-empty';li.textContent=t('hud.no_activity');list.append(li);}
 }

 const labels={new:t('state.connecting'),connecting:t('state.connecting'),checking:t('state.checking'),connected:t('state.connected'),completed:t('state.connected'),disconnected:t('state.reconnecting'),reconnecting:t('state.reconnecting'),failed:t('state.unavailable'),unavailable:t('state.unavailable'),error:t('state.reconnecting'),closed:t('state.unavailable')};

 function renderUsers(){
  const snapshot=[...users.values()].map(u=>[u.id,u.profile?.name,u.mic,peers.get(u.id)?.state,chat?.unreadFor(u.id)]);
  const key=JSON.stringify(snapshot);
  if(key===listKey)return;
  listKey=key;list.replaceChildren();
  const ordered=[...users.values()].sort((a,b)=>{
   const unreadDiff=(chat?.unreadFor(b.id)||0)-(chat?.unreadFor(a.id)||0);
   if(unreadDiff)return unreadDiff;
   return String(a.profile.name).localeCompare(String(b.profile.name),locale(),{sensitivity:'base'});
  });
  for(const u of ordered){
   const li=document.createElement('li'),button=document.createElement('button');button.className='mp-user';
   const top=document.createElement('span');top.className='mp-user-head';
   const name=document.createElement('span');name.className='mp-user-name';name.textContent=u.profile.name+(u.id===id?` (${t('hud.you')})`:'');
   top.append(name);
   const badgeCount=chat?.unreadFor(u.id)||0;
   if(badgeCount){const badge=document.createElement('span');badge.className='mp-user-unread';badge.textContent=String(badgeCount);badge.setAttribute('aria-label',t('hud.new_messages',{count:badgeCount}));top.append(badge);}
   const state=document.createElement('small');state.textContent=u.id===id?(live?t('state.mic_on'):t('state.mic_off')):labels[peers.get(u.id)?.state]||t('state.chat_only');
   button.append(top,state);button.disabled=u.id===id;button.onclick=()=>{hud.open=false;chat.open(u.id);};li.append(button);list.append(li);
  }
 }

 function applyPeerFace(p){
  if(p.faceMode==='photo'&&p.facePhoto){setAvatarFacePhoto(p.mesh,p.facePhoto);return;}
  if(p.faceMode==='camera'&&p.video?.readyState>=2){setAvatarFaceVideo(p.mesh,p.video);return;}
  setAvatarFaceDefault(p.mesh);
 }
 function makePeer(user){
  const mesh=avatar(user.profile);mesh.traverse(o=>{if(o.isMesh)o.userData.peerId=user.id;});currentScene.add(mesh);
  const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.setAttribute('webkit-playsinline','');audio.className='mp-live-audio';if(isMobile)audio.volume=.58;document.body.append(audio);
  const video=document.createElement('video');video.autoplay=true;video.muted=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.className='mp-live-video';document.body.append(video);
  const p={mesh,audio,video,laser:makeLaserVisual(),target:new THREE.Vector3(),yaw:0,direct:0,state:sfu?.ready?'connecting':'new',blocked:false,faceMode:'default',facePhoto:'',serverFaceMode:'default',serverFaceVersion:-1,faceLoadingVersion:null,laserState:user.laser||{active:false,color:'#ff334d',target:[0,1.4,0]},laserDisplayTarget:new THREE.Vector3(),laserDesiredTarget:new THREE.Vector3()};updatePose(p,user.pose);mesh.position.copy(p.target);peers.set(user.id,p);
  const oldAudio=sfu?.getRemoteTrack(user.id,'audio');if(oldAudio){audio.srcObject=new MediaStream([oldAudio]);audio.play().catch(()=>{});}
  const oldVideo=sfu?.getRemoteTrack(user.id,'video');if(oldVideo){video.srcObject=new MediaStream([oldVideo]);video.play().then(()=>applyPeerFace(p)).catch(()=>applyPeerFace(p));}
  return p;
 }
 function reconcile(all){
  const ids=new Set(all.map(u=>u.id));
  for(const key of peers.keys())if(!ids.has(key))removePeer(key);
  users.clear();
  for(const u of all){
   users.set(u.id,u);
   if(u.id!==id){const p=peers.get(u.id)||makePeer(u);p.laserState=u.laser||p.laserState;if(performance.now()-p.direct>1500)updatePose(p,u.pose);fetchPeerFace(u,p);}
  }
  status.textContent=t('hud.in_room',{count:all.length,limit:ROOM_LIMIT});
  renderUsers();chat.sync();
  sfu?.syncUsers(all).catch(e=>{notice.textContent=e.message||t('notice.subscribe_fail');});
 }

 function pose(){return [currentCamera.position.x,currentCamera.position.y,currentCamera.position.z,currentCamera.rotation.y];}

 function clearRemotePresence(){
  for(const key of [...peers.keys()])removePeer(key);
  users.clear();listKey='';renderUsers();chat.sync();
 }
 function showConnectionLost(message){
  if(stopped)return;
  if(!connectionLost){connectionLost=true;clearRemotePresence();}
  status.textContent=t('hud.offline');
  connectionDetail.textContent=message||(navigator.onLine===false?t('notice.device_offline'):t('notice.room_unreachable'));
  connectionRetry.disabled=false;connectionRetry.textContent=t('hud.retry');connectionGuard.hidden=false;
 }
 function hideConnectionLost(){
  connectionLost=false;connectionGuard.hidden=true;connectionRetry.disabled=false;connectionRetry.textContent=t('hud.retry');lastServerOk=Date.now();
 }

 async function join(){
  const serverProfile={name:profile.name,shape:profile.shape,color:profile.color,texture:profile.texture};
  const b=await request({action:'join',profile:serverProfile,pose:pose(),spread:!spawnApplied,accessKey:accessKey()});
  if(stopped){fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',room:currentRoom,id:b.id,token:b.token}),keepalive:true}).catch(()=>{});return;}
  const previousId=id;id=b.id;token=b.token;chatAck=0;
  if(!spawnApplied&&Array.isArray(b.spawnOffset)&&b.spawnOffset.length===2){
   const [dx,dz]=b.spawnOffset.map(Number);
   if(Number.isFinite(dx)&&Number.isFinite(dz)){currentCamera.position.x+=dx;currentCamera.position.z+=dz;}
   spawnApplied=true;
  }
  reconcile(b.users);renderActivity(b.events||[]);failures=0;lastServerOk=Date.now();hideConnectionLost();
  try{await sfu.start(previousId!==id);notice.textContent=t('notice.media_connected');sfu.syncUsers(b.users).catch(()=>{});}
  catch(e){notice.textContent=e.message||t('notice.sfu_unavailable');hud.open=true;}
  faceDirty=true;syncFaceServer();
 }

 async function processPollResponse(b){
  reconcile(b.users);renderActivity(b.events||[]);
  chat.add(b.messages||[]);for(const m of b.messages||[])chatAck=Math.max(chatAck,m.seq);
  const recovered=connectionLost;failures=0;lastServerOk=Date.now();hideConnectionLost();
  if(recovered&&sfu&&!['connected','completed'].includes(sfu.pc?.connectionState))sfu.retry();
  if(faceDirty)syncFaceServer();
 }

 async function poll(force=false){
  if(stopped||transitioning)return;
  if(pollBusy){if(force)retryRequested=true;return;}
  clearTimeout(timer);pollBusy=true;
  if(force){connectionRetry.disabled=true;connectionRetry.textContent=t('hud.retrying');}
  try{
   const b=await request({action:'poll',pose:pose(),mic:live,chatAck,laser:{active:laserActive,color:laserColor,target:[laserTarget.x,laserTarget.y,laserTarget.z]}});
   if(stopped)return;
   await processPollResponse(b);
  }catch(e){
   if(stopped)return;failures++;status.textContent=t('hud.reconnecting');
   if(e.status===401){
    clearRemotePresence();chat.reset();
    try{await join();failures=0;}catch(err){notice.textContent=err.message;if(err.status===403){clearAccessKey();showConnectionLost(t('access_denied'));}else showConnectionLost(navigator.onLine===false?t('notice.device_offline'):t('notice.session_expired'));}
   }else{
    notice.textContent=e.name==='AbortError'?t('notice.room_timeout'):e.message;
    showConnectionLost(navigator.onLine===false?t('notice.offline_retry'):t('notice.room_interrupted'));
   }
  }finally{
   pollBusy=false;connectionRetry.disabled=false;connectionRetry.textContent=t('hud.retry');
   if(stopped||transitioning)return;
   const immediate=retryRequested;retryRequested=false;
   const laserBusy=laserActive||[...users.values()].some(u=>u.id!==id&&u.laser?.active);timer=setTimeout(()=>poll(false),immediate?0:(laserBusy?180:Math.min(5000,650*2**Math.min(failures,3))));
  }
 }

 mic.onclick=async()=>{
  resumeAudio();if(micBusy)return;micBusy=true;mic.disabled=true;
  try{
   if(live){live=false;releaseMic('live');await sfu.setAudioTrack(null);}
   else{await acquireMic('live');if(stopped)return;live=true;await sfu.setAudioTrack(getTrack());resumeAudio();}
   notice.textContent=live?t('notice.mic_live'):'';
  }catch(e){live=false;releaseMic('live');notice.textContent=e.name==='NotAllowedError'?t('notice.mic_denied'):e.message;}
  finally{micBusy=false;mic.disabled=false;refreshMic();listKey='';renderUsers();}
 };

 facePhotoBtn.onclick=async()=>{
  if(facePhoto&&faceMode!=='photo'){stopCameraCapture();faceMode='photo';faceFallback='photo';persistFace();updateFaceUI();await updateVideoPeers();publishFaceState();notice.textContent=t('notice.photo_applied');return;}
  faceFile.click();
 };
 faceFile.onchange=async()=>{
  const file=faceFile.files?.[0];faceFile.value='';if(!file)return;facePhotoBtn.disabled=true;
  try{const data=await imageToFaceData(file);stopCameraCapture();facePhoto=data;faceMode='photo';faceFallback='photo';persistFace();updateFaceUI();await updateVideoPeers();publishFaceState();notice.textContent=t('notice.photo_applied');}
  catch(e){notice.textContent=e.message||t('notice.image_fail');}
  finally{facePhotoBtn.disabled=false;}
 };
 faceCameraBtn.onclick=async()=>{
  faceCameraBtn.disabled=true;
  try{await startCamera();notice.textContent=faceMode==='camera'?t('notice.camera_live'):t('notice.camera_stopped');}
  catch(e){notice.textContent=e.name==='NotAllowedError'?t('notice.camera_denied'):(e.message||t('notice.camera_fail'));}
  finally{faceCameraBtn.disabled=false;updateFaceUI();}
 };
 faceDefaultBtn.onclick=async()=>{stopCameraCapture();faceMode='default';faceFallback='default';persistFace();updateFaceUI();await updateVideoPeers();publishFaceState();notice.textContent=t('notice.default_applied');};
 laserBtn.onclick=()=>{laserActive=!laserActive;laserBtn.setAttribute('aria-pressed',String(laserActive));laserBtn.textContent=laserActive?t('hud.laser_off'):t('hud.laser_on');if(!laserActive)localLaser.group.visible=false;poll(true);};
 laserColorInput.oninput=()=>{laserColor=laserColorInput.value||'#ff334d';localStorage.setItem('ororo_laser_color',laserColor);if(laserActive)poll(true);};

 unlock.onclick=async()=>{await Promise.allSettled([...peers.values()].map(playPeer));unlock.hidden=![...peers.values()].some(p=>p.blocked);if(unlock.hidden)notice.textContent='';};
 hud.querySelector('.mp-listen').onclick=()=>{listening=!listening;const btn=hud.querySelector('.mp-listen');btn.textContent=listening?t('hud.listen_yes'):t('hud.listen_no');btn.setAttribute('aria-pressed',String(listening));for(const p of peers.values())p.audio.muted=!listening;if(listening)resumeAudio();};
 hud.querySelector('.mp-reconnect').onclick=()=>{resumeAudio();sfu.retry();notice.textContent=t('notice.media_reconnect');};
 connectionRetry.onclick=()=>poll(true);
 const onOffline=()=>showConnectionLost(t('notice.network_lost'));
 const onOnline=()=>{if(connectionLost){connectionDetail.textContent=t('notice.network_back');poll(true);}};
 const wake=()=>{if(document.visibilityState==='visible'){resumeAudio();if(connectionLost)poll(true);}};
 document.addEventListener('visibilitychange',wake);document.addEventListener('pointerdown',resumeAudio);window.addEventListener('offline',onOffline);window.addEventListener('online',onOnline);

 function sendLeave(){
  if(!id||!token)return;
  const payload=JSON.stringify({action:'leave',room:currentRoom,id,token,lang:getLang()});
  try{if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([payload],{type:'application/json'})))return;}catch{}
  fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true}).catch(()=>{});
 }
 function stop(){
  if(stopped)return;stopped=true;clearTimeout(timer);chat.dispose();captureUses.clear();syncCapture();rawStream?.getTracks().forEach(t=>t.stop());stopCameraCapture();sfu.close();
  for(const key of peers.keys())removePeer(key);
  document.removeEventListener('visibilitychange',wake);document.removeEventListener('pointerdown',resumeAudio);window.removeEventListener('offline',onOffline);window.removeEventListener('online',onOnline);
  disposeLaser(localLaser);sendLeave();activity.remove();connectionGuard.remove();hud.remove();if(ACTIVE_CLIENT?.stop===stop)ACTIVE_CLIENT=null;
 }
 hud.querySelector('.mp-exit').onclick=()=>{stop();location.href=new URL('../index.html',import.meta.url);};
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});

 try{await join();poll();}
 catch(e){status.textContent=t('hud.offline');notice.textContent=e.message;hud.open=true;if(e.status===403){clearAccessKey();showConnectionLost(t('access_denied'));}else showConnectionLost(navigator.onLine===false?t('notice.device_offline'):t('notice.join_fail'));timer=setTimeout(()=>poll(false),1800);}

 async function attach(next){
  if(stopped)throw new Error(t('notice.session_expired'));
  if(!next?.scene||!next?.camera||!next?.room)return;
  if(next.room===currentRoom){
   currentScene=next.scene;currentCamera=next.camera;currentOnModal=next.onModal||(()=>{});currentOnCapture=next.onCapture||(()=>{});currentGetLaserTarget=next.getLaserTarget||(()=>null);syncCapture();return;
  }
  transitioning=true;clearTimeout(timer);laserActive=false;laserBtn.setAttribute('aria-pressed','false');laserBtn.textContent=t('hud.laser_on');
  const started=performance.now();while(pollBusy&&performance.now()-started<2200)await new Promise(r=>setTimeout(r,25));
  try{
   clearRemotePresence();
   await sfu.clearRemote().catch(()=>{});
   disposeLaser(localLaser);
   const targetPose=[next.camera.position.x,next.camera.position.y,next.camera.position.z,next.camera.rotation.y];
   const b=await request({action:'switch',toRoom:next.room,pose:targetPose});
   currentRoom=next.room;currentScene=next.scene;currentCamera=next.camera;currentOnModal=next.onModal||(()=>{});currentOnCapture=next.onCapture||(()=>{});currentGetLaserTarget=next.getLaserTarget||(()=>null);
   if(Array.isArray(b.spawnOffset)&&b.spawnOffset.length===2){const dx=Number(b.spawnOffset[0]),dz=Number(b.spawnOffset[1]);if(Number.isFinite(dx)&&Number.isFinite(dz)){currentCamera.position.x+=dx;currentCamera.position.z+=dz;}}
   localLaser=makeLaserVisual();chatAck=0;chat.reset();eventKey='';listKey='';reconcile(b.users||[]);renderActivity(b.events||[]);syncCapture();
   await sfu.syncUsers(b.users||[]).catch(()=>{});notice.textContent=t('notice.media_connected');
  }finally{
   transitioning=false;if(!stopped){clearTimeout(timer);timer=setTimeout(()=>poll(false),120);}
  }
 }

 const hitTargets=[];
 function keepLocalPlayerApart(){
  const minDistance=1.08,min2=minDistance*minDistance;
  for(const [peerId,p] of peers){
   let dx=currentCamera.position.x-p.target.x,dz=currentCamera.position.z-p.target.z;
   let d2=dx*dx+dz*dz;if(d2>=min2)continue;
   if(d2<0.0001){const seed=[...String(id||peerId)].reduce((a,c)=>a+c.charCodeAt(0),0);const a=(seed%628)/100;dx=Math.cos(a);dz=Math.sin(a);d2=1;}
   const scale=minDistance/Math.sqrt(d2);
   currentCamera.position.x=p.target.x+dx*scale;currentCamera.position.z=p.target.z+dz*scale;
  }
 }
 const api={
  update(dt){
   if(stopped)return;const now=performance.now();
   keepLocalPlayerApart();
   if(laserActive){
    const target=currentGetLaserTarget?.();if(target?.isVector3)laserTarget.copy(target);else if(Array.isArray(target)&&target.length===3)laserTarget.set(...target);
    currentCamera.getWorldPosition(laserOrigin);setLaserVisual(localLaser,true,laserOrigin,laserTarget,laserColor);
   }else if(localLaser)localLaser.group.visible=false;
   for(const p of peers.values()){
    p.mesh.position.lerp(p.target,1-Math.exp(-10*dt));
    const angle=Math.atan2(Math.sin(p.yaw-p.mesh.rotation.y),Math.cos(p.yaw-p.mesh.rotation.y));p.mesh.rotation.y+=angle*(1-Math.exp(-10*dt));
    const ls=p.laserState||{};const tar=ls.target;
    if(ls.active&&Array.isArray(tar)&&tar.length===3){laserOrigin.copy(p.mesh.position);p.laserDesiredTarget.set(Number(tar[0])||0,Number(tar[1])||0,Number(tar[2])||0);if(!p.laser.group.visible)p.laserDisplayTarget.copy(p.laserDesiredTarget);else p.laserDisplayTarget.lerp(p.laserDesiredTarget,1-Math.exp(-14*dt));setLaserVisual(p.laser,true,laserOrigin,p.laserDisplayTarget,ls.color);}else if(p.laser)p.laser.group.visible=false;
   }
   if(now-lastSent>66)lastSent=now;
  },
  pick(raycaster){hitTargets.length=0;for(const p of peers.values())p.mesh.traverse(o=>{if(o.isMesh)hitTargets.push(o);});const hit=raycaster.intersectObjects(hitTargets,false)[0];return hit&&hit.distance<=12?hit:null;},
  openPeer(peerId){hud.open=false;chat.open(peerId);},
  minimapPlayers(){return [...users.values()].filter(u=>u.id!==id&&Array.isArray(u.pose)).map(u=>({id:u.id,name:u.profile?.name||'',color:u.profile?.color||'#e8e1d2',x:Number(u.pose[0])||0,z:Number(u.pose[2])||0}));},
  isModalOpen:chat.isOpen,
  isStopped:()=>stopped,
  attach,
  stop
 };
 ACTIVE_CLIENT=api;
 return api;
}
