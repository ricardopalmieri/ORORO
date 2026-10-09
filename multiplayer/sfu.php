<?php
// OЯOЯO v38 - proxy autenticado para Cloudflare Realtime SFU.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function fail(int $code,string $message,array $extra=[]):void{
 http_response_code($code);
 echo json_encode(['error'=>$message]+$extra,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
 exit;
}
function readJsonBody():array{
 if($_SERVER['REQUEST_METHOD']!=='POST')fail(405,'Use POST');
 if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')fail(403,'Origem inválida');
 if(stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0)fail(415,'Use application/json');
 $raw=file_get_contents('php://input',false,null,0,550000);
 if(!is_string($raw)||strlen($raw)>520000)fail(413,'Pedido muito grande');
 $b=json_decode($raw,true);if(!is_array($b))fail(400,'JSON inválido');return $b;
}
function loadConfig():array{
 $paths=[dirname(__DIR__,3).'/ororo-sfu.php',__DIR__.'/sfu-config.php'];
 foreach($paths as $p){if(is_file($p)){ $c=require $p; if(is_array($c))return $c; }}
 return [];
}
function sfuConfigStatus(array $c):array{
 $appId=(string)($c['app_id']??'');$secret=(string)($c['app_secret']??$c['api_token']??'');$issues=[];
 if(strlen($appId)!==32||!preg_match('/^[A-Za-z0-9_-]{32}$/D',$appId))$issues[]='App ID do Cloudflare Realtime precisa ter 32 caracteres (atual: '.strlen($appId).'). Confira o valor no painel.';
 if(strlen($secret)!==64)$issues[]='App Secret do Cloudflare Realtime precisa ter 64 caracteres (atual: '.strlen($secret).'). Complete o caractere que ficou de fora.';
 elseif(!preg_match('/^[A-Za-z0-9_-]{64}$/D',$secret))$issues[]='App Secret do Cloudflare Realtime contém caracteres inválidos.';
 if($issues)return ['ok'=>false,'error'=>implode(' ',$issues)];
 return ['ok'=>true,'appId'=>$appId,'secret'=>$secret];
}
function cfRequest(string $method,string $path,?array $payload,array $cfg):array{
 $url='https://rtc.live.cloudflare.com/v1/apps/'.rawurlencode($cfg['appId']).$path;
 $headers=['Authorization: Bearer '.$cfg['secret'],'Content-Type: application/json','Accept: application/json'];
 $body=$payload===null?'':json_encode($payload,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
 $response=false;$status=0;
 if(function_exists('curl_init')){
  $ch=curl_init($url);
  curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$headers,CURLOPT_POSTFIELDS=>$body,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12]);
  $response=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$err=curl_error($ch);curl_close($ch);
  if($response===false)fail(502,'Cloudflare Realtime indisponível: '.$err);
 }else{
  $ctx=stream_context_create(['http'=>['method'=>$method,'header'=>implode("\r\n",$headers),'content'=>$body,'timeout'=>12,'ignore_errors'=>true]]);
  $response=@file_get_contents($url,false,$ctx);
  foreach($http_response_header??[] as $line)if(preg_match('/^HTTP\/\S+\s+(\d{3})/',$line,$m))$status=(int)$m[1];
 }
 $json=is_string($response)?json_decode($response,true):null;
 if($status<200||$status>=300){
  $msg=is_array($json)?(string)($json['errorDescription']??$json['error']??$json['message']??''):'';
  fail(502,'Cloudflare Realtime respondeu com erro'.($msg!==''?': '.$msg:''),['providerStatus'=>$status]);
 }
 if(!is_array($json))fail(502,'Resposta inválida do Cloudflare Realtime.');
 if(isset($json['errorCode'])&&$json['errorCode'])fail(502,(string)($json['errorDescription']??'Erro no Cloudflare Realtime.'),['providerCode'=>$json['errorCode']]);
 return $json;
}
function roomDir():string{return sys_get_temp_dir().'/ororo-v34-'.substr(hash('sha256',__DIR__),0,20);}
function roomFile(string $room):string{return roomDir().'/'.$room.'.json';}
function openRoom(string $room){
 $path=roomFile($room);$f=fopen($path,'c+');if(!$f||!flock($f,LOCK_EX))fail(503,trSfu('room_unavailable'));
 $s=json_decode(stream_get_contents($f),true)?:['users'=>[],'signals'=>[],'seq'=>0,'messages'=>[],'mseq'=>0,'events'=>[],'eseq'=>0];return [$f,$s];
}
function saveRoom($f,array $s):void{
 $encoded=json_encode($s,JSON_INVALID_UTF8_SUBSTITUTE);rewind($f);
 if(!ftruncate($f,0)||fwrite($f,$encoded)!==strlen($encoded)){flock($f,LOCK_UN);fclose($f);fail(503,trSfu('room_save'));}
 fflush($f);flock($f,LOCK_UN);fclose($f);
}
function unlockRoom($f):void{flock($f,LOCK_UN);fclose($f);}
function authUser(array $s,string $id,string $token):array{
 if($id===''||!isset($s['users'][$id])||$token===''||!hash_equals((string)$s['users'][$id]['secret'],hash('sha256',$token)))fail(401,trSfu('session_expired'));
 return $s['users'][$id];
}
function validSdp($v):bool{return is_array($v)&&in_array($v['type']??'',['offer','answer'],true)&&is_string($v['sdp']??null)&&strlen($v['sdp'])>20&&strlen($v['sdp'])<450000;}

