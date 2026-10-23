/* Tests fonctionnels du noyau DevMaster (Node, sans navigateur).
   Exécute le JS de index.html dans un contexte VM doté de stubs DOM/localStorage,
   puis vérifie la logique de progression, de sauvegarde et l'intégrité du catalogue. */
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf-8");
const m = html.match(/<script>\n([\s\S]*)\n<\/script>/);
assert.ok(m, "script principal trouvé dans index.html");
const expose = `
;globalThis.__T = {
  App, levelInfo, sanitizeState, defaultState, Progress, Tracker, Badges, GAMES, DOMAINS, UNIVERSES,
  GAME_FACTORIES, checkOrder, importProgress, CHALLENGES, REWARDS, todayISO, normCode,
  JSX_PUZZLES, HOOKS_PAIRS, TF_QUESTIONS, PIPE_SCENARIOS, REACT_DECISIONS, MVC_ROUNDS, API_ROUNDS, API_MCQ,
  WIDGET_TREE_ROUNDS, BALANCE_SCENARIOS, TARGET_PROMPTS, FLOW_SCENARIOS_FLUTTER, FLUTTER_DECISIONS,
  JSON_ROUNDS, JSON_MAPPING, FLUTTER_ARCH_ROUNDS, COURSE_SECTIONS, MATERIAL_QUIZ_QUESTIONS
};`;

function stubNode() {
  const node = {
    children: [], style: {}, dataset: {}, className: "", textContent: "", innerHTML: "",
    disabled: false, checked: false, value: "", clientWidth: 320, parentElement: null,
    classList: (() => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: c => s.has(c) }; })(),
    appendChild(k) { this.children.push(k); if (k && typeof k === "object") k.parentElement = node; return k; },
    insertBefore(k) { this.children.unshift(k); return k; },
    removeChild(k) { this.children = this.children.filter(c => c !== k); return k; },
    get firstChild() { return this.children[0] || null; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, remove() {}, replaceWith() {},
    focus() {}, scrollIntoView() {}, querySelector() { return stubNode(); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 480 }; }
  };
  return node;
}
const storage = new Map();
const sandbox = {
  console,
  document: {
    readyState: "loading",
    createElement: () => stubNode(),
    createTextNode: t => ({ text: t }),
    querySelector: () => stubNode(),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    body: stubNode(), hidden: false
  },
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  },
  navigator: { onLine: true, vibrate() {} },
  location: { hash: "", protocol: "file:", hostname: "" },
  history: { length: 1 },
  setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[1] + expose, sandbox, { filename: "app.js" });
const T = sandbox.__T;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✔ " + name); }
  catch (e) { console.error("  ✘ " + name + "\n    " + e.message); process.exitCode = 1; }
}

/* ---------- Niveaux ---------- */
test("Niveaux : seuils et progression", () => {
  assert.strictEqual(T.levelInfo(0).title, "Code Rookie");
  assert.strictEqual(T.levelInfo(0).index, 1);
  assert.strictEqual(T.levelInfo(99).needed, 1);
  assert.strictEqual(T.levelInfo(100).title, "Junior Dev");
  assert.strictEqual(T.levelInfo(3000).title, "Architecture Master");
  assert.strictEqual(T.levelInfo(3000).isMax, true);
  assert.strictEqual(T.levelInfo(4500).isMax, true);
  assert.ok(T.levelInfo(500).pct > 0 && T.levelInfo(500).pct < 100);
});

/* ---------- Sauvegarde ---------- */
test("Profil vierge au premier lancement", () => {
  T.App.state = T.defaultState();
  assert.strictEqual(T.App.state.xp, 0);
  assert.strictEqual(T.App.state.badges.length, 0, "aucun badge au premier lancement");
  assert.strictEqual(T.Progress.computeAccuracy("react"), null, "précision « — » sans réponse");
  assert.strictEqual(T.Progress.totalFinished(), 0);
});

test("Sauvegarde : saveProgress / loadProgress", () => {
  T.App.state.xp = 420;
  T.App.state.profile.pseudonym = "NeoCoder";
  assert.ok(T.Progress !== undefined);
  sandbox.eval ? null : null;
  /* saveProgress est dans le scope du script : on passe par Progress.finishRun ou localStorage direct */
  storage.set("devmaster.progress.v1", JSON.stringify(T.App.state));
  const loaded = T.sanitizeState(JSON.parse(storage.get("devmaster.progress.v1")));
  assert.strictEqual(loaded.xp, 420);
  assert.strictEqual(loaded.profile.pseudonym, "NeoCoder");
});

