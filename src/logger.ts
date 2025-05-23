import pino from "pino";

// Create the global logger
export const logger = pino({
  level: 'info',
  base: undefined,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  }
});

export default logger;
