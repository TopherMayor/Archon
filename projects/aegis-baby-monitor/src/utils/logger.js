const winston = require('winston');
const path = require('path');

/**
 * Create a Winston logger instance with appropriate configuration
 */
function createLogger(component = 'Aegis') {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = process.env.DATA_STORAGE_PATH ? 
    path.join(process.env.DATA_STORAGE_PATH, 'logs') : 
    path.join(__dirname, '../../logs');

  // Create log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] [${component}] ${message}${metaStr}`;
    })
  );

  // Configure transports
  const transports = [
    // Console transport
    new winston.transports.Console({
      level: logLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}] [${component}] ${message}${metaStr}`;
        })
      )
    })
  ];

  // Add file transport in production or when LOG_TO_FILE is set
  if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10
      })
    );
  }

  // Create logger
  const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { component },
    transports,
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'exceptions.log'),
        maxsize: 10485760,
        maxFiles: 3
      })
    ],
    rejectionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'rejections.log'),
        maxsize: 10485760,
        maxFiles: 3
      })
    ]
  });

  return logger;
}

/**
 * Get the default application logger
 */
function getDefaultLogger() {
  return createLogger('Aegis');
}

/**
 * Log levels for reference
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

module.exports = {
  createLogger,
  getDefaultLogger,
  LOG_LEVELS
};
