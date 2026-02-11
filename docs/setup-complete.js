// Script completo para configurar TryOn desde cero
const http = require('http');

// Función para hacer requests HTTP
function makeRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function setupSystem() {
  console.log('🚀 CONFIGURANDO SISTEMA TRYON COMPLETO...\n');

  try {
    // 1. Verificar que el servidor esté corriendo
    console.log('1️⃣ Verificando servidor...');
    const healthCheck = await makeRequest('http://localhost:3000/api/setup');
    if (healthCheck.status !== 200) {
      console.log('❌ Servidor no está corriendo. Ejecutá primero:');
      console.log('   node server.js');
      console.log('   (en otra terminal)');
      return;
    }
    console.log('✅ Servidor corriendo\n');

    // 2. Inicializar cliente demo
    console.log('2️⃣ Inicializando cliente demo...');
    const setupResponse = await makeRequest('http://localhost:3000/api/setup');
    if (setupResponse.status === 200 && setupResponse.data.success) {
      console.log('✅ Cliente demo creado/actualizado');
      console.log('📋 API Key:', setupResponse.data.client.api_key);
      console.log('🔗 Script de integración:');
      console.log(setupResponse.data.integration.code);
      console.log('');
    } else {
      console.log('❌ Error en setup:', setupResponse.data);
      return;
    }

    // 3. Verificar widget
    console.log('3️⃣ Verificando widget JavaScript...');
    const widgetResponse = await makeRequest('http://localhost:3000/api/widget.js');
    if (widgetResponse.status === 200) {
      console.log('✅ Widget JavaScript funcionando');
      console.log('📏 Tamaño:', widgetResponse.data.length, 'caracteres');
      console.log('');
    } else {
      console.log('❌ Error en widget:', widgetResponse.status);
      return;
    }

    // 4. Verificar dashboard
    console.log('4️⃣ Verificando dashboard...');
    const dashboardResponse = await makeRequest('http://localhost:3000/dashboard');
    if (dashboardResponse.status === 200) {
      console.log('✅ Dashboard funcionando');
      console.log('');
    } else {
      console.log('❌ Error en dashboard:', dashboardResponse.status);
      return;
    }

    // 5. Probar endpoint de generación (sin archivos reales)
    console.log('5️⃣ Probando endpoint de generación...');
    try {
      const testGeneration = await makeRequest('http://localhost:3000/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        apiKey: 'demo_key_tryon_2024',
        userImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD',
        garments: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD']
      });

      if (testGeneration.status === 400) {
        console.log('✅ Endpoint de generación responde (esperado error por datos inválidos)');
      } else {
        console.log('ℹ️ Respuesta generación:', testGeneration.status, testGeneration.data?.error || 'OK');
      }
      console.log('');
    } catch (error) {
      console.log('⚠️ Endpoint de generación no disponible (esperado en versión simplificada)');
      console.log('');
    }

    // 6. Resumen final
    console.log('🎉 ¡SISTEMA TRYON COMPLETO CONFIGURADO!');
    console.log('');
    console.log('📡 ACCESOS DISPONIBLES:');
    console.log('   🌐 Dashboard Admin: http://localhost:3000/dashboard');
    console.log('   🔧 API Setup:       http://localhost:3000/api/setup');
    console.log('   📦 Widget JS:       http://localhost:3000/api/widget.js');
    console.log('   🎨 Generación:      http://localhost:3000/api/images/generate');
    console.log('');
    console.log('📋 SCRIPT DE INTEGRACIÓN:');
    console.log(`   <script src="http://localhost:3000/api/widget.js" data-tryon-key="demo_key_tryon_2024"></script>`);
    console.log('');
    console.log('🚀 PRUEBA EL WIDGET:');
    console.log('   Crea un archivo HTML con el script arriba y abrilo en el navegador');
    console.log('   Verás un botón flotante "✨ Try Look" en la esquina inferior derecha');
    console.log('');
    console.log('💡 PRÓXIMOS PASOS:');
    console.log('   1. Integra el widget en tu sitio web');
    console.log('   2. Crea más clientes desde el dashboard');
    console.log('   3. Monitorea métricas de uso');
    console.log('   4. Conecta con FAL AI real para generaciones');

  } catch (error) {
    console.error('❌ Error en configuración:', error.message);
    console.log('');
    console.log('💡 Asegurate de que el servidor esté corriendo:');
    console.log('   node server.js');
  }
}

// Ejecutar setup
setupSystem();