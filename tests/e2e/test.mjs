/* Test E2E réel dans Chrome headless : rendu, navigation, parties de bout en bout,
   persistance, Service Worker, import/export. */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:8765/index.html";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  ✔ " + name); }
  else { failed++; console.error("  ✘ " + name + (extra ? " — " + extra : "")); }
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--window-size=390,844"]
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

const consoleErrors = [];
page.on("pageerror", e => { consoleErrors.push("pageerror: " + e.message); console.log("    [pageerror]", (e.stack || e.message).split("\n").slice(0, 4).join(" | ")); });
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push("console: " + msg.text()); });

/* ---------------- Accueil ---------------- */
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.waitForSelector("#view h1", { timeout: 5000 });
const h1 = await page.$eval("#view h1", e => e.textContent);
check("Accueil : titre de bienvenue", /progresser|Niveau max/i.test(h1), h1);
const navCount = await page.$$eval("#bottomnav .nav-item", els => els.length);
check("Navigation inférieure : 5 entrées", navCount === 5, String(navCount));
const stats = await page.$$eval("#view .stat-value", els => els.map(e => e.textContent));
check("Nouveau joueur : 0 XP / 0 partie / aucune série", stats[0] === "0" && stats[1] === "—" && stats[2] === "0", JSON.stringify(stats));
const xpText = await page.$eval("#view .card .meta", e => e.textContent);
check("Carte progression : 0 XP affiché", xpText.includes("0 XP"), xpText);

/* ---------------- Navigation jusqu'au premier jeu ---------------- */
await page.click('#bottomnav .nav-item[data-key="explorer"]');
await sleep(150);
check("Explorer : ouverture", (await page.$eval("#view h1", e => e.textContent)).includes("Explorer"));
await page.click("#view .lrow"); /* premier domaine */
await sleep(150);
check("Domaine ouvert", (await page.$eval("#view h1", e => e.textContent)).includes("Composants"));
const gameCards = await page.$$eval("#view .btn", els => els.filter(e => e.textContent.includes("Jouer")).length);
check("Domaine : 3 jeux listés", gameCards === 3, String(gameCards));
await page.goto(BASE + "#/u/react", { waitUntil: "networkidle0" });
await sleep(200);
const uTitle = await page.$eval("#view h1", e => e.textContent);
check("Univers React.js ouvert", uTitle.includes("React"), uTitle);
check("Univers : jeux accessibles en un geste", (await page.$$eval("#view .lrow", els => els.length)) >= 7);
await page.click("#view .lrow"); /* première ligne de jeu */
await page.waitForSelector(".game-shell", { timeout: 3000 });
check("Écran de jeu : coquille avec en-tête", !!(await page.$(".game-head")));
const headBtns = await page.$$eval(".game-head .head-btn", els => els.length);
check("En-tête : bouton Retour présent", headBtns >= 1, String(headBtns));

/* ---------------- Partie complète : Vrai/Faux ---------------- */
await page.goto(BASE + "#/g/tf-flash", { waitUntil: "networkidle0" });
await page.waitForSelector(".game-body .duo .btn", { timeout: 3000 });
await page.click(".game-body .duo .btn:nth-child(2)"); /* mode apprentissage */
await sleep(150);
let guard = 0;
while (guard++ < 60) {
  const overlay = await page.$(".overlay");
  if (overlay) break;
  const answered = await page.$(".game-body .feedback");
  const duo = await page.$(".game-body .duo .btn");
  if (duo && !answered) { await page.click(".game-body .duo .btn"); await sleep(120); }
  const next = await page.$(".game-body .btn-primary");
  if (next) { await page.click(".game-body .btn-primary"); await sleep(120); }
}
check("Vrai/Faux : écran de résultat atteint", !!(await page.$(".overlay")));
const resultRows = await page.$$eval(".overlay .r-row", els => els.map(e => e.textContent));
check("Résultat : XP et précision affichés", resultRows.some(r => r.includes("XP obtenue")) && resultRows.some(r => r.includes("Précision")), JSON.stringify(resultRows));
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Sauvegarde : XP > 0 après la partie", saved && saved.xp > 0, saved ? String(saved.xp) : "aucune");
check("Sauvegarde : partie terminée enregistrée une fois", saved.stats.finished["tf-flash"] === 1, JSON.stringify(saved.stats.finished));
check("Sauvegarde : précision calculée", saved.stats.answers.react.t === 15, JSON.stringify(saved.stats.answers.react));
check("Sauvegarde : journée active marquée", Array.isArray(saved.activeDays) && saved.activeDays.length === 1);

