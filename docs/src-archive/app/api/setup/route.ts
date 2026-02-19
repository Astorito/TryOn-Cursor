import { NextResponse } from 'next/server'

/**
 * Setup endpoint - Stub version
 * This endpoint is not fully implemented in the docs/src build
 */
export async function GET() {
  return NextResponse.json({
    success: false,
    message: 'Setup endpoint not implemented in this build',
    info: 'Use the main app for setup functionality'
  }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Setup endpoint not implemented in this build',
    info: 'Use the main app for setup functionality'
  }, { status: 501 })
}
