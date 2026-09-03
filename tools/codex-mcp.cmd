@echo off
rem Запуск Codex CLI как MCP-сервера для Claude Code (мост оркестратор -> исполнитель).
rem Путь к codex.exe ищется автоматически: сначала PATH, затем стандартная папка установки
rem (она содержит версионный подкаталог, который меняется при обновлении Codex).
setlocal enabledelayedexpansion
set "CODEX="
for /f "delims=" %%i in ('where codex 2^>nul') do set "CODEX=%%i"
if not defined CODEX (
  for /f "delims=" %%i in ('dir /b /s "%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe" 2^>nul') do set "CODEX=%%i"
)
if not defined CODEX (
  echo [codex-mcp] Codex CLI не найден. Установите Codex или добавьте codex в PATH. 1>&2
  exit /b 1
)
"%CODEX%" mcp-server -c approval_policy="never" -c sandbox_mode="workspace-write"
