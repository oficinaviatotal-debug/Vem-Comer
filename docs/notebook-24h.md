# Notebook ligado 24 horas

Faça isto uma vez, sentado na frente do notebook (uns 20 minutos). Depois ele fica ligado dia e noite e o Claude trabalha por ele. Abra este guia no próprio notebook para copiar o comando do passo 1.

## 1. Energia: a tela nunca apaga e ele nunca dorme

1. Aperte as teclas **Windows + X** e depois a tecla **A**. Responda **Sim**. Isso abre o Terminal como administrador.
2. Cole este comando e aperte Enter:

```
irm https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/notebook/configurar-notebook.ps1 | iex
```

3. Cada linha mostra "ok" e o final diz **PRONTO**. Se aparecer linha amarela ou vermelha, tire um print e mande.

O comando faz: a tela nunca apaga, nunca suspende, nunca hiberna, e fechar a tampa não faz nada (ligado na tomada). Só mexe em energia: não instala, não apaga e não muda senha. O script usa só o `powercfg` do próprio Windows; eu não tenho Windows aqui para rodá-lo antes, por isso o print é importante se algo falhar.

Tela sempre acesa esquenta e gasta: depois baixe o brilho para uns 30% (tecla **Windows + A**, controle de brilho).

## 2. Instalar o Claude no notebook

1. Abra https://claude.ai/download e instale o aplicativo para Windows.
2. Entre com a mesma conta que você usa no celular.

## 3. O Claude abre sozinho quando o notebook liga

1. Aperte **Windows + R**, digite `ms-settings:startupapps` e aperte Enter.
2. Na lista, ache **Claude** e ligue a chave.

## 4. O Windows só reinicia de madrugada

1. Aperte **Windows + R**, digite `ms-settings:windowsupdate-options` e aperte Enter.
2. Abra o item de horário de atividade (em inglês, *Active hours*), escolha **Manualmente** e ponha das **06:00 às 23:00**. O Windows só reinicia entre 23:00 e 06:00.

## 5. Entrar sozinho depois de reiniciar

Sem isto, depois de uma atualização ou de uma queda de luz o Windows para na tela de senha e o Claude não abre. Faça só se o notebook ficar em lugar seguro: quem ligar o notebook entra direto.

1. Aperte **Windows + R**, digite `ms-settings:signinoptions` e aperte Enter. Desligue a chave que só permite entrar com Windows Hello (para contas Microsoft). Em "se você se ausentou, quando exigir que entre novamente", escolha **Nunca**.
2. Aperte **Windows + R**, digite `netplwiz` e aperte Enter. Desmarque **Os usuários devem digitar um nome e uma senha**, clique **OK** e digite a senha da sua conta duas vezes.

## 6. Ligar sozinho quando a luz voltar (BIOS) e poupar a bateria

1. Reinicie o notebook e, na tela com o logotipo da Dell, aperte **F2** várias vezes até abrir o BIOS.
2. Procure **Power Management** (gerenciamento de energia), depois **AC Behavior** e marque **Wake on AC**.
3. Na mesma área, ache a configuração de carga da bateria (*Primary Battery Charge Configuration*), escolha **Custom** e ponha de **50% a 80%**. Bateria que fica sempre na tomada dura bem mais assim.
4. Aplique e saia (**Apply** e **Exit**).

Os nomes mudam conforme o modelo. Se não achar, fotografe a tela e mande.

## 7. Lugar, rede e energia

- Cabo de rede ligado ao roteador, em vez de Wi-Fi.
- Num nobreak, se possível: protege de queda de luz e de pico.
- Sobre superfície dura, com as saídas de ar livres (nada de cama, sofá ou cobertor): ligado dia e noite, ele esquenta.
- A tampa pode ficar aberta ou fechada (o passo 1 faz fechar não suspender); aberta esquenta menos.

## 8. Acesso de emergência pelo celular

Se o notebook travar, você consegue mexer nele pelo celular.

1. No notebook, abra https://remotedesktop.google.com/access e clique em **Configurar acesso remoto**. Baixe e instale o que ele pedir.
2. Escolha um nome para o notebook e um PIN de 6 números que só você sabe.
3. No celular, instale o app **Área de trabalho remota do Chrome** e entre com o mesmo e-mail Google.

## 9. Ligar o notebook a esta conversa

1. No notebook, abra o app do Claude e entre na mesma conversa do projeto que você usa no celular.
2. Toque em **Ligar a este computador**.
3. Conecte uma pasta nova e vazia, chamada **Vem** (por exemplo `C:\Vem`). Eu baixo os projetos dentro dela.
4. Escreva na conversa: **notebook ligado**. Eu testo uma chamada de verdade e confirmo.

## O que eu faço depois, sem te pedir

- Preparo a chave de acesso à VPS (um passo curto, com o passo a passo pronto).
- Agendo: auditoria diária às 8h, vigia do site a cada 30 minutos com aviso no seu celular, teste semanal do backup.
- Rodo os builds e testes reais das telas.

O que mexe com dinheiro, cliente ou segurança continua passando por você: ligar a cobrança, abrir o cadastro público, colocar chaves e apagar dados.

## Teste de uma noite

Deixe ligado a noite toda. De manhã a tela deve estar acesa e o Claude aberto. Se não estiver, diga o que viu.
