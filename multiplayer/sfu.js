import {t,getLang} from './i18n.js?v=38';
// OЯOЯO v33 - Cloudflare Realtime SFU.
// Audio and a tiny placeholder video track are published in the initial offer.
// Camera on/off therefore uses replaceTrack() and never adds a new video m-section mid-session.
export class SfuMedia {
 constructor({endpoint,getAuth,onAudioTrack=()=>{},onVideoTrack=()=>{},onState=()=>{},onError=()=>{}}){
  Object.assign(this,{endpoint,getAuth,onAudioTrack,onVideoTrack,onState,onError});
  this.pc=null;this.sessionId='';this.audioSender=null;this.videoSender=null;this.audioTransceiver=null;this.videoTransceiver=null;
  this.silentAudio=null;this.silentContext=null;this.silentOsc=null;
  this.placeholderVideo=null;this.placeholderCanvas=null;this.placeholderTimer=null;
  this.currentAudio=null;this.currentVideo=null;this.closed=false;this.ready=false;this.serial=Promise.resolve();
  this.midMap=new Map();this.subscribed=new Map();this.remoteTracks=new Map();this.lastUsers=[];this.retryTimer=null;this.ownerId='';this.syncPending=false;this.syncAgain=false;
 }
 call(data){
  const auth=this.getAuth();
  if(!auth?.room||!auth?.id||!auth?.token)throw new Error(t('sfu.room_not_ready'));
  return fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...auth,lang:getLang(),...data})}).then(async r=>{
   let b={};try{b=await r.json();}catch{}
   if(!r.ok){const e=new Error(b.error||t('notice.sfu_fail'));e.status=r.status;throw e;}return b;
  });
 }
 enqueue(fn){const run=this.serial.catch(()=>{}).then(()=>{if(!this.closed)return fn();});this.serial=run.catch(e=>{if(!this.closed)this.onError(e);});return run;}
 async makeSilentAudio(){
  if(this.silentAudio?.readyState==='live')return this.silentAudio;
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw new Error(t('sfu.web_audio'));
  const ctx=this.silentContext=new AC({latencyHint:'interactive'});const osc=ctx.createOscillator(),gain=ctx.createGain(),dest=ctx.createMediaStreamDestination();gain.gain.value=0;osc.connect(gain).connect(dest);osc.start();
  this.silentOsc=osc;this.silentAudio=dest.stream.getAudioTracks()[0];return this.silentAudio;
 }
 async makePlaceholderVideo(){
  if(this.placeholderVideo?.readyState==='live')return this.placeholderVideo;
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;
  const draw=()=>{const g=canvas.getContext('2d',{alpha:false});if(!g)return;g.fillStyle='#080a0e';g.fillRect(0,0,160,120);g.fillStyle='#161b23';g.fillRect(4,4,152,112);g.fillStyle='#090b10';g.fillRect(5,5,150,110);g.fillStyle='#b62435';g.beginPath();g.arc(80,52,15,0,Math.PI*2);g.fill();g.fillStyle='rgba(255,255,255,.72)';g.font='700 10px monospace';g.textAlign='center';g.fillText('ORORO',80,98);g.fillStyle=`rgba(255,255,255,${.05+((Date.now()/5000|0)%2)*.01})`;g.fillRect(1,1,1,1);};
  draw();
  if(typeof canvas.captureStream!=='function')throw new Error(t('sfu.video_channel'));
  const stream=canvas.captureStream(1);const track=stream.getVideoTracks()[0];if(!track)throw new Error(t('sfu.video_prepare'));
  try{track.contentHint='detail';}catch{}
  this.placeholderCanvas=canvas;this.placeholderVideo=track;
  this.placeholderTimer=setInterval(()=>{draw();try{track.requestFrame?.();}catch{}},5000);
  return track;
 }
 createPc(){
  const pc=this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}],bundlePolicy:'max-bundle'});
  pc.ontrack=e=>{
   const mid=e.transceiver?.mid||'';const meta=this.midMap.get(mid);if(!meta)return;
   this.remoteTracks.set(`${meta.ownerId}:${meta.kind}`,e.track);
   if(meta.kind==='audio')this.onAudioTrack(meta.ownerId,e.track,meta);else if(meta.kind==='video')this.onVideoTrack(meta.ownerId,e.track,meta);
  };
  const state=()=>{
   if(pc!==this.pc||this.closed)return;const s=pc.connectionState||pc.iceConnectionState||'new';this.onState(s);
   clearTimeout(this.retryTimer);
   if(s==='failed')this.retryTimer=setTimeout(()=>this.retry(),900);
   else if(s==='disconnected')this.retryTimer=setTimeout(()=>this.retry(),4500);
  };
  pc.onconnectionstatechange=state;pc.oniceconnectionstatechange=state;
 }
 async start(force=false){return this.enqueue(async()=>{
  const auth=this.getAuth();if(!auth?.id)throw new Error(t('sfu.local_missing'));
  if(this.ready&&!force&&this.ownerId===auth.id)return;
  await this._reset(false);this.ownerId=auth.id;this.onState('connecting');
  const created=await this.call({action:'session'});this.sessionId=created.sessionId;if(!this.sessionId)throw new Error(t('sfu.session_fail'));
  this.createPc();const [silent,placeholder]=await Promise.all([this.makeSilentAudio(),this.makePlaceholderVideo()]);
  this.audioTransceiver=this.pc.addTransceiver(this.currentAudio||silent,{direction:'sendonly'});this.audioSender=this.audioTransceiver.sender;
  this.videoTransceiver=this.pc.addTransceiver(this.currentVideo||placeholder,{direction:'sendonly'});this.videoSender=this.videoTransceiver.sender;
  await this.publish([{kind:'audio',transceiver:this.audioTransceiver},{kind:'video',transceiver:this.videoTransceiver}]);
  this.ready=true;await this.applySenderLimits();this.onState(this.pc.connectionState||'connecting');
  if(this.lastUsers.length)await this._syncUsers(this.lastUsers);
 });}
 async publish(items){
  const offer=await this.pc.createOffer();await this.pc.setLocalDescription(offer);
  const tracks=items.map(({kind,transceiver})=>({location:'local',mid:transceiver.mid,trackName:transceiver.sender.track?.id||`${kind}-${crypto.randomUUID()}`,kind}));
  const r=await this.call({action:'publish',sessionId:this.sessionId,sessionDescription:{type:'offer',sdp:this.pc.localDescription.sdp},tracks});
  if(!r.sessionDescription)throw new Error(t('sfu.publish_sdp'));
  await this.pc.setRemoteDescription(r.sessionDescription);
 }
 async applySenderLimits(){
  if(this.audioSender?.getParameters&&this.audioSender?.setParameters){try{const p=this.audioSender.getParameters();if(!p.encodings?.length)p.encodings=[{}];p.encodings[0].maxBitrate=40000;await this.audioSender.setParameters(p);}catch{}}
  if(this.videoSender?.getParameters&&this.videoSender?.setParameters){try{const p=this.videoSender.getParameters();if(!p.encodings?.length)p.encodings=[{}];p.encodings[0].maxBitrate=this.currentVideo?120000:18000;p.encodings[0].maxFramerate=this.currentVideo?10:1;await this.videoSender.setParameters(p);}catch{}}
 }
 async setAudioTrack(track){
  this.currentAudio=track?.readyState==='live'?track:null;
  return this.enqueue(async()=>{if(!this.ready||!this.audioSender)return;const silent=await this.makeSilentAudio();await this.audioSender.replaceTrack(this.currentAudio||silent);await this.applySenderLimits();});
 }
 async setVideoTrack(track){
  this.currentVideo=track?.readyState==='live'?track:null;
  return this.enqueue(async()=>{
   if(!this.ready||!this.videoSender)return;
   const placeholder=await this.makePlaceholderVideo();
   await this.videoSender.replaceTrack(this.currentVideo||placeholder);
   await this.applySenderLimits();
  });
 }
 syncUsers(users){
  this.lastUsers=Array.isArray(users)?users:[];if(this.syncPending){this.syncAgain=true;return Promise.resolve();}
  this.syncPending=true;return this.enqueue(async()=>{do{this.syncAgain=false;await this._syncUsers(this.lastUsers);}while(this.syncAgain&&!this.closed);}).finally(()=>{this.syncPending=false;});
 }
 async _syncUsers(users){
  if(!this.ready||!this.pc||this.pc.signalingState!=='stable')return;
  const auth=this.getAuth();const wanted=[];
  for(const u of users){if(!u||u.id===auth.id)continue;const s=u.sfu||{};if(!s.sessionId)continue;
   if(s.audioTrack)wanted.push({ownerId:u.id,kind:'audio',sessionId:s.sessionId,trackName:s.audioTrack});
   // The video publisher exists from session start, but only subscribe when the remote face is actually in camera mode.
   if(u.faceMode==='camera'&&s.videoTrack)wanted.push({ownerId:u.id,kind:'video',sessionId:s.sessionId,trackName:s.videoTrack});
  }
  const wantedKeys=new Set(wanted.map(t=>`${t.ownerId}:${t.kind}`));
  const stale=[...this.subscribed.entries()].filter(([key])=>!wantedKeys.has(key));
  if(stale.length){
   const mids=stale.map(([,m])=>String(m.mid||'')).filter(Boolean);
   if(mids.length)await this.call({action:'close_remote',sessionId:this.sessionId,mids}).catch(e=>this.onError(e));
   for(const [key,m] of stale){this.subscribed.delete(key);this.remoteTracks.delete(key);if(m?.mid!=null)this.midMap.delete(String(m.mid));}
  }
  const add=wanted.filter(t=>{const old=this.subscribed.get(`${t.ownerId}:${t.kind}`);return !old||old.sessionId!==t.sessionId||old.trackName!==t.trackName;});
  if(!add.length)return;
  const r=await this.call({action:'subscribe',sessionId:this.sessionId,tracks:add});
  for(const m of r.ororoMap||[]){this.midMap.set(String(m.mid),m);this.subscribed.set(`${m.ownerId}:${m.kind}`,m);}
  if(r.requiresImmediateRenegotiation){
   if(!r.sessionDescription)throw new Error(t('sfu.renegotiate_sdp'));
   await this.pc.setRemoteDescription(r.sessionDescription);const answer=await this.pc.createAnswer();await this.pc.setLocalDescription(answer);
   await this.call({action:'renegotiate',sessionId:this.sessionId,sessionDescription:{type:'answer',sdp:this.pc.localDescription.sdp}});
  }
 }
 getRemoteTrack(ownerId,kind){const t=this.remoteTracks.get(`${ownerId}:${kind}`);return t?.readyState==='live'?t:null;}
 async clearRemote(){return this.enqueue(async()=>{
  if(!this.ready||!this.sessionId)return;
  const mids=[...this.subscribed.values()].map(m=>String(m.mid||'')).filter(Boolean);
  if(mids.length){try{await this.call({action:'close_remote',sessionId:this.sessionId,mids});}catch(e){this.onError(e);}}
  this.midMap.clear();this.subscribed.clear();this.remoteTracks.clear();this.lastUsers=[];
 });}
 async retry(){if(this.closed)return;this.onState('reconnecting');try{await this.start(true);}catch(e){this.onError(e);this.onState('unavailable');}}
 async _reset(detach=true){
  clearTimeout(this.retryTimer);this.ready=false;this.midMap.clear();this.subscribed.clear();this.remoteTracks.clear();
  try{this.pc?.close();}catch{}this.pc=null;this.audioSender=null;this.videoSender=null;this.audioTransceiver=null;this.videoTransceiver=null;
  if(detach&&this.sessionId){try{await this.call({action:'detach',sessionId:this.sessionId});}catch{}}
  this.sessionId='';
 }
 async close(){
  this.closed=true;clearTimeout(this.retryTimer);clearInterval(this.placeholderTimer);this.placeholderTimer=null;
  try{this.pc?.close();}catch{}this.pc=null;
  try{this.silentAudio?.stop();}catch{}try{this.silentOsc?.stop();}catch{}try{await this.silentContext?.close();}catch{}
  try{this.placeholderVideo?.stop();}catch{}
  this.silentAudio=null;this.silentContext=null;this.placeholderVideo=null;this.placeholderCanvas=null;
 }
}
