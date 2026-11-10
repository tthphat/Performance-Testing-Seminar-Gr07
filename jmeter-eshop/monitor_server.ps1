<#
.SYNOPSIS
    Script Giam Sat Phan Cung (CPU & RAM) Tien Trinh EShop Backend (Port 3000)
    Tu dong xuat Bao cao Do thi HTML Tuong tac phuc vu bai Endurance / Baseline Test.
.DESCRIPTION
    - Bat dung PID tien trinh Node.js dang lang nghe tai Port 3000.
    - Do luong lien tuc muc su dung CPU (%) va RAM (MB) theo chu ky.
    - Luu du lieu tho vao file CSV (hardware_metrics.csv).
    - Tu dong tong hop va sinh Bao cao HTML do thi tuong tac (hardware_report.html)
      ngay khi nguoi dung nhan Ctrl + C de dung giam sat!
.EXAMPLE
    .\monitor_server.ps1
    .\monitor_server.ps1 -IntervalSeconds 1 -AutoOpen
    .\monitor_server.ps1 -ExportOnly
#>

[CmdletBinding()]
param (
    [int]$Port = 3000,
    [int]$IntervalSeconds = 2,
    [string]$LogFile = "hardware_metrics.csv",
    [string]$HtmlReport = "hardware_report.html",
    [switch]$AutoOpen,
    [switch]$ExportOnly
)

# Dam bao duong dan luon tuong thich du chay tu bat ky thu muc nao
if (-not [System.IO.Path]::IsPathRooted($LogFile)) { 
    $LogFile = Join-Path $PSScriptRoot $LogFile 
}
if (-not [System.IO.Path]::IsPathRooted($HtmlReport)) { 
    $HtmlReport = Join-Path $PSScriptRoot $HtmlReport 
}

