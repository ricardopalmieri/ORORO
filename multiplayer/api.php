<?php
// OЯOЯO v38. Acesso protegido + presença persistente entre salas + laser + chat/SFU.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function fail(int $code, string $message): void { http_response_code($code); echo json_encode(['error'=>$message]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405,'Use POST');
if (($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site') fail(403,'Origem inválida');
if (stripos($_SERVER['CONTENT_TYPE']??'', 'application/json')!==0) fail(415,'Use application/json');
$raw=file_get_contents('php://input',false,null,0,1100001);
if(strlen($raw)>1100000) fail(413,'Mensagem muito grande');
$b=json_decode($raw,true);if(!is_array($b)) fail(400,'JSON inválido');
$LANG=in_array(($b['lang']??''),['pt','en','es','de','zh'],true)?$b['lang']:'pt';
function trApi(string $key):string{
 global $LANG;
 $m=[
  'access_denied'=>['pt'=>'ACESSO NÃO AUTORIZADO. ACESSE NOISETUPI.COM.BR/ORORO','en'=>'ACCESS NOT AUTHORIZED. GO TO NOISETUPI.COM.BR/ORORO','es'=>'ACCESO NO AUTORIZADO. VISITA NOISETUPI.COM.BR/ORORO','de'=>'ZUGRIFF NICHT AUTORISIERT. BESUCHE NOISETUPI.COM.BR/ORORO','zh'=>'未授权访问。请前往 NOISETUPI.COM.BR/ORORO'],
  'too_many'=>['pt'=>'MUITAS TENTATIVAS. ACESSE NOISETUPI.COM.BR/ORORO','en'=>'TOO MANY ATTEMPTS. GO TO NOISETUPI.COM.BR/ORORO','es'=>'DEMASIADOS INTENTOS. VISITA NOISETUPI.COM.BR/ORORO','de'=>'ZU VIELE VERSUCHE. BESUCHE NOISETUPI.COM.BR/ORORO','zh'=>'尝试次数过多。请前往 NOISETUPI.COM.BR/ORORO'],
  'room_full'=>['pt'=>'Sala cheia (8 pessoas). Tente novamente em instantes.','en'=>'Room full (8 people). Try again shortly.','es'=>'Sala llena (8 personas). Inténtalo de nuevo en unos instantes.','de'=>'Raum voll (8 Personen). Versuche es in Kürze erneut.','zh'=>'房间已满（8 人）。请稍后重试。'],
  'name_invalid'=>['pt'=>'Nome inválido','en'=>'Invalid name','es'=>'Nombre no válido','de'=>'Ungültiger Name','zh'=>'名字无效'],
  'shape_invalid'=>['pt'=>'Forma inválida','en'=>'Invalid shape','es'=>'Forma no válida','de'=>'Ungültige Form','zh'=>'形状无效'],
  'color_invalid'=>['pt'=>'Cor inválida','en'=>'Invalid color','es'=>'Color no válido','de'=>'Ungültige Farbe','zh'=>'颜色无效'],
  'texture_invalid'=>['pt'=>'Textura inválida','en'=>'Invalid texture','es'=>'Textura no válida','de'=>'Ungültige Textur','zh'=>'纹理无效'],
  'session_expired'=>['pt'=>'Sessão expirada','en'=>'Session expired','es'=>'Sesión caducada','de'=>'Sitzung abgelaufen','zh'=>'会话已过期'],
  'wait'=>['pt'=>'Aguarde','en'=>'Please wait','es'=>'Espera','de'=>'Bitte warten','zh'=>'请稍候'],
  'face_mode'=>['pt'=>'Modo de rosto inválido.','en'=>'Invalid face mode.','es'=>'Modo de rostro no válido.','de'=>'Ungültiger Gesichtsmodus.','zh'=>'头像面孔模式无效。'],
  'photo_invalid'=>['pt'=>'Foto inválida.','en'=>'Invalid photo.','es'=>'Foto no válida.','de'=>'Ungültiges Foto.','zh'=>'照片无效。'],
  'photo_big'=>['pt'=>'Foto inválida ou muito grande.','en'=>'Invalid photo or file too large.','es'=>'Foto no válida o demasiado grande.','de'=>'Ungültiges oder zu großes Foto.','zh'=>'照片无效或文件过大。'],
  'photo_fail'=>['pt'=>'Não foi possível atualizar a foto.','en'=>'Could not update the photo.','es'=>'No se pudo actualizar la foto.','de'=>'Das Foto konnte nicht aktualisiert werden.','zh'=>'无法更新照片。'],
  'face_unavailable'=>['pt'=>'Rosto indisponível.','en'=>'Face unavailable.','es'=>'Rostro no disponible.','de'=>'Gesicht nicht verfügbar.','zh'=>'头像面孔不可用。'],
  'person_left'=>['pt'=>'Esta pessoa saiu da sala.','en'=>'This person left the room.','es'=>'Esta persona salió de la sala.','de'=>'Diese Person hat den Raum verlassen.','zh'=>'此人已离开房间。'],
  'id_invalid'=>['pt'=>'Identificador inválido','en'=>'Invalid identifier','es'=>'Identificador no válido','de'=>'Ungültige Kennung','zh'=>'标识符无效'],
  'send_wait'=>['pt'=>'Aguarde um instante antes de enviar outra mensagem.','en'=>'Wait a moment before sending another message.','es'=>'Espera un momento antes de enviar otro mensaje.','de'=>'Warte einen Moment, bevor du eine weitere Nachricht sendest.','zh'=>'请稍等片刻再发送下一条消息。'],
  'text_invalid'=>['pt'=>'Texto inválido (até 1000 caracteres).','en'=>'Invalid text (up to 1000 characters).','es'=>'Texto no válido (hasta 1000 caracteres).','de'=>'Ungültiger Text (bis zu 1000 Zeichen).','zh'=>'文本无效（最多 1000 个字符）。'],
  'audio_format'=>['pt'=>'Formato de áudio não suportado.','en'=>'Audio format not supported.','es'=>'Formato de audio no compatible.','de'=>'Audioformat wird nicht unterstützt.','zh'=>'不支持此音频格式。'],
  'audio_invalid'=>['pt'=>'Áudio inválido ou maior que 750 KB.','en'=>'Invalid audio or larger than 750 KB.','es'=>'Audio no válido o mayor de 750 KB.','de'=>'Ungültiges Audio oder größer als 750 KB.','zh'=>'音频无效或大于 750 KB。'],
  'audio_content'=>['pt'=>'Conteúdo de áudio inválido.','en'=>'Invalid audio content.','es'=>'Contenido de audio no válido.','de'=>'Ungültiger Audioinhalt.','zh'=>'音频内容无效。'],
  'audio_save'=>['pt'=>'Não foi possível salvar o áudio.','en'=>'Could not save the audio.','es'=>'No se pudo guardar el audio.','de'=>'Das Audio konnte nicht gespeichert werden.','zh'=>'无法保存音频。'],
  'message_type'=>['pt'=>'Tipo de mensagem inválido','en'=>'Invalid message type','es'=>'Tipo de mensaje no válido','de'=>'Ungültiger Nachrichtentyp','zh'=>'消息类型无效'],
  'audio_unavailable'=>['pt'=>'Áudio indisponível ou expirado.','en'=>'Audio unavailable or expired.','es'=>'Audio no disponible o caducado.','de'=>'Audio nicht verfügbar oder abgelaufen.','zh'=>'音频不可用或已过期。'],
  'room_save'=>['pt'=>'Falha ao salvar a sala.','en'=>'Failed to save the room.','es'=>'No se pudo guardar la sala.','de'=>'Der Raum konnte nicht gespeichert werden.','zh'=>'无法保存房间。']
 ];
 return $m[$key][$LANG]??$m[$key]['en']??$key;
}
$room=$b['room']??'';
if(!is_string($room)||!preg_match('/^sala-[a-z0-9-]{1,64}$/D',$room)||!is_file(__DIR__.'/../rooms/data/'.$room.'.json')) fail(400,'Sala inválida');
$action=$b['action']??'poll';
if(!in_array($action,['authorize','join','poll','switch','leave','send','download','face','face_get'],true)) fail(400,'Ação inválida');
if(!in_array($action,['send'],true) && strlen($raw)>65536) fail(413,'Pedido muito grande');
// A palavra-chave nunca fica em JS nem em texto claro no servidor. Somente o SHA-256 esperado.
const ORORO_ACCESS_HASH='40dabcb3ca9050990e599169aa2aac03857e18868aecc3c034c7df0cbbb18227';
function accessDenied(): void { fail(403,trApi('access_denied')); }
function requireAccess(mixed $candidate): void {
 $ok=is_string($candidate)&&$candidate!==''&&hash_equals(ORORO_ACCESS_HASH,hash('sha256',$candidate));
 $rateDir=sys_get_temp_dir().'/ororo-v34-access-'.substr(hash('sha256',__DIR__),0,16);
 if(!is_dir($rateDir))@mkdir($rateDir,0700,true);
 $ip=(string)($_SERVER['REMOTE_ADDR']??'unknown');$rateFile=$rateDir.'/'.hash('sha256',$ip).'.json';$now=time();
 $rf=@fopen($rateFile,'c+');$attempts=[];
 if($rf&&flock($rf,LOCK_EX)){
  $decoded=json_decode(stream_get_contents($rf),true);if(is_array($decoded))$attempts=array_values(array_filter($decoded,fn($t)=>is_int($t)&&$now-$t<600));
  if(!$ok){
   if(count($attempts)>=12){flock($rf,LOCK_UN);fclose($rf);fail(429,trApi('too_many'));}
   $attempts[]=$now;rewind($rf);ftruncate($rf,0);fwrite($rf,json_encode($attempts));fflush($rf);
  }else{rewind($rf);ftruncate($rf,0);fflush($rf);}
  flock($rf,LOCK_UN);fclose($rf);
 }
 if(!$ok)accessDenied();
}
if($action==='authorize'){
 requireAccess($b['accessKey']??null);
 echo json_encode(['ok'=>true],JSON_UNESCAPED_UNICODE);exit;
}
$dir=sys_get_temp_dir().'/ororo-v34-'.substr(hash('sha256',__DIR__),0,20);
if(!is_dir($dir)&&!mkdir($dir,0700,true)) fail(503,'Sem armazenamento temporário');
$facePath=fn(string $uid):string=>$dir.'/face-'.hash('sha256',$room.'|'.$uid).'.face';
$f=fopen($dir.'/'.$room.'.json','c+');if(!$f||!flock($f,LOCK_EX)) fail(503,'Sala indisponível');
$s=json_decode(stream_get_contents($f),true)?:['users'=>[],'messages'=>[],'mseq'=>0,'events'=>[],'eseq'=>0];
if(!isset($s['events'])||!is_array($s['events']))$s['events']=[];
if(!isset($s['eseq']))$s['eseq']=0;
$now=microtime(true);
$pushEvent=function(string $name,string $type,array $meta=[])use(&$s,$now):void{
 $s['events'][]=['seq'=>++$s['eseq'],'time'=>$now,'name'=>$name,'type'=>$type]+$meta;
 if(count($s['events'])>80)$s['events']=array_slice($s['events'],-80);
};
foreach($s['users'] as $k=>$u)if($now-(float)($u['seen']??0)>12){$pushEvent((string)($u['profile']['name']??'SYSTEM'),'disconnected');@unlink($facePath((string)$k));unset($s['users'][$k]);}
$kept=[];
foreach($s['messages'] as $m){
 if($now-$m['time']>1800 || (!isset($s['users'][$m['from']])&&!isset($s['users'][$m['to']]))){if(isset($m['file']))@unlink($dir.'/'.$m['file']);}
 else $kept[]=$m;
}
$s['messages']=$kept;
foreach(glob($dir.'/*.voice')?:[] as $path)if($now-filemtime($path)>1800)@unlink($path);
foreach(glob($dir.'/face-*.face')?:[] as $path)if($now-filemtime($path)>86400)@unlink($path);
$id=$b['id']??'';$token=$b['token']??'';$extra=[];
if($action==='join'){
 requireAccess($b['accessKey']??null);
 $roomLimit=8;
 if(count($s['users'])>=$roomLimit) fail(409,trApi('room_full'));
 $p=$b['profile']??[];if(!is_array($p)||!is_string($p['name']??null))fail(400,trApi('name_invalid'));
 $name=trim($p['name']);if($name===''||strlen($name)>96||preg_match_all('/./us',$name)>24)fail(400,trApi('name_invalid'));
 if(!in_array($p['shape']??'', ['cube','sphere','cone'],true))fail(400,trApi('shape_invalid'));
 if(!is_string($p['color']??null)||!preg_match('/^#[0-9a-f]{6}$/iD',$p['color']))fail(400,trApi('color_invalid'));
 if(!is_int($p['texture']??null)||$p['texture']<0||$p['texture']>11)fail(400,trApi('texture_invalid'));
 $p=['name'=>$name,'shape'=>$p['shape'],'color'=>$p['color'],'texture'=>$p['texture']];
 $id=bin2hex(random_bytes(12));$token=bin2hex(random_bytes(24));
 $basePose=$b['pose']??[0,1.65,7,0];
 if(!is_array($basePose)||count($basePose)!==4||count(array_filter($basePose,fn($v)=>is_numeric($v)&&is_finite((float)$v)&&abs((float)$v)<1000))!==4)$basePose=[0,1.65,7,0];
 $basePose=array_map('floatval',array_values($basePose));
 $usedSlots=[];foreach($s['users'] as $existing)if(isset($existing['slot'])&&is_int($existing['slot']))$usedSlots[$existing['slot']]=true;
 $slot=0;while(isset($usedSlots[$slot])&&$slot<64)$slot++;
 $spread=($b['spread']??true)===true;$angle=($slot%8)*(M_PI/4)+intdiv($slot,8)*0.31;$radius=1.35+intdiv($slot,8)*0.55;
 $dx=$spread?cos($angle)*$radius:0.0;$dz=$spread?sin($angle)*$radius:0.0;$spawnPose=[$basePose[0]+$dx,$basePose[1],$basePose[2]+$dz,$basePose[3]];
 $s['users'][$id]=['id'=>$id,'secret'=>hash('sha256',$token),'profile'=>$p,'pose'=>$spawnPose,'slot'=>$slot,'seen'=>$now,'last'=>0,'sent'=>0,'mic'=>false,'faceMode'=>'default','faceVersion'=>0,'faceMime'=>'','laser'=>['active'=>false,'color'=>'#ff334d','target'=>[0,1.4,0]],'sfu'=>['sessionId'=>'','audioTrack'=>'','videoTrack'=>'','updated'=>0]];
 $pushEvent($name,'joined');$extra['token']=$token;$extra['spawnOffset']=[$dx,$dz];
}else{
 if(!is_string($id)||!isset($s['users'][$id])||!is_string($token)||!hash_equals($s['users'][$id]['secret'],hash('sha256',$token)))fail(401,trApi('session_expired'));
 $s['users'][$id]['seen']=$now;
 if($action==='switch'){
  $toRoom=$b['toRoom']??'';
  if(!is_string($toRoom)||!preg_match('/^sala-[a-z0-9-]{1,64}$/D',$toRoom)||!is_file(__DIR__.'/../rooms/data/'.$toRoom.'.json'))fail(400,'Sala de destino inválida');
  if($toRoom!==$room){
   $targetFile=$dir.'/'.$toRoom.'.json';$tf=fopen($targetFile,'c+');
   if(!$tf||!flock($tf,LOCK_EX|LOCK_NB)){if($tf)fclose($tf);fail(409,trApi('wait'));}
   $ts=json_decode(stream_get_contents($tf),true)?:['users'=>[],'messages'=>[],'mseq'=>0,'events'=>[],'eseq'=>0];
   if(!isset($ts['events'])||!is_array($ts['events']))$ts['events']=[];if(!isset($ts['eseq']))$ts['eseq']=0;
   foreach($ts['users'] as $tk=>$tu)if($now-(float)($tu['seen']??0)>12)unset($ts['users'][$tk]);
   if(!isset($ts['users'][$id])&&count($ts['users'])>=8){flock($tf,LOCK_UN);fclose($tf);fail(409,trApi('room_full'));}
   $name=(string)($s['users'][$id]['profile']['name']??'SYSTEM');$user=$s['users'][$id];
   $pushEvent($name,'room_changed',['from'=>$room,'to'=>$toRoom]);
   unset($s['users'][$id]);
   $srcEncoded=json_encode($s,JSON_INVALID_UTF8_SUBSTITUTE);rewind($f);ftruncate($f,0);fwrite($f,$srcEncoded);fflush($f);flock($f,LOCK_UN);fclose($f);
   $basePose=$b['pose']??[0,1.65,7,0];if(!is_array($basePose)||count($basePose)!==4||count(array_filter($basePose,fn($v)=>is_numeric($v)&&is_finite((float)$v)&&abs((float)$v)<1000))!==4)$basePose=[0,1.65,7,0];$basePose=array_map('floatval',array_values($basePose));
   $usedSlots=[];foreach($ts['users'] as $existing)if(isset($existing['slot'])&&is_int($existing['slot']))$usedSlots[$existing['slot']]=true;$slot=0;while(isset($usedSlots[$slot])&&$slot<64)$slot++;
   $angle=($slot%8)*(M_PI/4)+intdiv($slot,8)*0.31;$radius=1.35+intdiv($slot,8)*0.55;$dx=cos($angle)*$radius;$dz=sin($angle)*$radius;
   $user['pose']=[$basePose[0]+$dx,$basePose[1],$basePose[2]+$dz,$basePose[3]];$user['slot']=$slot;$user['seen']=$now;$user['last']=0;if(isset($user['laser'])&&is_array($user['laser']))$user['laser']['active']=false;
   $oldFace=$dir.'/face-'.hash('sha256',$room.'|'.$id).'.face';$newFace=$dir.'/face-'.hash('sha256',$toRoom.'|'.$id).'.face';if(is_file($oldFace)){@copy($oldFace,$newFace);@chmod($newFace,0600);@unlink($oldFace);}
   if(!isset($ts['events'])||!is_array($ts['events']))$ts['events']=[];$seq=(int)($ts['eseq']??0)+1;$ts['eseq']=$seq;$ts['events'][]=['seq'=>$seq,'time'=>$now,'name'=>$name,'type'=>'room_changed','from'=>$room,'to'=>$toRoom];if(count($ts['events'])>80)$ts['events']=array_slice($ts['events'],-80);
   $ts['users'][$id]=$user;$s=$ts;$f=$tf;$room=$toRoom;$facePath=fn(string $uid):string=>$dir.'/face-'.hash('sha256',$room.'|'.$uid).'.face';$extra['room']=$toRoom;$extra['spawnOffset']=[$dx,$dz];
  }
 }
 if($action==='leave'){$pushEvent((string)$s['users'][$id]['profile']['name'],'left');@unlink($facePath($id));unset($s['users'][$id]);}
 if($action==='poll'){
  if($now-$s['users'][$id]['last']<.15)fail(429,trApi('wait'));$s['users'][$id]['last']=$now;
  $oldMic=($s['users'][$id]['mic']??false)===true;$newMic=($b['mic']??false)===true;$s['users'][$id]['mic']=$newMic;
  if($oldMic!==$newMic)$pushEvent((string)$s['users'][$id]['profile']['name'],$newMic?'mic_on':'mic_off');
  $laser=$b['laser']??null;if(is_array($laser)){
   $oldLaser=($s['users'][$id]['laser']['active']??false)===true;$active=($laser['active']??false)===true;$color=(string)($laser['color']??'#ff334d');if(!preg_match('/^#[0-9a-f]{6}$/iD',$color))$color='#ff334d';
   $target=$laser['target']??[0,1.4,0];if(!is_array($target)||count($target)!==3||count(array_filter($target,fn($v)=>is_numeric($v)&&is_finite((float)$v)&&abs((float)$v)<1000))!==3)$target=[0,1.4,0];
   $s['users'][$id]['laser']=['active'=>$active,'color'=>$color,'target'=>array_map('floatval',array_values($target))];
   if($oldLaser!==$active)$pushEvent((string)$s['users'][$id]['profile']['name'],$active?'laser_on':'laser_off');
  }
  $pose=$b['pose']??null;
  if(is_array($pose)&&count($pose)===4&&count(array_filter($pose,fn($v)=>is_numeric($v)&&is_finite((float)$v)&&abs((float)$v)<1000))===4){
   $next=array_map('floatval',array_values($pose));$minDist=1.08;
   for($pass=0;$pass<2;$pass++)foreach($s['users'] as $otherId=>$other){
    if($otherId===$id||!isset($other['pose'][0],$other['pose'][2]))continue;
    $dx=$next[0]-(float)$other['pose'][0];$dz=$next[2]-(float)$other['pose'][2];$d2=$dx*$dx+$dz*$dz;
    if($d2>=$minDist*$minDist)continue;
    if($d2<0.0001){$seed=hexdec(substr(hash('sha256',$id.$otherId),0,6));$angle=($seed%6283)/1000;$dx=cos($angle);$dz=sin($angle);$d2=1;}
    $scale=$minDist/sqrt($d2);$next[0]=(float)$other['pose'][0]+$dx*$scale;$next[2]=(float)$other['pose'][2]+$dz*$scale;
   }
   $s['users'][$id]['pose']=$next;
  }
 }
 if($action==='face'){
  $oldMode=(string)($s['users'][$id]['faceMode']??'default');
  $mode=$b['mode']??'default';if(!in_array($mode,['default','photo','camera'],true))fail(400,trApi('face_mode'));
  $mime='';
  if($mode==='photo'){
   $photo=$b['photo']??'';if(!is_string($photo)||strlen($photo)>52000||!preg_match('/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/=]+)$/D',$photo,$m))fail(400,trApi('photo_invalid'));
   $mime='image/'.$m[1];$data=base64_decode($m[2],true);if($data===false||strlen($data)<32||strlen($data)>39000)fail(413,trApi('photo_big'));
   if(file_put_contents($facePath($id),$data,LOCK_EX)===false)fail(503,trApi('photo_fail'));@chmod($facePath($id),0600);
  }else @unlink($facePath($id));
  $s['users'][$id]['faceMode']=$mode;$s['users'][$id]['faceMime']=$mime;$s['users'][$id]['faceVersion']=(int)($s['users'][$id]['faceVersion']??0)+1;
  $who=(string)$s['users'][$id]['profile']['name'];if($oldMode==='camera'&&$mode!=='camera')$pushEvent($who,'camera_off');if($mode==='camera'&&$oldMode!=='camera')$pushEvent($who,'camera_on');if($mode==='photo')$pushEvent($who,'photo_changed');if($mode==='default'&&$oldMode!=='default')$pushEvent($who,'thumbnail');
  $extra['faceMode']=$mode;$extra['faceVersion']=$s['users'][$id]['faceVersion'];
 }
 if($action==='face_get'){
  $target=$b['userId']??'';if(!is_string($target)||!isset($s['users'][$target]))fail(404,trApi('face_unavailable'));
  $u=$s['users'][$target];$mode=(string)($u['faceMode']??'default');$version=(int)($u['faceVersion']??0);
  $extra['face']=['userId'=>$target,'mode'=>$mode,'version'=>$version];
  if($mode==='photo'&&is_file($facePath($target))){$mime=(string)($u['faceMime']??'image/webp');$data=file_get_contents($facePath($target));if(is_string($data))$extra['face']['photo']='data:'.$mime.';base64,'.base64_encode($data);}
 }
 if($action==='send'){
  $to=$b['to']??'';$mid=$b['mid']??'';$kind=$b['kind']??'';
  if(!is_string($to)||!isset($s['users'][$to])||$to===$id)fail(409,trApi('person_left'));
  if(!is_string($mid)||!preg_match('/^[a-zA-Z0-9-]{8,64}$/D',$mid))fail(400,trApi('id_invalid'));
  $found=null;foreach($s['messages'] as $m)if($m['from']===$id&&$m['mid']===$mid){$found=$m;break;}
  if($found===null){
   if($now-$s['users'][$id]['sent']<.7)fail(429,trApi('send_wait'));
   $m=['seq'=>++$s['mseq'],'mid'=>$mid,'from'=>$id,'to'=>$to,'time'=>$now,'kind'=>$kind,'name'=>$s['users'][$id]['profile']['name']];
   if($kind==='text'){$text=$b['text']??'';if(!is_string($text)||trim($text)===''||strlen($text)>4000||preg_match_all('/./us',$text)>1000)fail(400,trApi('text_invalid'));$m['text']=trim($text);}
   elseif($kind==='audio'){
    $mime=explode(';',(string)($b['mime']??''))[0];if(!in_array($mime,['audio/webm','audio/ogg','audio/mp4'],true))fail(400,trApi('audio_format'));
    $data=is_string($b['data']??null)?base64_decode($b['data'],true):false;if($data===false||strlen($data)<16||strlen($data)>750000)fail(413,trApi('audio_invalid'));
    $valid=($mime==='audio/webm'&&substr($data,0,4)==="\x1a\x45\xdf\xa3")||($mime==='audio/ogg'&&substr($data,0,4)==='OggS')||($mime==='audio/mp4'&&substr($data,4,4)==='ftyp');if(!$valid)fail(400,trApi('audio_content'));
    $m['file']=bin2hex(random_bytes(20)).'.voice';$m['mime']=$mime;if(file_put_contents($dir.'/'.$m['file'],$data,LOCK_EX)===false)fail(503,trApi('audio_save'));chmod($dir.'/'.$m['file'],0600);
   }else fail(400,trApi('message_type'));
   $s['users'][$id]['sent']=$now;$s['messages'][]=$m;$found=$m;$pushEvent((string)$s['users'][$id]['profile']['name'],$kind==='audio'?'voice':'chat');
   while(count($s['messages'])>256){$old=array_shift($s['messages']);if(isset($old['file']))@unlink($dir.'/'.$old['file']);}
  }
  unset($found['file']);$extra['message']=$found;
 }
 if($action==='download'){
  $seq=(int)($b['seq']??0);$found=null;foreach($s['messages'] as $m)if($m['seq']===$seq&&($m['to']===$id||$m['from']===$id)&&isset($m['file'])){$found=$m;break;}
  if(!$found||!is_file($dir.'/'.$found['file']))fail(404,trApi('audio_unavailable'));$extra['audio']=['mime'=>$found['mime'],'data'=>base64_encode(file_get_contents($dir.'/'.$found['file']))];
 }
}
$users=[];foreach($s['users'] as $u){unset($u['secret'],$u['last'],$u['sent'],$u['slot'],$u['faceMime']);$users[]=$u;}
$chat=[];$since=(int)($b['chatAck']??0);if($action==='poll')foreach($s['messages'] as $m)if($m['seq']>$since&&($m['from']===$id||$m['to']===$id)){unset($m['file']);$chat[]=$m;}
$out=['id'=>$id,'users'=>$users,'messages'=>$chat,'events'=>array_slice($s['events'],-30)]+$extra;
$encoded=json_encode($s,JSON_INVALID_UTF8_SUBSTITUTE);rewind($f);if(!ftruncate($f,0)||fwrite($f,$encoded)!==strlen($encoded))fail(503,trApi('room_save'));fflush($f);flock($f,LOCK_UN);fclose($f);
echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
