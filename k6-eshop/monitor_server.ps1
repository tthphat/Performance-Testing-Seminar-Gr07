# ============================================================================
# SCRIPT GIÁM SÁT CPU & RAM TIẾN TRÌNH ESHOP BACKEND (PORT 3000)
# ============================================================================

$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$pid3000 = $null
if ($conn) {
    $pid3000 = $conn.OwningProcess
}

if (-not $pid3000) {
    Write-Host "[ERROR] Khong tim thay server dang chay tai Port 3000! Hay bat 'node server.js' truoc." -ForegroundColor Red
    exit 1
}

$proc = Get-Process -Id $pid3000
$cores = [Environment]::ProcessorCount
$logFile = "server_hardware_metrics.csv"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " DANG GIAM SAT ESHOP BACKEND (PID: $pid3000 - $($proc.ProcessName))" -ForegroundColor Green
Write-Host " So luong CPU (Logical Cores): $cores" -ForegroundColor Yellow
Write-Host " Du lieu ghi lien tuc vao: $logFile" -ForegroundColor Yellow
Write-Host " Nhan Ctrl + C de dung giam sat." -ForegroundColor Gray
Write-Host "==================================================================" -ForegroundColor Cyan

"Timestamp,PID,ProcessName,CPU_Percent,RAM_MB" | Out-File -FilePath $logFile -Encoding utf8

$prevCpu = $proc.CPU
$prevTime = Get-Date

while ($true) {
    Start-Sleep -Seconds 2
    $proc.Refresh()
    
    $curCpu = $proc.CPU
    $curTime = Get-Date
    
    $timeDelta = ($curTime - $prevTime).TotalSeconds
    $cpuDelta = $curCpu - $prevCpu
    
    $cpuUsage = 0
    if ($timeDelta -gt 0) {
        $cpuUsage = [math]::Round(($cpuDelta / ($timeDelta * $cores)) * 100, 2)
    }
    
    $ramMB = [math]::Round($proc.WorkingSet64 / 1MB, 2)
    $nowStr = Get-Date -Format "HH:mm:ss"
    
    Write-Host "[$nowStr] Backend EShop -> CPU: $cpuUsage% | RAM: $ramMB MB" -ForegroundColor White
    "$nowStr,$pid3000,$($proc.ProcessName),$cpuUsage,$ramMB" | Out-File -FilePath $logFile -Append -Encoding utf8
    
    $prevCpu = $curCpu
    $prevTime = $curTime
}
