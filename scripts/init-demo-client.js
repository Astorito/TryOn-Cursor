const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function initDemoClient() {
  try {
    console.log('Initializing demo client...')

    // Check if demo client already exists
    const existingClient = await prisma.client.findUnique({
      where: { apiKey: 'demo_key_tryon_2024' }
    })

    if (existingClient) {
      console.log('Demo client already exists:', existingClient.name)
      return
    }

    // Create demo client
    const demoClient = await prisma.client.create({
      data: {
        name: 'Demo Client',
        email: 'demo@tryon.com',
        apiKey: 'demo_key_tryon_2024',
        active: true,
        limit: 1000, // Generous limit for demo
        website: 'https://demo.tryon.com'
      }
    })

    console.log('Demo client created successfully:', demoClient.name)
    console.log('API Key:', demoClient.apiKey)

  } catch (error) {
    console.error('Error initializing demo client:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

initDemoClient()