@echo off
rem Запуск Codex CLI как MCP-сервера для Claude Code (мост оркестратор -> исполнитель).
rem Путь к codex.exe ищется автоматически: сначала PATH, затем стандартная папка установки
rem (она содержит версионный подкаталог, который меняется при обновлении Codex).
rem
rem ВАЖНО про комплектность: 2026-09-08 обновление Codex установилось наполовину —
rem в новом версионном подкаталоге лежал codex.exe, но не было codex-code-mode-host.exe,
rem и Codex запускался, но не мог выполнить ни одной команды («os error 2»). Рядом при этом
rem оставалась предыдущая полная версия. Поэтому берём не первый попавшийся codex.exe,
rem а самую свежую папку, где есть ОБА файла: наличие codex.exe само по себе не значит,
rem что установка рабочая.
setlocal enabledelayedexpansion
set "CODEX="

rem 1. PATH — но только если рядом с ним лежит и вспомогательный хост.
for /f "delims=" %%i in ('where codex 2^>nul') do (
  if exist "%%~dpicodex-code-mode-host.exe" set "CODEX=%%i"
)

rem 2. Папка установки: перебираем версии, оставляем последнюю комплектную.
rem    dir /o-d отдаёт сначала свежие, поэтому первая найденная и будет самой новой.
if not defined CODEX (
  for /f "delims=" %%d in ('dir /b /ad /o-d "%LOCALAPPDATA%\OpenAI\Codex\bin" 2^>nul') do (
    if not defined CODEX (
      set "CANDIDATE=%LOCALAPPDATA%\OpenAI\Codex\bin\%%d"
      if exist "!CANDIDATE!\codex.exe" if exist "!CANDIDATE!\codex-code-mode-host.exe" set "CODEX=!CANDIDATE!\codex.exe"
    )
  )
)

if not defined CODEX (
  echo [codex-mcp] Рабочая установка Codex не найдена. 1>&2
  echo [codex-mcp] Нужны оба файла: codex.exe и codex-code-mode-host.exe в одной папке. 1>&2
  echo [codex-mcp] Если Codex обновлялся недавно — обновление могло установиться не полностью, переустановите его. 1>&2
  exit /b 1
)
"%CODEX%" mcp-server -c approval_policy="never" -c sandbox_mode="workspace-write"
