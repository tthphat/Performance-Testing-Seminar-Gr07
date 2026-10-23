@echo off
setlocal
cd /d "%~dp0"

echo ======================================================================
echo  [Gatling] Running Scenario 3: Spike / Stress Test (Traffic Explosion)
echo ======================================================================

mvn gatling:test -Dgatling.simulationClass=eshop.SpikeSimulation

pause
