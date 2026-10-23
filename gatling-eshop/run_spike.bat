@echo off
echo ======================================================================
echo  [Gatling] Running Scenario 3: Spike / Stress Test (Traffic Explosion)
echo ======================================================================
mvn gatling:test -Dgatling.simulationClass=eshop.SpikeSimulation
pause