$b=readJsonBody();$LANG=in_array(($b['lang']??''),['pt','en','es','de','zh'],true)?$b['lang']:'pt';
function trSfu(string $key):string{
 global $LANG;
 $m=[
  'session_expired'=>['pt'=>'Sessão expirada','en'=>'Session expired','es'=>'Sesión caducada','de'=>'Sitzung abgelaufen','zh'=>'会话已过期'],
  'room_unavailable'=>['pt'=>'Sala indisponível','en'=>'Room unavailable','es'=>'Sala no disponible','de'=>'Raum nicht verfügbar','zh'=>'房间不可用'],
  'room_save'=>['pt'=>'Falha ao salvar a sala.','en'=>'Failed to save the room.','es'=>'No se pudo guardar la sala.','de'=>'Der Raum konnte nicht gespeichert werden.','zh'=>'无法保存房间。'],
  'configured'=>['pt'=>'Cloudflare Realtime SFU configurado.','en'=>'Cloudflare Realtime SFU configured.','es'=>'Cloudflare Realtime SFU configurado.','de'=>'Cloudflare Realtime SFU konfiguriert.','zh'=>'Cloudflare Realtime SFU 已配置。'],
  'session_id'=>['pt'=>'Cloudflare não retornou um sessionId válido.','en'=>'Cloudflare did not return a valid sessionId.','es'=>'Cloudflare no devolvió un sessionId válido.','de'=>'Cloudflare hat keine gültige sessionId zurückgegeben.','zh'=>'Cloudflare 未返回有效的 sessionId。'],
  'stale'=>['pt'=>'Sessão SFU desatualizada. Reconecte a mídia.','en'=>'SFU session is stale. Reconnect media.','es'=>'La sesión SFU está desactualizada. Reconecta los medios.','de'=>'Die SFU-Sitzung ist veraltet. Verbinde die Medien neu.','zh'=>'SFU 会话已过期。请重新连接媒体。'],
  'publish_invalid'=>['pt'=>'Publicação SFU inválida.','en'=>'Invalid SFU publication.','es'=>'Publicación SFU no válida.','de'=>'Ungültige SFU-Veröffentlichung.','zh'=>'SFU 发布无效。'],
  'no_local'=>['pt'=>'Nenhuma track local válida.','en'=>'No valid local track.','es'=>'No hay ninguna pista local válida.','de'=>'Keine gültige lokale Spur.','zh'=>'没有有效的本地轨道。'],
  'publish_changed'=>['pt'=>'Sessão SFU mudou durante a publicação.','en'=>'SFU session changed during publication.','es'=>'La sesión SFU cambió durante la publicación.','de'=>'Die SFU-Sitzung hat sich während der Veröffentlichung geändert.','zh'=>'发布期间 SFU 会话发生了变化。'],
  'subscribe_invalid'=>['pt'=>'Assinaturas SFU inválidas.','en'=>'Invalid SFU subscriptions.','es'=>'Suscripciones SFU no válidas.','de'=>'Ungültige SFU-Abonnements.','zh'=>'SFU 订阅无效。'],
  'no_remote'=>['pt'=>'Nenhuma track remota disponível para assinatura.','en'=>'No remote track available to subscribe.','es'=>'No hay ninguna pista remota disponible para suscribirse.','de'=>'Keine Remote-Spur zum Abonnieren verfügbar.','zh'=>'没有可订阅的远程轨道。'],
  'answer_invalid'=>['pt'=>'Resposta SDP inválida.','en'=>'Invalid SDP answer.','es'=>'Respuesta SDP no válida.','de'=>'Ungültige SDP-Antwort.','zh'=>'SDP 应答无效。'],
  'not_implemented'=>['pt'=>'Ação SFU não implementada.','en'=>'SFU action not implemented.','es'=>'Acción SFU no implementada.','de'=>'SFU-Aktion nicht implementiert.','zh'=>'SFU 操作尚未实现。']
 ];
 return $m[$key][$LANG]??$m[$key]['en']??$key;
}
$room=$b['room']??'';$id=(string)($b['id']??'');$token=(string)($b['token']??'');$action=(string)($b['action']??'status');
if(!is_string($room)||!preg_match('/^sala-[a-z0-9-]{1,64}$/D',$room)||!is_file(__DIR__.'/../rooms/data/'.$room.'.json'))fail(400,'Sala inválida');
if(!in_array($action,['status','session','publish','subscribe','close_remote','renegotiate','detach'],true))fail(400,'Ação SFU inválida');
$configStatus=sfuConfigStatus(loadConfig());
if($action==='status'){echo json_encode(['configured'=>$configStatus['ok'],'message'=>$configStatus['ok']?trSfu('configured'):$configStatus['error']],JSON_UNESCAPED_UNICODE);exit;}
if(!$configStatus['ok'])fail(503,$configStatus['error']);

