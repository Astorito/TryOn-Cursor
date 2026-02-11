import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createRequestLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || Math.random().toString(36).substring(2, 15)
  const requestLogger = createRequestLogger(requestId)

  const start = Date.now();
  const checks: Record<string, { status: string; responseMs?: number; error?: string }> = {};

  try {
    // Check 1: Database
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', responseMs: Date.now() - dbStart };
      requestLogger.info('Database health check passed', { responseMs: checks.database.responseMs })
    } catch (e) {
      checks.database = { status: 'error', error: e instanceof Error ? e.message : 'Unknown' };
      requestLogger.error('Database health check failed', e as Error)
    }

    // Check 2: FAL AI (solo ping, no generar)
    try {
      const falStart = Date.now();
      const res = await fetch('https://fal.run/health', { signal: AbortSignal.timeout(5000) });
      checks.fal_ai = { status: res.ok ? 'ok' : 'degraded', responseMs: Date.now() - falStart };
      requestLogger.info('FAL AI health check completed', {
        status: checks.fal_ai.status,
        responseMs: checks.fal_ai.responseMs
      })
    } catch (e) {
      checks.fal_ai = { status: 'unreachable', error: e instanceof Error ? e.message : 'Timeout' };
      requestLogger.warn('FAL AI health check failed', {
        error: checks.fal_ai.error,
        status: checks.fal_ai.status
      })
    }

    // Check 3: Estadísticas básicas
    let stats = {};
    try {
      const [clientCount, genCount] = await Promise.all([
        prisma.client.count(),
        prisma.generation.count(),
      ]);
      stats = { clients: clientCount, generations: genCount };
      requestLogger.info('Statistics retrieved successfully', stats)
    } catch (e) {
      requestLogger.warn('Failed to retrieve statistics', e as Error)
      // Si falla, dejamos stats vacío
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    const response = {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      totalMs: Date.now() - start,
      checks,
      stats,
    };

    requestLogger.info('Health check completed', {
      status: response.status,
      totalMs: response.totalMs,
      allChecksOk: allOk
    });

    return NextResponse.json(response, { status: allOk ? 200 : 503 });

  } catch (error) {
    requestLogger.error('Unexpected error in health check', error as Error, {
      totalMs: Date.now() - start
    });

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      totalMs: Date.now() - start,
      checks: {
        ...checks,
        unexpected: { status: 'error', error: 'Unexpected health check failure' }
      },
      stats: {}
    }, { status: 500 });
  }
}