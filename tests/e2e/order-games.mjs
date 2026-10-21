import puppeteer from "puppeteer-core";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", e => errors.push(e.message));
const games = { "jsx-puzzle": 3, "api-flow": 6, "widget-tree": 9, "json-parsing": 6 };
let ok = true;
for (const [id, expected] of Object.entries(games)) {
  await page.goto("http://localhost:8765/index.html#/g/" + id, { waitUntil: "networkidle0" });
  await sleep(350);
  const n = await page.$$eval(".pool .order-item", els => els.length).catch(() => 0);
  const pass = n === expected;
  ok = ok && pass;
  console.log((pass ? "  ✔" : "  ✘") + " " + id + " : " + n + " blocs (attendu " + expected + ")");
}
console.log(errors.length ? "  ✘ erreurs JS: " + errors.join(" | ") : "  ✔ aucune erreur JS");
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);
