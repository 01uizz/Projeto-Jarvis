// Gera capacitor.config.json a partir da URL do app hospedado (variável JARVIS_APP_URL).
// O APK carrega essa URL (modo "remote URL"); os plugins nativos continuam disponíveis via ponte Capacitor.
import { writeFileSync } from "node:fs";

const raw = process.env.JARVIS_APP_URL?.trim();
if (!raw) {
  console.error("JARVIS_APP_URL não definida. Defina a variável do repositório (ex.: https://SEU-APP.vercel.app/app).");
  process.exit(1);
}
let url;
try {
  url = new URL(raw);
} catch {
  console.error(`JARVIS_APP_URL inválida: ${raw}`);
  process.exit(1);
}
if (url.protocol !== "https:") {
  console.error("JARVIS_APP_URL precisa ser https.");
  process.exit(1);
}
const config = {
  appId: "app.jarvis.assistant",
  appName: "JARVIS",
  webDir: "android-shell",
  server: { url: url.toString(), cleartext: false, allowNavigation: [url.host] },
  android: { allowMixedContent: false },
};
writeFileSync("capacitor.config.json", JSON.stringify(config, null, 2) + "\n");
console.log("capacitor.config.json gerado para", url.host);
