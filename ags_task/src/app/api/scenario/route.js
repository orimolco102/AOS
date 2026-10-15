const SERVICE_URL = process.env.SERVICE_URL || "http://localhost:5000";

// Demo control: reads and switches the service's active fault (SCENARIO).
// Only the /status page uses this. The agent's tools never call it.

async function forward(init) {
  try {
    const response = await fetch(`${SERVICE_URL}/admin/scenario`, { ...init, signal: AbortSignal.timeout(5000) });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ error: "The store service is not responding" }, { status: 503 });
  }
}

export async function GET() {
  return forward({ cache: "no-store" });
}

export async function POST(request) {
  const { scenario } = await request.json();
  return forward({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
}