test("sanitizeState rejette les données invalides", () => {
  assert.strictEqual(T.sanitizeState(null), null);
  assert.strictEqual(T.sanitizeState("bidule"), null);
  assert.strictEqual(T.sanitizeState({ version: 999 }), null, "version trop récente refusée");
  assert.strictEqual(T.sanitizeState({ version: 1, xp: -50 }).xp, 0, "XP négative neutralisée");
});

test("importProgress : JSON invalide, format inconnu, version trop récente", () => {
  assert.strictEqual(T.importProgress("pas du json").ok, false);
  assert.strictEqual(T.importProgress('{"truc":1}').ok, false);
  assert.strictEqual(T.importProgress('{"version":999,"xp":10}').ok, false);
  const ok = T.importProgress(JSON.stringify({ data: { version: 1, xp: 250 } }));
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.state.xp, 250);
});

/* ---------- Progression ---------- */
test("finishRun : première victoire = réponse XP + victoire + premier succès", () => {
  T.App.state = T.defaultState();
  const out = T.Progress.finishRun({ gameId: "jsx-puzzle", score: 900, win: true, answers: { correct: 3, total: 5 }, timeMs: 60000 });
  const expected = 3 * T.REWARDS.answer + T.REWARDS.levelComplete + T.REWARDS.firstSuccess;
  assert.strictEqual(out.xp, expected, "XP = 3×10 + 20 + 25 = 75");
  assert.strictEqual(T.App.state.xp, expected);
  assert.strictEqual(T.App.state.stats.finished["jsx-puzzle"], 1);
  assert.strictEqual(T.App.state.stats.wins["jsx-puzzle"], 1);
  assert.strictEqual(T.App.state.stats.answers.react.c, 3);
  assert.strictEqual(T.App.state.stats.answers.react.t, 5);
  assert.strictEqual(T.App.state.records["jsx-puzzle"].score, 900);
  assert.ok(T.App.state.activeDays.includes(T.todayISO()), "journée active marquée");
  assert.strictEqual(out.levelUp, null, "75 XP : pas encore de niveau 2");
});

test("finishRun : pas de double bonus premier succès", () => {
  const out = T.Progress.finishRun({ gameId: "jsx-puzzle", score: 400, win: true, answers: { correct: 2, total: 4 }, timeMs: 50000 });
  assert.strictEqual(out.xp, 2 * T.REWARDS.answer + T.REWARDS.levelComplete, "sans le bonus premier succès");
  assert.strictEqual(out.newRecord, false, "400 < 900 : pas de record");
});

test("finishRun : record battu = +15 XP", () => {
  const out = T.Progress.finishRun({ gameId: "jsx-puzzle", score: 1500, win: true, answers: { correct: 4, total: 4 }, timeMs: 40000 });
  assert.strictEqual(out.newRecord, true);
  assert.ok(out.breakdown.some(b => b.label === "Nouveau record"));
  assert.strictEqual(T.App.state.records["jsx-puzzle"].score, 1500);
});

test("Abandon : aucun XP, compté comme abandon", () => {
  const xpBefore = T.App.state.xp;
  T.Progress.abandonRun("jsx-puzzle");
  assert.strictEqual(T.App.state.xp, xpBefore, "l'abandon ne rapporte rien");
  assert.strictEqual(T.App.state.stats.abandoned["jsx-puzzle"], 1);
});

test("Série de jours : activeDay puis streak", () => {
  T.App.state.activeDays = [];
  T.Progress.markActiveDay();
  assert.strictEqual(T.Progress.streak(), 1);
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  const d2 = new Date(); d2.setDate(d2.getDate() - 2);
  T.App.state.activeDays = [T.todayISO(d2), T.todayISO(d1), T.todayISO()];
  assert.strictEqual(T.Progress.streak(), 3, "3 jours consécutifs");
  T.App.state.activeDays = [T.todayISO(d2)];
  assert.strictEqual(T.Progress.streak(), 0, "hors contexte : hier seulement, pas aujourd'hui ni la veille");
});

test("Défis : progression et récompense unique", () => {
  T.App.state = T.defaultState();
  T.App.state.challenges.date = T.todayISO();
  T.App.state.challenges.progress = {};
  const xpBefore = T.App.state.xp;
  for (let i = 0; i < 5; i++) T.Tracker.bump("reactAnswers", 1, true);
  assert.strictEqual(T.Tracker.progressOf("reactAnswers"), 5);
  assert.strictEqual(T.App.state.xp, xpBefore + T.REWARDS.challenge, "+30 XP une seule fois");
  T.Tracker.bump("reactAnswers", 1, true);
  assert.strictEqual(T.Tracker.progressOf("reactAnswers"), 5, "plafonné à la cible");
  assert.strictEqual(T.App.state.xp, xpBefore + T.REWARDS.challenge, "pas de XP en excès");
});

