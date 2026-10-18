import express from "express";
import { MongoClient } from "mongodb";
import "dotenv/config";
const app = express();
const version = process.env.APP_VERSION || "1.0.0";
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

// Which fault is active. Starts from SCENARIO in .env and can be switched at runtime via /admin/scenario.
//   healthy   - everything works
//   cart_down - the cart dependency (cart-info) can't be reached
//   db_down   - the database address doesn't exist
//   slow      - Add to cart takes 4-6 seconds
const SCENARIOS = ["healthy", "cart_down", "db_down", "slow"];
let SCENARIO = SCENARIOS.includes(process.env.SCENARIO) ? process.env.SCENARIO : "healthy";

const realClient = new MongoClient(process.env.MONGO_URI, {serverSelectionTimeoutMS: 3000});
const fakeClient = new MongoClient(process.env.FAKEDB, {serverSelectionTimeoutMS: 3000});

// In the db_down scenario every database call goes to the address that doesn't exist.

const db = () => (SCENARIO === "db_down" ? fakeClient : realClient).db();
const logs = { insertOne: (doc) => db().collection("logs").insertOne(doc), find: (...args) => db().collection("logs").find(...args) };
// "logs" works like a normal MongoDB collection, but picks the database on every call instead of once at startup.
// insertOne: (doc) => takes the document and saves it in the current database.
// find: (...args) => "...args" collects all the arguments find() was called with
// (for example the filter and the projection) into one array, and "find(...args)"
// spreads them back out, so they are passed on to the real find() unchanged.
const carts = { insertOne: (doc) => db().collection("carts").insertOne(doc) };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The last 200 log lines are also kept in memory, so /logs still works when the database is down.
const recentLogs = [];

function remember(line) {
  recentLogs.unshift(line);
  if (recentLogs.length > 200) recentLogs.pop();
}

async function log(level, message) {
  const line = { time: new Date(), version: version, level, message };
  console.log(JSON.stringify(line));
  remember(line);
  try {
    await logs.insertOne({ ...line });
  } catch (error) {
    remember({ time: new Date(), version: version, level: "error", message: `database write failed: ${error.message}` });
  }
}

// Remembers the last 200 requests so /metrics can report error rate and response times.
const recentRequests = [];
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (["/health", "/version", "/logs", "/metrics"].includes(req.path)) return;
    recentRequests.push({ ms: Date.now() - start, error: res.statusCode >= 500 });
    if (recentRequests.length > 200) recentRequests.shift();
  });
  next();
});

// error causing function. allways looks for the non existing URL and returns an error.
async function addToCart() {
    if(SCENARIO === "cart_down") {
        await fetch("http://cart-info:5000/personalcart")
    }
    return {leveL: 20, err: 232};
}

// Runs one dependency check and reports up/down with how long it took.
async function check(fn) {
  const start = Date.now();
  try {
    await fn();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (error) {
    return { status: "down", error: error.cause?.code || error.message, latencyMs: Date.now() - start };
  }
}

// Health checks every dependency the service needs: the database and the cart service.
app.get("/health", async (req, res) => {
  const [database, cartService] = await Promise.all([
    check(() => db().command({ ping: 1 })),
    check(() => addToCart()),
  ]);
  const ok = database.status === "up" && cartService.status === "up";
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", dependencies: { database, cartService } });
});

app.get("/version", (req, res) => {
  res.json({ service: "cart-api", version: version });
});

app.get("/logs", async (req, res) => {
  const newestFirst = { time: -1 };
  const limit = Math.min(Number(req.query.lines) || 20, 200);

  try {
    const lines = await logs
      .find({}, { projection: { _id: 0 } })
      .sort(newestFirst)
      .limit(limit)
      .toArray();
    res.json(lines);
  } catch {
    // The database is unreachable: serve the copy kept in memory instead.
    res.json(recentLogs.slice(0, limit));
  }
});

app.get("/metrics", (req, res) => {
  const times = recentRequests.map((r) => r.ms).sort((a, b) => a - b);
  const percentile = (p) => times.length ? times[Math.min(times.length - 1, Math.floor(times.length * p))] : 0;
  const errors = recentRequests.filter((r) => r.error).length;

  res.json({
    requests: recentRequests.length,
    errors,
    errorRate: recentRequests.length ? Number((errors / recentRequests.length).toFixed(2)) : 0,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
  });
});

//the real function that holds the working code and returns a real json
app.get("/api/cart", async (req, res) => {
    let cart;

    try {
        cart = await addToCart();
    } catch (error) {
        await log(
            "error", `GET /api/cart 500 - cannot reach cart ${error.cause} ${error.code} ${error.message}`,
        );
        return res.status(500).json({error: "internal server error"});
    }

    await log("info", "GET /api/cart 200");
    res.json({cart: [{id: 441310, 
        manufacture: "NVIDIA", 
        description: "ASUS Prime GeForce RTX 5070 12GB GDDR7 graphics card",
        price: 2690,
     }]});
});

// Called by the shop's "Add to cart" button.
app.post("/api/cart", express.json(), async (req, res) => {
    const start = Date.now();
    const { productId } = req.body ?? {};

    //timeout delay added so the server will exeed the time allowed. this is the timeout senario.
    if (SCENARIO === "slow") {
    await sleep(4000 + Math.random() * 2000); // 4–6 seconds 
    }

    try {
        await addToCart();
    } catch (error) {
        await log(
            "error", `POST /api/cart 500 - cannot reach cart ${error.cause} ${error.code} ${error.message}`,
        );
        return res.status(500).json({error: "internal server error"});
    }

    // The cart item is saved in the database, so a database outage breaks "Add to cart".
    try {
        await carts.insertOne({ productId, time: new Date() });
    } catch (error) {
        await log("error", `POST /api/cart 500 - database error: ${error.message}`);
        return res.status(500).json({error: "internal server error"});
    }

    // Requests over 2 seconds are logged as slow, so the agent can find them in /logs.
    const ms = Date.now() - start;
    if (ms > 2000) await log("warn", `POST /api/cart slow request ${ms}ms`);

    await log("info", `POST /api/cart 200 - added product ${productId}`);
    res.json({ added: productId });
});

// Demo control for the /status page. Not one of the agent's tools, and switching is not logged,
// so the agent never sees which scenario is active.
app.get("/admin/scenario", (req, res) => {
    res.json({ scenario: SCENARIO, options: SCENARIOS });
});

app.post("/admin/scenario", express.json(), (req, res) => {
    const { scenario } = req.body ?? {};
    if (!SCENARIOS.includes(scenario)) {
        return res.status(400).json({ error: `scenario must be one of: ${SCENARIOS.join(", ")}` });
    }
    SCENARIO = scenario;
    recentRequests.length = 0; // start metrics fresh so old results don't mix with the new scenario
    console.log(`scenario switched to ${SCENARIO}`);
    res.json({ scenario: SCENARIO });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`cart service V${version} is running on port: ${PORT} (scenario: ${SCENARIO})`);

})

// Simulated customers: every 5 seconds someone adds a product to the cart, like a real shop
// with steady traffic. This keeps the logs and metrics current, so a fault shows up right
// away instead of only after someone clicks "Add to cart".
const PRODUCT_IDS = [441201, 441202, 441310, 441311, 441420, 441421, 441530, 441531, 441640, 441750, 441860, 441970];
setInterval(() => {
    const productId = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
    fetch(`http://localhost:${PORT}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
    }).catch(() => {});
}, 5000);