function Export-HtmlReport {
    param (
        [string]$CsvPath,
        [string]$OutputPath,
        [string]$ProcessName,
        [int]$ProcessId,
        [int]$Cores
    )

    if (-not (Test-Path $CsvPath)) {
        Write-Host "[WARN] Khong tim thay file CSV '$CsvPath' de xuat bao cao HTML." -ForegroundColor Yellow
        return
    }

    $lines = Import-Csv -Path $CsvPath
    if ($lines.Count -lt 2) {
        Write-Host "[WARN] Du lieu thu thap qua it de ve bieu do HTML (can it nhat 2 mau)." -ForegroundColor Yellow
        return
    }

    # Loc bo cac mau khong hop le neu tien trinh tung bi tat giua chung
    $validLines = $lines | Where-Object { [double]$_.RAM_MB -gt 0 -and [double]$_.CPU_Percent -ge 0 }
    if ($validLines.Count -ge 2) {
        $lines = $validLines
    }

    # Thong ke so lieu
    $cpuValues = $lines | ForEach-Object { [double]$_.CPU_Percent }
    $ramValues = $lines | ForEach-Object { [double]$_.RAM_MB }

    $avgCpu = [math]::Round(($cpuValues | Measure-Object -Average).Average, 2)
    $maxCpu = ($cpuValues | Measure-Object -Maximum).Maximum
    $initRam = $ramValues[0]
    $peakRam = ($ramValues | Measure-Object -Maximum).Maximum
    $endRam = $ramValues[-1]
    
    $peakGrowth = [math]::Round($peakRam - $initRam, 2)
    $ramGrowth = [math]::Round($endRam - $initRam, 2)
    $growthDelta = [math]::Max($ramGrowth, $peakGrowth)
    $growthDisplay = if ($growthDelta -ge 0) { "+$growthDelta" } else { "$growthDelta" }

    # Danh gia ro ri bo nho (Memory Leak Analysis)
    $verdict = "STABLE (ON DINH)"
    $verdictColor = "#10b981"
    $verdictDesc = "Muc RAM khong co xu huong tang dot bien hoac doc dung. Khong phat hien ro ri bo nho nghiem trong."
    
    if ($growthDelta -gt 50) {
        $verdict = "POTENTIAL LEAK (CANH BAO RO RI BO NHO)"
        $verdictColor = "#ef4444"
        $verdictDesc = "Muc RAM tang truong hon 50 MB (+$growthDelta MB) trong suot qua trinh test. Phat hien ro ri bo nho tai bien toan cuc hoac V8 Heap."
    } elseif ($growthDelta -gt 25) {
        $verdict = "MODERATE GROWTH (CAN LUU Y)"
        $verdictColor = "#f59e0b"
        $verdictDesc = "RAM co su gia tang nhe (+$growthDelta MB). Co the do bo dem SQLite hoac co che caching cua V8 Engine."
    }

    # Chuan bi du lieu cho Chart.js
    $labelsJson = ($lines | ForEach-Object { "'$($_.Timestamp)'" }) -join ","
    $cpuJson = ($lines | ForEach-Object { $_.CPU_Percent }) -join ","
    $ramJson = ($lines | ForEach-Object { $_.RAM_MB }) -join ","

    $generatedTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $totalSamples = $lines.Count
    $durationMin = [math]::Round(($totalSamples * $IntervalSeconds) / 60, 1)

    $htmlContent = @"
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bao Cao Giam Sat Phan Cung - EShop Backend</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-card: #1e293b;
            --border: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent-blue: #38bdf8;
            --accent-purple: #a855f7;
            --accent-green: #10b981;
            --accent-red: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.5;
        }
        .container { max-width: 1300px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; color: var(--accent-blue); display: flex; align-items: center; gap: 10px; }
        .header .meta { display: flex; flex-wrap: wrap; gap: 16px; color: var(--text-muted); font-size: 14px; }
        .badge { background: #334155; padding: 4px 10px; border-radius: 6px; font-weight: 500; }
        
        .grid-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .card {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-2px); }
        .card .title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
        .card .value { font-size: 26px; font-weight: 700; color: var(--text-main); }
        .card .sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
        
        .verdict-box {
            background-color: var(--bg-card);
            border-left: 6px solid $verdictColor;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 24px;
            border-top: 1px solid var(--border);
            border-right: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
        }
        .verdict-box h3 { color: $verdictColor; font-size: 18px; margin-bottom: 4px; }
        .verdict-box p { color: var(--text-muted); font-size: 14px; }

        .chart-section {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }
        @media (min-width: 900px) {
            .chart-section { grid-template-columns: 1fr 1fr; }
        }
        .chart-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }
        .chart-card h2 { font-size: 16px; margin-bottom: 16px; color: var(--text-main); display: flex; justify-content: space-between; }
        .canvas-container { position: relative; height: 320px; width: 100%; }

        footer { text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 32px; padding: 16px 0; border-top: 1px solid var(--border); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>BAO CAO GIAM SAT TAI NGUYEN SERVER (ENDURANCE TEST)</h1>
            <div class="meta">
                <span class="badge">SUT: EShop Backend (Node.js)</span>
                <span class="badge">PID: $ProcessId ($ProcessName)</span>
                <span class="badge">Port: $Port</span>
                <span class="badge">CPU Cores: $Cores Cores</span>
                <span class="badge">Duration: ~$durationMin phut ($totalSamples mau)</span>
                <span class="badge">Exported: $generatedTime</span>
            </div>
        </div>

        <div class="verdict-box">
            <h3>Ket luan kiem thu do ben: $verdict</h3>
            <p>$verdictDesc</p>
        </div>

        <div class="grid-cards">
            <div class="card">
                <div class="title">RAM Khoi Diem</div>
                <div class="value">$initRam <span style="font-size:16px;">MB</span></div>
                <div class="sub">Muc RAM luc bat dau test</div>
            </div>
            <div class="card">
                <div class="title">RAM Dinh (Peak)</div>
                <div class="value" style="color:var(--accent-purple);">$peakRam <span style="font-size:16px;">MB</span></div>
                <div class="sub">Muc tieu thu bo nho cao nhat</div>
            </div>
            <div class="card">
                <div class="title">Tang Truong RAM (Delta)</div>
                <div class="value" style="color:$verdictColor;">$growthDisplay <span style="font-size:16px;">MB</span></div>
                <div class="sub">Do doc ro ri (Peak - Initial)</div>
            </div>
            <div class="card">
                <div class="title">CPU Trung Binh</div>
                <div class="value">$avgCpu <span style="font-size:16px;">%</span></div>
                <div class="sub">Muc an tai binh quan</div>
            </div>
            <div class="card">
                <div class="title">CPU Dinh (Peak)</div>
                <div class="value" style="color:var(--accent-blue);">$maxCpu <span style="font-size:16px;">%</span></div>
                <div class="sub">Tai dinh luc xu ly luong nang</div>
            </div>
        </div>

        <div class="chart-section">
            <div class="chart-card">
                <h2>Tieu Thu RAM Theo Thoi Gian (MB) <span style="font-size:12px; color:var(--text-muted);">(Kiem tra ro ri V8 Heap)</span></h2>
                <div class="canvas-container">
                    <canvas id="ramChart"></canvas>
                </div>
            </div>

            <div class="chart-card">
                <h2>Muc Tai CPU Theo Thoi Gian (%) <span style="font-size:12px; color:var(--text-muted);">(Kiem tra nghen CPU)</span></h2>
                <div class="canvas-container">
                    <canvas id="cpuChart"></canvas>
                </div>
            </div>
        </div>

        <footer>
            FIT@HCMUS - Software Testing (CS423 / CSC15003) - De tai T05 - Performance Testing (Nhom 07)
        </footer>
    </div>

    <script>
        const timestamps = [$labelsJson];
        const ramData = [$ramJson];
        const cpuData = [$cpuJson];

        // RAM Chart
        new Chart(document.getElementById('ramChart'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: 'RAM (Working Set MB)',
                    data: ramData,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: timestamps.length > 50 ? 0 : 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxTicksLimit: 12 },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        title: { display: true, text: 'Megabytes (MB)', color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc' } }
                }
            }
        });

        // CPU Chart
        new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: cpuData,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: timestamps.length > 50 ? 0 : 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxTicksLimit: 12 },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' }
                    },
                    y: {
                        min: 0,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        title: { display: true, text: 'Tai CPU (%)', color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc' } }
                }
            }
        });
    </script>
