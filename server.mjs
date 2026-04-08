import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./server/app.mjs";
import { PORT } from "./server/config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const app = createApp(distDir);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Personal Food OS listening on http://0.0.0.0:${PORT}`);
});
