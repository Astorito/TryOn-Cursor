/**
 * Script para limpiar prepared statements en PostgreSQL
 * 
 * Ejecutar cuando veas error 42P05 "prepared statement already exists"
 * 
 * Uso:
 *   node scripts/clear-prepared-statements.js
 */

const { Pool } = require('pg')
require('dotenv/config')

async function clearPreparedStatements() {
  console.log('🔧 Limpiando prepared statements...\n')

  // Extraer la URL de conexión directa (sin pooler)
  const dbUrl = process.env.DATABASE_URL
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no está configurada en .env')
    process.exit(1)
  }

  // Reemplazar pooler.supabase.com:6543 por aws-0-us-east-2.pooler.supabase.com:5432 (conexión directa)
  const directUrl = dbUrl
    .replace(':6543', ':5432')
    .replace('?pgbouncer=true', '')
  
  console.log('📡 Conectando a PostgreSQL (conexión directa)...')
  console.log('   URL:', directUrl.replace(/:[^:]*@/, ':****@'))

  const pool = new Pool({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false }
  })

  try {
    // Listar prepared statements activos
    console.log('\n📊 Consultando prepared statements activos...')
    const result = await pool.query(`
      SELECT name, statement, prepare_time 
      FROM pg_prepared_statements 
      ORDER BY prepare_time DESC
      LIMIT 20
    `)

    if (result.rows.length === 0) {
      console.log('✅ No hay prepared statements activos')
    } else {
      console.log(`\n⚠️  Encontrados ${result.rows.length} prepared statements:`)
      result.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.name} (${row.prepare_time})`)
      })

      // Deallocate prepared statements
      console.log('\n🧹 Limpiando prepared statements...')
      for (const row of result.rows) {
        try {
          await pool.query(`DEALLOCATE "${row.name}"`)
          console.log(`   ✓ Limpiado: ${row.name}`)
        } catch (err) {
          console.log(`   ⚠️  No se pudo limpiar ${row.name}:`, err.message)
        }
      }
    }

    console.log('\n✅ Operación completada')
    console.log('\n💡 Ahora reinicia tu servidor Node:')
    console.log('   1. Presiona Ctrl+C en la terminal del servidor')
    console.log('   2. Ejecuta: npm run start')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('\n💡 Sugerencias:')
    console.error('   - Verifica que DATABASE_URL esté configurada correctamente')
    console.error('   - Asegúrate de tener permisos en la base de datos')
    console.error('   - Intenta usar la conexión directa (puerto 5432) en vez del pooler (6543)')
  } finally {
    await pool.end()
  }
}

clearPreparedStatements().catch(console.error)