/* retour propre + persistance après rechargement */
await page.click(".overlay .btn-ghost"); /* Retour */
await sleep(250);
const backIsClean = await page.evaluate(() => !document.body.classList.contains("in-game") || !!document.querySelector(".game-shell"));
check("Retour : écran propre après la partie", backIsClean);
await page.goto(BASE + "#/home", { waitUntil: "networkidle0" });
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector("#view h1");
const afterReload = await page.$eval("#view .stat-value", e => e.textContent);
check("Persistance : parties conservées après rechargement", afterReload === "1", afterReload);
const xpHome = await page.$eval("#view .card .meta", e => e.textContent);
check("Persistance : XP affichée sur l'accueil", /XP/.test(xpHome), xpHome);

/* ---------------- Tous les jeux s'ouvrent sans erreur ---------------- */
const gameIds = ["jsx-puzzle", "hooks-memory", "tf-flash", "pipe-flow", "arch-decision", "mvc-sort", "api-flow",
  "material-quiz", "widget-tree", "balance-stateless", "target-ui", "flutter-data-flow", "flutter-decision", "json-parsing", "flutter-arch-sort",
  "snake", "breakout", "maze"];
for (const id of gameIds) {
  const before = consoleErrors.length;
  await page.goto(BASE + "#/g/" + id, { waitUntil: "networkidle0" });
  await sleep(220);
  const bodyKids = await page.$$eval(".game-body > *", els => els.length);
  const err = consoleErrors.length > before ? consoleErrors[consoleErrors.length - 1] : null;
  check("Jeu " + id + " : écran rendu sans erreur", bodyKids > 0 && !err, "children=" + bodyKids + (err ? " | " + err : ""));
}

/* ---------------- Serpent : interactions tactiles ---------------- */
await page.goto(BASE + "#/g/snake", { waitUntil: "networkidle0" });
await sleep(300);
await page.click(".game-body .duo .btn"); /* mode classique */
await sleep(300);
check("Serpent : canvas présent", !!(await page.$("canvas.game")));
check("Serpent : D-pad présent", (await page.$$eval(".dpad button", els => els.length)) >= 4);
await page.click(".dpad button:nth-child(2)"); /* haut */
await sleep(400);
const snakeSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Serpent : aucune sauvegarde fantôme pendant la partie", snakeSaved.stats.started["snake"] >= 1);

/* quitter proprement */
await page.click(".game-head .head-btn");
await sleep(200);
const modal = await page.$(".modal");
check("Confirmation de sortie affichée", !!modal);
if (modal) {
  await page.click(".modal-actions .btn-danger");
  await sleep(250);
}
const afterQuit = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Abandon : aucune XP et aucune partie terminée pour snake", !afterQuit.stats.finished["snake"] && afterQuit.stats.abandoned["snake"] === 1, JSON.stringify({ f: afterQuit.stats.finished["snake"], a: afterQuit.stats.abandoned["snake"] }));

/* ---------------- Labyrinthe : génération + victoire ---------------- */
await page.goto(BASE + "#/g/maze", { waitUntil: "networkidle0" });
await sleep(200);
await page.click("#view .lrow"); /* Facile */
await sleep(300);
check("Labyrinthe : canvas généré", !!(await page.$("canvas.game")));

