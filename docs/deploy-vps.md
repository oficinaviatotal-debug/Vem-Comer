# Vem Comer no servidor (VPS)

Como o Vem Comer roda num servidor próprio, com banco de dados, HTTPS e backup.
Tudo mora em `deploy/vps/`. Quem instala é o script `instalar.sh`.

## O que sobe

Três contêineres Docker, todos com o nome `vemcomer-…`, numa rede interna só deles:

| Contêiner | O que faz | Aberto para a internet? |
|---|---|---|
| `vemcomer-db` | PostgreSQL 16, dados num volume (`vemcomer_pgdata`) | Não |
| `vemcomer-api` | Servidor Flask (gunicorn) | Não, só pelo porteiro |
| `vemcomer-web` | Caddy: HTTPS automático, entrega o site e repassa `/api` | Sim, portas 80 e 443 |

O instalador **não mexe** em `/opt/vem-tecnologia` (runtime da ChatGPT), em
`/var/backups/vem-audit` (backups dela) nem em qualquer serviço que já exista. Só cria
`/opt/vem-comer`, os contêineres `vemcomer-*` e o timer `vem-comer-backup`.

## Antes de instalar

1. **Endereço.** Para testar serve o nome que a Hostinger dá ao servidor
   (`srv2017596.hstgr.cloud`). Para valer, registre um domínio próprio e aponte-o para o IP do
   servidor. **Registre o domínio antes de imprimir os QR codes das mesas**: o QR carrega o
   endereço. Não apague nem troque o registro A depois de imprimir. Se o domínio tiver registro
   **AAAA** (IPv6) apontando para outro lugar, apague-o: o site atende só por IPv4 e quem emite o
   certificado tenta o IPv6 primeiro. O instalador avisa se achar um.
2. **Firewall da Hostinger:** liberar as portas **80** e **443**. Sem isso o certificado HTTPS
   não sai.
3. **Instantâneo novo** no painel da Hostinger (ponto de restauração do servidor inteiro).

## Comandos

Só conferir o servidor (não muda nada):

```
curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/instalar.sh | bash -s -- --checar
```

Instalar ou atualizar (pode rodar de novo quantas vezes quiser):

```
curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/instalar.sh | VEM_DOMINIO=seu.endereco bash
```

Os dois comandos acima buscam o script no ramo `main`: só funcionam depois que o pedido (PR) do
kit for mesclado. Para testar um ramo ainda não mesclado, troque `main` pelo nome do ramo no
endereço do `curl` **e** use também `VEM_RAMO=nome-do-ramo` antes do `bash`.
O script mostra cada passo e, no fim, testa `https://seu.endereco/api/health` de fora.

O instalador também cria o arquivo `/opt/vem-comer/.env` com senhas geradas ao acaso (permissão
600, só o root lê). Ele **nunca** troca as senhas de um banco que já existe.

## Primeiro restaurante

O cadastro de restaurante por fora está **fechado** (o porteiro responde 404 em
`/api/auth/register-company`), porque qualquer pessoa da internet poderia encher o banco. Quem
cadastra é o administrador, no terminal do servidor:

```
bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh
```

Ele pergunta nome, endereço curto, dono, e-mail e senha (a senha não aparece nem fica no
histórico). Aceita o jeito do teclado de celular (maiúscula, espaço sobrando: ele ajusta e avisa),
pergunta de novo se algo estiver errado, mostra um resumo para você confirmar com `s` e então
mostra o link do painel: `https://seu.endereco/?empresa=<endereço curto>&painel=1`.
Uma tela de cadastro com proteção contra abuso fica para depois.

## Backup

- Todo dia às 03:30 (Brasília) o timer `vem-comer-backup` roda `backup.sh`: faz o dump do banco,
  confere que o arquivo é válido e guarda em `/var/backups/vem-comer` (pasta 700). Mantém 14 dias
  e sempre os 3 mais novos.