[$f,$s]=openRoom($room);$user=authUser($s,$id,$token);
if($action==='session'){
 unlockRoom($f);
 $r=cfRequest('POST','/sessions/new',null,$configStatus);$sessionId=(string)($r['sessionId']??'');
 if(!preg_match('/^[A-Za-z0-9_-]{8,128}$/D',$sessionId))fail(502,trSfu('session_id'));
 [$f,$s]=openRoom($room);authUser($s,$id,$token);
 $s['users'][$id]['sfu']=['sessionId'=>$sessionId,'audioTrack'=>'','videoTrack'=>'','updated'=>microtime(true)];saveRoom($f,$s);
 echo json_encode(['sessionId'=>$sessionId,'configured'=>true]);exit;
}
$sfu=$user['sfu']??[];$ownSession=(string)($sfu['sessionId']??'');$sessionId=(string)($b['sessionId']??'');
if($ownSession===''||$sessionId===''||!hash_equals($ownSession,$sessionId)){unlockRoom($f);fail(409,trSfu('stale'));}

if($action==='publish'){
 $desc=$b['sessionDescription']??null;$tracks=$b['tracks']??null;
 if(!validSdp($desc)||!is_array($tracks)||count($tracks)<1||count($tracks)>2){unlockRoom($f);fail(400,trSfu('publish_invalid'));}
 $clean=[];$kindByMid=[];
 foreach($tracks as $t){
  if(!is_array($t))continue;$mid=(string)($t['mid']??'');$name=(string)($t['trackName']??'');$kind=(string)($t['kind']??'');
  if(!preg_match('/^[0-9]{1,4}$/D',$mid)||strlen($name)<1||strlen($name)>180||!in_array($kind,['audio','video'],true))continue;
  $clean[]=['location'=>'local','mid'=>$mid,'trackName'=>$name];$kindByMid[$mid]=$kind;
 }
 if(!$clean){unlockRoom($f);fail(400,trSfu('no_local'));}
 unlockRoom($f);$r=cfRequest('POST','/sessions/'.rawurlencode($sessionId).'/tracks/new',['sessionDescription'=>$desc,'tracks'=>$clean],$configStatus);
 $published=[];
 foreach((array)($r['tracks']??[]) as $i=>$rt){if(!is_array($rt))continue;$mid=(string)($rt['mid']??($clean[$i]['mid']??''));$name=(string)($rt['trackName']??($clean[$i]['trackName']??''));$kind=$kindByMid[$mid]??($tracks[$i]['kind']??'');if(in_array($kind,['audio','video'],true)&&$name!=='')$published[$kind]=$name;}
 [$f,$s]=openRoom($room);authUser($s,$id,$token);if((string)($s['users'][$id]['sfu']['sessionId']??'')!==$sessionId){unlockRoom($f);fail(409,trSfu('publish_changed'));}
 foreach($published as $kind=>$name)$s['users'][$id]['sfu'][$kind.'Track']=$name;$s['users'][$id]['sfu']['updated']=microtime(true);saveRoom($f,$s);
 $r['published']=$published;echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}

