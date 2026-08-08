"use strict";

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 8017;
const debugPort = 9350;
const url = `http://127.0.0.1:${port}/`;
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "mo-character-radicals-"));
const visualProofs = {
   table390: path.join(os.tmpdir(), "mo-studio-radical-table-390.png"),
   table1024: path.join(os.tmpdir(), "mo-studio-radical-table-1024.png"),
   members390: path.join(os.tmpdir(), "mo-studio-radical-members-390.png"),
   members1024: path.join(os.tmpdir(), "mo-studio-radical-members-1024.png"),
   backToSearch390: path.join(os.tmpdir(), "mo-studio-radical-back-to-search-390.png"),
};
let server, browser, cdp;

function assert(value, message) { if (!value) throw new Error(message); }
function pass(message) { console.log("PASS " + message); }
async function waitFor(fn, message, timeout = 30000) {
   const end = Date.now() + timeout;
   while (Date.now() < end) {
      try { const value = await fn(); if (value) return value; } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 100));
   }
   throw new Error(message);
}

class Cdp {
   constructor(socket) {
      this.socket = socket; this.id = 0; this.pending = new Map(); this.errors = [];
      socket.onmessage = ({ data }) => {
         const message = JSON.parse(data);
         if (message.id) {
            const pending = this.pending.get(message.id); this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
         } else if (message.method === "Runtime.exceptionThrown") {
            this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
         }
      };
   }
   static async connect(ws) {
      const socket = new WebSocket(ws);
      await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
      return new Cdp(socket);
   }
   send(method, params = {}) {
      const id = ++this.id;
      return new Promise((resolve, reject) => {
         this.pending.set(id, { resolve, reject });
         this.socket.send(JSON.stringify({ id, method, params }));
      });
   }
}