- `restaurar-teste.sh` prova que o backup mais novo restaura: cria um banco de teste, restaura,
  compara as tabelas e apaga o banco de teste. O instalador roda os dois no fim.
- Esses arquivos ficam **no mesmo servidor**. Protegem contra erro e contra dado apagado, não
  contra a perda do servidor inteiro (para isso valem os backups da Hostinger e, mais para
  frente, uma cópia para fora).

Restaurar de verdade (apaga o banco atual; rode `backup.sh` antes para guardar o estado de agora):

```
cd /opt/vem-comer/app
C="docker compose -p vemcomer --env-file /opt/vem-comer/.env -f deploy/vps/docker-compose.yml"
$C stop api web
docker exec vemcomer-db psql -U vemcomer -d postgres -c "DROP DATABASE vemcomer WITH (FORCE)" -c "CREATE DATABASE vemcomer"
docker exec -i vemcomer-db pg_restore -U vemcomer -d vemcomer --no-owner --exit-on-error < /var/backups/vem-comer/ARQUIVO.dump
$C start api web
```

## Dia a dia

```
docker ps --filter name=vemcomer                 # estado
docker logs vemcomer-api --tail 50               # erros do servidor
docker logs vemcomer-web --tail 50               # certificado HTTPS e avisos do porteiro
systemctl list-timers vem-comer-backup.timer     # próximo backup
```

Atualizar para a versão mais nova do GitHub: rodar de novo o comando de instalar.
Não edite arquivos dentro de `/opt/vem-comer/app`: o instalador sobrescreve com a versão do GitHub.

Mudanças no banco entram como arquivos novos em `database/migrations/` (de `002` em diante) e
**precisam ser seguras para rodar mais de uma vez** (`IF NOT EXISTS`), porque o instalador roda
todas a cada atualização.

## Segurança

- Banco e servidor não têm porta aberta para a internet. Só o porteiro (80/443).
- Senhas e chave de sessão geradas ao acaso, fora do Git.
- O servidor roda sem ser root dentro do contêiner.
- O site conecta no banco com o usuário `vemcomer_app`, que só lê e grava dados (não cria tabela,
  não é administrador). O administrador `vemcomer` só é usado pelo instalador e pelo backup.
- Só IPv4 é publicado (`0.0.0.0:80` e `0.0.0.0:443`): pela porta IPv6 do Docker o servidor não
  enxergaria o endereço real do visitante.
- Não há registro de acessos: os endereços do sistema carregam `?tracking_token=…`, e isso não deve
  ir para arquivo de log. Só ficam avisos e erros (`docker logs`).
- O porteiro envia cabeçalhos de segurança, redireciona HTTP para HTTPS e fecha o cadastro público.
- O limitador de tentativas de login guarda a contagem na memória, por isso o servidor roda com
  **1 processo e várias threads**. Atrás do porteiro o servidor lê o endereço real do visitante
  (`TRUST_PROXY=1`), senão todos pareceriam ser a mesma pessoa.
- SSH (porta 22) está aberto no servidor e o `fail2ban` bloqueia quem erra a senha. Melhorias
  futuras: entrar só com chave SSH e desligar a senha do root por SSH.

## O que ainda não foi provado

- A montagem das imagens Docker e o certificado HTTPS só se confirmam na primeira instalação
  de verdade. O instalador para no primeiro erro e não toca no que já existe.
- `srv2017596.hstgr.cloud` é um nome compartilhado com outros clientes da Hostinger: pode bater
  em limites do Let's Encrypt. Domínio próprio resolve.
- O backup ainda não tem cópia fora do servidor, e nada avisa se o backup diário falhar. Confira de
  tempos em tempos: `ls -lh /var/backups/vem-comer` e `systemctl status vem-comer-backup.service`.
- O fechamento do cadastro público (404) e as variantes do endereço (barra no fim etc.) só se
  confirmam no servidor de verdade; o instalador testa duas variantes no fim.
- Pix com confirmação automática (provedor de pagamento) ainda não existe: hoje a confirmação é
  o botão "Pagamento recebido".