if($action==='subscribe'){
 $tracks=$b['tracks']??null;if(!is_array($tracks)||count($tracks)<1||count($tracks)>32){unlockRoom($f);fail(400,trSfu('subscribe_invalid'));}
 $clean=[];$meta=[];
 foreach($tracks as $t){
  if(!is_array($t))continue;$owner=(string)($t['ownerId']??'');$kind=(string)($t['kind']??'');$srcSession=(string)($t['sessionId']??'');$trackName=(string)($t['trackName']??'');
  if($owner===''||$owner===$id||!isset($s['users'][$owner])||!in_array($kind,['audio','video'],true))continue;
  $remote=$s['users'][$owner]['sfu']??[];
  if((string)($remote['sessionId']??'')!==$srcSession||(string)($remote[$kind.'Track']??'')!==$trackName||$trackName==='')continue;
  $clean[]=['location'=>'remote','sessionId'=>$srcSession,'trackName'=>$trackName];$meta[]=['ownerId'=>$owner,'kind'=>$kind,'sessionId'=>$srcSession,'trackName'=>$trackName];
 }
 unlockRoom($f);if(!$clean)fail(409,trSfu('no_remote'));
 $r=cfRequest('POST','/sessions/'.rawurlencode($sessionId).'/tracks/new',['tracks'=>$clean],$configStatus);
 $map=[];$responseTracks=array_values((array)($r['tracks']??[]));
 foreach($meta as $i=>$m){$rt=$responseTracks[$i]??[];$mid=is_array($rt)?(string)($rt['mid']??''):'';if($mid!=='')$map[]=['mid'=>$mid]+$m;}
 $r['ororoMap']=$map;echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}

if($action==='close_remote'){
 $mids=$b['mids']??[];if(!is_array($mids)){unlockRoom($f);fail(400,trSfu('subscribe_invalid'));}
 $clean=[];foreach(array_slice($mids,0,32) as $mid){$mid=(string)$mid;if(preg_match('/^[0-9]{1,4}$/D',$mid))$clean[]=['mid'=>$mid];}
 unlockRoom($f);if(!$clean){echo json_encode(['ok'=>true,'tracks'=>[]]);exit;}
 $r=cfRequest('PUT','/sessions/'.rawurlencode($sessionId).'/tracks/close',['tracks'=>$clean,'force'=>true],$configStatus);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}

if($action==='renegotiate'){
 $desc=$b['sessionDescription']??null;unlockRoom($f);if(!validSdp($desc)||($desc['type']??'')!=='answer')fail(400,trSfu('answer_invalid'));
 $r=cfRequest('PUT','/sessions/'.rawurlencode($sessionId).'/renegotiate',['sessionDescription'=>$desc],$configStatus);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}

if($action==='detach'){
 $s['users'][$id]['sfu']=['sessionId'=>'','audioTrack'=>'','videoTrack'=>'','updated'=>microtime(true)];saveRoom($f,$s);echo json_encode(['ok'=>true]);exit;
}

unlockRoom($f);fail(400,trSfu('not_implemented'));