</body>
</html>
"@

    $htmlContent | Out-File -FilePath $OutputPath -Encoding utf8
    Write-Host "`n[SUCCESS] Da xuat Bao cao HTML thanh cong tai: $OutputPath" -ForegroundColor Green
    
    if ($AutoOpen) {
        Start-Process $OutputPath
    }
}

# -------------------------------------------------------------
# CHE DO XUAT LAI REPORT TU FILE CSV CU (KHONG DO LAI)
# -------------------------------------------------------------
if ($ExportOnly) {
    Write-Host "[INFO] Dang tao lai Bao cao HTML tu file '$LogFile'..." -ForegroundColor Cyan
    Export-HtmlReport -CsvPath $LogFile -OutputPath $HtmlReport -ProcessName "node" -ProcessId 0 -Cores ([Environment]::ProcessorCount)
    exit 0
}

# -------------------------------------------------------------
# BUOC 1: TIM TIEN TRINH BACKEND DANG CHAY TAI PORT 3000
# -------------------------------------------------------------
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " HE THONG GIAM SAT PHAN CUNG (CPU/RAM) ESHOP - JMETER TESTING    " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$pidPort = $null
if ($conn) {
    $pidPort = ($conn | Select-Object -First 1).OwningProcess
}

if (-not $pidPort) {
    Write-Host "[ERROR] Khong tim thay Backend nao dang lang nghe tai Port $Port!" -ForegroundColor Red
    Write-Host "        Hay dam bao ban da khoi dong server ('npm start' tai eshop-sut/backend) truoc." -ForegroundColor Yellow
    exit 1
}

$proc = Get-Process -Id $pidPort -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Host "[ERROR] Khong the truy cap tien trinh voi PID $pidPort!" -ForegroundColor Red
    exit 1
}