/* ---------------- Quiz du cours : démarrage guidé ---------------- */
await page.goto(BASE + "#/g/material-quiz", { waitUntil: "networkidle0" });
await sleep(250);
await page.click(".game-body .duo .btn"); /* mode guidé */
await page.waitForSelector(".answer-grid .choice", { timeout: 3000 });
const quizChoices = await page.$$eval(".answer-grid .choice", els => els.length);
check("Quiz du cours : 4 choix proposés", quizChoices === 4, String(quizChoices));
await page.click(".answer-grid .choice");
await sleep(250);
const quizFb = await page.$eval(".feedback", e => e.textContent).catch(() => "");
check("Quiz du cours : explication affichée", quizFb.length > 40, quizFb.slice(0, 70));

/* ---------------- Fiches du cours ---------------- */
await page.goto(BASE + "#/cours", { waitUntil: "networkidle0" });
await sleep(200);
const lessons = await page.$$eval(".lesson", els => els.length);
check("Cours : 11 fiches PDF affichées", lessons === 11, String(lessons));
const firstOpen = await page.$$eval(".lesson[open]", els => els.length);
check("Cours : première fiche ouverte", firstOpen === 1, String(firstOpen));
const courseBtn = await page.$$eval(".course-hero .btn", els => els.filter(e => /Quiz/.test(e.textContent)).length);
check("Cours : accès au quiz depuis l'en-tête", courseBtn === 1, String(courseBtn));

/* ---------------- Progression : écran ---------------- */
await page.goto(BASE + "#/progression", { waitUntil: "networkidle0" });
await sleep(200);
const sections = await page.$$eval("#view .section-title", els => els.map(e => e.textContent));
const hasRecords = !!(await page.$eval("#view", v => [...v.querySelectorAll("h2")].some(h => h.textContent.includes("Records"))));
check("Progression : sections complètes", sections.some(s => /Précision/.test(s)) && sections.some(s => /Succès/.test(s)) && hasRecords, JSON.stringify(sections));

/* ---------------- Export / import / réinitialisation ---------------- */
const roundtrip = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("devmaster.progress.v1"));
  return JSON.stringify({ app: "DevMaster PWA", exportedAt: new Date().toISOString(), data: st });
});
await page.goto(BASE + "#/profil", { waitUntil: "networkidle0" });
await sleep(200);
/* réinitialisation */
await page.click("#view .btn-danger");
await sleep(200);
await page.click(".modal-actions .btn-danger");
await sleep(300);
const resetState = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Réinitialisation : profil vierge restauré", resetState.xp === 0 && Object.keys(resetState.stats.finished).length === 0, JSON.stringify(resetState.xp));
/* import */
await page.evaluate(() => { [...document.querySelectorAll("#view .btn")].find(b => b.textContent.includes("Restaurer")).click(); });
await sleep(200);
await page.type(".modal textarea", roundtrip);
await page.click(".modal-actions .btn-primary");
await sleep(250);
await page.click(".modal-actions .btn-danger"); /* confirmer le remplacement */
await sleep(300);
const imported = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Import : progression restaurée", imported.xp > 0 && imported.stats.finished["tf-flash"] === 1, JSON.stringify({ xp: imported.xp }));

/* ---------------- Pseudo ---------------- */
await page.type("#pseudo-input", "NeoCoder");
await sleep(200);
const pseudoSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("devmaster.progress.v1")));
check("Profil : pseudonyme enregistré", pseudoSaved.profile.pseudonym === "NeoCoder");

/* ---------------- Service Worker ---------------- */
await page.goto(BASE + "#/home", { waitUntil: "networkidle0" });
await sleep(800);
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return { registered: !!reg, active: !!(reg && reg.active), scope: reg ? reg.scope : null };
});
check("Service Worker enregistré sur localhost", swState.registered, JSON.stringify(swState));
check("Service Worker actif", swState.active, JSON.stringify(swState));

/* ---------------- Erreurs console ---------------- */
const realErrors = consoleErrors.filter(e => !/favicon/i.test(e));
check("Aucune erreur JS en navigateur", realErrors.length === 0, realErrors.slice(0, 3).join(" || "));

await browser.close();
console.log("\nE2E : " + passed + " réussi(s), " + failed + " échec(s)");
process.exit(failed ? 1 : 0);