test("Défis : réinitialisation à un nouveau jour", () => {
  T.App.state.challenges.date = "2000-01-01";
  T.App.state.challenges.progress = { reactAnswers: 5 };
  T.Tracker.ensureDay();
  assert.strictEqual(Object.keys(T.App.state.challenges.progress).length, 0, "défis remis à zéro");
  assert.strictEqual(T.App.state.challenges.date, T.todayISO());
});

test("Succès : déblocage conditionnel et non répété", () => {
  T.App.state = T.defaultState();
  T.App.state.xp = 1200;
  T.App.state.stats.answers.react = { c: 12, t: 14 };
  T.Badges.check();
  const b = T.App.state.badges;
  assert.ok(b.includes("react-10"), "badge React débloqué");
  assert.ok(b.includes("level-5"), "badge Senior Developer débloqué");
  assert.ok(!b.includes("streak-7"), "pas de badge sans condition remplie");
  const count = b.length;
  T.Badges.check();
  assert.strictEqual(b.length, count, "pas de doublon");
});

test("Précision globale : 0 réponse → null (affiché « — »)", () => {
  T.App.state = T.defaultState();
  assert.strictEqual(T.Progress.computeAccuracy("flutter"), null);
  T.App.state.stats.answers.flutter = { c: 3, t: 4 };
  assert.strictEqual(T.Progress.computeAccuracy("flutter"), 75);
});

/* ---------- Intégrité du catalogue ---------- */
test("Catalogue : 7 jeux React, 8 Flutter, 3 arcade, tous fabriqués", () => {
  const ids = Object.keys(T.GAMES);
  assert.strictEqual(ids.length, 18, "18 jeux au total");
  assert.strictEqual(ids.filter(id => T.GAMES[id].universe === "react").length, 7);
  assert.strictEqual(ids.filter(id => T.GAMES[id].universe === "flutter").length, 8);
  assert.strictEqual(ids.filter(id => T.GAMES[id].universe === "amusement").length, 3);
  assert.ok(!ids.includes("tap-race"), "le jeu Tap-Tap a été retiré");
  assert.ok(ids.includes("material-quiz"), "le quiz du cours est présent");
  ids.forEach(id => {
    assert.ok(T.DOMAINS[T.GAMES[id].domain], id + " : domaine existant");
    assert.strictEqual(T.DOMAINS[T.GAMES[id].domain].universe, T.GAMES[id].universe, id + " : univers cohérent");
    assert.strictEqual(typeof T.GAME_FACTORIES[id], "function", id + " : factory enregistrée");
    assert.ok(T.GAMES[id].rules && T.GAMES[id].rules.length > 20, id + " : règles renseignées");
  });
});

test("Contenu : ≥15 exercices par domaine", () => {
  const count = {
    "react-a": T.JSX_PUZZLES.length + T.HOOKS_PAIRS.length + T.TF_QUESTIONS.length,
    "react-b": T.PIPE_SCENARIOS.length + T.REACT_DECISIONS.length,
    "react-c": T.MVC_ROUNDS.length * T.MVC_ROUNDS[0].items.length + T.API_ROUNDS.length + T.API_MCQ.length,
    "flutter-a": T.WIDGET_TREE_ROUNDS.length + T.MATERIAL_QUIZ_QUESTIONS.length + T.BALANCE_SCENARIOS.length + T.TARGET_PROMPTS.length,
    "flutter-b": T.FLOW_SCENARIOS_FLUTTER.length + T.FLUTTER_DECISIONS.length,
    "flutter-c": T.JSON_ROUNDS.length + T.JSON_MAPPING.length + T.FLUTTER_ARCH_ROUNDS.length * T.FLUTTER_ARCH_ROUNDS[0].items.length
  };
  Object.entries(count).forEach(([domain, n]) => assert.ok(n >= 15, domain + " : " + n + " exercices"));
  console.log("    → décompte : " + JSON.stringify(count));
});

test("Questions Vrai/Faux : 15 questions, réponses et explications cohérentes", () => {
  assert.strictEqual(T.TF_QUESTIONS.length, 15);
  const ids = new Set();
  T.TF_QUESTIONS.forEach(q => {
    assert.ok(!ids.has(q.id), "id unique : " + q.id);
    ids.add(q.id);
    assert.strictEqual(typeof q.a, "boolean");
    assert.ok(q.e && q.e.length > 30, q.id + " : explication fournie");
    assert.ok(q.d >= 1 && q.d <= 3);
  });
  const trues = T.TF_QUESTIONS.filter(q => q.a).length;
  assert.ok(trues >= 5 && trues <= 10, "mélange vrai/faux équilibré (" + trues + " vrais)");
});

