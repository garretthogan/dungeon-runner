import http from "node:http";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const manifestPath = path.join(publicDir, "action-cards-manifest.json");
const port = Number.parseInt(process.env.CARD_FORM_PORT ?? "3210", 10);

const allowedMimeTypes = new Set(["image/png", "image/svg+xml"]);
const allowedExtensions = new Set([".png", ".svg"]);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function guessContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".css") return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function isValidCardId(id) {
  return /^[a-z0-9-]+$/.test(id);
}

async function parseMultipartForm(req) {
  const request = new Request(`http://localhost${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: "half",
  });

  return request.formData();
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createCard(req, res) {
  let formData;
  try {
    formData = await parseMultipartForm(req);
  } catch {
    sendJson(res, 400, { error: "Invalid form payload." });
    return;
  }

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const costRaw = String(formData.get("cost") ?? "").trim();
  const icon = formData.get("icon");

  if (!id || !name || !costRaw || !(icon instanceof File)) {
    sendJson(res, 400, { error: "Missing required fields." });
    return;
  }
  if (!isValidCardId(id)) {
    sendJson(res, 400, { error: "Card id must use lowercase letters, numbers, and dashes only." });
    return;
  }

  const cost = Number.parseInt(costRaw, 10);
  if (!Number.isFinite(cost) || cost < 0) {
    sendJson(res, 400, { error: "Cost must be a non-negative integer." });
    return;
  }

  const sourceExtension = path.extname(icon.name || "").toLowerCase();
  const extension = sourceExtension && allowedExtensions.has(sourceExtension) ? sourceExtension : "";
  if (!extension) {
    sendJson(res, 400, { error: "Icon file must be .svg or .png." });
    return;
  }

  const mimeType = icon.type?.toLowerCase();
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    sendJson(res, 400, { error: "Icon file type must be image/svg+xml or image/png." });
    return;
  }

  const iconFilename = `${id}${extension}`;
  const targetIconPath = path.join(publicDir, iconFilename);

  if (await fileExists(targetIconPath)) {
    sendJson(res, 409, { error: `Icon file already exists: ${iconFilename}` });
    return;
  }

  let manifest;
  try {
    const manifestRaw = await readFile(manifestPath, "utf8");
    manifest = JSON.parse(manifestRaw);
  } catch {
    sendJson(res, 500, { error: "Unable to read action card manifest." });
    return;
  }

  if (!manifest || !Array.isArray(manifest.cards)) {
    sendJson(res, 500, { error: "Manifest format is invalid. Expected { cards: [] }." });
    return;
  }

  if (manifest.cards.some((card) => card?.id === id)) {
    sendJson(res, 409, { error: `Card id already exists: ${id}` });
    return;
  }

  const iconBuffer = Buffer.from(await icon.arrayBuffer());
  await writeFile(targetIconPath, iconBuffer);

  manifest.cards.push({
    id,
    name,
    icon: iconFilename,
    cost,
  });

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  sendJson(res, 201, { message: `Card '${name}' created.`, cardId: id, icon: iconFilename });
}

async function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/new-card-form.html" : url.pathname;
  const requestedPath = path.normalize(path.join(publicDir, pathname));

  // Block directory traversal by enforcing the public directory prefix.
  if (!requestedPath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const fileStats = await stat(requestedPath);
    if (!fileStats.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }
    const content = await readFile(requestedPath);
    res.writeHead(200, { "Content-Type": guessContentType(requestedPath) });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Bad request");
    return;
  }

  if (req.method === "POST" && req.url === "/api/cards") {
    await createCard(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res);
    return;
  }

  sendText(res, 405, "Method not allowed");
});

server.listen(port, () => {
  console.log(`Card form server running at http://localhost:${port}`);
});
