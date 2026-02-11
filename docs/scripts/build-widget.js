/**
 * Extrae el código del widget desde src/app/api/widget/route.ts
 * y lo escribe en widget-full.js para que server.js pueda servirlo en local.
 */
const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '..', 'src', 'app', 'api', 'widget', 'route.ts');
const outPath = path.join(__dirname, '..', 'widget-full.js');

const content = fs.readFileSync(routePath, 'utf8');
const marker = 'const widgetCode = `';
const start = content.indexOf(marker) + marker.length;
const trimMarker = '`.trim()';
const end = content.indexOf(trimMarker);
if (start <= marker.length || end === -1) {
  console.error('No se encontró el bloque del widget en route.ts');
  process.exit(1);
}
const widget = content.substring(start, end).trim();
fs.writeFileSync(outPath, widget, 'utf8');
console.log('✅ widget-full.js generado en la raíz del proyecto');
