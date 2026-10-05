#!/usr/bin/env bash
# Só LÊ. Não instala, não apaga, não muda nada: mostra o que já existe neste servidor
# antes de colocarmos o Vem Comer nele. Não imprime senhas, chaves nem arquivos de configuração.
set +e
export LC_ALL=C

titulo() { printf '\n===== %s =====\n' "$1"; }
tem() { command -v "$1" >/dev/null 2>&1; }

titulo "SISTEMA"
. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"
echo "kernel: $(uname -r)"; echo "processadores: $(nproc)"; echo "no ar desde: $(uptime -s 2>/dev/null)"
free -h | sed -n '1,3p'
df -h / | sed -n '1,2p'

titulo "O QUE ESTÁ ESCUTANDO NA REDE (porta e programa)"
ss -tlnp 2>/dev/null | awk 'NR==1 || /LISTEN/ {print $1, $4, $6}' | head -30

titulo "SERVIÇOS RODANDO (fora os do sistema)"
systemctl list-units --type=service --state=running --no-legend 2>/dev/null \
  | awk '{print $1}' | grep -Ev '^(systemd|dbus|cron|rsyslog|ssh|getty|serial-getty|polkit|udisks|ModemManager|networkd|multipathd|unattended|snapd|chrony|qemu|irqbalance|accounts|packagekit)' | head -30

titulo "TAREFAS AGENDADAS (timers)"
systemctl list-timers --all --no-legend 2>/dev/null | awk '{print $NF, "->", $(NF-1)}' | grep -Ev 'apt|man-db|fstrim|logrotate|motd|e2scrub|systemd-tmpfiles|dpkg|update-notifier|snapd|ua-timer|esm|fwupd' | head -20

titulo "PROGRAMAS INSTALADOS QUE IMPORTAM"
for p in python3 pip3 node npm git docker nginx caddy apache2 psql postgres sqlite3 certbot ufw fail2ban; do
  if tem "$p"; then echo "sim   $p  $($p --version 2>&1 | head -1)"; else echo "não   $p"; fi
done

titulo "BANCO DE DADOS"
systemctl is-active postgresql 2>/dev/null | sed 's/^/postgresql: /'
ls /var/lib/postgresql 2>/dev/null | sed 's/^/versão em disco: /'
find / -xdev \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) -size +0 -not -path '/proc/*' -not -path '/usr/*' -not -path '/var/lib/snapd/*' -not -path '/snap/*' 2>/dev/null | head -10

titulo "PROJETOS JÁ COPIADOS PARA CÁ (pastas com .git)"
find /root /opt /srv /home /var/www -maxdepth 4 -name .git -type d 2>/dev/null | sed 's#/.git$##' | head -10
echo "-- /opt:"; ls -1 /opt 2>/dev/null | head -20
echo "-- /srv:"; ls -1 /srv 2>/dev/null | head -20

titulo "FIREWALL DO SERVIDOR"
if tem ufw; then ufw status 2>/dev/null | head -15; else echo "ufw não instalado"; fi

titulo "QUEM ENTROU NESTE SERVIDOR (últimos acessos, só data, usuário e origem)"
last -n 12 -a 2>/dev/null | head -14
echo "-- logins SSH aceitos (últimos):"
journalctl -u ssh -u sshd --no-pager 2>/dev/null | grep -i 'Accepted' | awk '{print $1,$2,$3,$6,$7,$8,$9,$10,$11}' | tail -12

titulo "FIM"
echo "Nada foi alterado."
