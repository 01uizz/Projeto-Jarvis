// Ajusta o projeto Android gerado por `npx cap add android`: permissões, visibilidade de pacotes e versão.
// Pede ao Android só o necessário; nada de permissões amplas (sem QUERY_ALL_PACKAGES, contatos, arquivos).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const gradlePath = "android/app/build.gradle";
if (!existsSync(manifestPath) || !existsSync(gradlePath)) {
  console.error("Projeto Android não encontrado. Rode `npx cap add android` antes.");
  process.exit(1);
}

let xml = readFileSync(manifestPath, "utf8");
const perms = [
  "android.permission.INTERNET",
  "android.permission.RECORD_AUDIO",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.SCHEDULE_EXACT_ALARM",
];
const missing = perms.filter((p) => !xml.includes(`"${p}"`));
const permXml = missing.map((p) => `    <uses-permission android:name="${p}" />`).join("\n");

// Pacotes que o JARVIS sabe abrir (mantenha igual a KNOWN_APPS em src/features/agent/tools/device.ts)
const packages = [
  "com.whatsapp", "com.google.android.youtube", "com.android.chrome", "com.google.android.gm", "com.google.android.apps.maps",
  "com.spotify.music", "com.instagram.android", "org.telegram.messenger", "com.android.camera",
];
const queries = [
  "    <queries>",
  ...packages.map((p) => `        <package android:name="${p}" />`),
  '        <intent><action android:name="android.speech.RecognitionService" /></intent>',
  "    </queries>",
].join("\n");

if (!xml.includes("<queries>")) xml = xml.replace("</manifest>", `${queries}\n</manifest>`);
if (permXml) xml = xml.replace("</manifest>", `${permXml}\n</manifest>`);
writeFileSync(manifestPath, xml);

let gradle = readFileSync(gradlePath, "utf8");
const code = process.env.VERSION_CODE;
const name = process.env.VERSION_NAME;
if (!code || !name) {
  console.error("Defina VERSION_CODE e VERSION_NAME.");
  process.exit(1);
}
if (!/^\d+$/.test(code)) {
  console.error("VERSION_CODE precisa ser inteiro.");
  process.exit(1);
}
const safeName = name.replace(/"/g, "");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${safeName}"`);
if (!gradle.includes(`versionCode ${code}`) || !gradle.includes(`versionName "${safeName}"`)) {
  console.error("Não encontrei versionCode/versionName no build.gradle (formato inesperado).");
  process.exit(1);
}
writeFileSync(gradlePath, gradle);
console.log(`Manifest ajustado (${missing.length} permissões adicionadas) e versão ${name} (${code}).`);
