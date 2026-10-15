"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), { Repository, MemoryDriver } = require("./repository.cjs"), S = require("./service.cjs");
function createApp({ actor = { id: "director-demo", name: "Giám đốc mẫu", roles: ["director", "finance"] }, readSources, driver = new MemoryDriver() } = {}) {
  const hash = (s) => crypto.createHash("sha256").update(s).digest("hex"), repository = new Repository(driver, { hash, id: () => crypto.randomUUID() }), server = http.createServer(async (req, res) => {
    if (req.method === "GET" && ["/", "/app.js"].includes(req.url)) {
      res.writeHead(200, { "Content-Type": req.url === "/" ? "text/html; charset=utf-8" : "application/javascript; charset=utf-8" });
      res.end(fs.readFileSync(path.join(__dirname, req.url === "/" ? "ui.html" : "ui.js")));
      return;
    }
    if (req.url !== "/api" || req.method !== "POST") {
      res.writeHead(404);
      res.end();
      return;
    }
    let raw = "", size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 18e5) {
        res.writeHead(413);
        res.end();
        return;
      }
      raw += chunk;
    }
    const result = S.response(() => {
      let request;
      try {
        request = JSON.parse(raw);
      } catch (e) {
        throw Error("INVALID_REQUEST");
      }
      return S.handle(request, typeof actor === "function" ? actor(req) : actor, repository, readSources);
    });
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(result));
  });
  return { server, repository, driver };
}
if (require.main === module) {
  const app = createApp();
  app.server.listen(Number(process.env.CD_LOCAL_PORT || 3120), "127.0.0.1", () => console.log("Local directory fixture started; no Google sources or production writes."));
}
module.exports = { createApp };
