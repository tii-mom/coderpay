import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.join(process.cwd(), ".vercel", "output");

await fs.rm(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
