import { openDb } from "./db";
import { createApp } from "./app";
import { gatewayInfo } from "./ai/gateway";

openDb();
const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  const ai = gatewayInfo();
  console.log(`SparkForge Kids API on http://localhost:${port} — AI provider: ${ai.provider}${ai.live ? "" : " (offline practice mode; set ANTHROPIC_API_KEY for live AI)"}`);
});
