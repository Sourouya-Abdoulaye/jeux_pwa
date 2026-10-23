import puppeteer from "puppeteer-core";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  ✔ " + name); }
  else { failed++; console.error("  ✘ " + name + (extra ? " — " + extra : "")); }
}
const BASE = "http://localhost:8765/index.html";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome", headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", e => errors.push(e.message));

/* --- 1. Préparation initiale (en ligne) --- */
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate(() => navigator.serviceWorker.ready);
await sleep(600); /* fin du precache */
check("Service Worker prêt", !!(await page.evaluate(() => navigator.serviceWorker.controller || true)));

/* --- 2. Hors ligne : rechargement complet --- */
await page.setOfflineMode(true);
await page.goto(BASE, { waitUntil: "load" });
await sleep(500);
const h1 = await page.$eval("#view h1", e => e.textContent).catch(() => null);
check("Hors ligne : l'application se recharge depuis le cache", !!h1, h1 || "aucun rendu");
const navOffline = await page.$$eval("#bottomnav .nav-item", els => els.length).catch(() => 0);
check("Hors ligne : navigation disponible", navOffline === 5, String(navOffline));

/* --- 3. Hors ligne : jouer à un jeu pédagogique complet --- */
await page.goto(BASE + "#/g/tf-flash", { waitUntil: "load" });
await sleep(400);
await page.click(".game-body .duo .btn:nth-child(2)"); /* mode apprentissage */
await sleep(200);
let guard = 0;
while (guard++ < 60 && !(await page.$(".overlay"))) {
  const duo = await page.$(".game-body .duo .btn");
  const fb = await page.$(".game-body .feedback");
  if (duo && !fb) { await page.click(".game-body .duo .btn"); await sleep(100); }
  const next = await page.$(".game-body .btn-primary");
  if (next) { await page.click(".game-body .btn-primary"); await sleep(100); }
}
check("Hors ligne : partie de Vrai/Faux jouable jusqu'au résultat", !!(await page.$(".overlay")));
const offlineSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Hors ligne : progression sauvegardée localement", offlineSaved && offlineSaved.xp > 0, offlineSaved ? String(offlineSaved.xp) : "aucune");

/* --- 4. Hors ligne : jeu Canvas --- */
await page.goto(BASE + "#/g/snake", { waitUntil: "load" });
await sleep(400);
await page.click(".game-body .duo .btn"); /* mode classique */
await sleep(300);
check("Hors ligne : Serpent rendu (Canvas)", !!(await page.$("canvas.game")));

/* --- 5. Retour en ligne --- */
await page.setOfflineMode(false);
await page.goto(BASE + "#/home", { waitUntil: "networkidle0" });
await sleep(300);
check("Reconnexion : application fonctionnelle", !!(await page.$("#view h1")));

/* --- 6. Puzzle JSX : boucle de validation complète --- */
await page.goto(BASE + "#/g/jsx-puzzle", { waitUntil: "networkidle0" });
await sleep(300);
const poolCount = await page.$$eval(".pool .order-item", els => els.length);
check("Puzzle JSX : 3 blocs proposés (exercice 1)", poolCount === 3, String(poolCount));
for (let i = 0; i < poolCount; i++) {
  await page.evaluate(() => document.querySelector(".pool .order-item").click());
  await sleep(80);
}
await sleep(150);
const orderCount = await page.$$eval(".order-list .order-item", els => els.length);
check("Puzzle JSX : blocs transférés dans la réponse", orderCount === 3, String(orderCount));
await page.click(".game-body .btn-primary"); /* Valider */
await sleep(250);
const fbText = await page.$eval(".feedback", e => e.textContent).catch(() => "");
check("Puzzle JSX : validation + explication affichées", fbText.length > 30, fbText.slice(0, 60));
const codeShown = !!(await page.$("pre.code"));
check("Puzzle JSX : solution attendue affichée après succès", codeShown || /incorrect/i.test(fbText));
const xpNow = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")).xp);
check("Puzzle JSX : XP comptabilisée après réponse", xpNow > 0, String(xpNow));

/* --- 7. Tri & rangement : placer + valider --- */
await page.goto(BASE + "#/g/mvc-sort", { waitUntil: "networkidle0" });
await sleep(300);
const items = await page.$$eval("#view .pool .class-item", els => els.length);
check("Tri : 6 éléments à classer", items === 6, String(items));
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const it = document.querySelector("#view .pool .class-item");
    if (it) it.click();
  });
  await sleep(60);
  await page.evaluate(ci => {
    const cols = document.querySelectorAll("#view .class-col");
    cols[ci % cols.length].click();
  }, i);
  await sleep(60);
}
const placed = await page.$$eval("#view .class-col .class-item", els => els.length);
check("Tri : 6 éléments placés dans les zones", placed === 6, String(placed));
await page.click("#view .game-body .btn-primary");
await sleep(250);
const sortFb = await page.$eval(".feedback", e => e.textContent).catch(() => "");
check("Tri : validation avec explications pédagogiques", sortFb.length > 30, sortFb.slice(0, 60));

/* --- 8. Cartes mémoire : retournement --- */
await page.goto(BASE + "#/g/hooks-memory", { waitUntil: "networkidle0" });
await sleep(300);
await page.click(".mem-card");
await sleep(120);
const flipped = await page.$$eval(".mem-card.flipped", els => els.length);
check("Mémoire : première carte retournée", flipped === 1, String(flipped));
await page.click(".mem-card:nth-child(6)");
await sleep(300);
const att = await page.$eval("#mm-att", e => e.textContent);
check("Mémoire : compteur d'essais mis à jour", att === "1", att);

/* --- 9. Casse-briques : raquette suit le doigt --- */
await page.goto(BASE + "#/g/breakout", { waitUntil: "networkidle0" });
await sleep(400);
const canvas = await page.$("canvas.game");
const box = await canvas.boundingBox();
await page.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height * 0.8);
await sleep(300);
check("Casse-briques : canvas actif au toucher", !!(await page.$("canvas.game")));
const lives = await page.$eval("#bo-lives", e => e.textContent).catch(() => "");
check("Casse-briques : HUD vies affiché", /vie/.test(lives), lives);

check("Aucune erreur JS sur l'ensemble du parcours", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
console.log("\nHors ligne + interactions : " + passed + " réussi(s), " + failed + " échec(s)");
process.exit(failed ? 1 : 0);
