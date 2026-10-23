@echo off
setlocal
cd /d "%~dp0"

echo ======================================================================
echo  [Gatling] Running Scenario 1: Smoke Test (1 VU Baseline Check)
echo ======================================================================

mvn gatling:test -Dgatling.simulationClass=eshop.SmokeSimulation

pause
