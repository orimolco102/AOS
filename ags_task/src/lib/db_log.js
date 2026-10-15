import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;

// Looks up a DNS record over HTTPS. The Next.js server on Windows can't do the
// SRV lookups that mongodb+srv:// needs (querySrv ECONNREFUSED), but HTTPS works.
async function lookup(name, type) {
  const res = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`, { signal: AbortSignal.timeout(5000) });
  const data = await res.json();
  return (data.Answer || []).map((a) => a.data);
}

// Turns mongodb+srv://user:pass@cluster.mongodb.net/db?opts into the
// equivalent mongodb://user:pass@host1,host2,host3/db?tls=true&opts address.
async function resolveSrvUri(uri) {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const rest = uri.slice("mongodb+srv://".length);
  const at = rest.lastIndexOf("@");
  const auth = at >= 0 ? rest.slice(0, at + 1) : "";
  const [hostAndPath, query = ""] = rest.slice(at + 1).split("?");
  const [host, ...path] = hostAndPath.split("/");

  // SRV answers look like "0 0 27017 ac-xyz-shard-00-00.abc.mongodb.net."
  const hosts = (await lookup(`_mongodb._tcp.${host}`, "SRV"))
    .map((r) => r.split(" ")).map(([, , port, target]) => `${target.replace(/\.$/, "")}:${port}`);
  if (hosts.length === 0) throw new Error(`no MongoDB servers found for ${host}`);

  // The TXT record holds options like authSource=admin&replicaSet=atlas-xyz.
  const txt = (await lookup(host, "TXT")).map((t) => t.replace(/"/g, "")).join("&");
  const options = ["tls=true", txt, query].filter(Boolean).join("&");

  return `mongodb://${auth}${hosts.join(",")}/${path.join("/")}?${options}`;
}

let clientPromise = null;

// Only connect when MONGO_URI is set in .env; otherwise saving is skipped.
function getClient() {
  if (!MONGO_URI) return null;
  clientPromise ??= resolveSrvUri(MONGO_URI)
    .then((uri) => new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }))
    .catch((error) => { clientPromise = null; throw error; });
  return clientPromise;
}

export async function saveInvestigation(investigation) {
    const client = await getClient();
    if (!client) return;
    const collection = client.db("agent-inventory").collection("investigation");
    await collection.insertOne(investigation);
}
