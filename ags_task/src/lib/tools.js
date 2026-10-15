import { callService } from "./demo-service";

// Each tool has a Gemini function declaration and the code that runs it.

export const checkHealth = {
  declaration: {
    name: "check_health",
    description: "Checks if the service is up and the status of its dependencies (database, external services).",
  },
  async execute() {
    const health = await callService("/health");

    return health;
  },
};

export const readLogs = {
  declaration: {
    name: "read_logs",
    description: "Reads the most recent service log lines. Use it to find errors, warnings and slow requests.",
  },
  async execute() {
    const result = await callService("/logs?lines=50");

    return result;
  },
};

export const getVersion = {
  declaration: {
    name: "get_version",
    description: "Returns the running version and when it was deployed. Use it to check if problems started after a deploy.",
  },
  async execute() {
    const version = await callService("/version");

    return version;
  },
};

export const getMetrics = {
  declaration: {
    name: "get_metrics",
    description: "Returns the request count, error rate and response times. Use it to find slow responses or a high error rate.",
  },
  async execute() {
    const metric = await callService("/metrics");

    return metric;
  },
};

export const tools = [checkHealth, readLogs, getVersion, getMetrics];
