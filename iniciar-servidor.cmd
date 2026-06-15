@echo off
cd "C:\Users\Paulo\Documents\controle leite"
echo Iniciando servidor local do Agro+...
echo.
echo Acesse: http://127.0.0.1:5173/
echo Login: admin
echo Senha: admin123
echo.
echo Para parar o servidor, aperte Ctrl+C ou feche esta janela.
echo.
"C:\Program Files\nodejs\node.exe" server.js
echo.
echo O servidor foi encerrado.
pause
