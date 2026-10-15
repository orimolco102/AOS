const SERVICE_URL = process.env.SERVICE_URL || "http://localhost:5000";

// Adding to the cart goes through the cart service,
// so when the service has a fault, "Add to cart" is what breaks.
export async function POST(request) {
  const { productId } = await request.json();

  try {
    const response = await fetch(`${SERVICE_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return Response.json({ error: `The store service returned ${response.status}` }, { status: 502 });
    }
    return Response.json(await response.json());
  } catch {
    return Response.json({ error: "The store service is not responding" }, { status: 503 });
  }
}
