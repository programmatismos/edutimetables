import { cp, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// Τα paths λύνονται με βάση το ίδιο το script και όχι το τρέχον shell cwd,
// ώστε το packaging να δουλεύει αξιόπιστα από npm/bun/turbo ή χειροκίνητη κλήση.
const webDist = resolve(scriptDir, "../../web/dist");
const desktopWebDist = resolve(scriptDir, "../web-dist");

try {
  const source = await stat(webDist);
  if (!source.isDirectory()) {
    throw new Error(`${webDist} is not a directory`);
  }
} catch {
  throw new Error("Web build output is missing. Run the web package build before packaging desktop.");
}

// Πριν το electron-builder τρέξει, καθαρίζουμε το παλιό web-dist και αντιγράφουμε
// φρέσκο Vite build. Αλλιώς το packaged app μπορεί να ανοίγει κενό παράθυρο.
await rm(desktopWebDist, { recursive: true, force: true });
await cp(webDist, desktopWebDist, { recursive: true });
