@echo off
cd "C:\Users\Paulo PC\Documents\controle leite"

echo.
echo  ╔════════════════════════════════════════╗
echo  ║     TERRASYN - Deploy para Vercel      ║
echo  ╚════════════════════════════════════════╝
echo.

git status
git add .
git commit -m "Deploy via deploy.bat"
git push -u origin main
git pull origin main --rebase
git push -u origin main

echo.
echo  Deploy concluido!
pause
