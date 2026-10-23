@echo off
setlocal
cd /d "%~dp0"

echo ======================================================================
echo  [Gatling] Launching Gatling Recorder GUI (Record and Playback)
echo ======================================================================

mvn gatling:recorder

pause
