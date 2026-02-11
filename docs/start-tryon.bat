@echo off
echo 🚀 INICIANDO SISTEMA TRYON...
echo.

echo 📦 Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
    echo ✅ Dependencias instaladas
) else (
    echo ✅ Dependencias ya instaladas
)
echo.

echo 🗄️ Verificando base de datos...
node setup-complete.js
echo.

echo 🌐 Iniciando servidor...
echo Servidor corriendo en: http://localhost:3000
echo Dashboard: http://localhost:3000/dashboard
echo API Setup: http://localhost:3000/api/setup
echo Widget: http://localhost:3000/api/widget.js
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

node server.js