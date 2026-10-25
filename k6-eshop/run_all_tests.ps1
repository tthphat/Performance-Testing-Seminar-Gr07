# ============================================================================
# SCRIPT CHẠY LIÊN HOÀN CÁC BÀI TEST K6 TRONG THƯ MỤC K6-ESHOP
# ============================================================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "      BẮT ĐẦU CHUỖI KIỂM THỬ HIỆU NĂNG K6 - ESHOP SUT" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. SMOKE TEST (1 VU - Sanity Check)
Write-Host "
>>> [1/4] Đang chạy Smoke Test (1 VU - 1 vòng lặp)..." -ForegroundColor Yellow
k6 run --iterations 1 smoke_test.js

# 2. BASELINE LOAD TEST (50 VUs - 5 phút)
Write-Host "
>>> [2/4] Đang chạy Baseline Load Test (50 VUs - 5 phút)..." -ForegroundColor Yellow
k6 run --out json=baseline_results_new.json baseline_load.js

# 3. SPIKE TEST (500 VUs - 5 phút)
Write-Host "
>>> [3/4] Đang chạy Spike Test (500 VUs - 5 phút)..." -ForegroundColor Yellow
k6 run --out json=spike_results_new.json spike_test.js

# 4. ENDURANCE TEST (50 VUs - 30 phút)
$answer = Read-Host "
>>> [4/4] Bạn có muốn chạy Endurance Test 30 phút ngay bây giờ không? (y/N)"
if ($answer -eq 'y' -or $answer -eq 'Y') {
    Write-Host ">>> Đang chạy Endurance Test (50 VUs - 30 phút)..." -ForegroundColor Yellow
    k6 run --out json=endurance_results_new.json endurance_test.js
} else {
    Write-Host ">>> Đã bỏ qua bài Endurance Test 30 phút." -ForegroundColor Gray
}

Write-Host "
==================================================================" -ForegroundColor Cyan
Write-Host " HOÀN TẤT TOÀN BỘ CÁC KỊCH BẢN KIỂM THỬ K6!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
