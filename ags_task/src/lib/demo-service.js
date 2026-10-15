const SERVICE_URL = process.env.SERVICE_URL || "http://localhost:5000";

// Calls the service and returns status, response time and body as text.
// Never throws: an unreachable service is evidence for the agent.
export async function callService(path) {
  const start = Date.now();
  try {
    const response = await fetch(`${SERVICE_URL}${path}`, { signal: AbortSignal.timeout(8000) });
    const body = await response.text();
    return `HTTP ${response.status} in ${Date.now() - start}ms\n${body.slice(0, 4000)}`;
  } catch (err) {
    return `Service unreachable after ${Date.now() - start}ms: ${err.cause?.code || err.message}`;
  }
}
