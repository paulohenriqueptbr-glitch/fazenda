# deploy.ps1 - Script de deploy para Vercel
# Uso: .\deploy.ps1 [-Prod] [-Build] [-Status]

param(
    [switch]$Prod,      # Deploy em produção
    [switch]$Build,     # Rodar build antes do deploy
    [switch]$Status,    # Mostrar status do último deploy
    [switch]$Logs,      # Mostrar logs do deploy
    [switch]$Help       # Mostrar ajuda
)

$ErrorActionPreference = "Stop"

# ─── Cores para output ──────────────────────────────────────────────────────
function Write-Color($text, $color = "White") {
    Write-Host $text -ForegroundColor $color
}

# ─── Banner ─────────────────────────────────────────────────────────────────
function Show-Banner {
    Write-Color ""
    Write-Color "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Color "  ║          TERRASYN - Deploy para Vercel              ║" -ForegroundColor Green
    Write-Color "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Color ""
}

# ─── Ajuda ──────────────────────────────────────────────────────────────────
function Show-Help {
    Show-Banner
    Write-Color "  Uso:" -ForegroundColor Yellow
    Write-Color "    .\deploy.ps1              Deploy preview (desenvolvimento)"
    Write-Color "    .\deploy.ps1 -Prod        Deploy em produção"
    Write-Color "    .\deploy.ps1 -Build       Rodar build antes do deploy"
    Write-Color "    .\deploy.ps1 -Status      Mostrar status do último deploy"
    Write-Color "    .\deploy.ps1 -Logs        Mostrar logs do deploy"
    Write-Color ""
    Write-Color "  Exemplos:" -ForegroundColor Yellow
    Write-Color "    .\deploy.ps1 -Prod -Build   Build + deploy em produção"
    Write-Color "    .\deploy.ps1 -Status        Verificar último deploy"
    Write-Color ""
    Write-Color "  Requisitos:" -ForegroundColor Yellow
    Write-Color "    - Node.js >= 20"
    Write-Color "    - Vercel CLI (npm i -g vercel)"
    Write-Color "    - Conta Vercel autenticada (vercel login)"
    Write-Color ""
}

# ─── Verificar pré-requisitos ──────────────────────────────────────────────
function Test-Prerequisites {
    $missing = @()

    # Verificar Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion -match "v(\d+)") {
            $major = [int]$Matches[1]
            if ($major -lt 20) {
                Write-Color "  ✗ Node.js $nodeVersion (mínimo: v20)" -ForegroundColor Red
                $missing += "node"
            } else {
                Write-Color "  ✓ Node.js $nodeVersion" -ForegroundColor Green
            }
        }
    } catch {
        Write-Color "  ✗ Node.js não encontrado" -ForegroundColor Red
        $missing += "node"
    }

    # Verificar Vercel CLI
    try {
        $vercelVersion = vercel --version 2>$null
        Write-Color "  ✓ Vercel CLI $vercelVersion" -ForegroundColor Green
    } catch {
        Write-Color "  ✗ Vercel CLI não encontrado" -ForegroundColor Red
        Write-Color "    Instale com: npm i -g vercel" -ForegroundColor Yellow
        $missing += "vercel"
    }

    # Verificar autenticação
    if ($missing.Count -eq 0) {
        try {
            $whoami = vercel whoami 2>$null
            Write-Color "  ✓ Autenticado como: $whoami" -ForegroundColor Green
        } catch {
            Write-Color "  ✗ Não autenticado na Vercel" -ForegroundColor Red
            Write-Color "    Execute: vercel login" -ForegroundColor Yellow
            $missing += "auth"
        }
    }

    if ($missing.Count -gt 0) {
        Write-Color ""
        Write-Color "  Instale os pré-requisitos faltantes e tente novamente." -ForegroundColor Red
        exit 1
    }
}

