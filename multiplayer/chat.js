import {texture} from './avatar.js?v=38';
import {t,textureNames} from './i18n.js?v=38';
export function createChat({request,getId,getUser,acquireMic,releaseMic,onModal,onUnread}) {
 const dialog=document.createElement('dialog');dialog.className='panel mp-chat';dialog.setAttribute('aria-labelledby','mp-chat-title');
 dialog.innerHTML=`<div class="panel-head"><div><p class="mp-eyebrow">${t('chat.eyebrow')}</p><h2 class="panel-title" id="mp-chat-title"></h2></div><button type="button" class="panel-close" aria-label="${t('chat.close')}">×</button></div><div class="mp-profile"><canvas width="64" height="64" aria-label="${t('chat.avatar_texture')}"></canvas><div><p class="mp-profile-meta"></p><p class="mp-profile-state"></p></div></div><div class="mp-messages scroll-thin" role="log" aria-label="${t('chat.messages')}" aria-live="polite"></div><p class="mp-chat-status" role="status"></p><form class="mp-compose"><label class="mp-sr" for="mp-text">${t('chat.message')}</label><textarea id="mp-text" maxlength="1000" rows="2" placeholder="${t('chat.placeholder')}"></textarea><button type="submit" class="mp-button">${t('chat.send')}</button></form><div class="mp-record-row"><button type="button" class="mp-button mp-record">${t('chat.record')}</button><span class="mp-record-time">${t('chat.up_to')}</span></div><div class="mp-record-preview" hidden><audio controls preload="metadata"></audio><div class="mp-row"><button type="button" class="mp-button mp-audio-send">${t('chat.send_audio')}</button><button type="button" class="mp-button mp-discard">${t('chat.discard')}</button></div></div>`;
 document.body.append(dialog);
 const title=dialog.querySelector('h2'),log=dialog.querySelector('.mp-messages'),status=dialog.querySelector('.mp-chat-status'),input=dialog.querySelector('textarea'),form=dialog.querySelector('form'),recordBtn=dialog.querySelector('.mp-record'),preview=dialog.querySelector('.mp-record-preview'),previewAudio=preview.querySelector('audio');
 const messages=new Map(),unread=new Map(),drafts=new Map(),urls=new Map();let target=null,previousFocus=null,recorder=null,recording=false,recordPending=false,recordGeneration=0,recordTimer=null,started=0,blob=null,previewURL=null,audioMid=null,textMid=null,busy=false,disposed=false,shown=new Set();
 const say=t=>{status.textContent=t;};
 const notify=()=>onUnread([...unread.values()].reduce((a,b)=>a+b,0));
 function renderMessage(m){if(shown.has(m.seq))return;shown.add(m.seq);const box=document.createElement('article');box.className='mp-message'+(m.from===getId()?' is-self':'');
  const head=document.createElement('span');head.className='mp-message-author';head.textContent=m.from===getId()?t('chat.you'):m.name;box.append(head);
  if(m.kind==='text'){const body=document.createElement('p');body.textContent=m.text;box.append(body);}else{
   const play=document.createElement('button');play.className='mp-button';play.textContent=t('chat.listen');
   play.onclick=async()=>{play.disabled=true;try{let url=urls.get(m.seq);if(!url){const r=await request({action:'download',seq:m.seq});if(disposed)return;const bytes=Uint8Array.from(atob(r.audio.data),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:r.audio.mime}));urls.set(m.seq,url);}
    if(!box.isConnected)return;const a=document.createElement('audio');a.controls=true;a.src=url;a.setAttribute('playsinline','');box.append(a);play.remove();a.play().catch(()=>say(t('chat.tap_play')));
   }catch(e){say(e.message);play.disabled=false;}};box.append(play);
  }
  log.append(box);
 }
 function renderHistory(){log.querySelectorAll('audio').forEach(a=>a.pause());log.replaceChildren();shown.clear();for(const m of messages.values())if(m.from===target||m.to===target)renderMessage(m);if(!log.children.length){const p=document.createElement('p');p.className='mp-chat-empty';p.textContent=t('chat.empty');log.append(p);}log.scrollTop=log.scrollHeight;}
 function add(batch){if(disposed)return;let changed=false;for(const m of batch){if(messages.has(m.seq))continue;messages.set(m.seq,m);changed=true;const other=m.from===getId()?m.to:m.from;
  if(m.from!==getId()&&(!dialog.open||target!==other))unread.set(other,(unread.get(other)||0)+1);
  if(dialog.open&&target===other){log.querySelector('.mp-chat-empty')?.remove();const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<100;renderMessage(m);if(atBottom)log.scrollTop=log.scrollHeight;}
 }
 while(messages.size>256){const seq=messages.keys().next().value;messages.delete(seq);if(urls.has(seq)){URL.revokeObjectURL(urls.get(seq));urls.delete(seq);}}
 if(changed)notify();}
 function sync(){if(!target)return;const user=getUser(target);const online=!!user;dialog.querySelector('.mp-profile-state').textContent=online?(user.mic?t('chat.online_mic'):t('chat.online_no_mic')):t('chat.left');input.disabled=!online;form.querySelector('button').disabled=!online||busy;recordBtn.disabled=!online||busy||recordPending;preview.querySelector('.mp-audio-send').disabled=!online||busy;}
 function open(id){const user=getUser(id);if(!user)return;if(dialog.open)close();target=id;previousFocus=document.activeElement;title.textContent=user.profile.name;
  const shape={cube:t('chat.shape_cube'),sphere:t('chat.shape_sphere'),cone:t('chat.shape_cone')}[user.profile.shape];const names=textureNames();dialog.querySelector('.mp-profile-meta').textContent=`${shape} / ${names[user.profile.texture]} / ${user.profile.color}`;
  const avatarTexture=texture(user.profile.texture,user.profile.color);dialog.querySelector('canvas').getContext('2d').drawImage(avatarTexture.image,0,0,64,64);avatarTexture.dispose();
  input.value=drafts.get(id)||'';unread.delete(id);notify();say('');renderHistory();sync();onModal(true);dialog.showModal();dialog.classList.add('is-open');dialog.querySelector('.panel-close').focus();}
 function clearPreview(){blob=null;audioMid=null;previewAudio.pause();previewAudio.removeAttribute('src');previewAudio.load();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;preview.hidden=true;}
 function stopRecording(discard=false){clearInterval(recordTimer);recordTimer=null;recording=false;
  if(recorder){recorder.discard=discard;if(recorder.state!=='inactive')recorder.stop();}
  releaseMic('message');recordBtn.textContent=t('chat.record');dialog.querySelector('.mp-record-time').textContent=t('chat.up_to');}
 function close(){recordGeneration++;drafts.set(target,input.value);recordPending=false;stopRecording(true);clearPreview();log.querySelectorAll('audio').forEach(a=>a.pause());dialog.close();dialog.classList.remove('is-open');onModal(false);previousFocus?.focus?.();}
 dialog.querySelector('.panel-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 form.onsubmit=async e=>{e.preventDefault();const text=input.value.trim();if(!text||busy||!getUser(target))return;const to=target;busy=true;sync();const mid=textMid?.text===text&&textMid.to===to?textMid.mid:crypto.randomUUID();textMid={text,to,mid};
  try{const r=await request({action:'send',to,kind:'text',text,mid});add([r.message]);textMid=null;drafts.delete(to);if(target===to){if(input.value.trim()===text)input.value='';say('');}}
  catch(err){if(target===to)say(err.message+' '+t('chat.retry_send'));}finally{busy=false;sync();}};
 recordBtn.onclick=async()=>{
  if(recording){stopRecording();return;}if(recordPending||busy)return;
  if(!window.MediaRecorder){say(t('chat.no_recorder'));return;}
  clearPreview();const to=target,generation=++recordGeneration;recordPending=true;sync();say('');
  try{const stream=await acquireMic('message');if(generation!==recordGeneration||!recordPending||!dialog.open||target!==to){if(!recordPending)releaseMic('message');return;}
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw new Error(t('chat.no_format'));
   const r=new MediaRecorder(stream,{mimeType:type,audioBitsPerSecond:64000});recorder=r;const chunks=[];let bytes=0;
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>750000&&r.state==='recording'){r.discard=true;stopRecording(true);say(t('chat.audio_big'));}}};
   r.onerror=()=>{stopRecording(true);say(t('chat.record_interrupted'));};
   const track=stream.getAudioTracks?.()[0];const ended=()=>{if(recorder===r)stopRecording();};track?.addEventListener?.('ended',ended);
   r.onstop=()=>{track?.removeEventListener?.('ended',ended);if(recorder===r)recorder=null;if(r.discard||!dialog.open||target!==to)return;const result=new Blob(chunks,{type:r.mimeType||type});if(result.size<16||result.size>750000){say(t('chat.record_invalid'));return;}blob=result;audioMid=crypto.randomUUID();previewURL=URL.createObjectURL(blob);previewAudio.src=previewURL;preview.hidden=false;};
   r.start(250);recording=true;started=performance.now();recordBtn.textContent=t('chat.stop_record');recordTimer=setInterval(()=>{const sec=Math.floor((performance.now()-started)/1000);dialog.querySelector('.mp-record-time').textContent=`${sec} / 30 S`;if(sec>=30)stopRecording();},250);
  }catch(err){if(generation===recordGeneration){releaseMic('message');say(err.name==='NotAllowedError'?t('chat.mic_denied'):err.message);}}finally{if(generation===recordGeneration){recordPending=false;sync();}}
 };
 preview.querySelector('.mp-discard').onclick=()=>clearPreview();
 preview.querySelector('.mp-audio-send').onclick=async()=>{if(!blob||busy||!getUser(target))return;const to=target,recorded=blob,mid=audioMid;busy=true;sync();say(t('chat.sending_audio'));try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(recorded);});const r=await request({action:'send',to,kind:'audio',data,mime:recorded.type,mid});add([r.message]);if(target===to){clearPreview();say('');}}catch(e){if(target===to)say(e.message+' '+t('chat.record_kept'));}finally{busy=false;sync();}};
 return {open,add,sync,isOpen:()=>dialog.open,unreadFor:id=>unread.get(id)||0,reset(){if(dialog.open)close();messages.clear();unread.clear();drafts.clear();for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();notify();},dispose(){disposed=true;if(dialog.open)close();else stopRecording(true);for(const url of urls.values())URL.revokeObjectURL(url);dialog.remove();}};
}
