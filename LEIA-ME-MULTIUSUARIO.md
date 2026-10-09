> **v33:** webcam local agora usa uma track de vídeo estável desde a negociação inicial e `replaceTrack()` ao ligar/desligar a câmera. Preserve seu `multiplayer/sfu-config.php` válido ao atualizar.

# OЯOЯO v33 - multiusuário com Cloudflare Realtime SFU

A base SFU introduzida na v32 substitui a malha WebRTC P2P de áudio e webcam por **uma única PeerConnection por usuário com o Cloudflare Realtime SFU**. Presença, posição, chat privado, log, fotos e regras da sala continuam no PHP da Hostinger.

## Arquitetura

```text
Navegador
  ├─ PHP Hostinger: presença, posição, chat, foto, log
  └─ WebRTC: uma conexão com Cloudflare Realtime SFU
       ├─ publica 1 track de áudio
       ├─ publica webcam apenas quando ligada
       └─ recebe áudio/vídeo dos demais usuários
```

A chave do Cloudflare nunca é enviada ao JavaScript. `multiplayer/sfu.php` autentica a sessão OЯOЯO e faz as chamadas HTTPS ao Realtime SFU.

## Configuração necessária

Edite apenas:

`multiplayer/sfu-config.php`

O pacote já contém o App ID recebido e o App Secret com **63 caracteres**, propositalmente incompleto. Acrescente o último caractere do App Secret antes de publicar/testar.

Também confira o App ID no painel Cloudflare. O valor recebido para esta montagem tem 31 caracteres, enquanto a documentação atual da Cloudflare descreve o identificador do App com 32 caracteres. A v32 bloqueia a tentativa de conexão e mostra um aviso local enquanto App ID ou App Secret estiverem incompletos, evitando um erro genérico da API.

O `.htaccess` da pasta `multiplayer` bloqueia acesso HTTP direto a `sfu-config.php`. Para uma instalação definitiva, você também pode mover a configuração para `ororo-sfu.php` no diretório acima de `public_html`; `sfu.php` dá prioridade a esse arquivo privado e usa o config local como fallback.

## Publicação

1. Faça backup da pasta atual `ororov2`.
2. Suba o conteúdo da v32 substituindo a instalação anterior, preservando `.htaccess`.
3. Complete `multiplayer/sfu-config.php`.
4. Garanta PHP 8.1+ e HTTPS.
5. Faça refresh forçado no navegador para limpar os módulos v31 do cache.
6. Teste com dois dispositivos na mesma sala, preferencialmente um em Wi-Fi e outro em 4G/5G.
7. Ligue o microfone nos dois lados. Depois teste a webcam em um dos avatares.

## Comportamento da v32

- o usuário entra com microfone desligado;
- o SFU publica uma track de áudio silenciosa e estável;
- ao ligar o microfone, a track real substitui a silenciosa sem criar outra PeerConnection;
- ao desligar, volta para a track silenciosa;
- a webcam só é publicada quando for usada pela primeira vez;
- depois disso, ligar/desligar câmera usa `replaceTrack()`;
- foto do avatar continua sincronizada pelo PHP, não pelo fluxo de vídeo;
- chat, presença, reconexão e alerta de queda continuam independentes do SFU;
- limite desta versão permanece em 8 pessoas por sala;
- proximidade e unsubscribe seletivo ficam para a etapa seguinte, depois de validar a estabilidade entre redes diferentes.

## O que testar primeiro

Teste prioritário:

```text
PC em Wi-Fi
+
celular em 4G/5G
```

Verifique:

- ambos aparecem na sala;
- áudio funciona nos dois sentidos;
- desligar/ligar microfone não derruba a chamada;
- webcam 320x240 aparece no rosto do avatar remoto;
- trocar para foto/thumbnail remove a webcam visualmente;
- queda de internet abre o alerta e permite reconectar;
- sair da sala remove o participante dos demais clientes.

## Diagnóstico

Se o App Secret ainda estiver incompleto, a interface mostrará:

`App ID do Cloudflare Realtime precisa ter 32 caracteres... App Secret do Cloudflare Realtime precisa ter 64 caracteres...`

Se o App ID estiver incorreto, o proxy PHP retornará o erro do Cloudflare sem expor o segredo ao navegador.

A v32 usa `stun:stun.cloudflare.com:3478`. O Realtime SFU normalmente não exige TURN adicional porque o cliente estabelece WebRTC com o SFU público da Cloudflare. TURN pode ser adicionado depois apenas como fallback para redes extremamente restritivas.

## Segurança

Nunca coloque `app_secret` em JavaScript, HTML, URL ou localStorage. O navegador conhece apenas os IDs de sessão/tracks e chama nosso PHP autenticado. O backend valida que uma pessoa só pode assinar tracks pertencentes a usuários presentes na mesma sala.