# ─── Verificar mudanças não commitadas ─────────────────────────────────────
function Test-GitStatus {
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            Write-Color "  ⚠ Existem mudanças não commitadas:" -ForegroundColor Yellow
            $status | Select-Object -First 5 | ForEach-Object {
                Write-Color "    $_" -ForegroundColor Gray
            }
            if (($status | Measure-Object).Count -gt 5) {
                Write-Color "    ... e mais $(($status | Measure-Object).Count - 5) arquivos" -ForegroundColor Gray
            }
            Write-Color ""
            $response = Read-Host "  Deseja continuar mesmo assim? (s/N)"
            if ($response -ne "s" -and $response -ne "S") {
                Write-Color "  Deploy cancelado." -ForegroundColor Red
                exit 0
            }
        }
    } catch {
        # Git não instalado ou não é repo - ignorar
    }
}

# ─── Rodar build ────────────────────────────────────────────────────────────
function Invoke-Build {
    Write-Color "  ⚙ Rodando build de produção..." -ForegroundColor Cyan
    Write-Color ""

    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build falhou" }
        Write-Color ""
        Write-Color "  ✓ Build concluído com sucesso!" -ForegroundColor Green
    } catch {
        Write-Color "  ✗ Erro ao rodar build: $_" -ForegroundColor Red
        exit 1
    }
}

# ─── Deploy ─────────────────────────────────────────────────────────────────
function Invoke-Deploy {
    param([bool]$Production)

    $env:VERCEL_ORG_ID = ""   # Será preenchido automaticamente
    $env:VERCEL_PROJECT_ID = "" # Será preenchido automaticamente

    $deployArgs = @("deploy", "--yes")
    if ($Production) {
        $deployArgs += "--prod"
        Write-Color "  🚀 Fazendo deploy em PRODUÇÃO..." -ForegroundColor Magenta
    } else {
        Write-Color "  🚀 Fazendo deploy preview..." -ForegroundColor Cyan
    }

    Write-Color ""

    try {
        $result = vercel @deployArgs 2>&1
        Write-Color $result

        # Extrair URL do deploy
        $url = ($result | Select-String "https://.*\.vercel\.app" | Select-Object -First 1).Matches.Value
        if ($url) {
            Write-Color ""
            Write-Color "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
            Write-Color "  ║  ✓ Deploy concluído com sucesso!                   ║" -ForegroundColor Green
            Write-Color "  ╠══════════════════════════════════════════════════════╣" -ForegroundColor Green
            Write-Color "  ║  URL: $url" -ForegroundColor Green
            Write-Color "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
            Write-Color ""

            # Perguntar se quer abrir no navegador
            $open = Read-Host "  Abrir no navegador? (S/n)"
            if ($open -ne "n" -and $open -ne "N") {
                Start-Process $url
            }
        }
    } catch {
        Write-Color "  ✗ Erro no deploy: $_" -ForegroundColor Red
        exit 1
    }
}

# ─── Mostrar status ────────────────────────────────────────────────────────
function Show-Status {
    Write-Color "  📊 Status do projeto:" -ForegroundColor Cyan
    Write-Color ""
    vercel ls 2>$null | Select-Object -First 15 | ForEach-Object {
        Write-Color "  $_" -ForegroundColor Gray
    }
}

# ─── Mostrar logs ──────────────────────────────────────────────────────────
function Show-Logs {
    Write-Color "  📋 Logs do último deploy:" -ForegroundColor Cyan
    Write-Color ""
    vercel logs 2>$null | Select-Object -Last 30 | ForEach-Object {
        Write-Color "  $_" -ForegroundColor Gray
    }
}

# ─── Main ───────────────────────────────────────────────────────────────────
Show-Banner

if ($Help) {
    Show-Help
    exit 0
}

Write-Color "  Verificando pré-requisitos..." -ForegroundColor Cyan
Test-Prerequisites
Write-Color ""

if ($Status) {
    Show-Status
    exit 0
}

if ($Logs) {
    Show-Logs
    exit 0
}

Test-GitStatus

if ($Build) {
    Invoke-Build
    Write-Color ""
}

$isProduction = $Prod.IsPresent
Invoke-Deploy -Production $isProduction
