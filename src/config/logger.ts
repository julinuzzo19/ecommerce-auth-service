import { createLogger, format, transports } from 'winston';
import { ConsoleTransportOptions } from 'winston/lib/winston/transports';
const NODE_ENV = process.env.NODE_ENV ?? 'production';

const { combine, timestamp, label, printf } = format;

// custom log display format
const customFormat = format.printf(({ timestamp, level, stack, message }) => {
  const log = `${timestamp} - [${level.toUpperCase()}] - ${message}${stack ? ' - ' + stack : ''}`;
  return log;
});

const options: {
  console: ConsoleTransportOptions;
} = {
  console: {
    level: 'silly',
  },
};

// for development environment
const devLogger = {
  format: format.combine(
    timestamp(),
    format.errors({ stack: true }),
    customFormat,
  ),
  transports: [new transports.Console(options.console)],
};

// for production environment
const formatProd = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const prodLogger = {
  level: 'warn',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), formatProd),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({
      filename: 'logs/info.log',
      level: 'info',
    }),
    new transports.Console(options.console),
  ],
};

const instanceLogger = NODE_ENV === 'production' ? prodLogger : devLogger;

export const logger = createLogger(instanceLogger);
