@echo off
echo ======================================================================
echo  [Gatling] Running Scenario 2: Baseline Load (50 VUs - Mixed 70/25/5)
echo ======================================================================
mvn gatling:test -Dgatling.simulationClass=eshop.BaselineLoadSimulation
pause
