@echo off
rem Разовая задача для Codex без MCP-моста (запасной способ).
rem Использование: tools\codex-task.cmd <файл-с-заданием> [файл-для-ответа]
rem Codex работает в папке проекта с правом записи только внутри неё.
setlocal enabledelayedexpansion

if "%~1"=="" (
  echo Использование: codex-task.cmd ^<файл-с-заданием^> [файл-для-ответа] 1>&2
  exit /b 1
)
if not exist "%~1" (
  echo [codex-task] Файл задания не найден: %~1 1>&2
  exit /b 1
)

set "CODEX="
for /f "delims=" %%i in ('where codex 2^>nul') do set "CODEX=%%i"
if not defined CODEX (
  for /f "delims=" %%i in ('dir /b /s "%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe" 2^>nul') do set "CODEX=%%i"
)
if not defined CODEX (
  echo [codex-task] Codex CLI не найден. Установите Codex или добавьте codex в PATH. 1>&2
  exit /b 1
)

set "OUT=%~2"
if not defined OUT set "OUT=%TEMP%\codex-last-answer.txt"

rem %~f1 / %~f2 — полные пути с обратными слэшами: type не понимает пути через "/"
type "%~f1" | "%CODEX%" exec -s workspace-write -C "%~dp0.." -o "%OUT%" -
