import winston from 'winston';
import path from 'path';

// Custom colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'gray',
  success: 'green'
};

// Add colors to winston
winston.addColors(colors);

// Custom format for beautiful console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ` ${JSON.stringify(meta)}`;
    }
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// File format (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    success: 3,
    debug: 4
  },
  format: fileFormat,
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false
});

// Helper methods for different log levels
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  success: (message: string, meta?: any) => logger.log('success', message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // Request logging
  request: (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'error' : 'info';
      logger.log(level, `${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        user: req.user?.id || 'anonymous'
      });
    });
    next();
  }
};

export default logger;