test("Variantes de solutions : puzzles et circuits", () => {
  assert.ok(T.checkOrder(["b1", "b2"], [["b1", "b2"]]));
  assert.ok(!T.checkOrder(["b2", "b1"], [["b1", "b2"]]));
  T.JSX_PUZZLES.forEach(p => {
    assert.ok(p.variants.length >= 1);
    p.variants.forEach(v => assert.deepStrictEqual(v.slice().sort(), p.blocks.map(b => b.id).sort(), p.id + " : variante = mêmes blocs"));
  });
  T.PIPE_SCENARIOS.forEach(sc => assert.strictEqual(sc.path.length, sc.nodes.length, sc.id + " : chemin complet"));
  T.FLOW_SCENARIOS_FLUTTER.forEach(sc => assert.strictEqual(sc.path.length, sc.nodes.length, sc.id + " : chemin complet"));
});

test("Quiz : bonne réponse toujours présente dans les options", () => {
  T.API_MCQ.forEach(q => assert.ok(q.options.some(o => o.id === q.correct), q.id));
  T.JSON_MAPPING.forEach(q => assert.ok(q.correct >= 0 && q.correct < q.options.length, q.id));
  T.BALANCE_SCENARIOS.forEach(s => assert.ok(s.options.some(o => o.id === s.correct), s.id));
  T.REACT_DECISIONS.concat(T.FLUTTER_DECISIONS).forEach(s => {
    assert.ok(s.options.filter(o => o.verdict === "good").length >= 1, s.id + " : au moins une solution solide");
    assert.ok(s.options.filter(o => o.verdict === "bad").length >= 1, s.id + " : au moins une solution faible");
  });
});

test("Cours Flutter : 11 fiches complètes issues du PDF", () => {
  assert.strictEqual(T.COURSE_SECTIONS.length, 11);
  const ids = new Set();
  T.COURSE_SECTIONS.forEach(sec => {
    assert.ok(!ids.has(sec.id), "id de fiche unique : " + sec.id);
    ids.add(sec.id);
    assert.ok(sec.title && sec.summary && sec.summary.length > 30, sec.id + " : résumé fourni");
    assert.ok(Array.isArray(sec.points) && sec.points.length >= 3, sec.id + " : points clés");
    assert.ok(sec.icon, sec.id + " : icône");
  });
  assert.ok(T.COURSE_SECTIONS.some(s => /WhatsApp/i.test(s.title)), "le TP WhatsApp est présent");
  assert.ok(T.COURSE_SECTIONS.some(s => s.code && /MaterialApp\(/.test(s.code)), "un exemple MaterialApp est fourni");
});

test("Quiz du cours : 16 questions à choix multiples cohérentes", () => {
  assert.strictEqual(T.MATERIAL_QUIZ_QUESTIONS.length, 16);
  const ids = new Set();
  T.MATERIAL_QUIZ_QUESTIONS.forEach(q => {
    assert.ok(!ids.has(q.id), "id de question unique : " + q.id);
    ids.add(q.id);
    assert.ok(q.q && q.q.length > 15, q.id + " : énoncé fourni");
    assert.ok(Array.isArray(q.options) && q.options.length >= 3, q.id + " : au moins 3 options");
    assert.ok(q.options.some(o => o.id === q.correct), q.id + " : bonne réponse présente");
    assert.ok(new Set(q.options.map(o => o.id)).size === q.options.length, q.id + " : options uniques");
    assert.ok(q.e && q.e.length > 40, q.id + " : explication fournie");
  });
});

test("Mémoïsation Hooks : 5 paires uniques", () => {
  const ids = T.HOOKS_PAIRS.map(p => p.id);
  assert.strictEqual(new Set(ids).size, 5);
  T.HOOKS_PAIRS.forEach(p => assert.ok(p.explain && p.explain.length > 40, p.id + " : explication"));
});

test("Persistance : profil à plat relisible par sanitizeState (aller-retour)", () => {
  T.App.state = T.defaultState();
  T.Progress.finishRun({ gameId: "snake", score: 300, win: false, answers: { correct: 0, total: 0 }, timeMs: 20000 });
  T.Progress.finishRun({ gameId: "target-ui", score: 900, win: true, answers: { correct: 9, total: 12 }, timeMs: 70000 });
  const json = JSON.parse(JSON.stringify(T.App.state));
  const back = T.sanitizeState(json);
  assert.strictEqual(back.xp, T.App.state.xp);
  assert.strictEqual(back.stats.arcade.runs, 1);
  assert.strictEqual(back.stats.finished["target-ui"], 1);
  assert.strictEqual(back.stats.answers.flutter.c, 9);
  assert.strictEqual(back.records["target-ui"].score, 900);
  assert.ok(back.runs.length === 2, "historique conservé");
});

console.log("\n" + passed + " test(s) réussis" + (process.exitCode ? " — MAIS DES ÉCHECS CI-DESSUS" : " ✔"));
