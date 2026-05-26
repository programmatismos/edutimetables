/**
 * Standalone HTTP server entry point for Electron production.
 * Spawned as a child process by main.ts.
 * Serves the Hono API on a random port and signals readiness to the parent.
 *
 * Uses Node.js built-in http — no extra deps needed.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import app from "../../web/src/api/index";

const port = parseInt(process.env.PORT ?? "0", 10);

async function nodeReqToWebRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? "/", `http://127.0.0.1`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let body: BodyInit | undefined;
  if (hasBody) {
    body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }
  return new Request(url, { method: req.method, headers, body });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const webReq = await nodeReqToWebRequest(req);
    const webRes = await app.fetch(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((val: string, key: string) => res.setHeader(key, val));
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error("[api-server] error:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  // Signal readiness to the parent Electron main process
  if (process.send) {
    process.send({ type: "ready", port: actualPort });
  } else {
    // Fallback: print to stdout so parent can read it
    process.stdout.write(`PORT=${actualPort}\n`);
  }
  console.log(`[api-server] listening on http://127.0.0.1:${actualPort}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT",  () => server.close(() => process.exit(0)));
