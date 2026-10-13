# Deixa este notebook ligado 24 horas: a tela nunca apaga, ele nunca dorme e fechar a tampa nao faz nada.
#
# Rode no Terminal COMO ADMINISTRADOR (tecla Windows + X, depois a tecla A, depois Sim):
#   irm https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/notebook/configurar-notebook.ps1 | iex
#
# So mexe nas configuracoes de ENERGIA. Nao instala nada, nao apaga nada, nao muda senha.
# Pode rodar de novo quantas vezes quiser. Texto sem acento de proposito (o console do Windows embaralha acentos).

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ''
    Write-Host 'PAROU: abra o Terminal como Administrador (tecla Windows + X, depois a tecla A) e rode de novo.' -ForegroundColor Red
    return
}

$global:AvisosVem = 0

function Passo([string]$texto, [scriptblock]$comando) {
    & $comando *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host ('  ok      ' + $texto)
    } else {
        Write-Host ('  ATENCAO ' + $texto + ' nao deu certo (codigo ' + $LASTEXITCODE + ')') -ForegroundColor Yellow
        $global:AvisosVem = $global:AvisosVem + 1
    }
}

Write-Host ''
Write-Host 'Configurando a energia (ligado na tomada):'
Passo 'a tela nunca apaga'                     { powercfg /change monitor-timeout-ac 0 }
Passo 'nunca entra em suspensao'               { powercfg /change standby-timeout-ac 0 }
Passo 'nunca hiberna (por tempo)'              { powercfg /change hibernate-timeout-ac 0 }
Passo 'o disco nunca desliga'                  { powercfg /change disk-timeout-ac 0 }
Passo 'fechar a tampa nao faz nada (tomada)'   { powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 }
Passo 'fechar a tampa nao faz nada (bateria)'  { powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 }
Passo 'ativando o plano com estas mudancas'    { powercfg /setactive SCHEME_CURRENT }
# por ultimo: desligar a hibernacao tambem desliga o "inicio rapido", e assim reiniciar reinicia de verdade
Passo 'hibernacao e inicio rapido desligados'  { powercfg /hibernate off }

Write-Host ''
Write-Host 'Plano de energia ativo:'
powercfg /getactivescheme

Write-Host ''
if ($global:AvisosVem -eq 0) {
    Write-Host 'PRONTO. Energia configurada. Siga os proximos passos do guia (abrir o Claude ao ligar, entrar sozinho, BIOS).' -ForegroundColor Green
} else {
    Write-Host ('Terminou com ' + $global:AvisosVem + ' aviso(s) acima. Tire um print desta tela e mande para o Claude.') -ForegroundColor Yellow
}
