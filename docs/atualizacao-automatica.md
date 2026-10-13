# Atualização automática do servidor

O servidor passa a se atualizar sozinho. Você roda **um comando, uma vez**; daí em diante, tudo que for
mesclado no GitHub (ramo `main`) com **todos os testes automáticos verdes** entra no ar em até ~15 minutos,
sem ninguém digitar nada, e **volta atrás sozinho** se o site não subir.

## Instalar (uma vez)

No servidor, como root (o mesmo lugar onde você rodou o `instalar.sh`):

```
curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/atualizar-sozinho.sh | bash -s -- --instalar
```

Ele **não troca o código do site** e não reinicia nada. Só instala o conferidor e liga o relógio. Termina com
`PRONTO`. A primeira conferência acontece uns 2 minutos depois.

## O que ele faz a cada ~10 minutos

1. Pergunta ao GitHub qual é a versão mais nova de `main`. Se for a que já está no ar, para aqui.
2. Confere os testes automáticos dessa versão no GitHub. Só continua se **todos** terminaram e passaram,
   e se há pelo menos 5 (hoje são 5: front-end build, front-end lógica, front-end segurança, back-end
   segurança/fluxo crítico e gitleaks). Vermelho, ainda rodando, poucos ou GitHub fora do ar = não instala,
   tenta de novo no ciclo seguinte.
3. Se a versão nova só muda documentação, testes ou arquivos do GitHub (`docs/`, `tests/`, `.github/`,
   `deploy/notebook/`, `*.md`), anota como feita e **não reinicia nada**.
4. Confere que o site está respondendo de fora (HTTPS). Se não responde de fora mas o servidor está bem por
   dentro, não atualiza (o problema é de endereço/DNS e a versão nova não poderia ser conferida).
5. **Faz backup** do banco e das fotos (`backup.sh`). Se o backup falhar, **não atualiza**.
6. Roda o instalador (`instalar.sh`) **do commit exato** que passou nos testes, não de "o que estiver em
   main naquele segundo".
7. **Confere de fora** que `https://seu.endereco/api/health` responde `ok` **e informa a versão nova**
   (`version`). Só então marca como "no ar".
8. Se não subiu: volta o código para a versão anterior confirmada, reconstrói, sobe e confere de novo. A
   versão ruim fica "de lado" e não é tentada outra vez; uma versão mais nova volta a ser tentada.
9. Se nem a volta funcionar: grava `EMERGÊNCIA`, para de mexer em tudo e sai com erro. Aí é com a gente:
   rode `vem-comer-atualizar --estado` e mande o resultado.

Falhas "leves" (backup que falhou, instalador que parou antes de mexer em qualquer coisa, por exemplo
falta de espaço ou memória) são tentadas até 3 vezes, uma por ciclo; depois a versão é posta de lado.

## Controlar

```
vem-comer-atualizar --estado       # o que está no ar, último ciclo, fim do registro
vem-comer-atualizar --pausar       # para de atualizar sozinho
vem-comer-atualizar --retomar      # volta
vem-comer-atualizar                # roda um ciclo agora
vem-comer-atualizar --desinstalar  # tira o relógio (o site continua como está)
```

O registro fica em `/var/log/vem-comer-atualizar.log` (guarda só o final, ~1 MB). O estado fica em
`/var/lib/vem-comer/`. O site informa a versão no ar em `https://seu.endereco/api/health` (campo `version`,
o começo do código do commit).

Rodar o `instalar.sh` à mão continua funcionando: se o atualizador estiver no meio de uma rodada, o
`instalar.sh` espera ele terminar (até 15 minutos) antes de começar.

## O que isto garante e o que não garante

- **Garante:** só entra o que passou nos testes; há backup antes; o site é conferido de fora depois; se
  quebrar, volta o código sozinho; nada é apagado.
- **Não garante:** que o teste automático pegue todo erro (ele pega o que foi escrito para pegar). Por isso a
  gente continua testando tela e fluxo de verdade antes de dizer que algo está pronto.
- **O banco não volta junto.** As atualizações do banco (`database/migrations`) só acrescentam (por regra do
  projeto) e a versão anterior do código continua funcionando com elas. Se alguma vez for preciso voltar o
  *banco*, isso é manual, a partir do backup feito antes de cada atualização em `/var/backups/vem-comer`.
- **Ninguém é avisado automaticamente** de uma reversão ou emergência (ainda não há e-mail nem WhatsApp
  configurado). Hoje se descobre rodando `vem-comer-atualizar --estado` ou olhando o `version` em
  `/api/health`. Um aviso automático é um dos próximos passos.

## Segurança

- Roda como root no servidor, por um relógio do systemd (`vem-comer-atualizar.timer`).
- **Só puxa do nosso GitHub** (`oficinaviatotal-debug/Vem-Comer`, ramo `main`), por HTTPS, e só um commit que
  passou em todos os testes. Quem consegue mesclar em `main` consegue, portanto, mudar o que roda no
  servidor: **mantenha a proteção do GitHub** (senha forte e verificação em duas etapas na conta
  `oficinaviatotal-debug`) e, quando houver mais gente, exigir revisão antes do merge.
- Não abre porta nenhuma para a internet e não guarda segredo nenhum no GitHub: o servidor é quem pergunta.
- Usa só o que já existe no servidor (`git`, `curl`, `docker`, `flock`, `systemctl`); não precisa de
  `python3` nem de `jq`.
- A cópia que roda fica em `/usr/local/sbin/vem-comer-atualizar`, fora da pasta que o `git` troca. Depois de
  cada atualização que deu certo ela se renova sozinha com a versão nova (se a sintaxe estiver correta).
- Parar de uma vez: `vem-comer-atualizar --pausar`.

## Testes

`deploy/vps/test_atualizar_sozinho.py` (32 testes, roda no CI como `deploy-scripts`): versão boa entra, teste
vermelho/rodando/poucos/sem resposta não entram, só documentação não reinicia, backup que falha impede,
versão que não sobe volta, banco que falha com servidor antigo ainda no ar também volta, volta que falha
trava, pausa, instalação e remoção.
