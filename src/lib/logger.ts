import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const rootLogger = pino({
  level: isDev ? "debug" : "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export function createLogger(name: string) {
  return rootLogger.child({ module: name });
}
