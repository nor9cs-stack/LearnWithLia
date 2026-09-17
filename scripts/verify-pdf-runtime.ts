import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type RouteTrace = { files: string[] };

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracePath = resolve(repositoryRoot, ".next/server/app/api/inngest/route.js.nft.json");
const trace = JSON.parse(await readFile(tracePath, "utf8")) as RouteTrace;
const tracedFiles = trace.files.map((file) => resolve(dirname(tracePath), file));

function requireTracedFile(description: string, predicate: (path: string) => boolean) {
  if (!tracedFiles.some(predicate)) {
    throw new Error(`PDF_RUNTIME_TRACE_MISSING:${description}`);
  }
}

requireTracedFile("pdf-parse", (path) => path.includes("/pdf-parse/"));
requireTracedFile("pdfjs-runtime", (path) => path.endsWith("/pdfjs-dist/legacy/build/pdf.mjs"));
requireTracedFile("pdfjs-worker", (path) => path.endsWith("/pdfjs-dist/legacy/build/pdf.worker.mjs"));
requireTracedFile("canvas-runtime", (path) => path.endsWith("/@napi-rs/canvas/index.js"));

const nativeSuffix =
  process.platform === "linux" && process.arch === "x64"
    ? "/skia.linux-x64-gnu.node"
    : process.platform === "darwin" && process.arch === "arm64"
      ? "/skia.darwin-arm64.node"
      : undefined;

if (nativeSuffix) {
  requireTracedFile("canvas-native-binding", (path) => path.endsWith(nativeSuffix));
}

await Promise.all(
  tracedFiles
    .filter(
      (path) =>
        path.endsWith("/pdfjs-dist/legacy/build/pdf.worker.mjs") ||
        path.endsWith("/@napi-rs/canvas/index.js") ||
        (nativeSuffix !== undefined && path.endsWith(nativeSuffix)),
    )
    .map((path) => readFile(path)),
);

console.log(`PDF runtime trace verified for ${process.platform}/${process.arch}`);
