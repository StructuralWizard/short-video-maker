import pino from "pino";

// Create the global logger
const logger = pino({
  level: 'info',
  base: undefined,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  }
});

// Export both named and default exports
export { logger };
export default logger;

// Add type declaration
declare global {
  const logger: ReturnType<typeof pino>;
}