$cores = [Environment]::ProcessorCount

Write-Host "[+] Phat hien Backend EShop:" -ForegroundColor Green
Write-Host "    - PID: $pidPort" -ForegroundColor White
Write-Host "    - Ten tien trinh: $($proc.ProcessName)" -ForegroundColor White
Write-Host "    - So luong CPU Cores: $cores" -ForegroundColor White
Write-Host "    - File log du lieu CSV: $LogFile" -ForegroundColor Yellow
Write-Host "    - File Dashboard HTML: $HtmlReport" -ForegroundColor Yellow
Write-Host "`n>>> DANG GHI DU LIEU LIEN TUC MOI $IntervalSeconds GIAY..." -ForegroundColor Green
Write-Host ">>> NHAN [CTRL + C] BAT CU LUC NAO DE DUNG VA TU DONG SINH HTML REPORT!`n" -ForegroundColor Magenta

# Ghi tieu de CSV
"Timestamp,PID,ProcessName,CPU_Percent,RAM_MB" | Out-File -FilePath $LogFile -Encoding utf8

$prevCpu = $proc.CPU
$prevTime = Get-Date

try {
    while ($true) {
        Start-Sleep -Seconds $IntervalSeconds
        $proc.Refresh()
        
        if ($proc.HasExited) {
            $nowStr = (Get-Date).ToString("HH:mm:ss")
            Write-Host "[$nowStr] [!] Tien trinh Backend (PID $pidPort) da dung! Dang tim PID moi tai Port $Port..." -ForegroundColor Yellow
            $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($conn -and $conn.OwningProcess -ne $pidPort) {
                $pidPort = $conn.OwningProcess
                $proc = Get-Process -Id $pidPort -ErrorAction SilentlyContinue
                if ($proc) {
                    $prevCpu = $proc.CPU
                    $prevTime = Get-Date
                    Write-Host "[$nowStr] [+] Da tu dong ket noi sang Backend moi (PID: $pidPort)!" -ForegroundColor Green
                    continue
                }
            }
            # Neu backend tam thoi tat, khong ghi mau 0MB vao CSV de tranh lam sai lech bao cao
            continue
        }

        $curCpu = $proc.CPU
        $curTime = Get-Date
        
        $timeDelta = ($curTime - $prevTime).TotalSeconds
        $cpuDelta = $curCpu - $prevCpu
        if ($cpuDelta -lt 0) { $cpuDelta = 0 }
        
        $cpuUsage = 0
        if ($timeDelta -gt 0) {
            $cpuUsage = [math]::Round(($cpuDelta / ($timeDelta * $cores)) * 100, 2)
        }
        
        $ramMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)
        $nowStr = (Get-Date).ToString("HH:mm:ss")
        
        # In mau sinh dong theo muc tai
        $cpuColor = "White"
        if ($cpuUsage -gt 70) { $cpuColor = "Red" }
        elseif ($cpuUsage -gt 40) { $cpuColor = "Yellow" }
        
        Write-Host "[$nowStr] Backend EShop -> CPU: " -NoNewline -ForegroundColor Gray
        Write-Host "$cpuUsage%" -NoNewline -ForegroundColor $cpuColor
        Write-Host " | RAM: " -NoNewline -ForegroundColor Gray
        Write-Host "$ramMB MB" -ForegroundColor Magenta
        
        "$nowStr,$pidPort,$($proc.ProcessName),$cpuUsage,$ramMB" | Out-File -FilePath $LogFile -Append -Encoding utf8
        
        $prevCpu = $curCpu
        $prevTime = $curTime
    }
}
finally {
    Write-Host "`n[!] Da nhan tin hieu dung giam sat. Dang tong hop bao cao HTML..." -ForegroundColor Cyan
    $finalProcessName = if ($proc -and $proc.ProcessName) { $proc.ProcessName } else { "node" }
    Export-HtmlReport -CsvPath $LogFile -OutputPath $HtmlReport -ProcessName $finalProcessName -ProcessId $pidPort -Cores $cores
}