async function evaluate(expression) {
   const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
   if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
   return result.result.value;
}
async function navigate() {
   await cdp.send("Page.navigate", { url });
   await waitFor(() => evaluate("document.readyState === 'complete' && typeof openRadicalMode === 'function' && typeof setView === 'function'"), "application init failed");
}
async function click(selector) {
   return evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if(!node) throw new Error('missing ${selector}'); node.click(); return true; })()`);
}
async function screenshot(target) {
   const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
   await writeFile(target, Buffer.from(result.data, "base64"));
}

async function main() {
   server = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
   await waitFor(async () => (await fetch(url)).ok, "server failed");
   browser = spawn(edge, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
   const version = await waitFor(async () => { try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return response.ok && response.json(); } catch (_) { return false; } }, "browser failed");
   const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
   cdp = await Cdp.connect(pages.find((item) => item.type === "page").webSocketDebuggerUrl);
   await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
   await navigate();

   const manifest = await evaluate(`(async () => (await fetch('data/generated/character-radicals/manifest.json')).json())()`);
   assert(manifest.format === "mo-studio-character-radicals", "unexpected manifest format");
   assert(manifest.counts.radicalsWithDictionaryMembers === 288, `expected 288 radicals in the picker, got ${manifest.counts.radicalsWithDictionaryMembers}`);
   assert(manifest.counts.charactersCovered === 9409, `expected 9409 covered characters, got ${manifest.counts.charactersCovered}`);
   assert(manifest.counts.dictionaryCharactersTotal === 14426, `expected 14426 total dictionary characters, got ${manifest.counts.dictionaryCharactersTotal}`);
   assert(manifest.counts.dictionaryCharactersWithoutRadical === 5017, `expected 5017 dictionary characters without a known radical, got ${manifest.counts.dictionaryCharactersWithoutRadical}`);
   pass(`chiffres mesurés (source manifest) : ${manifest.counts.radicalsWithDictionaryMembers} clés, ${manifest.counts.charactersCovered} caractères couverts, ${manifest.counts.dictionaryCharactersWithoutRadical} sans clé connue`);

   await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
   await evaluate("(() => { if (activeView !== 'search') setView('search'); })()");
   assert(await evaluate("!!document.querySelector('#search-mode-toggle') && document.querySelector('#search-mode-toggle').getAttribute('aria-pressed')==='false'"), "toggle button missing or already pressed");

   await click("#search-mode-toggle");
   await waitFor(() => evaluate("!document.querySelector('#dradical-panel').hidden && document.querySelectorAll('.radical-chip').length > 0"), "radical table did not open");
   assert(await evaluate("document.querySelector('#search-mode-toggle').getAttribute('aria-pressed')==='true'"), "toggle did not report pressed state");
   const catalogCheck = await evaluate("({ catalogCount: radicalBrowser.catalog.length, chipCount: document.querySelectorAll('.radical-chip').length })");
   assert(catalogCheck.catalogCount === manifest.radicals.length, `catalog length mismatch: ${JSON.stringify(catalogCheck)}`);
   const gridMetrics390 = await evaluate(`(() => {
      const grids = [...document.querySelectorAll('.radical-grid')];
      const chips = [...document.querySelectorAll('.radical-chip')];
      return { overflow: grids.some((g) => g.scrollWidth > g.clientWidth + 1), minChipHeight: Math.min(...chips.map((c) => c.getBoundingClientRect().height)), pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
   })()`);
   assert(!gridMetrics390.overflow && !gridMetrics390.pageOverflow && gridMetrics390.minChipHeight >= 44, `390px radical grid failed: ${JSON.stringify(gridMetrics390)}`);
   await screenshot(visualProofs.table390);
   pass(`tableau des clés à 390px : ${catalogCheck.chipCount} pastilles, aucune cible < 44px, aucun débordement`);

   await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
   const gridMetrics1024 = await evaluate(`(() => {
      const grids = [...document.querySelectorAll('.radical-grid')];
      return { overflow: grids.some((g) => g.scrollWidth > g.clientWidth + 1), pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
   })()`);
   assert(!gridMetrics1024.overflow && !gridMetrics1024.pageOverflow, `desktop radical grid failed: ${JSON.stringify(gridMetrics1024)}`);
   await screenshot(visualProofs.table1024);
   pass("tableau des clés en desktop : aucun débordement horizontal");

   await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
   for (const radical of ["氵", "亻", "女", "木"]) {
      const row = manifest.radicals.find((item) => item.radical === radical);
      assert(row, `${radical} missing from manifest`);
      await click(`[data-radical="${radical}"]`);
      await waitFor(() => evaluate(`radicalBrowser.radical === ${JSON.stringify(radical)} && Array.isArray(radicalBrowser.members)`), `${radical} member list did not load`);
      const info = await evaluate("({ count: radicalBrowser.members.length, strokes: radicalBrowser.members.map((m) => m.__strokeCount), rows: document.querySelectorAll('#dradical-panel .dict-result').length })");
      assert(info.count === row.memberCount, `${radical} member count mismatch: expected ${row.memberCount}, got ${info.count}`);
      assert(info.rows === Math.min(info.count, 32), `${radical} rendered row count mismatch: ${JSON.stringify(info)}`);
      const ascending = info.strokes.every((value, index, all) => index === 0 || (all[index - 1] ?? Infinity) <= (value ?? Infinity));
      assert(ascending, `${radical} members are not sorted ascending by stroke count: ${JSON.stringify(info.strokes)}`);
      if (radical === "氵") {
         await screenshot(visualProofs.members390);
         await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
         await screenshot(visualProofs.members1024);
         await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      }
      await click("#radical-back");
      await waitFor(() => evaluate("radicalBrowser.radical === null && document.querySelectorAll('.radical-chip').length > 0"), `${radical} did not return to the radical table`);
   }
   pass("氵/亻/女/木 : listes de caractères correctes, triées par nombre de traits croissant");

   await click('[data-radical="氵"]');
   await waitFor(() => evaluate("radicalBrowser.radical === '氵' && document.querySelectorAll('#dradical-panel .dict-result').length > 0"), "氵 member list did not reload");
   await click("#dradical-panel .dict-result-primary");
   await waitFor(() => evaluate("sheetOpen() && !!document.querySelector('.dd-entry')"), "character detail did not open from radical mode");
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "detail sheet did not close");
   const historyAfterClose = await evaluate("({ mode: history.state?.mode, radical: history.state?.radical, rows: document.querySelectorAll('#dradical-panel .dict-result').length, panelHidden: document.querySelector('#dradical-panel').hidden })");
   assert(historyAfterClose.mode === "radical" && historyAfterClose.radical === "氵" && !historyAfterClose.panelHidden && historyAfterClose.rows > 0, `closing a character detail from radical mode did not return to the same radical's list: ${JSON.stringify(historyAfterClose)}`);
   pass("fermeture d’une fiche depuis le mode clés → retour dans la même liste de clé (pas de résultats génériques)");

   const oneMember = manifest.radicals.find((row) => row.memberCount === 1);
   assert(oneMember, "no genuine 1-member radical found in the manifest");
   await click("#radical-back");
   await waitFor(() => evaluate("radicalBrowser.radical === null"), "did not return to radical table before 1-member check");
   await click(`[data-radical="${oneMember.radical}"]`);
   await waitFor(() => evaluate(`radicalBrowser.radical === ${JSON.stringify(oneMember.radical)} && Array.isArray(radicalBrowser.members)`), "1-member radical did not load");
   const oneMemberInfo = await evaluate("({ rows: document.querySelectorAll('#dradical-panel .dict-result').length, showMore: !!document.querySelector('#radical-show-more') })");
   assert(oneMemberInfo.rows === 1 && !oneMemberInfo.showMore, `1-member radical (${oneMember.radical}) rendering unexpected: ${JSON.stringify(oneMemberInfo)}`);
   pass(`clé à 1 membre (${oneMember.radical}) : une seule ligne, pas de pagination`);

   // No real radical is missing hanzi-writer stroke data today (confirmed at build time), so the
   // "unknown stroke count" fallback is exercised here by injecting a synthetic catalog row.
   const syntheticCheck = await evaluate(`(() => {
      const sentinel = "\uE001";
      radicalBrowser.catalog = [...radicalBrowser.catalog, { radical: sentinel, strokeCount: null, sens: null, memberCount: 3 }];
      renderRadicalTable();
      const heading = [...document.querySelectorAll('.radical-group-heading')].find((node) => node.textContent.includes('inconnu'));
      const chip = document.querySelector('[data-radical="' + sentinel + '"]');
      return { headingFound: !!heading, chipFound: !!chip, chipHasNoStrokeLabel: !!chip && !chip.textContent.includes('null') };
   })()`);
   assert(syntheticCheck.headingFound && syntheticCheck.chipFound && syntheticCheck.chipHasNoStrokeLabel, `synthetic missing-stroke-count radical did not render safely: ${JSON.stringify(syntheticCheck)}`);
   pass("clé sans nombre de traits (cas synthétique — aucune clé réelle n’en manque aujourd’hui) : rendu sans plantage ni valeur inventée");
   await evaluate("openRadicalMode({fromHistory:true})");
   await waitFor(() => evaluate("radicalBrowser.catalog.length === " + manifest.radicals.length), "radical catalog did not reset after the synthetic test");
   await evaluate("exitRadicalMode({fromHistory:true})");
   await waitFor(() => evaluate("document.querySelector('#dradical-panel').hidden"), "did not exit radical mode before the query-preservation test");

   const priorSearch = await evaluate(`(async () => { await launchDictionarySearch('你'); return new Promise((resolve) => setTimeout(() => resolve(srch.search?.results.map((item) => item.entry.id)), 400)); })()`);
   assert(Array.isArray(priorSearch) && priorSearch.length, "prior search before entering radical mode failed to populate results");
   await click("#search-mode-toggle");
   await waitFor(() => evaluate("!document.querySelector('#dradical-panel').hidden"), "radical mode did not reopen for the exit test");
   await click("#search-mode-toggle");
   await waitFor(() => evaluate("document.querySelector('#dradical-panel').hidden"), "exiting radical mode did not hide the panel");
   const afterExit = await evaluate("({ query: document.querySelector('#dq').value, results: srch.search?.results.map((item) => item.entry.id) })");
   assert(afterExit.query === "你" && JSON.stringify(afterExit.results) === JSON.stringify(priorSearch), `exiting radical mode lost the prior query/results: ${JSON.stringify(afterExit)}`);
   await screenshot(visualProofs.backToSearch390);
   pass("bascule retour vers la recherche normale : requête et résultats préservés");

   assert(!cdp.errors.length, "runtime errors: " + cdp.errors.join(" | "));
   console.log(`RESULT ${version.Browser} — mode clés validé · captures ${Object.values(visualProofs).join(" · ")}`);
}

try { await main(); }
catch (error) { console.error("FAIL " + (error.stack || error.message)); process.exitCode = 1; }
finally {
   if (cdp?.socket) cdp.socket.close();
   if (browser && !browser.killed) browser.kill();
   if (server && !server.killed) server.kill();
   await new Promise((resolve) => setTimeout(resolve, 250));
   await rm(profile, { recursive: true, force: true }).catch(() => {});
}
