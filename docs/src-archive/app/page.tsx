export default function Home() {
  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      margin: '40px',
      maxWidth: '800px',
      marginLeft: 'auto',
      marginRight: 'auto'
    }}>
      <h1 style={{ color: '#1e40af' }}>🚀 TryOn API</h1>
      <p>Sistema de virtual try-on basado en IA</p>
      
      <h2>Endpoints disponibles:</h2>
      <ul>
        <li><a href="/api/health">/api/health</a> - Health check del sistema</li>
        <li><a href="/api/clients">/api/clients</a> - Gestión de clientes (requiere auth)</li>
        <li><code>/api/images/generate</code> - Generación de imágenes (POST)</li>
        <li><a href="/dashboard">/dashboard</a> - Panel de administración</li>
      </ul>

      <h2>Documentación:</h2>
      <ul>
        <li><a href="/api/setup">/api/setup</a> - Setup inicial</li>
        <li>Widget: <code>&lt;script src="/api/widget.js"&gt;&lt;/script&gt;</code></li>
      </ul>
    </div>
  )
}
