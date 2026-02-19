/**
 * Structured Logging System
 *
 * Logs consistentes en formato JSON para fácil búsqueda y debugging
 * Compatible con Vercel logs, CloudWatch, etc.
 */

interface LogMeta {
  [key: string]: any
}

interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug'
  msg: string
  time: string
  requestId?: string
  [key: string]: any
}

class Logger {
  private formatLog(level: LogEntry['level'], msg: string, meta?: LogMeta): LogEntry {
    const entry: LogEntry = {
      level,
      msg,
      time: new Date().toISOString(),
      ...meta
    }

    return entry
  }

  info(msg: string, meta?: LogMeta) {
    const entry = this.formatLog('info', msg, meta)
    console.log(JSON.stringify(entry))
  }

  error(msg: string, error?: Error, meta?: LogMeta) {
    const entry = this.formatLog('error', msg, {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
      ...meta
    })
    console.error(JSON.stringify(entry))
  }

  warn(msg: string, meta?: LogMeta) {
    const entry = this.formatLog('warn', msg, meta)
    console.warn(JSON.stringify(entry))
  }

  debug(msg: string, meta?: LogMeta) {
    const entry = this.formatLog('debug', msg, meta)
    console.debug(JSON.stringify(entry))
  }

  child(context: LogMeta) {
    const childLogger = new Logger()
    const originalFormatLog = childLogger.formatLog.bind(childLogger)

    // @ts-ignore - override for contextual logging
    childLogger.formatLog = (level, msg, meta) => {
      return originalFormatLog(level, msg, { ...context, ...meta })
    }

    return childLogger
  }
}

export const logger = new Logger()

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}
