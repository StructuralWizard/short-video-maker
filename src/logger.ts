import pino from "pino";

// Create the global logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Export both named and default exports
export { logger };
export default logger;

// Add type declaration
declare global {
  const logger: ReturnType<typeof pino>;
}
