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
   table1280: path.join(os.tmpdir(), "mo-studio-radical-table-1280.png"),
   selected390: path.join(os.tmpdir(), "mo-studio-radical-selected-390x844.png"),
   selected1280: path.join(os.tmpdir(), "mo-studio-radical-selected-1280x900.png"),
   iceRadical390: path.join(os.tmpdir(), "mo-studio-radical-ice-390x844.png"),
   songDetail390: path.join(os.tmpdir(), "mo-studio-radical-song-detail-390x844.png"),
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
   const buildReport = await evaluate(`(async () => (await fetch('data/generated/character-radicals/build-report.json')).json())()`);
   assert(manifest.format === "mo-studio-character-radicals", "unexpected manifest format");
   assert(manifest.counts.radicalsWithDictionaryMembers === 288, `expected 288 radicals in the picker, got ${manifest.counts.radicalsWithDictionaryMembers}`);
   assert(manifest.counts.charactersCovered === 9409, `expected 9409 covered characters, got ${manifest.counts.charactersCovered}`);
   assert(manifest.counts.dictionaryCharactersTotal === 14426, `expected 14426 total dictionary characters, got ${manifest.counts.dictionaryCharactersTotal}`);
   assert(manifest.counts.dictionaryCharactersWithoutRadical === 5017, `expected 5017 dictionary characters without a known radical, got ${manifest.counts.dictionaryCharactersWithoutRadical}`);
   assert(buildReport.frenchAttachment.radicalNavigationCharacters.recoveredByExplicitSimplifiedTraditionalAttachment === 2430, "unexpected recovered French count in radical navigation");
   assert(buildReport.frenchAttachment.radicalNavigationCharacters.remainingWithoutFrench === 932, "unexpected remaining French gap in radical navigation");
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
   const gridMetrics1280 = await evaluate(`(() => {
      const grids = [...document.querySelectorAll('.radical-grid')];
      return { overflow: grids.some((g) => g.scrollWidth > g.clientWidth + 1), pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
   })()`);
   assert(!gridMetrics1280.overflow && !gridMetrics1280.pageOverflow, `desktop radical grid failed: ${JSON.stringify(gridMetrics1280)}`);
   await screenshot(visualProofs.table1280);
   pass("tableau des clés en desktop : aucun débordement horizontal");

   await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
   await evaluate("window.scrollTo(0, 420)");
   const radicalTableScroll = await evaluate("window.scrollY");
   await click('[data-radical="覀"]');
   await waitFor(() => evaluate("radicalBrowser.radical === '覀' && Array.isArray(radicalBrowser.members)"), "覀 member list did not load");
   const linkedContext = await evaluate(`(() => {
      const glyph=document.querySelector('.radical-context-glyph');
      const card=document.querySelector('.radical-context-card');
      return {
         glyph:glyph?.textContent.trim(), glyphLabel:glyph?.getAttribute('aria-label'),
         sense:document.querySelector('.radical-context-sense')?.textContent.trim(),
         strokes:document.querySelector('[data-radical-strokes]')?.textContent.trim(),
         count:document.querySelector('[data-radical-count]')?.textContent.trim(),
         linked:document.querySelector('[data-radical-linked]')?.textContent.trim(),
         rows:document.querySelectorAll('#dradical-panel .dict-result').length,
         title:document.querySelector('#radical-results-title')?.textContent.trim(),
         backButtons:document.querySelectorAll('#radical-back').length,
         cardTop:card?.getBoundingClientRect().top,
      };
   })()`);
   assert(linkedContext.glyph === "覀" && linkedContext.glyphLabel === "Clé 覀", `linked radical glyph was substituted: ${JSON.stringify(linkedContext)}`);
   assert(linkedContext.sense === "ouest (forme liée de 西)" && linkedContext.strokes === "6 traits" && linkedContext.count === "4 caractères associés" && linkedContext.linked.includes("Forme liée") && linkedContext.linked.includes("西"), `覀 context metadata is incomplete: ${JSON.stringify(linkedContext)}`);
   assert(linkedContext.rows === 4 && linkedContext.title === "Caractères utilisant cette clé" && linkedContext.backButtons === 1, `覀 list hierarchy is incomplete: ${JSON.stringify(linkedContext)}`);

   const selectedWidths = [[320, 568], [375, 667], [390, 844], [430, 932], [1280, 900]];
   for (const [width, height] of selectedWidths) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
      const layout = await evaluate(`(() => {
         const rect=(selector)=>{const node=document.querySelector(selector),box=node?.getBoundingClientRect();return node?{top:box.top,bottom:box.bottom,left:box.left,right:box.right,height:box.height}:null};
         const targets=[...document.querySelectorAll('#search-mode-toggle,#radical-back,#dradical-panel .dict-result-primary,#radical-show-more')].filter((node)=>getComputedStyle(node).display!=='none');
         const ids=[...document.querySelectorAll('[id]')].map((node)=>node.id),duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
         const top=rect('.search-hero-top'),context=rect('.radical-context-card'),heading=rect('.radical-members-heading'),first=rect('#dradical-panel .dict-result'),nav=rect('.nav');
         return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,minTarget:Math.min(...targets.map((node)=>node.getBoundingClientRect().height)),duplicates:[...new Set(duplicates)],gap:context.top-top.bottom,context,heading,first,nav};
      })()`);
      assert(!layout.overflow && layout.minTarget >= 44 && !layout.duplicates.length, `selected radical responsive/a11y failed at ${width}px: ${JSON.stringify(layout)}`);
      assert(layout.gap <= 16 && layout.context.top >= 0 && layout.context.bottom < layout.nav.top && layout.heading.top < layout.nav.top && layout.first.top < layout.nav.top, `selected context was not useful in the first viewport at ${width}px: ${JSON.stringify(layout)}`);
      if (width === 390) await screenshot(visualProofs.selected390);
      if (width === 1280) await screenshot(visualProofs.selected1280);
      await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      const bottomSafety = await evaluate(`(() => {const last=[...document.querySelectorAll('#dradical-panel .dict-result')].at(-1)?.getBoundingClientRect(),nav=document.querySelector('.nav').getBoundingClientRect();return {lastBottom:last?.bottom,navTop:nav.top,scrollY:window.scrollY};})()`);
      assert(bottomSafety.lastBottom <= bottomSafety.navTop + 1, `selected radical content passed under navigation at ${width}px: ${JSON.stringify(bottomSafety)}`);
      await evaluate("window.scrollTo(0, 0)");
   }
   pass("覀 : glyphe exact, forme liée de 西, 6 traits, 4 membres et contexte visible dès le premier écran à 320/375/390/430/1280px");

   await evaluate("history.back()");
   await waitFor(() => evaluate("radicalBrowser.radical === null && document.querySelectorAll('.radical-chip').length > 0"), "browser Back did not restore the radical table");
   const restoredTableScroll = await waitFor(() => evaluate(`Math.abs(window.scrollY - ${radicalTableScroll}) <= 2 ? window.scrollY : false`), "browser Back did not restore the radical table scroll");
   await evaluate("history.forward()");
   await waitFor(() => evaluate("radicalBrowser.radical === '覀' && document.querySelector('.radical-context-glyph')?.textContent.trim() === '覀'"), "browser Forward did not restore the selected radical");
   assert(restoredTableScroll >= 0, "restored table scroll is invalid");
   await click("#radical-back");
   await waitFor(() => evaluate("radicalBrowser.radical === null && document.querySelectorAll('.radical-chip').length > 0"), "context back action did not return to all radicals");
   pass("retour navigateur, avance navigateur et unique action Toutes les clés préservent les deux niveaux du mode");

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
         assert(info.count > 100 && info.rows === 32 && await evaluate("!!document.querySelector('#radical-show-more')"), `large radical did not expose its 32-row first page: ${JSON.stringify(info)}`);
         await click("#radical-show-more");
         const expandedRows = await evaluate("document.querySelectorAll('#dradical-panel .dict-result').length");
         assert(expandedRows === 64, `Afficher plus did not advance the 32-row page: ${expandedRows}`);
      }
      await click("#radical-back");
      await waitFor(() => evaluate("radicalBrowser.radical === null && document.querySelectorAll('.radical-chip').length > 0"), `${radical} did not return to the radical table`);
   }
   pass("氵/亻/女/木 : tri conservé ; clé > 100 membres paginée 32 puis 64 lignes");

   await click('[data-radical="冫"]');
   await waitFor(() => evaluate("radicalBrowser.radical === '冫' && Array.isArray(radicalBrowser.members)"), "冫 member list did not load");
   await screenshot(visualProofs.iceRadical390);
   const iceRadicalTargets = ['冰','冲','决','冻','净','凄','准','凇','凈','凉','冼'];
   const recoveredByIceRadical = await evaluate(`(() => Object.fromEntries(
      ${JSON.stringify(iceRadicalTargets)}.map((hanzi) => {
         const entry=radicalBrowser.members.find((item)=>item.simplified===hanzi);
         return [hanzi, entry ? {
            pinyin:(entry.readings||[]).map((reading)=>reading.pinyin.numbered),
            french:(entry.readings||[]).flatMap((reading)=>reading.definitionsFr||[]),
         } : null];
      })
   ))()`);
   assert(await evaluate("radicalBrowser.members.length === 26"), "冫 must expose exactly 26 associated characters");
   for (const hanzi of iceRadicalTargets)
      assert(recoveredByIceRadical[hanzi]?.french.length, `${hanzi} stayed French-empty in the mobile radical navigation`);
   assert(recoveredByIceRadical['冲'].pinyin.join(',') === 'chong1,chong4', `冲 readings merged in radical navigation: ${JSON.stringify(recoveredByIceRadical['冲'])}`);
   assert(recoveredByIceRadical['凉'].pinyin.join(',') === 'liang2,liang4', `凉 readings merged in radical navigation: ${JSON.stringify(recoveredByIceRadical['凉'])}`);

   const directSearchByIceRadical = await evaluate(`(async () => {
      const output={};
      for (const hanzi of ${JSON.stringify(iceRadicalTargets)}) {
         const result=(await searchDictionary(hanzi)).results.find((item)=>item.entry.id==='char-'+hanzi);
         const entry=result && await loadDictionaryEntryById(result.entry.id);
         output[hanzi]=entry ? {
            pinyin:(entry.readings||[]).map((reading)=>reading.pinyin.numbered),
            french:(entry.readings||[]).flatMap((reading)=>reading.definitionsFr||[]),
         } : null;
      }
      return output;
   })()`);
   for (const hanzi of iceRadicalTargets)
      assert(JSON.stringify(directSearchByIceRadical[hanzi]) === JSON.stringify(recoveredByIceRadical[hanzi]), `${hanzi}: direct search and radical navigation disagree`);

   const detailFragments = {
      冰:'glace', 冲:'infuser', 决:'décider', 冻:'congeler', 净:'propre', 凄:'glacial',
      准:'autoriser', 凇:'givre', 凈:'variante graphique de 淨/净', 凉:'laisser refroidir', 冼:'nom de famille Xian',
   };
   for (const hanzi of iceRadicalTargets) {
      await evaluate(`(() => {
         const article=[...document.querySelectorAll('#dradical-panel .dict-result')].find((node)=>node.dataset.entryId==='char-'+${JSON.stringify(hanzi)});
         if(!article) throw new Error('missing radical result for '+${JSON.stringify(hanzi)});
         article.querySelector('.dict-result-primary').click();
      })()`);
      await waitFor(() => evaluate(`sheetOpen() && document.querySelector('#dd-french-definitions')?.textContent.includes(${JSON.stringify(detailFragments[hanzi])})`), `${hanzi} detail lost its verified French`);
      const detail = await evaluate(`(() => ({
         overflow:document.documentElement.scrollWidth>innerWidth+1,
         width:innerWidth,
         french:document.querySelector('#dd-french-definitions')?.textContent || '',
         unavailable:document.querySelector('#dd-french-definitions')?.textContent.includes('Sens français vérifié indisponible'),
         englishReference:document.querySelector('#sheet')?.textContent.includes('Sens anglais de référence'),
         readingGroups:[...document.querySelectorAll('.dd-reading-group')].map((node)=>node.dataset.reading),
      }))()`);
      assert(detail.width === 390 && !detail.overflow && !detail.unavailable && !detail.englishReference, `${hanzi} mobile detail failed: ${JSON.stringify(detail)}`);
      if (hanzi === '冲') assert(detail.readingGroups.join(',') === 'chong1,chong4', `冲 detail merged readings: ${JSON.stringify(detail)}`);
      if (hanzi === '凉') assert(detail.readingGroups.join(',') === 'liang2,liang4', `凉 detail merged readings: ${JSON.stringify(detail)}`);
      if (hanzi === '凇') await screenshot(visualProofs.songDetail390);
      await click('#dd-close');
      await waitFor(() => evaluate("!sheetOpen() && radicalBrowser.radical === '冫'"), `closing ${hanzi} did not restore the 冫 list`);
   }
   await click('#radical-back');
   await waitFor(() => evaluate("radicalBrowser.radical === null"), "did not return from 冫 to the radical table");
   pass("viewport mobile 390×844 : les 26 membres de 冫 sont présents ; recherche, navigation et fiches concordent pour 冰/冲/决/冻/净/凄/准/凇/凈/凉/冼");

   await click('[data-radical="氵"]');
   await waitFor(() => evaluate("radicalBrowser.radical === '氵' && document.querySelectorAll('#dradical-panel .dict-result').length > 0"), "氵 member list did not reload");
   await click("#radical-show-more");
   await waitFor(() => evaluate("document.querySelectorAll('#dradical-panel .dict-result').length === 64"), "second radical member page did not open before detail");
   await evaluate("window.scrollTo(0, Math.min(1500, document.documentElement.scrollHeight - innerHeight))");
   const listScrollBeforeDetail = await evaluate("window.scrollY");
   await evaluate(`(() => {
      const navTop=document.querySelector('.nav').getBoundingClientRect().top;
      const buttons=[...document.querySelectorAll('#dradical-panel .dict-result-primary')];
      const target=buttons.find((button)=>{const rect=button.getBoundingClientRect();return rect.top>=0&&rect.bottom<navTop;})||buttons[0];
      target.click();
   })()`);
   await waitFor(() => evaluate("sheetOpen() && !!document.querySelector('.dd-entry')"), "character detail did not open from radical mode");
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "detail sheet did not close");
   await waitFor(() => evaluate(`Math.abs(window.scrollY - ${listScrollBeforeDetail}) <= 2`), "closing a character detail did not restore the list scroll");
   const historyAfterClose = await evaluate("({ mode: history.state?.mode, radical: history.state?.radical, rows: document.querySelectorAll('#dradical-panel .dict-result').length, panelHidden: document.querySelector('#dradical-panel').hidden, scrollY: window.scrollY })");
   assert(historyAfterClose.mode === "radical" && historyAfterClose.radical === "氵" && !historyAfterClose.panelHidden && historyAfterClose.rows === 64 && Math.abs(historyAfterClose.scrollY - listScrollBeforeDetail) <= 2, `closing a character detail from radical mode did not return to the same radical's list and position: ${JSON.stringify(historyAfterClose)}`);
   pass("fermeture d’une fiche depuis le mode clés → même clé, même page de 64 éléments et même position de défilement");

   const oneMember = manifest.radicals.find((row) => row.memberCount === 1);
   assert(oneMember, "no genuine 1-member radical found in the manifest");
   await click("#radical-back");
   await waitFor(() => evaluate("radicalBrowser.radical === null"), "did not return to radical table before 1-member check");
   await click(`[data-radical="${oneMember.radical}"]`);
   await waitFor(() => evaluate(`radicalBrowser.radical === ${JSON.stringify(oneMember.radical)} && Array.isArray(radicalBrowser.members)`), "1-member radical did not load");
   const oneMemberInfo = await evaluate("({ rows: document.querySelectorAll('#dradical-panel .dict-result').length, showMore: !!document.querySelector('#radical-show-more'), count: document.querySelector('[data-radical-count]')?.textContent.trim(), sense: document.querySelector('.radical-context-sense')?.textContent.trim() })");
   assert(oneMemberInfo.rows === 1 && !oneMemberInfo.showMore && oneMemberInfo.count === "1 caractère associé", `1-member radical (${oneMember.radical}) rendering unexpected: ${JSON.stringify(oneMemberInfo)}`);
   if (!oneMember.sens) assert(oneMemberInfo.sense === "Sens français vérifié indisponible", `missing verified-French state is unclear: ${JSON.stringify(oneMemberInfo)}`);
   pass(`clé à 1 membre (${oneMember.radical}) : contexte explicite, une seule ligne et pas de pagination`);

   await click("#radical-back");
   await waitFor(() => evaluate("radicalBrowser.radical === null"), "did not return to radical table before synthetic states");

   // No real radical is missing hanzi-writer stroke data today (confirmed at build time), so the
   // "unknown stroke count" fallback is exercised here by injecting a synthetic catalog row.
   const syntheticCheck = await evaluate(`(() => {
      const sentinel = "\uE001";
      radicalBrowser.catalog = [...radicalBrowser.catalog, { radical: sentinel, strokeCount: null, sens: null, memberCount: 3 }];
      renderRadicalTable();
      const heading = [...document.querySelectorAll('.radical-group-heading')].find((node) => node.textContent.includes('inconnu'));
      const chip = document.querySelector('[data-radical="' + sentinel + '"]');
      radicalBrowser.radical = sentinel;
      radicalBrowser.members = [];
      setRadicalPanelVisible(true);
      renderRadicalMembers();
      const selected = {
         glyph:document.querySelector('.radical-context-glyph')?.textContent.trim(),
         strokes:document.querySelector('[data-radical-strokes]')?.textContent.trim(),
         sense:document.querySelector('.radical-context-sense')?.textContent.trim(),
         count:document.querySelector('[data-radical-count]')?.textContent.trim(),
         empty:document.querySelector('.radical-members-empty')?.textContent.trim(),
      };
      renderRadicalMembersError(sentinel);
      const retry=document.querySelector('#radical-retry');
      return { headingFound: !!heading, chipFound: !!chip, chipHasNoStrokeLabel: !!chip && !chip.textContent.includes('null'), selected,
         error:document.querySelector('[role="alert"]')?.textContent.trim(), retryHeight:retry?.getBoundingClientRect().height,
         preservedGlyph:document.querySelector('.radical-context-glyph')?.textContent.trim() };
   })()`);
   assert(syntheticCheck.headingFound && syntheticCheck.chipFound && syntheticCheck.chipHasNoStrokeLabel && syntheticCheck.selected.strokes === "Nombre de traits inconnu" && syntheticCheck.selected.sense === "Sens français vérifié indisponible" && syntheticCheck.selected.count === "3 caractères associés", `synthetic missing metadata radical did not render safely: ${JSON.stringify(syntheticCheck)}`);
   assert(syntheticCheck.selected.empty.includes("Aucun caractère associé") && syntheticCheck.error.includes("n’ont pas pu être chargés") && syntheticCheck.retryHeight >= 44 && syntheticCheck.preservedGlyph === syntheticCheck.selected.glyph, `empty/error states lost their selected-radical context: ${JSON.stringify(syntheticCheck)}`);
   pass("traits inconnus, sens français absent, aucun résultat et erreur : états explicites sans valeur inventée");
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
