const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Widget completo (generado con: node scripts/build-widget.js)
const widgetPath = path.join(__dirname, 'widget-full.js');
let fullWidgetCode = null;
try {
  fullWidgetCode = fs.readFileSync(widgetPath, 'utf8');
} catch (_) {
  // Si no existe widget-full.js, se usará el widget mínimo
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ 
      message: 'TryOn API activo!',
      endpoints: {
        setup: '/api/setup',
        widget: '/api/widget.js', 
        dashboard: '/dashboard',
        test: '/test-widget'
      }
    }));
  }
  
  else if (parsedUrl.pathname === '/api/setup' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ 
      success: true,
      message: 'TryOn Setup Complete!',
      client: { 
        name: 'Demo Store TryOn',
        api_key: 'demo_key_tryon_2024',
        limit: 1000
      },
      integration: {
        code: '<script src=\"http://localhost:3000/api/widget.js\" data-tryon-key=\"demo_key_tryon_2024\"></script>',
        instructions: 'Copiar este código en tu HTML antes del /body'
      }
    }));
  }
  
  else if (parsedUrl.pathname === '/api/widget.js' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/javascript');
    if (fullWidgetCode) {
      res.end(fullWidgetCode);
    } else {
      const widget = '(function(){const key=document.currentScript.dataset.tryonKey;console.log("TryOn activado con key: "+key);alert("Ejecuta: node scripts/build-widget.js y reinicia para el widget completo");})();';
      res.end(widget);
    }
  }
  
  else if (parsedUrl.pathname === '/dashboard' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    const html = '<html><body style="font-family:Arial;margin:40px;background:#f5f5f5;">' +
      '<div style="max-width:800px;margin:0 auto;background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">' +
      '<h1 style="color:#1e40af;text-align:center;">TryOn Dashboard</h1>' +
      '<h2>Script de Integración</h2>' +
      '<div style="background:#1e1e1e;color:#4ade80;padding:15px;border-radius:5px;font-size:12px;">' +
      '&lt;script src="http://localhost:3000/api/widget.js" data-tryon-key="demo_key_tryon_2024"&gt;&lt;/script&gt;' +
      '</div><h2>Instrucciones</h2><ol><li>Copia el script de arriba</li><li>Pégalo en tu HTML antes del /body</li><li>El botón aparecerá flotante</li></ol></div></body></html>';
    res.end(html);
  }

  else if (parsedUrl.pathname === '/test-widget' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    const testHtml = '<html><body style="font-family:Arial;margin:40px;"><h1>Prueba TryOn Widget</h1>' +
      '<p>El botón flotante debería aparecer abajo a la derecha</p>' +
      '<script src="http://localhost:3000/api/widget.js" data-tryon-key="demo_key_tryon_2024"></script></body></html>';
    res.end(testHtml);
  }
  
  else {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ error: 'Not found', try: '/api/setup' }));
  }
});

server.listen(3000, () => {
  console.log('');
  console.log('🚀 SERVIDOR TRUON INICIADO!');
  console.log('');
  console.log('📡 Endpoints disponibles:');
  console.log('   http://localhost:3000/api/setup  → Setup del sistema');
  console.log('   http://localhost:3000/api/widget.js → Widget JS');
  console.log('   http://localhost:3000/dashboard  → Panel admin');
  console.log('   http://localhost:3000/test-widget → Prueba del widget');
  console.log('');
});
