# Voz do guia: a melhor voz que cada celular e cada internet aguentam

Pedido do GD (07/10/2026): a voz do guia não pode ser robótica. No 2G vale a voz do próprio celular;
no 3G, 4G e 5G, a melhor voz que tivermos, sempre a mais rápida e a mais fácil.

## Como a tela escolhe a voz

`frontend/src/voice/voiceQuality.ts` lê a conexão que o navegador informa (`navigator.connection`;
o Chrome do Android informa, o Safari e o Firefox não):

| Conexão | Nome no código | Voz |
| --- | --- | --- |
| 2G, "economia de dados" ligada ou sem internet | `leve` | Só a voz guardada no celular. Nada é baixado para falar. Se a pessoa tinha escolhido uma voz que vem pela internet, a tela usa a guardada enquanto a conexão estiver fraca (a escolha continua salva). |
| 3G (ou internet lenta) | `media` | Voz natural do servidor, se estiver ligada, com até 2,8 s para começar; senão, a voz do celular. |
| 4G, 5G, Wi-Fi, ou navegador que não informa | `plena` | Voz natural do servidor, se estiver ligada, com até 2 s para começar; senão, a voz do celular, de preferência as mais naturais ("Google", "Natural", "Neural"). |

Se a voz natural demorar ou falhar, o celular fala a mesma frase na hora. O guia nunca fica esperando.
A decisão é refeita a cada frase, então quem sai do 4G e entra no 2G no meio do cadastro passa para a
voz do celular sem perceber.

## Voz natural do servidor (preparada, desligada até escolher o provedor)

`backend/voice_tts.py` e a rota `POST /api/admin/voz` (só o dono e o gerente logados):

- A tela manda a frase e recebe o endereço do áudio (`/media/voz/<código>.mp3`).
- **Frase repetida não custa:** o áudio fica guardado em disco e o Caddy entrega com cache longo. As
  perguntas fixas do guia são pagas uma vez só, para todos os restaurantes.
- Limites: 400 frases por restaurante por hora e 300 mil caracteres por dia no servidor todo
  (`VOZ_POR_HORA`, `VOZ_CARACTERES_POR_DIA`). Passou disso, volta a voz do celular.
- Frase de até 400 caracteres. A chave fica só no `.env` do servidor, nunca vai para o navegador.
- A pasta de áudios tem teto (`VOZ_MAX_ARQUIVOS`, padrão 50 mil, ~1 GB): passou disso, os mais antigos
  saem. Se uma frase apagada voltar, ela é gerada de novo.
- Testado só com o provedor simulado (`backend/test_voice_tts.py`). Falta ouvir com a chave real.

### Provedores (preços das páginas oficiais em 07/10/2026; confirmar antes de assinar)

| Provedor | Preço | Grátis | Observação |
| --- | --- | --- | --- |
| Google Cloud, voz Neural2 | US$ 16 por milhão de caracteres | 1 milhão de caracteres por mês | Vozes pt-BR prontas. Padrão no código: `pt-BR-Neural2-B` (masculina); trocar ouvindo. |
| Google Cloud, voz Chirp 3: HD | US$ 30 por milhão | 1 milhão por mês | Mais natural; trocar `VOZ_GOOGLE_VOZ` pelo nome da voz escolhida. |
| ElevenLabs, modelo Flash | US$ 0,04 por mil caracteres (US$ 40 por milhão); planos a partir de US$ 6/mês | não | Permite **clonar a voz do GD**, com a autorização dele, no painel da ElevenLabs. |

Conta de padeiro: uma pessoa cadastrando o cardápio ouve umas 30 frases de ~60 caracteres
(~1.800 caracteres). Mil restaurantes cadastrando no mesmo mês = ~1,8 milhão de caracteres: uns US$ 13
(Neural2) a US$ 24 (Chirp 3: HD) no Google, já descontado o milhão grátis, ou uns US$ 72 na ElevenLabs.
Na prática sai menos, porque as perguntas fixas são geradas uma vez só.

### A voz do GD

O GD autorizou usar uma voz parecida com a dele (dicção, tom, força, confiança). Caminho: criar a conta
na ElevenLabs, gravar de 1 a 3 minutos falando natural, num lugar quieto, e criar a voz clonada no painel
(a ElevenLabs pede para confirmar que a voz é sua ou que você tem autorização). O painel dá o id da voz.
Mesmo com a voz dele, o guia continua se apresentando como assistente do Vem.

### Como ligar (quando o provedor for escolhido)

No `.env` do servidor (um script de configuração igual ao `configurar-ia.sh` vem junto com a escolha):

```
VOZ_PROVEDOR=google
VOZ_GOOGLE_CHAVE=...           # chave de API com o Text-to-Speech ativado
VOZ_GOOGLE_VOZ=pt-BR-Neural2-B # opcional
```

ou

```
VOZ_PROVEDOR=elevenlabs
VOZ_ELEVENLABS_CHAVE=...
VOZ_ELEVENLABS_VOZ=...         # id da voz (a do GD, clonada)
VOZ_ELEVENLABS_MODELO=eleven_flash_v2_5  # opcional
```

Trocar a voz gera áudios novos (o nome do arquivo depende da voz); os antigos podem ser apagados da
pasta `voz` sem problema.

## Testes

- `tests/assistant/voiceQuality.test.mjs`: conexão → nível; 2G nunca pede a voz natural; no 2G a voz
  guardada no celular ganha da voz que vem pela internet.
- `backend/test_voice_tts.py`: configuração, pedido a cada provedor (chave no cabeçalho, nunca no
  endereço), resposta que não é MP3 recusada, cache em disco, limites, falha do provedor não gasta cota.
