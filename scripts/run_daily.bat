@echo off
REM Danish Daily — runs the lesson generator and commits/pushes the result.
REM Designed to be invoked by Windows Task Scheduler.
REM All output is appended to logs\daily.log for debugging.

setlocal
cd /d "%~dp0\.."
if not exist logs mkdir logs

echo. >> logs\daily.log
echo ============================================ >> logs\daily.log
echo Run started: %date% %time% >> logs\daily.log
echo ============================================ >> logs\daily.log

python scripts\daily_lesson.py >> logs\daily.log 2>&1
if errorlevel 1 (
    echo FAILED: daily_lesson.py exited with code %errorlevel% >> logs\daily.log
    goto :end
)

git add docs/data/ >> logs\daily.log 2>&1
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "chore: daily lesson auto-update" >> logs\daily.log 2>&1
    git push >> logs\daily.log 2>&1
    echo Commit + push done. >> logs\daily.log
) else (
    echo No changes to commit. >> logs\daily.log
)

:end
echo Run finished: %date% %time% >> logs\daily.log
endlocal
