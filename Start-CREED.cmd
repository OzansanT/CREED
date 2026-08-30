@echo off
setlocal

set "CREED_ROOT=%~dp0"
call "%CREED_ROOT%optional\windows-local-launcher\Start-CREED.cmd" %*
exit /b %ERRORLEVEL%
