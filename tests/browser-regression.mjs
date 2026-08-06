import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const serverUrl = "http://127.0.0.1:8000/";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browserPort = 9333;
const browserProfile = await mkdtemp(path.join(os.tmpdir(), "mo-studio-edge-"));
const screenshotDirectory = await mkdtemp(
   path.join(os.tmpdir(), "mo-studio-screens-"),
);

const results = [];
const runtimeErrors = [];
const measurements = {};

function record(name, details = "") {
   results.push({ name, status: "PASS", details });
   console.log(`PASS ${name}${details ? ` — ${details}` : ""}`);
}

function assert(condition, message) {
   if (!condition) throw new Error(message);
}

async function waitFor(check, message, timeout = 12_000) {
   const deadline = Date.now() + timeout;
   let lastError;
   while (Date.now() < deadline) {
      try {
         const value = await check();
         if (value) return value;
      } catch (error) {
         lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
   }
   throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function waitForHttp(url) {
   return waitFor(async () => {
      const response = await fetch(url);
      return response.ok;
   }, `HTTP server did not become ready at ${url}`);
}

class CdpClient {
   constructor(socket) {
      this.socket = socket;
      this.nextId = 1;
      this.pending = new Map();
      socket.addEventListener("message", (event) => {
         const message = JSON.parse(event.data);
         if (message.id && this.pending.has(message.id)) {
            const { resolve, reject } = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) reject(new Error(message.error.message));
            else resolve(message.result);
            return;
         }
         if (message.method === "Runtime.exceptionThrown") {
            runtimeErrors.push(
               message.params.exceptionDetails.exception?.description ||
                  message.params.exceptionDetails.text,
            );
         }
         if (
            message.method === "Log.entryAdded" &&
            message.params.entry.level === "error"
         ) {
            runtimeErrors.push(message.params.entry.text);
         }
      });
   }

   static async connect(url) {
      const socket = new WebSocket(url);
      await new Promise((resolve, reject) => {
         socket.addEventListener("open", resolve, { once: true });
         socket.addEventListener("error", reject, { once: true });
      });
      return new CdpClient(socket);
   }

   send(method, params = {}) {
      const id = this.nextId++;
      return new Promise((resolve, reject) => {
         this.pending.set(id, { resolve, reject });
         this.socket.send(JSON.stringify({ id, method, params }));
      });
   }

   close() {
      this.socket.close();
   }
}

let server;
let browser;
let cdp;

async function evaluate(expression) {
   const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
   });
   if (result.exceptionDetails) {
      throw new Error(
         result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text,
      );
   }
   return result.result.value;
}

async function navigate(relativeUrl = "") {
   await cdp.send("Page.navigate", { url: new URL(relativeUrl, serverUrl).href });
   try {
      await waitFor(
         () =>
            evaluate(
               "document.readyState === 'complete' && !!document.querySelector('#view') && document.querySelector('#view').children.length > 0",
            ),
         `Page did not initialize: ${relativeUrl || "index.html"}`,
         20_000,
      );
   } catch (error) {
      const state = await evaluate(`({
         href: location.href,
         readyState: document.readyState,
         hasView: !!document.querySelector('#view'),
         viewHtml: document.querySelector('#view')?.innerHTML,
         scripts: [...document.scripts].map((script) => ({ src: script.src, dataApp: script.hasAttribute('data-mo-app') }))
      })`).catch((detailError) => ({ detailError: detailError.message }));
      throw new Error(`${error.message}; state=${JSON.stringify(state)}`);
   }
}

async function click(selector) {
   const encoded = JSON.stringify(selector);
   await evaluate(`(() => {
      const element = document.querySelector(${encoded});
      if (!element) throw new Error('Missing element: ' + ${encoded});
      element.click();
      return true;
   })()`);
}

async function mouseClick(selector, options = {}) {
   const encoded = JSON.stringify(selector);
   const target = await evaluate(`(async () => {
      const element = document.querySelector(${encoded});
      if (!element) throw new Error('Missing element: ' + ${encoded});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      element.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const style = getComputedStyle(element);
      return {
         x,
         y,
         width: rect.width,
         height: rect.height,
         disabled: !!element.disabled,
         pointerEvents: style.pointerEvents,
         visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
         hitTarget: hit ? (hit.id || hit.tagName) : null,
         receivesPointer: !!hit && (hit === element || element.contains(hit)),
      };
   })()`);
   assert(target.visible, `Mouse target is not visible: ${selector}`);
   assert(target.pointerEvents !== "none", `Mouse target has pointer-events:none: ${selector}`);
   assert(target.receivesPointer, `Mouse target is overlapped: ${selector}; hit ${target.hitTarget}`);
   if (!options.allowDisabled)
      assert(!target.disabled, `Mouse target is disabled: ${selector}`);
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: target.x,
      y: target.y,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: target.x,
      y: target.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: target.x,
      y: target.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
   });
   return target;
}

async function mouseDrag(selector, deltaX, deltaY = 0) {
   const encoded = JSON.stringify(selector);
   const target = await evaluate(`(async () => {
      const element = document.querySelector(${encoded});
      if (!element) throw new Error('Missing element: ' + ${encoded});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      element.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = element.getBoundingClientRect();
      return {
         x: rect.left + rect.width / 2,
         y: rect.top + Math.min(rect.height * 0.34, 180),
      };
   })()`);
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: target.x,
      y: target.y,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: target.x,
      y: target.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: target.x + deltaX / 2,
      y: target.y + deltaY / 2,
      button: "left",
      buttons: 1,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: target.x + deltaX,
      y: target.y + deltaY,
      button: "left",
      buttons: 1,
   });
   await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: target.x + deltaX,
      y: target.y + deltaY,
      button: "left",
      buttons: 0,
      clickCount: 1,
   });
}

async function pointerGesture(selector, { deltaX, deltaY = 0, pointerType = "touch", pointerId = 41 }) {
   const encoded = JSON.stringify(selector);
   return evaluate(`(() => {
      const target = document.querySelector(${encoded});
      if (!target) throw new Error('Missing element: ' + ${encoded});
      const rect = target.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + Math.min(rect.height * 0.34, 180);
      const init = { bubbles: true, cancelable: true, isPrimary: true, pointerId: ${pointerId}, pointerType: ${JSON.stringify(pointerType)}, button: 0 };
      const down = new PointerEvent('pointerdown', { ...init, clientX: startX, clientY: startY });
      const move = new PointerEvent('pointermove', { ...init, clientX: startX + ${Number(deltaX) / 2}, clientY: startY + ${Number(deltaY) / 2} });
      const moveEnd = new PointerEvent('pointermove', { ...init, clientX: startX + ${Number(deltaX)}, clientY: startY + ${Number(deltaY)} });
      const up = new PointerEvent('pointerup', { ...init, clientX: startX + ${Number(deltaX)}, clientY: startY + ${Number(deltaY)} });
      const results = [target.dispatchEvent(down), target.dispatchEvent(move), target.dispatchEvent(moveEnd), target.dispatchEvent(up)];
      return { results, selection: window.getSelection()?.toString() || '' };
   })()`);
}

async function touchScroll(selector, distance = 180) {
   const encoded = JSON.stringify(selector);
   await evaluate("window.scrollTo(0, 0)");
   const point = await evaluate(`(async () => {
      const element = document.querySelector(${encoded});
      if (!element) throw new Error('Missing element: ' + ${encoded});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = element.getBoundingClientRect();
      return {
         x: Math.max(24, Math.min(innerWidth - 24, rect.left + rect.width / 2)),
         y: Math.max(120, Math.min(innerHeight - 120, rect.top + Math.min(rect.height * 0.4, 300))),
         maximum: Math.max(0, document.documentElement.scrollHeight - innerHeight),
      };
   })()`);
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 3, y: point.y - distance / 2, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 4, y: point.y - distance, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
   await new Promise((resolve) => setTimeout(resolve, 180));
   return { ...point, scrollY: await evaluate("window.scrollY") };
}

async function touchScrollContainer(selector, containerSelector, distance = 180) {
   const encodedSelector = JSON.stringify(selector);
   const encodedContainer = JSON.stringify(containerSelector);
   const point = await evaluate(`(async () => {
      const element = document.querySelector(${encodedSelector});
      const container = document.querySelector(${encodedContainer});
      if (!element || !container) throw new Error('Missing touch-scroll target or container');
      container.scrollTop = 0;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = element.getBoundingClientRect();
      return {
         x: Math.max(24, Math.min(innerWidth - 24, rect.left + rect.width / 2)),
         y: Math.max(180, Math.min(innerHeight - 180, rect.top + Math.min(rect.height * 0.5, 220))),
      };
   })()`);
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 7, radiusX: 5, radiusY: 5, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 2, y: point.y - distance / 2, id: 7, radiusX: 5, radiusY: 5, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 3, y: point.y - distance, id: 7, radiusX: 5, radiusY: 5, force: 1 }],
   });
   await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
   await new Promise((resolve) => setTimeout(resolve, 220));
   return evaluate(`document.querySelector(${encodedContainer}).scrollTop`);
}

async function setValue(selector, value, eventName = "input") {
   const encodedSelector = JSON.stringify(selector);
   const encodedValue = JSON.stringify(value);
   await evaluate(`(() => {
      const element = document.querySelector(${encodedSelector});
      if (!element) throw new Error('Missing element: ' + ${encodedSelector});
      element.value = ${encodedValue};
      element.dispatchEvent(new Event(${JSON.stringify(eventName)}, { bubbles: true }));
      return true;
   })()`);
}

async function setFileInput(selector, filePath) {
   await cdp.send("DOM.enable");
   const documentNode = await cdp.send("DOM.getDocument", { depth: -1 });
   const queried = await cdp.send("DOM.querySelector", {
      nodeId: documentNode.root.nodeId,
      selector,
   });
   assert(queried.nodeId, `File input not found: ${selector}`);
   await cdp.send("DOM.setFileInputFiles", {
      nodeId: queried.nodeId,
      files: [filePath],
   });
   await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('change', { bubbles: true }))`,
   );
}

async function assertNoDuplicateIds(context) {
   const duplicates = await evaluate(`(() => {
      const counts = new Map();
      document.querySelectorAll('[id]').forEach((element) =>
         counts.set(element.id, (counts.get(element.id) || 0) + 1),
      );
      return [...counts.entries()].filter(([, count]) => count > 1);
   })()`);
   assert(duplicates.length === 0, `${context} contains duplicate HTML IDs: ${JSON.stringify(duplicates)}`);
}

async function main() {
   server = spawn(
      "python",
      ["-m", "http.server", "8000", "--bind", "127.0.0.1"],
      { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
   );
   let serverError = "";
   server.stderr.on("data", (chunk) => (serverError += chunk.toString()));
   await waitForHttp(serverUrl);
   record("local Python server", "python -m http.server 8000 responded");

   browser = spawn(
      edgePath,
      [
         "--headless=new",
         "--no-sandbox",
         "--disable-gpu",
         "--disable-extensions",
         "--disable-features=VizDisplayCompositor",
         "--no-first-run",
         "--no-default-browser-check",
         `--remote-debugging-port=${browserPort}`,
         `--user-data-dir=${browserProfile}`,
         "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
   );

   const version = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${browserPort}/json/version`, {
         signal: AbortSignal.timeout(1_000),
      });
      return response.ok ? response.json() : null;
   }, "Edge DevTools endpoint did not become ready");
   const pageList = await (
      await fetch(`http://127.0.0.1:${browserPort}/json/list`)
   ).json();
   const pageTarget =
      pageList.find(
         (target) =>
            target.type === "page" && !target.url.startsWith("chrome-extension:"),
      ) || pageList.find((target) => target.type === "page");
   assert(pageTarget, "No browser page target was available");
   cdp = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);
   await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Log.enable"),
      cdp.send("Network.enable"),
      cdp.send("DOM.enable"),
   ]);
   record("browser automation", version.Browser);

   await navigate();
   const startup = await evaluate(`({
      title: document.title,
      nav: document.querySelectorAll('.nav button').length,
      navLabels: [...document.querySelectorAll('.nav button')].map((button) =>
         [...button.querySelectorAll('span')].map((span) => span.textContent.trim()).join(' '),
      ),
      view: activeView,
      emptyReview: !!document.querySelector('.review-empty-message') && document.querySelector('#btn-continue')?.disabled,
      storageKeys: [DB_KEY, SESSION_KEY, BACKUP_KEY, COURSE_PROGRESS_KEY],
      courseProgress,
      dictionaryRequests: performance.getEntriesByType('resource')
         .filter((item) => item.name.includes('/data/generated/dictionary/')).length,
      hskRequests: performance.getEntriesByType('resource')
         .filter((item) => item.name.includes('/data/generated/hsk/runtime/')).length,
      resourceRequests: performance.getEntriesByType('resource').length,
      resourceBytes: performance.getEntriesByType('resource')
         .reduce((sum, item) => sum + (item.encodedBodySize || 0), 0),
      domContentLoadedMs: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || null,
      loadMs: performance.getEntriesByType('navigation')[0]?.loadEventEnd || null
   })`);
   assert(startup.title.includes("Mò Studio"), "Unexpected page title");
   assert(startup.nav === 5 && startup.view === "learn", "Home navigation failed");
   assert(startup.emptyReview, "Empty review state missing");
   assert(
      startup.navLabels.join("|") ===
         "学 Parcours|写 Écrire|查 Rechercher|库 Mes mots|复 Réviser",
      `Main navigation order is incorrect: ${JSON.stringify(startup.navLabels)}`,
   );
   await evaluate("document.querySelector('.nav button').focus({ preventScroll: true })");
   const keyboardNavigationOrder = [];
   for (let index = 0; index < 5; index++) {
      keyboardNavigationOrder.push(await evaluate("document.activeElement?.dataset?.view || ''"));
      if (index < 4) {
         await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
         await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      }
   }
   assert(
      keyboardNavigationOrder.join("|") === "path|write|search|lib|learn",
      `Keyboard navigation order is incorrect: ${JSON.stringify(keyboardNavigationOrder)}`,
   );
   assert(startup.dictionaryRequests === 0, "Dictionary data loaded during application startup");
   assert(startup.hskRequests === 0, "HSK data loaded during application startup");
   assert(
      startup.storageKeys.join("|") ===
         "mo-studio-v1|mo-studio-session|mo-studio-backup|mo-studio-course-progress-v1",
      "Storage keys changed",
   );
   assert(
      startup.courseProgress.version === 1 && Object.keys(startup.courseProgress.levels).length === 0,
      `Future course progress is not an empty isolated structure: ${JSON.stringify(startup.courseProgress)}`,
   );
   measurements.startup = startup;
   await assertNoDuplicateIds("Home startup");
   record(
      "startup and home",
      `empty-state home rendered with zero dictionary/HSK data startup requests; ${startup.resourceRequests} local resources / ${startup.resourceBytes} encoded bytes; load ${startup.loadMs?.toFixed(2)} ms`,
   );

   const emptyLearningState = await evaluate(
      "JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units, settings: db.settings })",
   );
   for (const width of [360, 430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width,
         height: 900,
         deviceScaleFactor: 1,
         mobile: width <= 430,
      });
      await evaluate("setView('learn', { fromHistory: true })");
      const reviewEmpty = await evaluate(`({
         text: document.querySelector('#view').textContent,
         hasStart: !!document.querySelector('#btn-continue'),
         startDisabled: document.querySelector('#btn-continue')?.disabled,
         hasEmpty: !!document.querySelector('.review-empty-message'),
         overflow: document.documentElement.scrollWidth > innerWidth,
      })`);
      assert(
         reviewEmpty.hasStart && reviewEmpty.startDisabled && reviewEmpty.hasEmpty &&
            !reviewEmpty.overflow,
         `Réviser empty state is not clean at ${width}px: ${JSON.stringify(reviewEmpty)}`,
      );

      await click('.nav button[data-view="lib"]');
      const cardsEmpty = await evaluate(`({
         text: document.querySelector('#view').textContent,
         hasCreatePack: !!document.querySelector('#lib-create-pack'),
         hasImport: !!document.querySelector('#lib-import'),
         hasEmpty: !!document.querySelector('.lib-empty'),
         overflow: document.documentElement.scrollWidth > innerWidth,
      })`);
      assert(
         cardsEmpty.hasCreatePack && cardsEmpty.hasImport && cardsEmpty.hasEmpty &&
            !cardsEmpty.overflow,
         `Cartes empty state is not clean at ${width}px: ${JSON.stringify(cardsEmpty)}`,
      );

      await click('.nav button[data-view="path"]');
      await waitFor(
         () => evaluate("document.querySelectorAll('[data-path-level]').length === 6"),
         `HSK manifest did not render at ${width}px`,
         20_000,
      );
      const pathHome = await evaluate(`(() => {
         const cards = [...document.querySelectorAll('[data-path-level]')];
         return {
            title: document.querySelector('#path-title')?.textContent,
            continueTitle: document.querySelector('#path-continue-title')?.textContent,
            levels: cards.map((card) => card.querySelector('.path-level-title').textContent),
            counts: cards.map((card) => Number(card.dataset.pathLevelCount)),
            total: document.querySelector('.path-continue')?.textContent,
            overflow: document.documentElement.scrollWidth > innerWidth,
         };
      })()`);
      assert(
         pathHome.title === "学 · Parcours" && pathHome.continueTitle === "Explorer le vocabulaire HSK" &&
            pathHome.levels.join("|") === "HSK 1|HSK 2|HSK 3|HSK 4|HSK 5|HSK 6" &&
            pathHome.counts.join("|") === "301|200|499|1000|1600|1799" &&
            pathHome.total.replace(/\s/gu, " ").includes("5 399 entrées") &&
            !pathHome.overflow,
         `Real HSK path is incomplete at ${width}px: ${JSON.stringify(pathHome)}`,
      );
      await mouseClick('[data-path-level="1"]');
      await waitFor(
         () => evaluate("document.querySelectorAll('[data-path-word-index]').length > 0"),
         `HSK 1 vocabulary did not load at ${width}px`,
         20_000,
      );
      const levelPage = await evaluate(`({
         title: document.querySelector('#path-level-title')?.textContent,
         total: Number(document.querySelector('[data-path-current-count]')?.textContent.replace(/\\s/g, '')),
         filtered: document.querySelector('.path-filter-count')?.textContent,
         rendered: document.querySelectorAll('[data-path-word-index]').length,
         firstWord: document.querySelector('[data-path-word-index] .path-word-hanzi')?.textContent,
         noLessons: document.querySelector('.path-scope-note')?.textContent,
         back: document.querySelector('#path-level-back')?.textContent.trim(),
         overflow: document.documentElement.scrollWidth > innerWidth,
      })`);
      assert(
         levelPage.title === "HSK 1" && levelPage.total === 301 && levelPage.filtered.includes("301 entrées") &&
            levelPage.rendered === 80 && levelPage.firstWord === "爱" &&
            levelPage.noLessons.includes("aucune leçon") && levelPage.back === "← Retour" && !levelPage.overflow,
         `HSK vocabulary list is incomplete at ${width}px: ${JSON.stringify(levelPage)}`,
      );
      const hskPathScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      await writeFile(
         path.join(screenshotDirectory, `hsk-path-${width}.png`),
         Buffer.from(hskPathScreenshot.data, "base64"),
      );
      await setValue("#path-level-search", "爱");
      const levelSearch = await waitFor(
         () => evaluate(`(() => {
            const rows = [...document.querySelectorAll('[data-path-word-index]')];
            return rows.length === 1 ? {
               word: rows[0].querySelector('.path-word-hanzi')?.textContent,
               badge: rows[0].querySelector('[data-hsk-badge]')?.textContent,
            } : null;
         })()`),
         `HSK level search failed at ${width}px`,
      );
      assert(
         levelSearch.word === "爱" && levelSearch.badge === "HSK 1",
         `HSK level filter returned the wrong entry at ${width}px: ${JSON.stringify(levelSearch)}`,
      );
      await mouseClick("#path-level-back");
      assert(
         await evaluate("document.querySelectorAll('[data-path-level]').length === 6"),
         `HSK level page did not close at ${width}px`,
      );

      if (width === 1024) {
         const expectedCounts = [301, 200, 499, 1000, 1600, 1799];
         for (let level = 2; level <= 6; level++) {
            await click(`[data-path-level="${level}"]`);
            await waitFor(
               () => evaluate(`pathLevelEntries.length === ${expectedCounts[level - 1]}`),
               `HSK ${level} vocabulary did not load`,
               20_000,
            );
            const loadedLevel = await evaluate(`({
               title: document.querySelector('#path-level-title')?.textContent,
               count: pathLevelEntries.length,
               correctlyClassified: pathLevelEntries.every((entry) => entry.firstHskLevel === ${level}),
               hasRows: document.querySelectorAll('[data-path-word-index]').length > 0,
            })`);
            assert(
               loadedLevel.title === `HSK ${level}` && loadedLevel.count === expectedCounts[level - 1] &&
                  loadedLevel.correctlyClassified && loadedLevel.hasRows,
               `HSK ${level} progressive list failed: ${JSON.stringify(loadedLevel)}`,
            );
            await click("#path-level-back");
         }
      }

      await click("#btn-settings");
      const dataActions = await evaluate(`(() => {
         const format = document.querySelector('#st-format');
         const groups = [...document.querySelectorAll('.settings-group')];
         const card = document.querySelector('.sheet-card');
         return {
            importLabel: document.querySelector('#st-import')?.textContent,
            exportLabel: document.querySelector('#st-export')?.textContent,
            formatLabel: format?.textContent,
            groupTitles: groups.map((group) => group.querySelector('.eyebrow')?.textContent.trim()),
            groupHelp: groups.map((group) => group.querySelector('.settings-group-help')?.textContent.trim()),
            underDataSection: format?.closest('.settings-group')?.querySelector('.eyebrow')?.textContent.trim() === 'Données',
            dangerSeparated: document.querySelector('#st-reset')?.closest('.settings-danger-zone')?.querySelector('.eyebrow')?.textContent.trim() === 'Zone dangereuse',
            deadSessionControls: !!document.querySelector('#st-size, #st-new'),
            overflow: document.documentElement.scrollWidth > innerWidth || card.scrollWidth > card.clientWidth,
         };
      })()`);
      assert(
         dataActions.importLabel === "Importer" && dataActions.exportLabel === "Exporter" &&
            dataActions.formatLabel === "Voir le format JSON" && dataActions.underDataSection &&
            dataActions.groupTitles.join("|") === "Pendant la révision|Audio|Données|Zone dangereuse" &&
            dataActions.groupHelp.every(Boolean) && dataActions.dangerSeparated &&
            !dataActions.deadSessionControls && !dataActions.overflow,
         `Settings data actions are incomplete at ${width}px: ${JSON.stringify(dataActions)}`,
      );
      if (width === 360) {
         const legacySettingsLoad = await evaluate(`(() => {
            const previous = localStorage.getItem(DB_KEY);
            const payload = previous ? JSON.parse(previous) : JSON.parse(JSON.stringify(db));
            payload.settings.sessionSize = 30;
            payload.settings.newPerSession = 10;
            localStorage.setItem(DB_KEY, JSON.stringify(payload));
            const loaded = load();
            if (previous == null) localStorage.removeItem(DB_KEY);
            else localStorage.setItem(DB_KEY, previous);
            return !('sessionSize' in loaded.settings) && !('newPerSession' in loaded.settings);
         })()`);
         assert(legacySettingsLoad, "Legacy session settings were not safely ignored while loading");
         await waitFor(
            () => evaluate("getComputedStyle(document.querySelector('#sheet')).opacity === '1'"),
            "Settings sheet transition did not finish",
         );
         const settingsTopImage = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
         });
         await writeFile(
            path.join(screenshotDirectory, "settings-360-top.png"),
            Buffer.from(settingsTopImage.data, "base64"),
         );
         await evaluate(`(() => {
            const card = document.querySelector('.sheet-card');
            card.scrollTop = card.scrollHeight;
         })()`);
         const settingsBottomImage = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
         });
         await writeFile(
            path.join(screenshotDirectory, "settings-360-bottom.png"),
            Buffer.from(settingsBottomImage.data, "base64"),
         );
      }
      await click("#st-close");
      assert(
         (await evaluate("JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units, settings: db.settings })")) ===
            emptyLearningState,
         `Parcours or empty-state checks changed learning data at ${width}px`,
      );
   }
   record(
      "empty states, Settings data actions, and real HSK path",
      "Réviser/Cartes, Settings, six real HSK counts, progressive vocabulary lists, filtering, isolated progress, and layout passed at 360, 430, and 1024px",
   );

   await evaluate(`(() => {
      Object.defineProperty(navigator, 'clipboard', {
         configurable: true,
         value: {
            writeText: async (text) => { window.__formatClipboardText = text; },
         },
      });
   })()`);
   await click("#btn-settings");
   await click("#st-format");
   const settingsFormatDialog = await evaluate(`(() => {
      const sheet = document.querySelector('#sheet');
      const minimal = JSON.parse(document.querySelector('#fmt-card-example').textContent);
      const pack = JSON.parse(document.querySelector('#fmt-pack-example').textContent);
      const text = sheet.textContent;
      return {
         role: sheet.getAttribute('role'),
         modal: sheet.getAttribute('aria-modal'),
         labelledBy: sheet.getAttribute('aria-labelledby'),
         backgroundInert: document.querySelector('#view').inert && document.querySelector('.nav').inert,
         hasRequired: text.includes('chinese'),
         optionalFields: ['pinyin', 'translation', 'notes', 'favorite', 'difficult', 'tags']
            .every((field) => text.includes(field)),
         minimal,
         pack,
         buttons: !!document.querySelector('#fmt-copy') && !!document.querySelector('#fmt-close'),
      };
   })()`);
   assert(
      settingsFormatDialog.role === "dialog" && settingsFormatDialog.modal === "true" &&
         settingsFormatDialog.labelledBy && settingsFormatDialog.backgroundInert,
      `Settings format modal is not accessible: ${JSON.stringify(settingsFormatDialog)}`,
   );
   assert(
      settingsFormatDialog.hasRequired && settingsFormatDialog.optionalFields &&
         settingsFormatDialog.minimal.chinese === "你好" && settingsFormatDialog.minimal.translation === "bonjour",
      "Settings format modal does not document the real card contract",
   );
   assert(
      settingsFormatDialog.pack.pack?.name &&
         Array.isArray(settingsFormatDialog.pack.pack.categories) &&
         Array.isArray(settingsFormatDialog.pack.pack.categories[0]?.words) &&
         settingsFormatDialog.buttons,
      "Settings format modal does not include the complete pack example or controls",
   );
   await click("#fmt-copy");
   await waitFor(() => evaluate("window.__formatClipboardText === FORMAT_PACK_EXAMPLE"), "Format example was not copied");
   await evaluate(`navigator.clipboard.writeText = async () => { throw new Error('simulated clipboard denial'); }`);
   await click("#fmt-copy");
   await waitFor(
      () => evaluate("document.querySelector('#toast').classList.contains('show') && document.querySelector('#toast').textContent.includes('Copie impossible')"),
      "Clipboard failure did not produce a safe toast",
   );
   await click("#fmt-close");
   assert(!(await evaluate("sheetOpen()")), "Settings format modal did not close with Fermer");
   assert(
      (await evaluate("JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units, settings: db.settings })")) ===
         emptyLearningState,
      "Viewing or copying the JSON format changed learning data",
   );
   record(
      "Settings personal-card JSON format modal",
      "Settings → Données opened the accessible contract modal; copy success, failure toast, and Fermer passed",
   );

   await setFileInput("#file-global", path.join(projectRoot, "hsk1.json"));
   await waitFor(
      () => evaluate("!!document.querySelector('#im-merge')"),
      "HSK import confirmation did not open",
   );
   await click("#im-merge");
   const imported = await evaluate(`({
      cards: db.cards.length,
      packs: db.packs.map((pack) => pack.name),
      units: Object.keys(db.units).length,
      storedCards: JSON.parse(localStorage.getItem(DB_KEY)).cards.length
   })`);
   assert(imported.cards === 150 && imported.storedCards === 150, "HSK card import failed");
   assert(imported.units === 15 && imported.packs.includes("HSK 1"), "HSK pack/unit import failed");
   record("JSON import", "hsk1.json imported 150 cards, 15 units, and HSK 1 pack");

   await click('.nav button[data-view="learn"]');
   await click('[data-review-scope="all"]');
   await click("#btn-continue");
   await waitFor(() => evaluate("session.active && !!document.querySelector('.sess')"), "Smart review did not start");
   await click("#s-flip");
   const reviewedId = await evaluate("currentCard().id");
   await click('[data-grade="good"]');
   const graded = await evaluate(`(() => {
      const card = db.cards.find((item) => item.id === ${JSON.stringify(reviewedId)});
      const stored = JSON.parse(localStorage.getItem(DB_KEY)).cards.find((item) => item.id === card.id);
      return { level: card.lvl, due: card.due, storedLevel: stored.lvl, sessionSaved: !!localStorage.getItem(SESSION_KEY) };
   })()`);
   assert(graded.level >= 2 && graded.due > Date.now(), "SRS grade was not applied");
   assert(graded.storedLevel === graded.level, "SRS grade was not persisted");
   record("review and SRS", "smart review grade persisted to the existing card schema");
   await click("#s-exit");
   await waitFor(() => evaluate("!!document.querySelector('#btn-back-hub')"), "Review summary missing");
   await click("#btn-back-hub");

   await click('[data-review-mode="discover"]');
   await click("#btn-continue");
   assert(await evaluate("session.active && session.mode === 'discover'"), "Free discovery session failed");
   await click("#s-exit");
   await waitFor(() => evaluate("!!document.querySelector('#btn-back-hub')"), "Free-session summary missing");
   await click("#btn-back-hub");
   record("free sessions", "discovery session started and completed through the UI");

   const historyLength = await evaluate("history.length");
   await click('.nav button[data-view="lib"]');
   await click("#lib-show-all");
   const library = await evaluate(`({
      rows: document.querySelectorAll('#lib-list .word-select-row').length,
      cards: db.cards.length,
      hasPackBreadcrumb: !!document.querySelector('[data-lib-go="packs"]')
   })`);
   assert(library.rows > 0 && library.cards === 150, "Library did not render imported cards");
   record("library, cards, and units", `${library.rows} initial rows rendered from 150 cards`);

   await click("#lib-list [data-word-open]");
   await click("#card-favorite");
   assert(await evaluate("db.cards.some((card) => card.fav)"), "Favorite was not saved");
   record("favorites", "favorite flag persisted on a personal card");
   await click("#card-close");

   await click('[data-lib-go="packs"]');
   assert((await evaluate("document.querySelector('.pack-grid').textContent")).includes("HSK 1"), "Imported pack missing");
   await evaluate("window.prompt = () => 'Test pack'");
   await click("#lib-create-pack");
   assert(await evaluate("db.packs.some((pack) => pack.name === 'Test pack')"), "Pack creation failed");
   record("packs", "imported and newly created packs are present");
   await click("#pack-add-word");
   await setValue("#word-hz", "测试");
   await setValue("#word-py", "ce4 shi4");
   await setValue("#word-fr", "test temporaire");
   await click("#word-save");
   await waitFor(
      () => evaluate("db.cards.some((card) => card.hz === '测试' && card.fr === 'test temporaire')"),
      "Card creation failed",
   );

   await click('[data-lib-go="packs"]');
   await click("#lib-show-all");
   await setValue("#lib-search", "测试");
   await click("#lib-list [data-word-open]");
   await click("#card-edit");
   await setValue("#word-fr", "test modifié");
   await click("#word-save");
   assert(await evaluate("db.cards.find((card) => card.hz === '测试').fr === 'test modifié'"), "Card edit failed");

   await setValue("#lib-search", "测试");
   await click("#lib-list [data-word-open]");
   await evaluate("window.confirm = () => true");
   await click("#card-delete");
   assert(!(await evaluate("db.cards.some((card) => card.hz === '测试')")), "Card deletion failed");
   record("card create/edit/delete", "temporary card completed the full lifecycle");

   await evaluate("setView('listen', { fromHistory: true })");
   assert(await evaluate("!!document.querySelector('#tone-play') && !!document.querySelector('#word-play')"), "Listening view failed");
   await evaluate(`(() => {
      window.__spoken = [];
      speechSynthesis.cancel = () => {};
      speechSynthesis.speak = (utterance) => window.__spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
   })()`);
   await click("#tone-play");
   await click("#word-play");
   const spoken = await evaluate("window.__spoken");
   assert(spoken.length >= 2 && spoken.every((item) => item.lang === "zh-CN"), "Audio actions were not wired");
   const tone = await evaluate("toneRound.tone");
   await click(`[data-t="${tone}"]`);
   const wordId = await evaluate("wordRound.target.id");
   await click(`[data-id="${wordId}"]`);
   record("listening and audio", "tone/word rounds and zh-CN speech dispatch succeeded");

   await evaluate("setView('path', { fromHistory: true })");
   await waitFor(() => evaluate("!!document.querySelector('#path-grammar')"), "Grammar card missing from Parcours");
   await click("#path-grammar");
   const grammar = await evaluate(`({ lessons: document.querySelectorAll('.gcard').length, quizOptions: document.querySelectorAll('.qz-opts .chip').length })`);
   assert(grammar.lessons > 0 && grammar.quizOptions > 0, "Grammar lessons or quizzes missing");
   assert(await evaluate("!!document.querySelector('#grammar-back')"), "Grammar return to Parcours missing");
   await click(".qz-opts .chip");
   assert(await evaluate("document.querySelector('.qz-opts').dataset.done === '1'"), "Grammar quiz did not evaluate an answer");
   record("grammar", `${grammar.lessons} lesson panels and interactive quiz options rendered`);

   const learningStateBeforeHskDictionary = await evaluate(
      "JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units })",
   );
   await click('.nav button[data-view="search"]');
   await setValue("#dq", "红");
   await click(".search-submit");
   await waitFor(
      () => evaluate("document.querySelector('#dresults .dict-result')?.textContent.includes('红')"),
      "Search returned no Hanzi result",
      30_000,
   );
   const searchResult = await evaluate("document.querySelector('#dresults .dict-result').textContent");
   assert(searchResult.includes("红"), "Incorrect search result");
   const hskSearchBadge = await evaluate(`(() => {
      const result = [...document.querySelectorAll('#dresults .dict-result')]
         .find((item) => item.querySelector('[data-hsk-badge="5"]') && item.querySelector('.dict-result-hanzi b')?.textContent === '红');
      return result ? { badge: result.querySelector('[data-hsk-badge="5"]').textContent, entryId: result.dataset.entryId } : null;
   })()`);
   assert(
      hskSearchBadge?.badge === "HSK 5" && hskSearchBadge.entryId,
      `Verified HSK badge missing from dictionary results: ${JSON.stringify(hskSearchBadge)}`,
   );
   const coldSearchMetrics = await evaluate(`({
      durationMs: srch.search.durationMs,
      dictionaryBytes: performance.getEntriesByType('resource')
         .filter((item) => item.name.includes('/data/generated/dictionary/'))
         .reduce((sum, item) => sum + (item.transferSize || 0), 0),
      initialRows: document.querySelectorAll('#dresults .dict-result').length,
      detailChunkRequests: performance.getEntriesByType('resource')
         .filter((item) => item.name.includes('/entries/')).length,
   })`);
   assert(coldSearchMetrics.initialRows <= 32, "Initial result DOM exceeded pagination limit");
   assert(coldSearchMetrics.detailChunkRequests === 0, "Search eagerly loaded full dictionary-detail chunks");
   measurements.coldSearch = coldSearchMetrics;
   record(
      "search",
      `cold indexed Hanzi search ${coldSearchMetrics.durationMs.toFixed(2)} ms; ${coldSearchMetrics.initialRows} initial rows`,
   );

   await evaluate("caches.delete(DICTIONARY_CACHE_NAME).then(() => resetDictionaryMemory())");
   await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
   const lowerEndSearch = await evaluate(`(async () => {
      let lastTick = performance.now();
      let maximumEventLoopGapMs = 0;
      let tickCount = 0;
      const timer = setInterval(() => {
         const now = performance.now();
         maximumEventLoopGapMs = Math.max(maximumEventLoopGapMs, now - lastTick);
         lastTick = now;
         tickCount += 1;
      }, 16);
      const startedAt = performance.now();
      const response = await searchDictionary('ni3', { limit: 96 });
      await new Promise((resolve) => setTimeout(resolve, 64));
      clearInterval(timer);
      return {
         durationMs: performance.now() - startedAt,
         engineDurationMs: response.durationMs,
         maximumEventLoopGapMs,
         tickCount,
      };
   })()`);
   await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
   assert(lowerEndSearch.tickCount > 0, "Lower-end responsiveness probe did not run");
   assert(lowerEndSearch.maximumEventLoopGapMs < 500, "Lower-end search blocked the main thread excessively");
   measurements.lowerEndSearch = lowerEndSearch;
   record(
      "lower-end search responsiveness",
      `4x CPU: ${lowerEndSearch.engineDurationMs.toFixed(2)} ms search, ${lowerEndSearch.maximumEventLoopGapMs.toFixed(2)} ms maximum event-loop gap`,
   );

   await click('#dresults .dict-result:has([data-hsk-badge="5"]) .dict-result-primary');
   await waitFor(() => evaluate("!!document.querySelector('#dd-target')"), "Dictionary detail did not open");
   const hskDetail = await evaluate(`({
      badge: document.querySelector('.dd-entry [data-hsk-badge="5"]')?.textContent,
      source: document.querySelector('.dd-hsk-source')?.textContent,
   })`);
   assert(
      hskDetail.badge === "HSK 5" && hskDetail.source.includes("red"),
      `HSK badge or source data missing from dictionary detail: ${JSON.stringify(hskDetail)}`,
   );
   const lazyDetailChunkRequests = await evaluate(
      "performance.getEntriesByType('resource').filter((item) => item.name.includes('/entries/')).length",
   );
   assert(lazyDetailChunkRequests > 0, "Opening a dictionary detail did not lazily load an entry chunk");
   measurements.lazyDetailChunkRequests = lazyDetailChunkRequests;
   const writerState = await waitFor(
      () => evaluate(`(() => {
         const state = { library: typeof HanziWriter !== 'undefined', writer: !!ddWriter, fallback: !document.querySelector('#dd-canvas').hidden };
         return state.writer || state.fallback ? state : null;
      })()`),
      "Writer state unavailable",
   );
   assert(writerState.library, "Pinned local Hanzi Writer library did not load");
   assert(writerState.writer, "Pinned local Hanzi Writer did not initialize");
   await setValue("#dd-speed", "1.8");
   assert(await evaluate("db.settings.strokeSpeed === 1.8"), "Stroke speed was not saved");
   await click("#dd-anim");
   await click('[data-stroke-tab="practice"]');
   await waitFor(() => evaluate("!!ddWriter && ddWriterTarget?.id === 'dd-practice-target'"), "Practice writer did not initialize");
   await click("#dd-quiz");
   const writerNote = await evaluate("document.querySelector('#dd-note').textContent");
   assert(writerNote.length > 0, "Hanzi writer controls did not respond");
   record(
      "Hanzi animation, writing quiz, and speed",
      writerState.writer ? "live Hanzi Writer instance exercised at 1.8×" : "freehand fallback exercised at 1.8×",
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!!document.querySelector('#dq')"), "Search list did not return");

   await setValue("#dq", "新能源");
   await click(".search-submit");
   await waitFor(
      () => evaluate("!!document.querySelector('[data-entry-id=\"hsk:6:1466\"]')"),
      "Source-only HSK word was not searchable",
      30_000,
   );
   const sourceOnlySearch = await evaluate(`(() => {
      const item = document.querySelector('[data-entry-id="hsk:6:1466"]');
      return {
         text: item?.textContent,
         badge: item?.querySelector('[data-hsk-badge="6"]')?.textContent,
         status: item?.querySelector('.dict-english-reference')?.textContent,
      };
   })()`);
   assert(
      sourceOnlySearch.text.includes("new energy") && sourceOnlySearch.badge === "HSK 6" &&
         sourceOnlySearch.status.includes("Sens anglais de référence"),
      `Source-only HSK search result is incomplete: ${JSON.stringify(sourceOnlySearch)}`,
   );
   await click('[data-entry-id="hsk:6:1466"] .dict-result-primary');
   await waitFor(
      () => evaluate("document.querySelector('.dd-entry')?.dataset.entryId === 'hsk:6:1466'"),
      "Source-only HSK detail did not open",
   );
   const sourceOnlyDetail = await evaluate(`({
      badge: document.querySelector('.dd-entry [data-hsk-badge="6"]')?.textContent,
      translation: document.querySelector('.dd-hsk-source')?.textContent,
      pinyin: document.querySelector('.dd-entry .cd-py')?.textContent,
   })`);
   assert(
      sourceOnlyDetail.badge === "HSK 6" && sourceOnlyDetail.translation.includes("new energy") &&
         sourceOnlyDetail.pinyin.includes("xīnméngyuán") === false && sourceOnlyDetail.pinyin.includes("xīnnéngyuán"),
      `Source-only HSK detail is incomplete: ${JSON.stringify(sourceOnlyDetail)}`,
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!!document.querySelector('#dq')"), "HSK source detail did not return to search");
   assert(
      (await evaluate("JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units })")) ===
         learningStateBeforeHskDictionary,
      "HSK path, dictionary badges, or HSK source search changed cards, packs, favorites, or SRS fields",
   );
   record(
      "HSK dictionary integration",
      "linked HSK badge/detail and source-only search/detail passed without changing learning data",
   );

   await setValue("#dq", "红绿蓝");
   await click(".search-submit");
   await waitFor(() => evaluate("!!document.querySelector('#btn-seq')"), "Sequence action missing");
   await evaluate("ddStrokeTab = 'animation'");
   await click("#btn-seq");
   assert(await evaluate("seq && seq.chars.length === 3 && seq.index === 0"), "Sequence did not start");
   await waitFor(() => evaluate("!!document.querySelector('#seq-next')"), "Sequence entry did not load", 20_000);
   await click("#seq-next");
   assert(await evaluate("seq.index === 1"), "Sequence next navigation failed");
   await waitFor(() => evaluate("!!document.querySelector('#seq-flash')"), "Second sequence entry did not load", 20_000);
   await pointerGesture("#seq-flash", { deltaX: -120, deltaY: 2, pointerType: "touch" });
   await waitFor(() => evaluate("seq.index === 2"), "Sequence swipe navigation failed", 20_000);
   await waitFor(() => evaluate("!!document.querySelector('#seq-exit')"), "Third sequence entry did not load", 20_000);
   await click("#seq-exit");
   record("multi-character sequence", "shared chevrons and Pointer Events advanced three characters");

   const searchMatrix = await evaluate(`(async () => {
      const queries = [
         'ni', 'ni3', 'nǐ', '你', '你好', 'nv3', 'nu:3', 'nǚ',
         'lv4', 'lu:4', 'lü4', 'lǜ', 'tu', 'toi', 'bonjour', 'rouge',
         'apprendre', 'aardvark', '红绿蓝黑白灰棕', '紅', '', '   ', '...?!', '@', '你 ni3'
      ];
      const rows = [];
      for (const query of queries) {
         const response = await searchDictionary(query, { limit: 96 });
         rows.push({
            query,
            type: response.query.type,
            valid: response.query.valid,
            durationMs: response.durationMs,
            limited: response.limited,
            englishFallback: response.englishFallback,
            top: response.results.slice(0, 12).map((item) => ({
               id: item.entry.id,
               simplified: item.entry.simplified,
               traditional: item.entry.traditional,
               type: item.entry.entryType,
               pinyin: item.entry.pinyin.map((variant) => variant.marked),
               numbered: item.entry.pinyin.map((variant) => variant.numbered),
               hasFr: item.entry.definitionsFr.length > 0,
               hasEn: item.entry.definitionsEn.length > 0,
               personal: !!item.entry.personalCard,
            })),
         });
      }
      let stalePrevented = false;
      const first = searchDictionary('zhuang', { limit: 20 }).catch((error) => {
         stalePrevented = error instanceof StaleDictionarySearchError;
      });
      const latest = await searchDictionary('学校', { limit: 20 });
      await first;
      const duplicateResponse = await searchDictionary('还', { limit: 96 });
      const warmQueries = ['ni', 'ni3', 'nǐ', '你', '你好', 'nv3', 'nǚ', 'lv4', 'lǜ', 'tu', 'toi', 'bonjour', 'rouge', 'apprendre', 'aardvark', '紅'];
      const warmDurations = [];
      for (const query of warmQueries) {
         const response = await searchDictionary(query, { limit: 96 });
         warmDurations.push({ query, durationMs: response.durationMs });
      }
      return {
         rows,
         warmDurations,
         stalePrevented,
         latestTop: latest.results[0]?.entry.simplified,
         duplicatePinyin: Array.from(new Set(duplicateResponse.results
            .filter((item) => item.entry.simplified === '还')
            .flatMap((item) => item.entry.pinyin.map((variant) => variant.numbered)))),
      };
   })()`);
   const byQuery = new Map(searchMatrix.rows.map((row) => [row.query, row]));
   for (const query of ["ni", "ni3", "nǐ"])
      assert(byQuery.get(query).top.slice(0, 10).some((item) => item.simplified === "你"), `${query} did not rank 你 near the top`);
   assert(
      byQuery.get("你").top.some((item) => item.simplified === "你" && item.type === "character"),
      "Exact 你 character was not ranked near the top",
   );
   assert(byQuery.get("你").top.some((item) => item.simplified === "你" && item.personal), "Personal-card state was not attached to 你");
   assert(byQuery.get("你好").top[0].simplified === "你好", "Exact 你好 word was not first");
   assert(byQuery.get("紅").top[0].traditional === "紅", "Traditional exact lookup failed");
   assert(byQuery.get("rouge").top.slice(0, 12).some((item) => item.simplified === "红"), "rouge did not surface 红");
   assert(byQuery.get("tu").type === "translation" && byQuery.get("toi").type === "translation", "French words were misclassified as pinyin");
   for (const query of ["nv3", "nu:3", "nǚ", "lv4", "lu:4", "lü4", "lǜ", "bonjour", "rouge", "apprendre"])
      assert(byQuery.get(query).valid && byQuery.get(query).top.length > 0, `${query} returned no indexed result`);
   assert(
      byQuery.get("aardvark").englishFallback &&
         byQuery.get("aardvark").top.every((item) => !item.hasFr && item.hasEn),
      "English-only fallback was not clearly isolated",
   );
   assert(byQuery.get("红绿蓝黑白灰棕").type === "hanzi-sequence", "Hanzi sequence was not detected");
   for (const query of ["", "   ", "...?!", "@", "你 ni3"])
      assert(!byQuery.get(query).valid && byQuery.get(query).top.length === 0, `${JSON.stringify(query)} should be invalid or empty`);
   assert(byQuery.get("ni").limited, "Large pinyin result set was not bounded");
   assert(
      byQuery.get("ni3").top.every((item) =>
         item.numbered.some((variant) => variant.toLowerCase().includes("ni3")),
      ),
      "Unrelated translation-only results polluted the ni3 pinyin search",
   );
   assert(searchMatrix.stalePrevented && searchMatrix.latestTop === "学校", "Stale search prevention failed");
   assert(searchMatrix.duplicatePinyin.length >= 2, "Distinct pronunciations of a homograph were lost");
   const measured = searchMatrix.rows.filter((row) => row.valid).map((row) => row.durationMs);
   const averageSearchMs = measured.reduce((sum, value) => sum + value, 0) / measured.length;
   const slowestSearchMs = Math.max(...measured);
   const warmValues = searchMatrix.warmDurations.map((row) => row.durationMs);
   const warmAverageMs = warmValues.reduce((sum, value) => sum + value, 0) / warmValues.length;
   const warmSlowestMs = Math.max(...warmValues);
   measurements.search = {
      firstPassAverageMs: averageSearchMs,
      firstPassSlowestMs: slowestSearchMs,
      warmAverageMs,
      warmSlowestMs,
      rows: searchMatrix.rows,
   };
   record(
      "offline dictionary query matrix",
      `${searchMatrix.rows.length} first-pass queries avg ${averageSearchMs.toFixed(2)} ms, slowest ${slowestSearchMs.toFixed(2)} ms; fully warm avg ${warmAverageMs.toFixed(2)} ms, slowest ${warmSlowestMs.toFixed(2)} ms`,
   );

   await evaluate("launchDictionarySearch('ni')");
   await waitFor(() => evaluate("document.querySelectorAll('#dresults .dict-result').length === 32"), "Initial ni page did not render 32 results", 20_000);
   assert(await evaluate("!!document.querySelector('#dshow-more')"), "Large result set has no Afficher plus control");
   await click("#dshow-more");
   await waitFor(() => evaluate("document.querySelectorAll('#dresults .dict-result').length > 32"), "Afficher plus did not progressively render results");
   const progressiveRows = await evaluate("document.querySelectorAll('#dresults .dict-result').length");
   assert(progressiveRows <= 64, "Afficher plus rendered an unbounded result set");
   measurements.progressiveRows = progressiveRows;
   record("progressive search results", `ni rendered 32 rows initially, then ${progressiveRows} after Afficher plus`);

   await setValue("#dq", "ni3");
   await waitFor(() => evaluate("document.querySelectorAll('#dsearch-suggestions [role=option]').length > 0"), "Search suggestions did not appear", 20_000);
   const suggestionCount = await evaluate("document.querySelectorAll('#dsearch-suggestions [role=option]').length");
   assert(suggestionCount <= 6, "Too many suggestions rendered");
   assert(await evaluate("document.querySelector('#dq').getAttribute('role') === 'combobox'"), "Search input does not expose combobox semantics");
   assert(await evaluate("document.querySelector('#dq').getAttribute('aria-expanded') === 'true'"), "Suggestion state was not announced as expanded");
   await evaluate(`(() => {
      const input = document.querySelector('#dq');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
   })()`);
   assert(
      await evaluate("document.querySelector('#dq').getAttribute('aria-activedescendant') === 'dsearch-option-0'"),
      "Keyboard suggestion did not expose an active descendant",
   );
   await evaluate("document.querySelector('#dq').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
   assert(await evaluate("document.querySelector('#dsearch-suggestions').hidden"), "Escape did not close suggestions");
   assert(await evaluate("document.querySelector('#dq').getAttribute('aria-expanded') === 'false'"), "Closed suggestion state remained expanded");
   assert(!(await evaluate("document.querySelector('#dq-clear').hidden")), "Clear-field control is missing");
   await click("#dq-clear");
   assert((await evaluate("document.querySelector('#dq').value")) === "", "Clear-field control failed");
   record("search suggestions", `${suggestionCount} touch-sized suggestions; keyboard Escape and clear control passed`);

   await evaluate("launchDictionarySearch('你好')");
   await waitFor(() => evaluate("document.querySelector('#dresults .dict-result')?.textContent.includes('你好')"), "History test results missing", 20_000);
   await evaluate("window.scrollTo(0, Math.min(280, document.documentElement.scrollHeight - innerHeight))");
   const historyScroll = await evaluate("window.scrollY");
   await click("#dresults .dict-result-primary");
   await waitFor(() => evaluate("!!document.querySelector('#sheet .dd-entry')"), "History detail did not open", 20_000);
   await waitFor(
      () => evaluate("!document.hasFocus() || document.activeElement?.id === 'dd-close-top'"),
      "Dictionary detail close control did not receive focus",
      2_000,
   );
   const dialogState = await evaluate(`({
      activeId: document.activeElement?.id,
      documentFocused: document.hasFocus(),
      viewInert: document.querySelector('#view').inert,
      navInert: document.querySelector('.nav').inert,
      sheetHidden: document.querySelector('#sheet').getAttribute('aria-hidden'),
      sheetRole: document.querySelector('#sheet').getAttribute('role'),
      sheetName: document.querySelector('#sheet').getAttribute('aria-labelledby') ||
         document.querySelector('#sheet').getAttribute('aria-label')
   })`);
   assert(
         (!dialogState.documentFocused || dialogState.activeId === "dd-close-top") &&
         dialogState.viewInert && dialogState.navInert &&
         dialogState.sheetHidden === "false" && dialogState.sheetRole === "dialog" && dialogState.sheetName,
      `Dictionary dialog focus or isolation failed: ${JSON.stringify(dialogState)}`,
   );
   await assertNoDuplicateIds("Dictionary detail");
   const completeDetail = await evaluate(`({
      text: document.querySelector('#sheet').textContent,
      chips: document.querySelectorAll('#dd-picker .hzchip').length,
      numbered: document.querySelector('.dd-numbered')?.textContent,
      hasAudio: !!document.querySelector('#sheet [data-say]'),
      hasStroke: !!document.querySelector('#dd-target'),
      hasAdd: !!document.querySelector('#dd-addcard, #dd-manage'),
      focusId: document.activeElement?.id,
      backgroundInert: document.querySelector('#view').inert && document.querySelector('.nav').inert,
      topCloseSize: Math.min(
         document.querySelector('#dd-close-top').getBoundingClientRect().width,
         document.querySelector('#dd-close-top').getBoundingClientRect().height
      ),
      ordered: (() => {
         const article = document.querySelector('.dd-entry');
         const children = [...article.children];
         const position = (selector) => {
            const match = article.querySelector(selector);
            return children.findIndex((child) => child === match || child.contains(match));
         };
         const interaction = article.querySelector('#dd-character-interaction');
         const interactionChildren = interaction ? [...interaction.children] : [];
         const interactionPosition = (selector) => {
            const match = interaction?.querySelector(selector);
            return interactionChildren.findIndex((child) => child === match || child.contains(match));
         };
         return {
            definitions: position('.dd-definitions'),
            card: position('.dd-card-actions'),
            interaction: position('#dd-character-interaction'),
            sources: position('.dd-sources'),
            picker: interactionPosition('#dd-picker'),
            characterCard: interactionPosition('#dd-character-study-card'),
            navigation: interactionPosition('#dd-character-stage'),
            workspace: interactionPosition('.stroke-workspace'),
            related: position('#dd-related'),
         };
      })(),
   })`);
   assert(
      completeDetail.text.includes("Sens français") && completeDetail.text.includes("Sources du dictionnaire"),
      "Complete detail definitions or attribution missing",
   );
   assert(completeDetail.chips === 2 && completeDetail.numbered.includes("ni3 hao3"), "Word character chips or numbered pinyin missing");
   assert(completeDetail.hasAudio && completeDetail.hasStroke && completeDetail.hasAdd, "Detail audio, stroke, or add-card action missing");
   assert(completeDetail.backgroundInert, "Dictionary dialog background isolation failed");
   assert(Math.round(completeDetail.topCloseSize) >= 44, "Dictionary detail top close control is too small");
   assert(
      completeDetail.ordered.definitions < completeDetail.ordered.card &&
         completeDetail.ordered.card < completeDetail.ordered.interaction &&
         completeDetail.ordered.interaction < completeDetail.ordered.sources &&
         completeDetail.ordered.sources < completeDetail.ordered.related &&
         completeDetail.ordered.picker < completeDetail.ordered.characterCard &&
         completeDetail.ordered.characterCard < completeDetail.ordered.navigation &&
         completeDetail.ordered.navigation <= completeDetail.ordered.workspace,
      `Dictionary detail priority is wrong: ${JSON.stringify(completeDetail.ordered)}`,
   );
   await click('[data-stroke-tab="animation"]');
   await click("#dd-picker .hzchip:nth-child(2)");
   await waitFor(() => evaluate("ddChar === '好'"), "Selecting a character chip did not update the stroke area", 20_000);
   await evaluate("history.back()");
   await waitFor(() => evaluate("!sheetOpen() && !!document.querySelector('#dresults .dict-result')"), "Browser Back did not restore results", 20_000);
   assert((await evaluate("document.querySelector('#dq').value")) === "你好", "Browser Back lost the query");
   assert(Math.abs((await evaluate("window.scrollY")) - historyScroll) < 8, "Browser Back lost result scroll position");
   await evaluate("history.forward()");
   await waitFor(() => evaluate("!!document.querySelector('#sheet .dd-entry')"), "Browser Forward did not restore the entry", 20_000);
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "App Back did not restore results", 20_000);
   record("search history restoration", "query, list scroll, opened entry, Browser Back/Forward, and app Back passed");

   await evaluate("launchDictionarySearch('aardvark')");
   await waitFor(() => evaluate("!!document.querySelector('#dresults .dict-result')"), "English fallback UI result missing", 20_000);
   assert((await evaluate("document.querySelector('#dresults .dict-result').textContent")).includes("Sens anglais de référence"), "English fallback result was not labelled");
   await click("#dresults .dict-result-primary");
   await waitFor(() => evaluate("!!document.querySelector('#sheet .dd-entry')"), "English fallback detail missing", 20_000);
   assert((await evaluate("document.querySelector('#sheet').textContent")).includes("Traduction française indisponible") &&
      (await evaluate("document.querySelector('#sheet').textContent")).includes("Sens anglais de référence"), "English fallback detail was not labelled");
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "English fallback detail did not close", 20_000);
   await evaluate("launchDictionarySearch('你')");
   await waitFor(() => evaluate("!!document.querySelector('#dresults .dict-result')"), "Personal-card dictionary result missing", 20_000);
   assert((await evaluate("document.querySelector('#dresults .dict-result').textContent")).includes("Mes mots"), "Personal-word result badge missing");
   await click("#dresults .dict-result-primary");
   await waitFor(() => evaluate("!!document.querySelector('#dd-manage')"), "Edit/manage personal-card action missing", 20_000);
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "Personal-card detail did not close", 20_000);
   record("complete dictionary detail", "definitions, sources, audio, add-card state, pinyin, character chips, strokes, and labelled English fallback passed");

   const personalLearningBeforeTargetedFixes = await evaluate(
      "JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units })",
   );
   await evaluate(`(() => {
      window.__strokeWriterAudit = { creates: [], animations: [] };
      const originalCreate = HanziWriter.create.bind(HanziWriter);
      HanziWriter.create = (target, character, options) => {
         const writer = originalCreate(target, character, options);
         window.__strokeWriterAudit.creates.push({ character, target: target.id });
         const originalAnimate = writer.animateCharacter.bind(writer);
         writer.animateCharacter = (...args) => {
            window.__strokeWriterAudit.animations.push({ character, target: target.id });
            return originalAnimate(...args);
         };
         return writer;
      };
      ddStrokeTab = 'animation';
   })()`);
   await evaluate("launchDictionarySearch('你')");
   await waitFor(() => evaluate("!!document.querySelector('#dresults .dict-result')"), "你 search failed", 20_000);
   await click("#dresults .dict-result-primary");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '你' && ddCharacterData.strokeCount === 7 && window.__strokeWriterAudit.animations.length === 1"),
      "Real 你 stroke data did not load",
      20_000,
   );
   const firstAutoplay = await evaluate(`(() => ({
      animations: window.__strokeWriterAudit.animations.slice(),
      writerTarget: ddWriterTarget?.id,
      animationSvgs: document.querySelectorAll('#dd-target svg').length,
      workspaces: document.querySelectorAll('.stroke-workspace').length,
      note: document.querySelector('#dd-note').textContent,
   }))()`);
   assert(
      firstAutoplay.animations.length === 1 && firstAutoplay.animations[0].character === "你" &&
         firstAutoplay.writerTarget === "dd-target" && firstAutoplay.animationSvgs === 1 &&
         firstAutoplay.workspaces === 1 && firstAutoplay.note.includes("Lecture automatique"),
      `Initial 你 autoplay or writer uniqueness failed: ${JSON.stringify(firstAutoplay)}`,
   );
   await setValue("#dd-speed", "1.35");
   await evaluate("document.querySelector('#dd-speed').dispatchEvent(new Event('change', { bubbles: true }))");
   await waitFor(() => evaluate("!!ddWriter && document.querySelectorAll('#dd-target svg').length === 1"), "Speed recreation did not leave one writer");
   assert(
      (await evaluate("window.__strokeWriterAudit.animations.length")) === 1,
      "Changing stroke speed restarted autoplay",
   );
   await click("#dd-anim");
   await waitFor(
      () => evaluate("window.__strokeWriterAudit.animations.length === 2"),
      "Manual Rejouer did not animate",
   );
   await click('[data-stroke-tab="steps"]');
   await waitFor(
      () => evaluate("document.querySelectorAll('#dd-gallery .stroke-panel[data-rendered=true]').length === 7"),
      "Seven 你 panels were not rendered",
      20_000,
   );
   const niGallery = await evaluate(`(() => ({
      source: ddCharacterData.sourcePackage + '@' + ddCharacterData.sourceVersion,
      count: ddCharacterData.strokeCount,
      medians: ddCharacterData.medians.length,
      grid: (() => {
         const panel = document.querySelector('#dd-gallery .stroke-panel');
         const border = panel.querySelector('.stroke-grid-border');
         const center = panel.querySelector('.stroke-grid-center');
         const diagonal = panel.querySelector('.stroke-grid-diagonal');
         const style = (element) => {
            const computed = getComputedStyle(element);
            return { opacity: Number(computed.opacity), width: parseFloat(computed.strokeWidth) };
         };
         return { border: style(border), center: style(center), diagonal: style(diagonal) };
      })(),
      panels: [...document.querySelectorAll('#dd-gallery .stroke-panel')].map((panel, panelIndex) => ({
         completed: panel.querySelectorAll('.stroke-complete').length,
         current: panel.querySelectorAll('.stroke-current').length,
         future: panel.querySelectorAll('.stroke-future').length,
         indexes: [...panel.querySelectorAll('[data-path-index]')].map((path) => Number(path.dataset.pathIndex)),
         currentFill: getComputedStyle(panel.querySelector('.stroke-current')).fill,
         label: panel.querySelector('.stroke-panel-label').textContent,
         panelIndex,
      })),
   }))()`);
   assert(niGallery.source === "hanzi-writer-data@2.0.1", "Unpinned 你 stroke source");
   assert(niGallery.count === 7 && niGallery.medians === 7 && niGallery.panels.length === 7, "Incorrect real 你 stroke count");
   assert(
      niGallery.grid.border.width <= 1.1 && niGallery.grid.border.opacity <= 0.4 &&
         niGallery.grid.center.width < 1 && niGallery.grid.center.opacity <= 0.3 &&
         niGallery.grid.diagonal.width < niGallery.grid.center.width &&
         niGallery.grid.diagonal.opacity < niGallery.grid.center.opacity,
      `Stroke gallery grid is still too strong: ${JSON.stringify(niGallery.grid)}`,
   );
   niGallery.panels.forEach((panel, index) => {
      assert(panel.completed === index, `你 panel ${index + 1} lost completed strokes`);
      assert(panel.current === 1, `你 panel ${index + 1} does not have exactly one red stroke`);
      assert(panel.future === 6 - index, `你 panel ${index + 1} has incorrect future strokes`);
      assert(panel.indexes.join(",") === "0,1,2,3,4,5,6", `你 panel ${index + 1} duplicates or omits a path`);
      assert(panel.currentFill === "rgb(166, 37, 32)", `你 panel ${index + 1} current stroke is not lacquer red`);
      assert(panel.label === `Trait ${index + 1} sur 7`, `你 panel ${index + 1} accessible label is wrong`);
   });
   assert(niGallery.panels[6].completed === 6 && niGallery.panels[6].future === 0, "Final 你 panel is incomplete");
   await click('#dd-gallery .stroke-panel[data-stroke-index="2"]');
   assert(await evaluate("document.querySelector('.stroke-focus-title').textContent.includes('Trait 3 sur 7')"), "Focused stroke viewer did not open");
   assert(await evaluate("document.querySelector('#sheet').inert"), "Focused stroke viewer did not isolate the underlying dictionary dialog");
   await assertNoDuplicateIds("Enlarged stroke viewer");
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
   assert(await evaluate("document.querySelector('.stroke-focus-title').textContent.includes('Trait 4 sur 7')"), "Focused viewer ArrowRight failed");
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
   assert(!(await evaluate("!!document.querySelector('.stroke-focus')")), "Focused viewer Escape failed");
   assert(!(await evaluate("document.querySelector('#sheet').inert")), "Closing the focused stroke viewer did not restore the dictionary dialog");
   const gallerySettingsSafety = await evaluate(`(() => {
      const cardsBefore = JSON.stringify(db.cards);
      const future = document.querySelector('#dd-show-future');
      const hasHandler = typeof future.onchange;
      future.checked = false;
      future.dispatchEvent(new Event('change', { bubbles: true }));
      const hiddenFutureCount = document.querySelectorAll('#dd-gallery .stroke-future').length;
      const stored = JSON.parse(localStorage.getItem(DB_KEY)).settings.strokeGallery;
      future.checked = true;
      future.dispatchEvent(new Event('change', { bubbles: true }));
      return { cardsUnchanged: cardsBefore === JSON.stringify(db.cards), hiddenFutureCount, stored, hasHandler };
   })()`);
   assert(gallerySettingsSafety.cardsUnchanged, "Gallery settings changed personal cards");
   assert(
      gallerySettingsSafety.hiddenFutureCount === 0 && gallerySettingsSafety.stored.showFuture === false,
      `Future-stroke setting did not persist safely: ${JSON.stringify(gallerySettingsSafety)}`,
   );
   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 780,
      deviceScaleFactor: 1,
      mobile: true,
   });
   await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
   const galleryRect = await evaluate(`(() => {
      const gallery = document.querySelector('#dd-gallery');
      gallery.scrollIntoView({ block: 'center' });
      gallery.scrollLeft = 0;
      const rect = gallery.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
   })()`);
   const touchY = Math.max(80, Math.min(700, (galleryRect.top + galleryRect.bottom) / 2));
   const touchStartX = Math.min(335, galleryRect.right - 20);
   await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: touchStartX, y: touchY, id: 1 }],
   });
   for (const x of [280, 230, 180, 130, 80]) {
      await cdp.send("Input.dispatchTouchEvent", {
         type: "touchMove",
         touchPoints: [{ x, y: touchY, id: 1 }],
      });
   }
   await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
   await new Promise((resolve) => setTimeout(resolve, 500));
   assert((await evaluate("document.querySelector('#dd-gallery').scrollLeft")) > 20, "Mobile gallery swipe did not scroll");
   const mobileGalleryScreenshot = path.join(screenshotDirectory, "stroke-gallery-ni-360.png");
   const mobileGalleryImage = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
   await writeFile(mobileGalleryScreenshot, Buffer.from(mobileGalleryImage.data, "base64"));
   await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
   for (const width of [430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width,
         height: 900,
         deviceScaleFactor: 1,
         mobile: width <= 430,
      });
      await evaluate("document.querySelector('#dd-gallery').scrollIntoView({ block: 'center' })");
      const image = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      await writeFile(
         path.join(screenshotDirectory, `stroke-gallery-ni-${width}.png`),
         Buffer.from(image.data, "base64"),
      );
   }
   for (const sample of [
      { character: "红", name: "hong" },
      { character: "蓝", name: "lan" },
   ]) {
      await evaluate(`loadDDChar(${JSON.stringify(sample.character)}, ['红', '蓝'])`);
      await waitFor(
         () => evaluate(`ddCharacterData?.character === ${JSON.stringify(sample.character)} && document.querySelectorAll('#dd-gallery .stroke-current').length > 0`),
         `${sample.character} gallery did not render`,
         20_000,
      );
      for (const width of [360, 430, 1024]) {
         await cdp.send("Emulation.setDeviceMetricsOverride", {
            width,
            height: 900,
            deviceScaleFactor: 1,
            mobile: width <= 430,
         });
         await evaluate(`(() => {
            const gallery = document.querySelector('#dd-gallery');
            gallery.scrollLeft = 0;
            gallery.scrollIntoView({ block: 'center' });
            gallery.dispatchEvent(new Event('scroll'));
         })()`);
         const sampleStyles = await evaluate(`(() => {
            const panel = document.querySelector('#dd-gallery .stroke-panel');
            return {
               current: getComputedStyle(panel.querySelector('.stroke-current')).fill,
               centerOpacity: Number(getComputedStyle(panel.querySelector('.stroke-grid-center')).opacity),
               diagonalOpacity: Number(getComputedStyle(panel.querySelector('.stroke-grid-diagonal')).opacity),
               overflow: document.documentElement.scrollWidth > innerWidth,
            };
         })()`);
         assert(
            sampleStyles.current === "rgb(166, 37, 32)" &&
               sampleStyles.diagonalOpacity < sampleStyles.centerOpacity && !sampleStyles.overflow,
            `${sample.character} gallery styles failed at ${width}px: ${JSON.stringify(sampleStyles)}`,
         );
         const image = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
         await writeFile(
            path.join(screenshotDirectory, `stroke-gallery-${sample.name}-${width}.png`),
            Buffer.from(image.data, "base64"),
         );
      }
   }
   record("cumulative 你 gallery", "7 real panels; cumulative black/red/grey paths, labels, final character, focus and keyboard navigation passed");
   record("subtle stroke-gallery grid", `你, 红 and 蓝 passed at 360px, 430px and 1024px; screenshots captured in ${screenshotDirectory}`);
   record("stroke-gallery mobile swipe", "360px touch swipe advanced the gallery");

   const loaderCoverage = await evaluate(`(async () => {
      const supported = {};
      for (const character of ['一', '人', '你', '好', '谢', '龍', '鬱']) {
         const data = await loadStrokeCharacterData(character);
         supported[character] = { count: data.strokeCount, medians: data.medians.length };
      }
      await invalidateStrokeCharacterData('人');
      const first = loadStrokeCharacterData('人');
      const second = loadStrokeCharacterData('人');
      const deduplicated = first === second;
      await Promise.all([first, second]);
      let missingRejected = false;
      const originalFetch = window.fetch;
      window.fetch = (url, options) => String(url).includes(encodeURIComponent('𰻞'))
         ? Promise.resolve(new Response('', { status: 404 }))
         : originalFetch(url, options);
      try { await loadStrokeCharacterData('𰻞', { reload: true }); }
      catch (error) { missingRejected = error instanceof StrokeCharacterDataError; }
      finally { window.fetch = originalFetch; }
      return { supported, deduplicated, missingRejected };
   })()`);
   assert(loaderCoverage.supported["一"].count === 1, "一 real stroke count is wrong");
   assert(loaderCoverage.supported["人"].count === 2, "人 real stroke count is wrong");
   assert(loaderCoverage.supported["你"].count === 7 && loaderCoverage.supported["好"].count === 6, "你 or 好 real stroke count is wrong");
   assert(loaderCoverage.supported["龍"].count > 0, "Traditional 龍 data is unsupported");
   assert(loaderCoverage.supported["鬱"].count > 20, "High-stroke 鬱 data was not exercised");
   assert(loaderCoverage.deduplicated, "Simultaneous character-data requests were duplicated");
   assert(loaderCoverage.missingRejected, "Missing character data received a fabricated fallback");
   record("local character-data loader", "一, 人, 你, 好, 谢, 龍 and high-stroke 鬱 loaded; concurrent request deduplication and missing-data rejection passed");
   const highStrokeRender = await evaluate(`(async () => {
      const data = await loadStrokeCharacterData('鬱');
      const startedAt = performance.now();
      renderStrokeGallery(data);
      return {
         durationMs: performance.now() - startedAt,
         strokeCount: data.strokeCount,
         panels: document.querySelectorAll('#dd-gallery .stroke-panel').length,
         materialized: document.querySelectorAll('#dd-gallery .stroke-panel[data-rendered=true]').length,
      };
   })()`);
   assert(highStrokeRender.panels === highStrokeRender.strokeCount, "High-stroke panel count is incomplete");
   assert(highStrokeRender.materialized < highStrokeRender.panels, "High-stroke gallery did not lazy-render offscreen SVGs");
   assert(highStrokeRender.durationMs < 250, "High-stroke gallery shell render was too slow");
   record(
      "high-stroke gallery performance",
      `鬱: ${highStrokeRender.strokeCount} panels, ${highStrokeRender.materialized} initial SVGs in ${highStrokeRender.durationMs.toFixed(2)} ms`,
   );

   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "你 detail did not close", 20_000);
   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
   });
   const wordAnimationStart = await evaluate("window.__strokeWriterAudit.animations.length");
   await evaluate("ddStrokeTab = 'animation'");
   await evaluate("launchDictionarySearch('你好')");
   await waitFor(() => evaluate("!!document.querySelector('#dresults .dict-result')"), "你好 search failed", 20_000);
   await click("#dresults .dict-result-primary");
   await waitFor(
      () => evaluate(`ddCharacterData?.character === '你' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 1}`),
      "你好 first character did not autoplay",
      20_000,
   );
   await waitFor(
      () => evaluate("document.querySelector('#dd-character-study-card')?.getAttribute('aria-busy') === 'false'"),
      "你好 active-character card did not load",
      20_000,
   );
   const initialWordNavigation = await evaluate(`(() => {
      const previous = document.querySelector('#dd-character-prev');
      const next = document.querySelector('#dd-character-next');
      const nav = document.querySelector('#dd-character-stage').getBoundingClientRect();
      const previousRect = previous.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      const studyCard = document.querySelector('#dd-character-study-card');
      const studyCardRect = studyCard.getBoundingClientRect();
      return {
         position: document.querySelector('#dd-character-position').textContent.trim(),
         previousDisabled: previous.disabled,
         nextDisabled: next.disabled,
         previousLabel: previous.getAttribute('aria-label'),
         nextLabel: next.getAttribute('aria-label'),
         positionLive: document.querySelector('#dd-character-position').getAttribute('aria-live'),
         currentChip: document.querySelector('#dd-picker [aria-current=true]')?.textContent,
         previousSize: [previousRect.width, previousRect.height],
         nextSize: [nextRect.width, nextRect.height],
         edgeInsets: [Math.abs(previousRect.left - studyCardRect.left), Math.abs(nextRect.right - studyCardRect.right)],
         insideViewport: nav.left >= 0 && nav.right <= innerWidth,
         noOverflow: document.querySelector('.sheet-card').scrollWidth <= document.querySelector('.sheet-card').clientWidth,
         studyCharacter: document.querySelector('.dd-character-study-hanzi')?.textContent.trim(),
         studyPinyin: document.querySelector('.dd-character-study-pinyin')?.textContent.trim(),
         studyTranslation: document.querySelector('.dd-character-study-translation')?.textContent.trim(),
         studyAudio: document.querySelector('.dd-character-audio')?.getAttribute('data-say'),
         cardActionReady: !!document.querySelector('#dd-character-manage') ||
            !!document.querySelector('#dd-character-addcard')?.dataset.entryId,
         navigationSvgCount: document.querySelectorAll('#dd-character-stage > .character-nav-button svg').length,
         definitionSelectable: getComputedStyle(document.querySelector('.dd-definitions')).userSelect !== 'none',
         gestureCardUnselectable: getComputedStyle(studyCard).userSelect === 'none',
         translationSelectable: getComputedStyle(document.querySelector('.dd-character-study-translation')).userSelect !== 'none',
         tabsUnselectable: getComputedStyle(document.querySelector('.stroke-tabs')).userSelect === 'none',
         pickerUnselectable: getComputedStyle(document.querySelector('#dd-picker')).userSelect === 'none',
         nativeDragPrevented: !document.querySelector('#dd-character-interaction').dispatchEvent(
            new DragEvent('dragstart', { bubbles: true, cancelable: true })
         ),
      };
   })()`);
   assert(
      initialWordNavigation.position === "你 · 1 / 2" && initialWordNavigation.previousDisabled &&
         !initialWordNavigation.nextDisabled && initialWordNavigation.currentChip === "你" &&
         initialWordNavigation.previousLabel === "Caractère précédent" &&
         initialWordNavigation.nextLabel === "Caractère suivant" && initialWordNavigation.positionLive === "polite" &&
         initialWordNavigation.studyCharacter === "你" && initialWordNavigation.studyPinyin &&
         initialWordNavigation.studyTranslation && initialWordNavigation.studyAudio === "你" &&
         initialWordNavigation.cardActionReady && initialWordNavigation.navigationSvgCount === 2 &&
         initialWordNavigation.definitionSelectable && initialWordNavigation.gestureCardUnselectable &&
         initialWordNavigation.translationSelectable &&
         initialWordNavigation.tabsUnselectable && initialWordNavigation.pickerUnselectable &&
         initialWordNavigation.nativeDragPrevented,
      `你好 initial character navigation is wrong: ${JSON.stringify(initialWordNavigation)}`,
   );
   assert(
         initialWordNavigation.previousSize.every((size) => size >= 44) &&
         initialWordNavigation.nextSize.every((size) => size >= 44) &&
         initialWordNavigation.edgeInsets.every((inset) => inset <= 18) &&
         initialWordNavigation.insideViewport && initialWordNavigation.noOverflow,
      `你好 character controls are not usable at 360px: ${JSON.stringify(initialWordNavigation)}`,
   );

   await mouseDrag(".dd-character-study-hanzi", -155, 2);
   await waitFor(
      () => evaluate(`ddChar === '好' && ddCharacterData?.strokeCount === 6 && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 2} && document.querySelector('#dd-character-study-card')?.getAttribute('aria-busy') === 'false' && document.querySelector('.dd-character-study-hanzi')?.textContent.trim() === '好'`),
      "你好 mouse drag started on the large character did not load 好",
      20_000,
   );
   assert(
      await evaluate("document.querySelector('#dd-character-position').textContent.trim() === '好 · 2 / 2' && !document.querySelector('#dd-character-prev').disabled && document.querySelector('#dd-character-next').disabled && document.querySelector('#dd-picker [aria-current=true]').textContent === '好'"),
      "你好 last-character controls are wrong",
   );
   assert(
      await evaluate("document.querySelector('.dd-character-audio').getAttribute('data-say') === '好' && document.querySelector('.dd-character-study-pinyin').textContent.trim() && document.querySelector('.dd-character-study-translation').textContent.trim() && (!!document.querySelector('#dd-character-manage') || !!document.querySelector('#dd-character-addcard')?.dataset.entryId)"),
      "你好 Next did not refresh active-character pinyin, translation, or audio",
   );
   await waitFor(
      () => evaluate("document.querySelector('#dd-related')?.getAttribute('aria-busy') === 'false'"),
      "好 related words did not reload",
      20_000,
   );
   assert(
      await evaluate("[...document.querySelectorAll('#dd-related [data-related]')].every((button) => button.textContent.includes('好'))"),
      "好 related words contain stale 你 results",
   );

   await mouseClick("#dd-character-prev");
   await waitFor(
      () => evaluate(`ddChar === '你' && ddCharacterData?.character === '你' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 3}`),
      "你好 Previous did not return to 你",
      20_000,
   );
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
   await waitFor(
      () => evaluate(`ddChar === '好' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 4}`),
      "你好 keyboard ArrowRight failed",
      20_000,
   );
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
   await waitFor(
      () => evaluate(`ddChar === '你' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 5}`),
      "你好 keyboard ArrowLeft failed",
      20_000,
   );
   assert(
      await evaluate(`(() => {
         const input = document.querySelector('#dd-speed');
         input.focus({ preventScroll: true });
         input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
         const inputPreserved = ddChar === '你';
         const textarea = document.createElement('textarea');
         document.querySelector('.dd-entry').append(textarea);
         textarea.focus({ preventScroll: true });
         textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
         const textareaPreserved = ddChar === '你';
         textarea.remove();
         return inputPreserved && textareaPreserved;
      })()`),
      "Dictionary character navigation intercepted ArrowRight from an input or textarea",
   );

   await mouseClick("#dd-picker .hzchip:nth-child(2)");
   await waitFor(
      () => evaluate(`ddChar === '好' && ddCharacterData?.character === '好' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 6}`),
      "你好 character-chip selection failed",
      20_000,
   );
   const dictionarySwipeRight = await pointerGesture(".dd-character-study-card", {
      deltaX: 38,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 51,
   });
   await waitFor(
      () => evaluate(`ddChar === '你' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 7}`),
      "你好 mobile swipe right failed",
      20_000,
   );
   const dictionarySwipeLeft = await pointerGesture(".dd-character-study-hanzi", {
      deltaX: -38,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 52,
   });
   await waitFor(
      () => evaluate(`ddChar === '好' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 8}`),
      "你好 mobile swipe left failed",
      20_000,
   );
   const simpleDictionaryTap = await pointerGesture(".dd-character-study-hanzi", {
      deltaX: 0,
      deltaY: 0,
      pointerType: "touch",
      pointerId: 50,
   });
   const smallDictionaryGesture = await pointerGesture(".dd-character-study-card", {
      deltaX: 10,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 53,
   });
   await new Promise((resolve) => setTimeout(resolve, 120));
   assert(
      (await evaluate("ddChar === '好'")) && dictionarySwipeRight.selection === "" &&
         dictionarySwipeLeft.selection === "" && simpleDictionaryTap.selection === "" &&
         smallDictionaryGesture.selection === "" &&
         (await evaluate("window.getSelection().toString() === ''")),
      "Dictionary swipe selected text or a tap/small movement changed character",
   );
   const verticalDictionaryGesture = await pointerGesture("#dd-character-interaction", {
      deltaX: 5,
      deltaY: 130,
      pointerType: "touch",
      pointerId: 54,
   });
   assert(
      verticalDictionaryGesture.results.every(Boolean) &&
         (await evaluate("ddChar === '好' && getComputedStyle(document.querySelector('#dd-character-interaction')).touchAction === 'pan-y'")),
      "Dictionary swipe blocked a vertical mobile gesture",
   );
   const dictionaryTouchScrollTop = await touchScrollContainer(
      ".dd-character-study-hanzi",
      ".sheet-card",
      150,
   );
   assert(
      dictionaryTouchScrollTop > 0 && (await evaluate("ddChar === '好'")),
      `A vertical touch begun on the character did not scroll the sheet: ${dictionaryTouchScrollTop}`,
   );
   const animationGridSwipe = await pointerGesture("#dd-target", {
      deltaX: 40,
      deltaY: 2,
      pointerType: "pen",
      pointerId: 55,
   });
   await waitFor(
      () => evaluate(`ddChar === '你' && window.__strokeWriterAudit.animations.length === ${wordAnimationStart + 9}`),
      "你好 stylus swipe started on the animation grid failed",
      20_000,
   );
   const animationModePagingCount = await evaluate("window.__strokeWriterAudit.animations.length");
   assert(
      animationGridSwipe.selection === "" && (await evaluate("window.getSelection().toString() === ''")),
      "Animation-grid swipe left an accidental text selection",
   );
   await evaluate("document.querySelector('.sheet-card').scrollTop = 0");
   await new Promise((resolve) => setTimeout(resolve, 120));
   const characterNavigationScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
   await writeFile(
      path.join(screenshotDirectory, "dictionary-character-navigation-360.png"),
      Buffer.from(characterNavigationScreenshot.data, "base64"),
   );
   assert(
      await evaluate("document.querySelectorAll('#dd-target svg').length === 1 && ddWriterTarget?.id === 'dd-target'"),
      "你好 character switch created duplicate animation writers",
   );
   await click('[data-stroke-tab="steps"]');
   await click("#dd-picker .hzchip:nth-child(1)");
   await waitFor(
      () => evaluate("ddChar === '你' && document.querySelectorAll('#dd-gallery .stroke-panel').length === 7"),
      "你好 first-character gallery switch failed",
      20_000,
   );
   await click("#dd-picker .hzchip:nth-child(2)");
   await waitFor(
      () => evaluate("ddChar === '好' && ddCharacterData?.strokeCount === 6 && document.querySelectorAll('#dd-gallery .stroke-panel').length === 6"),
      "你好 character-chip gallery switch failed",
      20_000,
   );
   await pointerGesture("#dd-gallery .stroke-panel", {
      deltaX: 38,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 56,
   });
   await waitFor(
      () => evaluate("ddChar === '你' && document.querySelectorAll('#dd-gallery .stroke-panel').length === 7"),
      "Étapes swipe did not return to 你",
      20_000,
   );
   await click("#dd-picker .hzchip:nth-child(1)");
   await waitFor(() => evaluate("ddChar === '你'"), "Étapes character chip did not return to 你", 20_000);
   await click("#dd-character-next");
   await waitFor(() => evaluate("ddChar === '好'"), "Étapes chevron did not advance to 好", 20_000);
   assert(await evaluate("document.querySelector('[data-stroke-tab=steps]').getAttribute('aria-selected') === 'true'"), "Character switch lost the selected stroke tab");
   await click('[data-stroke-tab="practice"]');
   const practicePagingState = await evaluate(`({
      locked: document.querySelector('#dd-character-interaction').classList.contains('is-practice-paging-locked'),
      chipsDisabled: [...document.querySelectorAll('#dd-picker .hzchip')].every((button) => button.disabled && button.getAttribute('aria-disabled') === 'true'),
      writerCount: document.querySelectorAll('#dd-practice-target svg').length,
      character: ddChar,
   })`);
   assert(
      practicePagingState.locked && practicePagingState.chipsDisabled &&
         practicePagingState.writerCount === 1 && practicePagingState.character === "好",
      `S'entraîner did not lock non-chevron paging: ${JSON.stringify(practicePagingState)}`,
   );
   const practiceSwipe = await pointerGesture("#dd-practice-target", {
      deltaX: 155,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 57,
   });
   const practiceTrace = await pointerGesture("#dd-practice-target", {
      deltaX: 34,
      deltaY: 48,
      pointerType: "pen",
      pointerId: 58,
   });
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
   await click("#dd-picker .hzchip:nth-child(1)");
   await new Promise((resolve) => setTimeout(resolve, 160));
   assert(
      (await evaluate("ddChar === '好' && document.querySelectorAll('#dd-practice-target svg').length === 1")) &&
         practiceSwipe.selection === "" && practiceTrace.selection === "",
      "S'entraîner interpreted swipe, keyboard, chip, or tracing input as character navigation",
   );
   await click("#dd-character-prev");
   await waitFor(
      () => evaluate("ddChar === '你' && ddCharacterData?.character === '你' && ddWriterTarget?.id === 'dd-practice-target'"),
      "你好 Previous did not reload practice for 你",
      20_000,
   );
   await click("#dd-character-next");
   await waitFor(
      () => evaluate("ddChar === '好' && ddCharacterData?.character === '好' && ddWriterTarget?.id === 'dd-practice-target'"),
      "你好 Next did not reload practice for 好",
      20_000,
   );
   await click('[data-stroke-tab="animation"]');
   await waitFor(
      () => evaluate(`window.__strokeWriterAudit.animations.length === ${animationModePagingCount + 1}`),
      "Pending selected-character autoplay did not start on the Animation tab",
   );
   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
   });
   const rapidAnimationStart = await evaluate("window.__strokeWriterAudit.animations.length");
   const rapidSwitch = await evaluate(`(async () => {
      loadDDChar('你', ['你', '好', '谢']);
      loadDDChar('好', ['你', '好', '谢']);
      await loadDDChar('谢', ['你', '好', '谢']);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
         character: ddChar,
         dataCharacter: ddCharacterData?.character,
         workspaces: document.querySelectorAll('.stroke-workspace').length,
         writerSvgs: document.querySelectorAll('#dd-target svg').length,
         animations: window.__strokeWriterAudit.animations.slice(${rapidAnimationStart}),
      };
   })()`);
   assert(
      rapidSwitch.character === "谢" && rapidSwitch.dataCharacter === "谢" &&
         rapidSwitch.workspaces === 1 && rapidSwitch.writerSvgs === 1 &&
         rapidSwitch.animations.length === 1 && rapidSwitch.animations[0].character === "谢",
      `Rapid switching left stale character or autoplay state: ${JSON.stringify(rapidSwitch)}`,
   );
   record("multi-character stroke tabs and autoplay", "你好 autoplayed each selection once, preserved Étapes, and rapid switching animated only the final 谢 writer");

   await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
   });
   const reducedAnimationStart = await evaluate("window.__strokeWriterAudit.animations.length");
   await evaluate("loadDDChar('好', ['你', '好', '谢'])");
   await waitFor(() => evaluate("document.querySelector('#dd-note')?.textContent.includes('aucune lecture automatique')"), "Reduced-motion state missing", 20_000);
   assert(
      await evaluate(`window.__strokeWriterAudit.animations.length === ${reducedAnimationStart} && document.querySelectorAll('#dd-target svg').length === 1`),
      "Reduced motion autoplayed or duplicated the writer",
   );
   await cdp.send("Emulation.setEmulatedMedia", { features: [] });
   await click('[data-stroke-tab="practice"]');
   await click("#dd-quiz");
   for (let index = 0; index < 4; index++) await click("#dd-clear");
   assert((await evaluate("document.querySelectorAll('#dd-practice-target svg').length")) === 1, "Practice recreation leaked writer SVGs");
   record("stroke motion and practice lifecycle", "reduced-motion prevented autoplay messaging; repeated quiz reset kept one writer surface");

   const strokeOffline = await evaluate(`(async () => {
      await loadStrokeCharacterData('你');
      const cache = await caches.open(STROKE_DATA_CACHE_NAME);
      await cache.put(strokeCharacterDataUrl('你'), new Response('{broken-json', {
         headers: { 'Content-Type': 'application/json' },
      }));
      strokeCharacterCache.delete('你');
      const recoveredCount = (await loadStrokeCharacterData('你')).strokeCount;
      strokeCharacterCache.delete('你');
      const originalFetch = window.fetch;
      window.fetch = () => Promise.reject(new TypeError('simulated offline'));
      try { return { recoveredCount, offlineCount: (await loadStrokeCharacterData('你')).strokeCount }; }
      finally { window.fetch = originalFetch; }
   })()`);
   assert(strokeOffline.recoveredCount === 7, "Corrupted 你 stroke cache did not recover");
   assert(strokeOffline.offlineCount === 7, "Cached 你 stroke data did not reopen offline");
   record("offline stroke cache", "corrupted cache recovered, then cached 你 reopened with seven real strokes while fetch was disabled");

   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "你好 detail did not close", 20_000);
   await evaluate("ddStrokeTab = 'animation'; openDictDetail(normalizeDetailEntry({ hz: '你好吗', py: 'nǐ hǎo ma', fr: 'comment vas-tu ?' }))");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '你' && document.querySelectorAll('#dd-picker .hzchip').length === 3"),
      "你好吗 dictionary detail did not load",
      20_000,
   );
   assert(
      await evaluate("document.querySelector('#dd-character-prev').disabled && !document.querySelector('#dd-character-next').disabled && document.querySelector('#dd-character-position').textContent.trim() === '你 · 1 / 3'"),
      "你好吗 initial chevron state is wrong",
   );
   await click("#dd-character-prev");
   assert(await evaluate("ddChar === '你'"), "Disabled 你好吗 previous chevron changed character");
   await click("#dd-character-next");
   await waitFor(() => evaluate("ddChar === '好'"), "你好吗 did not advance to 好", 20_000);
   await click("#dd-character-next");
   await waitFor(
      () => evaluate("ddChar === '吗' && document.querySelector('#dd-character-next').disabled && !document.querySelector('#dd-character-prev').disabled"),
      "你好吗 final chevron state is wrong",
      20_000,
   );
   await click("#dd-character-next");
   assert(await evaluate("ddChar === '吗'"), "Disabled 你好吗 next chevron changed character");
   await pointerGesture(".dd-character-study-hanzi", {
      deltaX: 155,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 59,
   });
   await waitFor(() => evaluate("ddChar === '好'"), "你好吗 reverse swipe did not return to 好", 20_000);
   await pointerGesture(".dd-character-study-card", {
      deltaX: 155,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 60,
   });
   await waitFor(
      () => evaluate("ddChar === '你' && document.querySelector('#dd-character-prev').disabled && !document.querySelector('#dd-character-next').disabled"),
      "你好吗 reverse navigation did not return to the first character",
      20_000,
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "你好吗 detail did not close", 20_000);
   await evaluate("ddStrokeTab = 'animation'; openDictDetail(normalizeDetailEntry({ hz: '人', py: 'rén', fr: 'personne' }))");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '人' && !!document.querySelector('#dd-character-stage')"),
      "Single-character dictionary detail did not load",
      20_000,
   );
   const singleCharacterNavigation = await evaluate(`({
      positionCount: document.querySelectorAll('#dd-character-position').length,
      previousCount: document.querySelectorAll('#dd-character-prev').length,
      nextCount: document.querySelectorAll('#dd-character-next').length,
      pickerCount: document.querySelectorAll('#dd-picker .hzchip').length,
   })`);
   assert(
      singleCharacterNavigation.positionCount === 0 &&
         singleCharacterNavigation.previousCount === 0 && singleCharacterNavigation.nextCount === 0 &&
         singleCharacterNavigation.pickerCount === 0,
      `Single-character navigation is wrong: ${JSON.stringify(singleCharacterNavigation)}`,
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "Single-character detail did not close", 20_000);

   await evaluate("openDictDetail(normalizeDetailEntry({ hz: '看看', fr: 'regarder un peu' }))");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '看' && document.querySelectorAll('#dd-picker .hzchip').length === 2"),
      "Repeated-character dictionary detail did not preserve both positions",
      20_000,
   );
   await click("#dd-character-next");
   await waitFor(
      () => evaluate("document.querySelector('#dd-character-position').textContent.trim() === '看 · 2 / 2' && document.querySelectorAll('#dd-picker [aria-current=true]').length === 1 && document.querySelector('#dd-picker [aria-current=true]').dataset.i === '1'"),
      "Repeated-character navigation did not advance by position",
      20_000,
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "Repeated-character detail did not close", 20_000);

   await evaluate("openDictDetail(normalizeDetailEntry({ hz: '红绿蓝黑白灰棕', fr: 'séquence de couleurs' }))");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '红' && document.querySelectorAll('#dd-picker .hzchip').length === 7"),
      "Seven-character dictionary detail did not load",
      20_000,
   );
   assert(
      await evaluate("document.querySelector('#dd-character-position').textContent.trim() === '红 · 1 / 7' && document.querySelector('#dd-character-prev').disabled && !document.querySelector('#dd-character-next').disabled"),
      "Seven-character initial navigation is wrong",
   );
   const sevenCharacterScrollTop = await evaluate(`(() => {
      const card = document.querySelector('.sheet-card');
      card.scrollTop = Math.min(220, card.scrollHeight - card.clientHeight);
      return card.scrollTop;
   })()`);
   await click('#dd-picker .hzchip[data-i="6"]');
   await waitFor(
      () => evaluate("ddCharacterData?.character === '棕' && document.querySelector('#dd-character-position').textContent.trim() === '棕 · 7 / 7'"),
      "Seven-character direct chip selection failed",
      20_000,
   );
   assert(
      await evaluate("document.querySelector('#dd-character-next').disabled && document.querySelector('#dd-picker [aria-current=true]').textContent === '棕'"),
      "Seven-character final state is wrong",
   );
   assert(
      Math.abs((await evaluate("document.querySelector('.sheet-card').scrollTop")) - sevenCharacterScrollTop) < 8,
      "Changing a dictionary character jumped the sheet toward the top",
   );
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
   await waitFor(
      () => evaluate("ddCharacterData?.character === '灰' && document.querySelector('#dd-character-position').textContent.trim() === '灰 · 6 / 7'"),
      "Seven-character keyboard navigation failed",
      20_000,
   );
   await click("#dd-close");
   await waitFor(() => evaluate("!sheetOpen()"), "Seven-character detail did not close", 20_000);
   record(
      "dictionary word character navigation",
      `你好 data/click/keyboard/chips/swipe passed at 360px; repeated, seven-character and 1 / 1 states passed; screenshot ${screenshotDirectory}`,
   );

   const repeatedStrokeLifecycle = await evaluate(`(async () => {
      const entry = normalizeDetailEntry({ hz: '人', py: 'rén', fr: 'personne' });
      const originalAdd = document.addEventListener;
      const originalRemove = document.removeEventListener;
      const counts = { add: 0, remove: 0 };
      document.addEventListener = function (type, listener, options) {
         if (type === 'mouseup' || type === 'touchend') counts.add += 1;
         return originalAdd.call(this, type, listener, options);
      };
      document.removeEventListener = function (type, listener, options) {
         if (type === 'mouseup' || type === 'touchend') counts.remove += 1;
         return originalRemove.call(this, type, listener, options);
      };
      try {
         for (let index = 0; index < 4; index++) {
            openDictDetail(entry);
            const deadline = performance.now() + 5000;
            while (ddCharacterData?.character !== '人' && performance.now() < deadline) {
               await new Promise((resolve) => setTimeout(resolve, 25));
            }
            closeSheet();
         }
      } finally {
         document.addEventListener = originalAdd;
         document.removeEventListener = originalRemove;
      }
      return {
         writerReleased: ddWriter === null,
         writerSvgs: document.querySelectorAll('#sheet .stroke-workspace svg').length,
         workspaces: document.querySelectorAll('#sheet .stroke-workspace').length,
         focusDialogs: document.querySelectorAll('.stroke-focus').length,
         documentListenerAdds: counts.add,
         documentListenerRemoves: counts.remove,
         trackedDocumentListeners: ddWriterDocumentListeners.length,
      };
   })()`);
   assert(
      repeatedStrokeLifecycle.writerReleased && repeatedStrokeLifecycle.writerSvgs === 0 &&
         repeatedStrokeLifecycle.workspaces === 0 && repeatedStrokeLifecycle.focusDialogs === 0 &&
         repeatedStrokeLifecycle.documentListenerAdds === repeatedStrokeLifecycle.documentListenerRemoves &&
         repeatedStrokeLifecycle.trackedDocumentListeners === 0,
      "Repeated detail open/close leaked stroke UI state",
   );
   record("repeated stroke open/close", `four detail lifecycles released the writer, SVG surface, focus dialog and ${repeatedStrokeLifecycle.documentListenerAdds} document listeners`);
   for (const width of [360, 430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width,
         height: 900,
         deviceScaleFactor: 1,
         mobile: width <= 430,
      });
      await evaluate(`(() => {
         if (seq) teardownSequence();
         srch.q = '';
         srch.mode = 'landing';
         srch.search = null;
         ddStrokeTab = 'animation';
         setView('search', { fromHistory: true });
      })()`);
      await setValue("#dq", "红绿蓝黑白灰棕");
      await mouseClick(".search-submit");
      await waitFor(
         () => evaluate("!!document.querySelector('#btn-seq')"),
         `Seven-character sequence action missing at ${width}px`,
         20_000,
      );
      const sequenceAnimationStart = await evaluate("window.__strokeWriterAudit.animations.length");
      await mouseClick("#btn-seq");
      await waitFor(
         () => evaluate(`seq?.chars.length === 7 && ddChar === '红' && window.__strokeWriterAudit.animations.length === ${sequenceAnimationStart + 1}`),
         `Seven-character viewer or initial autoplay failed at ${width}px`,
         20_000,
      );
      await assertNoDuplicateIds(`Seven-character sequence viewer at ${width}px`);
      assert(
         (await evaluate("document.querySelectorAll('#seq-character-strip button').length")) === 7,
         `Clickable seven-character strip is incomplete at ${width}px`,
      );
      assert(
         await evaluate("seq.index === 0 && document.querySelector('#seq-prev').disabled && document.querySelector('.s-count').textContent.trim() === '红 · 1 / 7'"),
         `Sequence previous control is not disabled at position 1 / 7 at ${width}px`,
      );
      const sharedSequenceControls = await evaluate(`(() => {
         const nav = document.querySelector('#seq-stage').getBoundingClientRect();
         const previous = document.querySelector('#seq-prev');
         const next = document.querySelector('#seq-next');
         const previousRect = previous.getBoundingClientRect();
         const nextRect = next.getBoundingClientRect();
         return {
            previousLabel: previous.getAttribute('aria-label'),
            nextLabel: next.getAttribute('aria-label'),
            previousSize: [previousRect.width, previousRect.height],
            nextSize: [nextRect.width, nextRect.height],
            svgCount: document.querySelectorAll('#seq-stage > .character-nav-button svg').length,
            nextBackground: getComputedStyle(next).backgroundColor,
            insideViewport: nav.left >= 0 && nav.right <= innerWidth,
            noOverflow: document.documentElement.scrollWidth <= innerWidth,
         };
      })()`);
      assert(
         sharedSequenceControls.previousLabel === "Caractère précédent" &&
            sharedSequenceControls.nextLabel === "Caractère suivant" &&
            sharedSequenceControls.previousSize.every((size) => size >= 44) &&
            sharedSequenceControls.nextSize.every((size) => size >= 44) &&
            sharedSequenceControls.svgCount === 2 && sharedSequenceControls.insideViewport &&
            sharedSequenceControls.noOverflow && sharedSequenceControls.nextBackground !== "rgb(23, 20, 15)",
         `Shared sequence controls are not compact or responsive at ${width}px: ${JSON.stringify(sharedSequenceControls)}`,
      );
      await evaluate("document.querySelector('#seq-stage').scrollIntoView({ block: 'center', inline: 'center' })");
      const sequenceNavigationScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      await writeFile(
         path.join(screenshotDirectory, `sequence-character-navigation-${width}.png`),
         Buffer.from(sequenceNavigationScreenshot.data, "base64"),
      );

      await mouseClick('#seq-character-strip button[data-i="2"]');
      await waitFor(
         () => evaluate(`seq.index === 2 && ddChar === '蓝' && ddCharacterData?.character === '蓝' && window.__strokeWriterAudit.animations.length === ${sequenceAnimationStart + 2}`),
         `Direct sequence move to 蓝 failed at ${width}px`,
         20_000,
      );
      const blueSequenceState = await evaluate(`(() => ({
         position: document.querySelector('.s-count').textContent.trim(),
         currentChip: document.querySelector('#seq-character-strip [aria-current=true]').textContent,
         pinyin: document.querySelector('.seq-card .pinyin')?.textContent || '',
         meaning: document.querySelector('.seq-card .fr').textContent,
         previousDisabled: document.querySelector('#seq-prev').disabled,
         strokeTab: ddStrokeTab,
         historyIndex: history.state.sequenceIndex,
         progress: parseFloat(document.querySelector('.s-bar i').style.width),
         audioCharacter: document.querySelector('.seq-card [data-say]')?.getAttribute('data-say'),
         cardActionReady: !!document.querySelector('.seq-card #dd-addcard, .seq-card #dd-manage'),
      }))()`);
      assert(
         blueSequenceState.position === "蓝 · 3 / 7" && blueSequenceState.currentChip === "蓝" &&
            blueSequenceState.pinyin && blueSequenceState.meaning && !blueSequenceState.previousDisabled &&
            blueSequenceState.strokeTab === "animation" && blueSequenceState.historyIndex === 2 &&
            Math.abs(blueSequenceState.progress - 42.9) < 0.2 && blueSequenceState.audioCharacter === "蓝" &&
            blueSequenceState.cardActionReady,
         `蓝 sequence state is incomplete at ${width}px: ${JSON.stringify(blueSequenceState)}`,
      );

      const firstPreviousTarget = await mouseClick("#seq-prev");
      await waitFor(
         () => evaluate(`seq.index === 1 && ddChar === '绿' && ddCharacterData?.character === '绿' && window.__strokeWriterAudit.animations.length === ${sequenceAnimationStart + 3}`),
         `Visible Previous mouse click did not move from 蓝 to 绿 at ${width}px`,
         20_000,
      );
      const greenSequenceState = await evaluate(`(() => ({
         position: document.querySelector('.s-count').textContent.trim(),
         currentChip: document.querySelector('#seq-character-strip [aria-current=true]').textContent,
         pinyin: document.querySelector('.seq-card .pinyin')?.textContent || '',
         meaning: document.querySelector('.seq-card .fr').textContent,
         previousDisabled: document.querySelector('#seq-prev').disabled,
         strokeTab: ddStrokeTab,
         historyIndex: history.state.sequenceIndex,
      }))()`);
      assert(
         greenSequenceState.position === "绿 · 2 / 7" && greenSequenceState.currentChip === "绿" &&
            greenSequenceState.pinyin && greenSequenceState.meaning && !greenSequenceState.previousDisabled &&
            greenSequenceState.strokeTab === "animation" && greenSequenceState.historyIndex === 1 &&
            (greenSequenceState.pinyin !== blueSequenceState.pinyin || greenSequenceState.meaning !== blueSequenceState.meaning),
         `绿 sequence state did not fully update at ${width}px: ${JSON.stringify(greenSequenceState)}`,
      );

      const secondPreviousTarget = await mouseClick("#seq-prev");
      await waitFor(
         () => evaluate(`seq.index === 0 && ddChar === '红' && ddCharacterData?.character === '红' && window.__strokeWriterAudit.animations.length === ${sequenceAnimationStart + 4}`),
         `Visible Previous mouse click did not move from 绿 to 红 at ${width}px`,
         20_000,
      );
      const redSequenceState = await evaluate(`(() => ({
         position: document.querySelector('.s-count').textContent.trim(),
         currentChip: document.querySelector('#seq-character-strip [aria-current=true]').textContent,
         previousDisabled: document.querySelector('#seq-prev').disabled,
         historyIndex: history.state.sequenceIndex,
         writerSvgs: document.querySelectorAll('#dd-target svg').length,
         animations: window.__strokeWriterAudit.animations.slice(${sequenceAnimationStart}).map((item) => item.character),
      }))()`);
      assert(
         redSequenceState.position === "红 · 1 / 7" && redSequenceState.currentChip === "红" &&
            redSequenceState.previousDisabled && redSequenceState.historyIndex === 0 &&
            redSequenceState.writerSvgs === 1 && redSequenceState.animations.join("") === "红蓝绿红",
         `Required 蓝 → 绿 → 红 Previous scenario failed at ${width}px: ${JSON.stringify(redSequenceState)}`,
      );
      const disabledPreviousState = await evaluate(`(() => {
         const button = document.querySelector('#seq-prev');
         return { disabled: button.disabled, pointerEvents: getComputedStyle(button).pointerEvents };
      })()`);
      assert(
         disabledPreviousState.disabled && disabledPreviousState.pointerEvents === "none" &&
            (await evaluate("seq.index === 0 && ddChar === '红'")),
         `Previous did not enter its non-interactive disabled state at ${width}px: ${JSON.stringify(disabledPreviousState)}`,
      );
      assert(
         firstPreviousTarget.receivesPointer && secondPreviousTarget.receivesPointer &&
            firstPreviousTarget.pointerEvents !== "none" && secondPreviousTarget.pointerEvents !== "none",
         `Previous was overlapped or rejected pointer events at ${width}px`,
      );
      assert(
         (await evaluate("JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units })")) === personalLearningBeforeTargetedFixes,
         `Sequence navigation changed cards, packs, favorites, units, or SRS data at ${width}px`,
      );
      record(
         `visible Previous button ${width}px`,
         "real mouse hit-testing passed; 蓝 3/7 → 绿 2/7 → 红 1/7 and disabled state held",
      );
      if (width !== 1024) {
         await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
         await waitFor(() => evaluate("!seq"), `Sequence did not close at ${width}px`, 20_000);
      }
   }
   await click('[data-stroke-tab="steps"]');
   await click("#seq-next");
   await waitFor(
      () => evaluate("seq.index === 1 && ddChar === '绿' && document.querySelector('[data-stroke-tab=steps]').getAttribute('aria-selected') === 'true'"),
      "Sequence Next failed or lost the selected stroke tab",
      20_000,
   );
   await click('#seq-character-strip button[data-i="3"]');
   await waitFor(() => evaluate("seq.index === 3 && ddChar === '黑'"), "Direct sequence selection failed", 20_000);
   await mouseDrag("#seq-flash .hanzi", -140, 2);
   await waitFor(
      () => evaluate("seq.index === 4 && ddChar === '白'"),
      "Seven-character mouse swipe failed",
      20_000,
   );
   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 360,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
   });
   const smallSequenceGesture = await pointerGesture("#seq-flash", {
      deltaX: -24,
      deltaY: 2,
      pointerType: "touch",
      pointerId: 61,
   });
   await new Promise((resolve) => setTimeout(resolve, 120));
   assert(
      (await evaluate("seq.index === 4 && ddChar === '白'")) && smallSequenceGesture.selection === "",
      "A small sequence gesture changed character or selected text",
   );
   const sequenceTouchRight = await pointerGesture("#seq-flash", {
      deltaX: 145,
      deltaY: 3,
      pointerType: "touch",
      pointerId: 62,
   });
   await waitFor(() => evaluate("seq.index === 3 && ddChar === '黑'"), "Seven-character touch swipe right failed", 20_000);
   const sequenceTouchLeft = await pointerGesture("#seq-flash", {
      deltaX: -145,
      deltaY: 3,
      pointerType: "pen",
      pointerId: 63,
   });
   await waitFor(() => evaluate("seq.index === 4 && ddChar === '白'"), "Seven-character pen swipe left failed", 20_000);
   const verticalSequenceGesture = await pointerGesture("#seq-flash", {
      deltaX: 4,
      deltaY: 135,
      pointerType: "touch",
      pointerId: 64,
   });
   assert(
      verticalSequenceGesture.results.every(Boolean) && sequenceTouchRight.selection === "" &&
         sequenceTouchLeft.selection === "" && (await evaluate("seq.index === 4 && ddChar === '白' && window.getSelection().toString() === '' && getComputedStyle(document.querySelector('#seq-flash')).touchAction === 'pan-y'")),
      "Sequence gestures selected text, changed on a vertical move, or blocked pan-y",
   );
   const mobileSequenceScroll = await touchScroll("#seq-flash", 190);
   assert(
      (mobileSequenceScroll.maximum <= 20 || mobileSequenceScroll.scrollY > 20) &&
         (await evaluate("seq.index === 4 && ddChar === '白'")),
      `Vertical mobile scrolling failed through the sequence swipe zone: ${JSON.stringify(mobileSequenceScroll)}`,
   );
   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
   });
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
   await waitFor(() => evaluate("seq.index === 3 && ddChar === '黑'"), "Sequence keyboard ArrowLeft failed", 20_000);
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
   await waitFor(() => evaluate("seq.index === 4 && ddChar === '白'"), "Sequence keyboard ArrowRight failed", 20_000);
   await click('#seq-character-strip button[data-i="0"]');
   await waitFor(() => evaluate("seq.index === 0 && ddChar === '红'"), "Sequence did not return to its first character", 20_000);
   assert(
      await evaluate(`(() => {
         const card = document.querySelector('#seq-flash');
         const controls = [document.createElement('textarea'), document.createElement('select'), document.createElement('div')];
         controls[2].contentEditable = 'true';
         let preserved = true;
         controls.forEach((control) => {
            card.append(control);
            control.focus({ preventScroll: true });
            control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            preserved = preserved && seq.index === 0;
            control.remove();
         });
         return preserved;
      })()`),
      "Sequence keyboard navigation intercepted an editable control",
   );
   await click("#seq-next");
   await waitFor(() => evaluate("seq.index === 1 && ddChar === '绿'"), "Sequence scroll-preservation move failed", 20_000);
   await click('#seq-character-strip button[data-i="0"]');
   await waitFor(() => evaluate("seq.index === 0 && ddChar === '红'"), "Sequence full traversal reset failed", 20_000);
   const sevenCharacters = Array.from("红绿蓝黑白灰棕");
   for (let index = 1; index < sevenCharacters.length; index++) {
      await click("#seq-next");
      await waitFor(
         () => evaluate(`seq.index === ${index} && ddChar === ${JSON.stringify(sevenCharacters[index])} && document.querySelector('.s-count').textContent.trim() === ${JSON.stringify(`${sevenCharacters[index]} · ${index + 1} / 7`)}`),
         `Forward sequence traversal failed at ${sevenCharacters[index]}`,
         20_000,
      );
   }
   assert(await evaluate("document.querySelector('#seq-next').disabled"), "Sequence next chevron is enabled at 7 / 7");
   for (let index = sevenCharacters.length - 2; index >= 0; index--) {
      await click("#seq-prev");
      await waitFor(
         () => evaluate(`seq.index === ${index} && ddChar === ${JSON.stringify(sevenCharacters[index])}`),
         `Backward sequence traversal failed at ${sevenCharacters[index]}`,
         20_000,
      );
   }
   assert(await evaluate("document.querySelector('#seq-prev').disabled"), "Sequence previous chevron is enabled at 1 / 7");
   await click('[data-stroke-tab="practice"]');
   await click("#seq-next");
   await waitFor(
      () => evaluate("seq.index === 1 && ddChar === '绿' && ddWriterTarget?.id === 'dd-practice-target' && document.querySelector('[data-stroke-tab=practice]').getAttribute('aria-selected') === 'true'"),
      "Sequence practice mode was not preserved on Next",
      20_000,
   );
   await click("#seq-prev");
   await waitFor(
      () => evaluate("seq.index === 0 && ddChar === '红' && ddWriterTarget?.id === 'dd-practice-target'"),
      "Sequence practice mode was not preserved on Previous",
      20_000,
   );
   await click('[data-stroke-tab="steps"]');
   await click('#seq-character-strip button[data-i="6"]');
   await waitFor(() => evaluate("seq.index === 6 && ddChar === '棕'"), "Direct sequence jump to 棕 failed", 20_000);
   assert((await evaluate("document.querySelector('.s-count').textContent.trim()")) === "棕 · 7 / 7", "Sequence position indicator is wrong");
   await evaluate("history.back()");
   await waitFor(() => evaluate("!seq && !!document.querySelector('#dresults')"), "Browser Back did not close sequence", 20_000);
   await evaluate("history.forward()");
   await waitFor(() => evaluate("seq?.index === 6 && ddChar === '棕'"), "Browser Forward did not restore sequence position", 20_000);
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
   await waitFor(() => evaluate("seq.index === 5 && ddChar === '灰'"), "Sequence keyboard ArrowLeft failed", 20_000);
   assert(
      (await evaluate("JSON.stringify({ cards: db.cards, packs: db.packs, units: db.units })")) === personalLearningBeforeTargetedFixes,
      "Stroke, gallery, or sequence fixes changed cards, packs, favorites, units, or SRS data",
   );
   record("complete seven-character sequence", "full round trip, mouse/touch/pen swipes, no selection, pan-y, keyboard, chips, shared tabs and Browser Back/Forward passed");
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
   await waitFor(() => evaluate("!seq"), "Sequence Escape failed", 20_000);

   assert((await evaluate("history.length")) > historyLength, "Search navigation did not create browser history");
   record("browser history contract", "search, detail, and sequence navigation created restorable history entries");

   await click("#btn-settings");
   await setValue("#st-rate", "0.9");
   assert(await evaluate("db.settings.rate === 0.9"), "Settings did not persist");
   await evaluate(`(() => {
      window.__exportText = null;
      window.__exportName = null;
      URL.createObjectURL = (blob) => {
         blob.text().then((text) => window.__exportText = text);
         return 'blob:mo-studio-test';
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () { window.__exportName = this.download; };
   })()`);
   await click("#st-export");
   const exported = await waitFor(async () => {
      const text = await evaluate("window.__exportText");
      return text ? JSON.parse(text) : null;
   }, "Export blob was not produced");
   assert(exported.version === 3 && exported.cards.length === 150, "Export schema failed");
   assert((await evaluate("window.__exportName")) === "mo-studio-export.json", "Export filename changed");
   record("settings and JSON export", "setting persisted and version-3 export contained 150 cards");

   const learningDataBeforeDictionaryRebuild = await evaluate(
      "localStorage.getItem(DB_KEY)",
   );
   await click("#st-dictionary-sources");
   await waitFor(
      () => evaluate("!!document.querySelector('#dict-rebuild')"),
      "Dictionary sources did not load",
      20_000,
   );
   const sourcesText = await evaluate(
      "document.querySelector('#sheet').textContent",
   );
   assert(
      sourcesText.includes("CC-CEDICT") && sourcesText.includes("CFDICT"),
      "Verified dictionary attributions are missing",
   );
   const invalidManifestRejected = await evaluate(`(() => {
      try { validateDictionaryManifest({ schemaVersion: 999 }); return false; }
      catch (error) { return true; }
   })()`);
   assert(invalidManifestRejected, "Outdated dictionary manifests are not rejected");
   const sourcesScreenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
   });
   const sourcesScreenshotPath = path.join(
      screenshotDirectory,
      "dictionary-sources.png",
   );
   await writeFile(
      sourcesScreenshotPath,
      Buffer.from(sourcesScreenshot.data, "base64"),
   );
   await click("#dict-rebuild");
   await waitFor(
      () =>
         evaluate(
            "document.querySelector('#dict-source-status')?.dataset.state === 'success'",
         ),
      "Dictionary index rebuild did not reach success",
      180_000,
   );
   assert(
      (await evaluate("localStorage.getItem(DB_KEY)")) ===
         learningDataBeforeDictionaryRebuild,
      "Dictionary rebuild changed personal learning data",
   );
   const dictionaryDatabaseExists = await evaluate(
      "indexedDB.databases ? indexedDB.databases().then((items) => items.some((item) => item.name === 'mo-studio-dictionary-v1')) : false",
   );
   assert(!dictionaryDatabaseExists, "Dictionary rebuild unexpectedly created IndexedDB storage");
   const cacheRecovery = await evaluate(`(async () => {
      const cache = await caches.open(DICTIONARY_CACHE_NAME);
      const manifest = dictionaryDataState.manifest;
      const frenchUrl = dictionaryResourceUrl(manifest.indexes.french);
      await cache.put(frenchUrl, new Response('{broken-json', {
         headers: { 'Content-Type': 'application/json' },
      }));
      dictionaryDataState.indexes.delete('french');
      const recoveredFrench = await loadDictionaryIndex('french', false);
      const originalFetch = window.fetch;
      resetDictionaryMemory();
      window.fetch = () => Promise.reject(new TypeError('simulated offline'));
      try {
         const response = await searchDictionary('你好', { limit: 10 });
         const full = response.results[0]
            ? await loadDictionaryEntryById(response.results[0].entry.id)
            : null;
         return {
            recoveredFrench: !!recoveredFrench.bonjour,
            offlineTop: response.results[0]?.entry.simplified,
            offlineDetail: full?.simplified,
         };
      } finally {
         window.fetch = originalFetch;
      }
   })()`);
   assert(cacheRecovery.recoveredFrench, "Corrupted dictionary cache did not recover from source files");
   assert(
      cacheRecovery.offlineTop === "你好" && cacheRecovery.offlineDetail === "你好",
      "Prepared dictionary did not reopen with full detail while offline",
   );
   assert(
      (await evaluate("localStorage.getItem(DB_KEY)")) === learningDataBeforeDictionaryRebuild,
      "Cache recovery or offline reopening changed personal data",
   );
   record(
      "dictionary sources and safe rebuild",
      "verified attributions rendered; corrupted cache recovered; full offline reopening passed without touching learning data; screenshot " +
         sourcesScreenshotPath,
   );
   await click("#dict-source-close");
   await click("#btn-settings");

   const preResetLearningData = await evaluate(`JSON.stringify({
      cards: db.cards,
      packs: db.packs,
      units: db.units,
      settings: db.settings,
   })`);
   await click("#st-reset");
   assert(await evaluate("db.cards.length === 0 && !!localStorage.getItem(BACKUP_KEY)"), "Reset or backup failed");
   assert(await evaluate("db.settings.rate === 0.9"), "Reset did not preserve settings");
   await click("#btn-settings");
   await click("#st-restore");
   assert(await evaluate("db.cards.length === 150"), "Backup restoration failed");
   const postRestoreLearningData = await evaluate(`JSON.stringify({
      cards: db.cards,
      packs: db.packs,
      units: db.units,
      settings: db.settings,
   })`);
   assert(postRestoreLearningData === preResetLearningData, "Reset restoration did not exactly recover cards, packs, units, progress, favorites, and settings");
   record("reset and restoration", "reset preserved settings and restoration exactly recovered cards, packs, units, favorites, and SRS fields");

   await click("#btn-settings");
   await evaluate(`(() => {
      const py = document.querySelector('#wm-py');
      const fr = document.querySelector('#wm-fr');
      const trace = document.querySelector('#wm-tr');
      trace.checked = true; trace.dispatchEvent(new Event('change', { bubbles: true }));
      py.checked = false; py.dispatchEvent(new Event('change', { bubbles: true }));
      fr.checked = false; fr.dispatchEvent(new Event('change', { bubbles: true }));
   })()`);
   await click("#st-close");
   await evaluate("setView('learn')");
   await click('[data-review-scope="all"]');
   await click('[data-review-mode="written"]');
   await click('[data-review-direction="fr2zh"]');
   await click("#btn-continue");
   await waitFor(() => evaluate("session.mode === 'written' && !!document.querySelector('#s-writer')"), "Trace-only written session did not start");
   const traceMode = await waitFor(
      () => evaluate(`({ writer: document.querySelector('#s-writer').children.length > 0, fallback: !document.querySelector('#s-canvas').hidden })`),
      "Trace writer did not initialize",
   );
   await click("#s-skip");
   assert(await evaluate("getState(session.index).checked"), "Written quiz skip/reveal failed");
   record("written review quiz", traceMode.writer ? "Hanzi trace task initialized" : "freehand trace fallback initialized");
   await click('[data-grade="good"]');
   if (await evaluate("!!document.querySelector('#s-exit')")) await click("#s-exit");
   if (await evaluate("!!document.querySelector('#btn-back-hub')")) await click("#btn-back-hub");

   const persistedBeforeReload = await evaluate("localStorage.getItem(DB_KEY)");
   await cdp.send("Page.reload", { ignoreCache: false });
   await waitFor(() => evaluate("document.readyState === 'complete' && db.cards.length === 150"), "Reload persistence failed", 20_000);
   const persistedAfterReload = await evaluate("localStorage.getItem(DB_KEY)");
   assert(persistedBeforeReload === persistedAfterReload, "Persistent learning data changed after reload");
   record("reload persistence", "the complete stored card, pack, unit, favorite, SRS, and settings payload survived reload byte-for-byte");

   for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width,
         height: 900,
         deviceScaleFactor: 1,
         mobile: width <= 430,
      });
      await evaluate("setView('learn')");
      await new Promise((resolve) => setTimeout(resolve, 700));
      const metrics = await evaluate(`({
         innerWidth,
         scrollWidth: document.documentElement.scrollWidth,
         navWidth: Math.round(document.querySelector('.nav').getBoundingClientRect().width),
         viewWidth: Math.round(document.querySelector('#view').getBoundingClientRect().width),
         navButtonsInside: [...document.querySelectorAll('.nav button')].every((button) => {
            const rect = button.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.width >= 44 && rect.height >= 44;
         }),
         bodyPaddingBottom: parseFloat(getComputedStyle(document.body).paddingBottom),
         navHeight: document.querySelector('.nav').getBoundingClientRect().height
      })`);
      assert(metrics.innerWidth === width, `Viewport width mismatch at ${width}px`);
      assert(metrics.scrollWidth <= width, `Horizontal overflow at ${width}px`);
      assert(metrics.navWidth <= width, `Navigation overflow at ${width}px`);
      assert(metrics.navButtonsInside, `Navigation controls are clipped or too small at ${width}px`);
      if (width < 900)
         assert(metrics.bodyPaddingBottom >= metrics.navHeight, `Bottom navigation can cover content at ${width}px`);
      const screenshot = await cdp.send("Page.captureScreenshot", {
         format: "png",
         fromSurface: true,
      });
      const screenshotPath = path.join(screenshotDirectory, `home-${width}.png`);
      const bytes = Buffer.from(screenshot.data, "base64");
      await writeFile(screenshotPath, bytes);
      assert(bytes.readUInt32BE(16) === width, `Screenshot width mismatch at ${width}px`);
      record(`viewport ${width}px`, `no horizontal overflow; screenshot ${screenshotPath}`);

      await evaluate("setView('search', { fromHistory: true }); launchDictionarySearch('你好', { fromHistory: true })");
      await waitFor(() => evaluate("document.querySelectorAll('#dresults .dict-result').length > 0"), `Search results missing at ${width}px`, 30_000);
      const searchMetrics = await evaluate(`({
         scrollWidth: document.documentElement.scrollWidth,
         initialResults: document.querySelectorAll('#dresults .dict-result').length,
         formWidth: Math.round(document.querySelector('.dictionary-search-form').getBoundingClientRect().width),
         inputInside: (() => {
            const rect = document.querySelector('#dq').getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44;
         })(),
         submitInside: (() => {
            const rect = document.querySelector('.search-submit').getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44;
         })()
      })`);
      assert(searchMetrics.scrollWidth <= width, `Search horizontal overflow at ${width}px`);
      assert(searchMetrics.initialResults <= 32, `Too many initial search DOM rows at ${width}px`);
      assert(searchMetrics.formWidth <= width, `Search form overflow at ${width}px`);
      assert(searchMetrics.inputInside && searchMetrics.submitInside, `Search controls are clipped at ${width}px`);
      const searchScreenshot = await cdp.send("Page.captureScreenshot", {
         format: "png",
         fromSurface: true,
      });
      await writeFile(
         path.join(screenshotDirectory, `search-${width}.png`),
         Buffer.from(searchScreenshot.data, "base64"),
      );

      if ([320, 390, 768, 1440].includes(width)) {
         await click("#dresults .dict-result-primary");
         await waitFor(() => evaluate("!!document.querySelector('.dd-entry')"), `Detail did not open at ${width}px`, 20_000);
         if (width <= 430) {
            await waitFor(() => evaluate("!!ddCharacterData && ddCharacterData.character === ddChar"), `Stroke data did not load at ${width}px`, 20_000);
            await click('[data-stroke-tab="steps"]');
         }
         await new Promise((resolve) => setTimeout(resolve, 280));
         const detailMetrics = await evaluate(`(() => {
            const card = document.querySelector('.sheet-card').getBoundingClientRect();
            const close = document.querySelector('#dd-close-top').getBoundingClientRect();
            const firstPanel = document.querySelector('.stroke-panel')?.getBoundingClientRect();
            return {
               bodyScrollWidth: document.documentElement.scrollWidth,
               cardInside: card.left >= -1 && card.right <= innerWidth + 1 && card.top >= -1 && card.bottom <= innerHeight + 1,
               cardRect: { left: card.left, right: card.right, top: card.top, bottom: card.bottom, innerWidth, innerHeight },
               closeInside: close.left >= 0 && close.right <= innerWidth && close.top >= 0 && close.bottom <= innerHeight,
               closeSize: Math.min(close.width, close.height),
               panelWidth: firstPanel?.width || null,
            };
         })()`);
         assert(detailMetrics.bodyScrollWidth <= width, `Detail caused body overflow at ${width}px`);
         assert(
            detailMetrics.cardInside && detailMetrics.closeInside,
            `Detail dialog is outside the viewport at ${width}px: ${JSON.stringify(detailMetrics)}`,
         );
         assert(detailMetrics.closeSize >= 44, `Detail close control is too small at ${width}px`);
         if (width <= 430)
            assert(detailMetrics.panelWidth >= 240, `Stroke swipe panel is unreadably small at ${width}px: ${detailMetrics.panelWidth}px`);
         if (width === 320 || width === 1440) {
            const detailScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
            await writeFile(
               path.join(screenshotDirectory, `detail-${width}.png`),
               Buffer.from(detailScreenshot.data, "base64"),
            );
         }
         await click("#dd-close-top");
         await waitFor(() => evaluate("!sheetOpen()"), `Detail did not close at ${width}px`, 20_000);
      }
   }

   for (const profile of [
      { name: "portrait", width: 390, height: 844 },
      { name: "landscape", width: 844, height: 390 },
      { name: "keyboard-proxy", width: 390, height: 480 },
   ]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width: profile.width,
         height: profile.height,
         deviceScaleFactor: 1,
         mobile: true,
      });
      await evaluate("setView('search', { fromHistory: true })");
      await evaluate(`(() => {
         const input = document.querySelector('#dq');
         input.focus();
         input.scrollIntoView({ block: 'start' });
      })()`);
      const orientationMetrics = await evaluate(`(() => {
         const input = document.querySelector('#dq').getBoundingClientRect();
         const submit = document.querySelector('.search-submit').getBoundingClientRect();
         const headerBottom = document.querySelector('.top').getBoundingClientRect().bottom;
         return {
            scrollWidth: document.documentElement.scrollWidth,
            inputVisible: input.top >= headerBottom - 1 && input.bottom <= innerHeight,
            submitReachable: submit.left >= 0 && submit.right <= innerWidth && submit.top < innerHeight,
            navVisible: document.querySelector('.nav').getBoundingClientRect().top < innerHeight,
            inputRect: { left: input.left, right: input.right, top: input.top, bottom: input.bottom },
            submitRect: { left: submit.left, right: submit.right, top: submit.top, bottom: submit.bottom },
            innerWidth,
            innerHeight,
            headerBottom,
         };
      })()`);
      assert(orientationMetrics.scrollWidth <= profile.width, `${profile.name} caused horizontal overflow`);
      assert(
         orientationMetrics.inputVisible && orientationMetrics.submitReachable,
         `${profile.name} hid the primary search controls: ${JSON.stringify(orientationMetrics)}`,
      );
      assert(orientationMetrics.navVisible, `${profile.name} hid the bottom navigation`);
      record(
         `responsive ${profile.name}`,
         `${profile.width}×${profile.height}: search controls remained reachable with no horizontal overflow`,
      );
   }

   await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 430,
      height: 900,
      deviceScaleFactor: 2,
      mobile: true,
   });
   const wordsFlowBaseline = await evaluate("db.cards.length");
   await evaluate("setView('search', { fromHistory: true })");
   await evaluate("launchDictionarySearch('面包', { fromHistory: true })");
   await waitFor(
      () =>
         evaluate(
            "!![...document.querySelectorAll('#dresults .dict-result')].find((item) => item.querySelector('.dict-result-hanzi b')?.textContent === '面包')",
         ),
      "Dictionary word for Mes mots flow missing",
      30_000,
   );
   await evaluate(
      "[...document.querySelectorAll('#dresults .dict-result')].find((item) => item.querySelector('.dict-result-hanzi b')?.textContent === '面包').querySelector('.dict-result-primary').click()",
   );
   await waitFor(() => evaluate("!!document.querySelector('#dd-addcard')"), "Mes mots add action missing");
   await click("#dd-addcard");
   assert(await evaluate("!!document.querySelector('#dd-add-confirm')"), "Dictionary add placement action missing");
   await setValue("#dd-add-pack-name", "Pack rapide test");
   await click("#dd-add-pack-create");
   await waitFor(
      () => evaluate("db.packs.some((pack) => pack.name === 'Pack rapide test')"),
      "Quick pack creation failed",
   );
   await evaluate(`(() => {
      const label = [...document.querySelectorAll('.dd-add-packs .dd-pack-choice')]
         .find((item) => item.textContent.includes('HSK 1'));
      if (!label) throw new Error('HSK 1 pack choice missing');
      const checkbox = label.querySelector('input');
      if (!checkbox.checked) checkbox.click();
   })()`);
   for (let index = 0; index < 2; index++) {
      await evaluate(`(() => {
         const unresolved = [...document.querySelectorAll('[data-dd-pack-block]')].find((block) =>
            block.querySelector('[data-dd-add-pack]')?.checked &&
            !block.querySelector('[data-dd-add-category]:checked') &&
            !block.querySelector('[data-dd-without-category]:checked')
         );
         unresolved?.querySelector('[data-dd-without-category]')?.click();
      })()`);
   }
   await click("#dd-add-confirm");
   await waitFor(() => evaluate("!!document.querySelector('#dd-manage')"), "Added word detail did not return");
   const addedWord = await evaluate(`(() => {
      const cards = db.cards.filter((card) => card.hz === '面包');
      const card = cards[0];
      return {
         cardCount: db.cards.length,
         matches: cards.length,
         memberships: card ? categoriesForCard(card.id).map((category) => db.packs.find((pack) => pack.id === category.packId)?.name).filter(Boolean) : [],
      };
   })()`);
   assert(
      addedWord.cardCount === wordsFlowBaseline + 1 && addedWord.matches === 1 &&
         addedWord.memberships.includes("HSK 1") && addedWord.memberships.includes("Pack rapide test"),
      `Mes mots multi-pack add failed: ${JSON.stringify(addedWord)}`,
   );
   await evaluate(`(() => {
      const item = srch.search.results.find((result) => result.entry.simplified === '面包');
      if (!item) throw new Error('面包 search result missing');
      openDictionaryAddToWords(attachHskMetadata(item.entry), { fromSearch: true });
   })()`);
   await click("#dd-add-confirm");
   await waitFor(() => evaluate("!!document.querySelector('#dd-manage')"), "Duplicate guard detail did not return");
   assert(
      (await evaluate("db.cards.filter((card) => card.hz === '面包').length")) === 1 &&
         (await evaluate("db.cards.length")) === wordsFlowBaseline + 1,
      "Adding an existing dictionary word duplicated its personal card",
   );
   record(
      "Mes mots dictionary flow",
      "direct add, quick pack creation, two-pack membership, and duplicate prevention passed",
   );

   await evaluate(`(() => {
      const removed = db.cards.filter((card) => card.hz === '面包').map((card) => card.id);
      removeCardsFromLibrary(removed);
      const quickPack = db.packs.find((pack) => pack.name === 'Pack rapide test');
      if (quickPack) deletePersonalPack(quickPack.id);
      invalidateDictIndex();
      save();
   })()`);
   assert((await evaluate("db.cards.length")) === wordsFlowBaseline, "Mes mots test cleanup failed");

   await evaluate("setView('search', { fromHistory: true })");
   await evaluate("launchDictionarySearch('你好', { fromHistory: true })");
   await waitFor(
      () =>
         evaluate(
            "!![...document.querySelectorAll('#dresults .dict-result')].find((item) => item.querySelector('.dict-result-hanzi b')?.textContent === '你好')",
         ),
      "你好 dictionary result missing before writing route",
      30_000,
   );
   await evaluate(
      "[...document.querySelectorAll('#dresults .dict-result')].find((item) => item.querySelector('.dict-result-hanzi b')?.textContent === '你好').querySelector('.dict-result-primary').click()",
   );
   await waitFor(() => evaluate("!!document.querySelector('#dd-write')"), "Dictionary writing action missing");
   await click("#dd-write");
   await waitFor(
      () => evaluate("activeView === 'write' && !!document.querySelector('#writing-canvas')"),
      "Dictionary did not open the writing board",
   );
   const initialWritingWord = await evaluate(`({
      position: document.querySelector('#writing-position')?.textContent.trim(),
      model: document.querySelector('#writing-model')?.textContent.trim(),
      mode: writingState.mode,
      word: writingState.word,
      fullscreen: !!document.querySelector('#writing-fullscreen'),
   })`);
   assert(
      initialWritingWord.position === "你 · 1 / 2" && initialWritingWord.model === "你" &&
         initialWritingWord.mode === "practice" && initialWritingWord.word === "你好" &&
         initialWritingWord.fullscreen,
      `你好 writing route failed: ${JSON.stringify(initialWritingWord)}`,
   );
   const writingStructure = await evaluate(`(() => {
      const surface = document.querySelector('#writing-surface');
      const selector = document.querySelector('.writing-grid-selector');
      const note = document.querySelector('.writing-note');
      const selection = (selector) => {
         const style = getComputedStyle(document.querySelector(selector));
         return [style.userSelect, style.webkitUserSelect];
      };
      return {
         surfaceBeforeSelector: !!(surface.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING),
         selectorBeforeNote: !!(selector.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING),
         visualOrder: surface.getBoundingClientRect().top < selector.getBoundingClientRect().top,
         optionCount: document.querySelectorAll('.writing-grid-option').length,
         previewCount: document.querySelectorAll('.writing-grid-preview').length,
         actionToolsTouchable: [...document.querySelectorAll('.writing-action-tools .btn')].every((button) => button.getBoundingClientRect().height >= 44),
         primaryToolsTouchable: [...document.querySelectorAll('.writing-primary-tools .btn')]
            .filter((button) => button.getClientRects().length)
            .every((button) => button.getBoundingClientRect().height >= 44),
         colorsTouchable: [...document.querySelectorAll('.writing-color, .writing-color-custom')].every((button) => {
            const rect = button.getBoundingClientRect();
            return rect.width >= 44 && rect.height >= 44;
         }),
         modelToggle: (() => {
            const button = document.querySelector('#writing-model-visible');
            const rect = button.getBoundingClientRect();
            const surfaceRect = surface.getBoundingClientRect();
            return {
               pressed: button.getAttribute('aria-pressed'),
               size: Math.min(rect.width, rect.height),
               insideSurface: rect.left >= surfaceRect.left && rect.right <= surfaceRect.right && rect.top >= surfaceRect.top,
            };
         })(),
         opacityAvailable: !!document.querySelector('#writing-opacity'),
         toolsPanelHidden: document.querySelector('#writing-more-tools').hidden,
         selectionBlocked: ['.writing-page', '.writing-tools', '.writing-grid-option', '#writing-canvas']
            .every((selector) => selection(selector).every((value) => value === 'none')),
         inputSelection: selection('#writing-word'),
      };
   })()`);
   const writingCss = await readFile(path.join(projectRoot, "css", "writing.css"), "utf8");
   const writingPageSelectionCss = writingCss.match(/\.writing-page,\s*\.writing-page \*\s*\{([^}]+)\}/)?.[1] || "";
   const writingInputSelectionCss = writingCss.match(/\.writing-page #writing-word\s*\{([^}]+)\}/)?.[1] || "";
   assert(
      writingStructure.surfaceBeforeSelector && writingStructure.selectorBeforeNote && writingStructure.visualOrder &&
         writingStructure.optionCount === 4 && writingStructure.previewCount === 4 &&
         writingStructure.primaryToolsTouchable &&
         writingStructure.modelToggle.pressed === 'true' && writingStructure.modelToggle.size >= 44 &&
         writingStructure.modelToggle.insideSurface && writingStructure.opacityAvailable &&
         writingStructure.selectionBlocked && writingStructure.inputSelection.every((value) => value === 'text') &&
         /-webkit-touch-callout:\s*none/.test(writingPageSelectionCss) &&
         /-webkit-touch-callout:\s*default/.test(writingInputSelectionCss),
      `Writing canvas/grid structure is wrong: ${JSON.stringify(writingStructure)}`,
   );
   await click("#writing-model-visible");
   const hiddenWritingModel = await evaluate(`({
      hidden: document.querySelector('#writing-model').hidden,
      pressed: document.querySelector('#writing-model-visible').getAttribute('aria-pressed'),
      stored: JSON.parse(localStorage.getItem(DB_KEY)).settings.writingBoard.modelVisible,
   })`);
   assert(
      hiddenWritingModel.hidden && hiddenWritingModel.pressed === "false" && hiddenWritingModel.stored === false,
      `Writing eye button did not hide and persist the model: ${JSON.stringify(hiddenWritingModel)}`,
   );
   await click("#writing-model-visible");
   assert(
      !(await evaluate("document.querySelector('#writing-model').hidden")) &&
         (await evaluate("document.querySelector('#writing-model-visible').getAttribute('aria-pressed')")) === "true",
      "Writing eye button did not restore the model",
   );
   if (writingStructure.toolsPanelHidden) await click("#writing-more-toggle");
   const expandedWritingTools = await evaluate(`({
      panelHidden: document.querySelector('#writing-more-tools').hidden,
      actionToolsTouchable: [...document.querySelectorAll('.writing-action-tools .btn')]
         .every((button) => button.getBoundingClientRect().height >= 44),
      colorsTouchable: [...document.querySelectorAll('.writing-color, .writing-color-custom')].every((button) => {
         const rect = button.getBoundingClientRect();
         return rect.width >= 44 && rect.height >= 44;
      }),
      opacityAvailable: !!document.querySelector('#writing-opacity'),
   })`);
   assert(
      !expandedWritingTools.panelHidden && expandedWritingTools.actionToolsTouchable &&
         expandedWritingTools.colorsTouchable && expandedWritingTools.opacityAvailable,
      `Writing expanded tools are not usable: ${JSON.stringify(expandedWritingTools)}`,
   );
   await click("#writing-next");
   assert(
      (await evaluate("document.querySelector('#writing-position').textContent.trim()")) === "好 · 2 / 2",
      "Writing chevron did not advance to 好",
   );
   await click("#writing-prev");
   await pointerGesture("#writing-character-nav", { deltaX: -90, pointerType: "touch", pointerId: 81 });
   assert(
      (await evaluate("document.querySelector('#writing-position').textContent.trim()")) === "好 · 2 / 2",
      "Writing swipe did not advance from 你 to 好",
   );
   await click('[data-writing-mode="free"]');
   await mouseDrag("#writing-canvas", 74, 52);
   await waitFor(() => evaluate("writingState.free.actions.length === 1"), "Mouse drawing did not create a stroke");
   await click('[data-writing-color="#9e2b25"]');
   await setValue("#writing-width", "11");
   await mouseDrag("#writing-canvas", -58, 68);
   const penSettings = await evaluate(`({
      color: writingState.free.actions.at(-1)?.color,
      width: writingState.free.actions.at(-1)?.width,
      stored: JSON.parse(localStorage.getItem(DB_KEY)).settings.writingBoard,
   })`);
   assert(
      penSettings.color === "#9e2b25" && penSettings.width === 11 &&
         penSettings.stored.color === "#9e2b25" && penSettings.stored.width === 11,
      `Writing color/width did not persist: ${JSON.stringify(penSettings)}`,
   );
   await click("#writing-eraser");
   await mouseDrag("#writing-canvas", 34, -42);
   assert(
      (await evaluate("writingState.free.actions.at(-1).tool")) === "eraser",
      "Writing eraser did not create an erasing stroke",
   );
   await pointerGesture("#writing-canvas", {
      deltaX: 64,
      deltaY: 44,
      pointerType: "touch",
      pointerId: 82,
   });
   assert(
      (await evaluate("writingState.free.actions.at(-1).points.length")) >= 3,
      "Simulated touch drawing did not produce points",
   );
   const actionsBeforeClear = await evaluate("writingState.free.actions.length");
   await click("#writing-clear");
   assert(
      (await evaluate("writingState.free.actions.at(-1).type")) === "clear",
      "Tout effacer was not immediate",
   );
   await click("#writing-undo");
   assert(
      (await evaluate("writingState.free.actions.length")) === actionsBeforeClear &&
         (await evaluate("writingState.free.actions.at(-1).type")) !== "clear",
      "Undo did not recover the drawing after Tout effacer",
   );
   await click("#writing-redo");
   assert(
      (await evaluate("writingState.free.actions.at(-1).type")) === "clear",
      "Redo did not restore Tout effacer",
   );
   await click("#writing-undo");
   const drawingBeforeGridChange = await evaluate("JSON.stringify(writingState.free.actions)");
   await click('[data-writing-grid="mi"]');
   const writingPreferencesState = await evaluate(`({
      grid: document.querySelector('#writing-surface').dataset.grid,
      storedGrid: JSON.parse(localStorage.getItem(DB_KEY)).settings.writingBoard.grid,
      canvasTouchAction: getComputedStyle(document.querySelector('#writing-canvas')).touchAction,
      drawing: JSON.stringify(writingState.free.actions),
      activeGrid: document.querySelector('.writing-grid-option[aria-pressed=true]')?.dataset.writingGrid,
   })`);
   assert(
      writingPreferencesState.grid === "mi" && writingPreferencesState.storedGrid === "mi" &&
         writingPreferencesState.canvasTouchAction === "none" && writingPreferencesState.activeGrid === "mi" &&
         writingPreferencesState.drawing === drawingBeforeGridChange,
      `Writing grid or touch behavior failed: ${JSON.stringify(writingPreferencesState)}`,
   );
   await click("#writing-fullscreen");
   await waitFor(
      () =>
         evaluate(
            "document.fullscreenElement?.id === 'writing-workspace' || document.querySelector('#writing-workspace').classList.contains('writing-fullscreen-fallback')",
         ),
      "Writing fullscreen did not open",
   );
   await click("#writing-fullscreen");
   await waitFor(
      () =>
         evaluate(
            "!document.fullscreenElement && !document.querySelector('#writing-workspace').classList.contains('writing-fullscreen-fallback')",
         ),
      "Writing fullscreen did not close",
   );

   for (const width of [360, 430, 1024]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width,
         height: 900,
         deviceScaleFactor: width === 430 ? 2 : 1,
         mobile: width <= 430,
      });
      await evaluate(`(() => {
         writingState.mode = 'free';
         writingState.compactToolsViewport = null;
         writingState.toolsExpanded = null;
         renderWriting();
      })()`);
      const writingLayout = await evaluate(`(() => {
         const canvas = document.querySelector('#writing-canvas');
         const rect = canvas.getBoundingClientRect();
         const surface = document.querySelector('#writing-surface');
         const selector = document.querySelector('.writing-grid-selector');
         const note = document.querySelector('.writing-note');
         const selectorRect = selector.getBoundingClientRect();
         return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            nav: [...document.querySelectorAll('.nav button')].map((button) =>
               button.querySelector('.n-hz').textContent.trim() + ' ' + button.querySelector('.n-lab').textContent.trim()
            ),
            navFits: [...document.querySelectorAll('.nav button')].every((button) => button.scrollWidth <= button.clientWidth + 1),
            activeRoute: document.querySelector('.nav button[aria-pressed=true]')?.dataset.view,
            crisp: Math.abs(canvas.width - Math.round(rect.width * devicePixelRatio)) <= 1 &&
               Math.abs(canvas.height - Math.round(rect.height * devicePixelRatio)) <= 1,
            surfaceBeforeSelector: !!(surface.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING) &&
               surface.getBoundingClientRect().top < selectorRect.top,
            selectorBeforeNote: !!(selector.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING),
            selectorInside: selectorRect.left >= 0 && selectorRect.right <= innerWidth,
            gridColumnCount: getComputedStyle(document.querySelector('.writing-grid-options')).gridTemplateColumns.split(' ').length,
            gridOptionsTouchable: [...document.querySelectorAll('.writing-grid-option')].every((option) => {
               const optionRect = option.getBoundingClientRect();
               return optionRect.width >= 44 && optionRect.height >= 44;
            }),
            compactTools: {
               expanded: document.querySelector('#writing-more-toggle').getAttribute('aria-expanded'),
               panelHidden: document.querySelector('#writing-more-tools').hidden,
               toggleVisible: document.querySelector('#writing-more-toggle').getBoundingClientRect().height >= 44,
               primaryTouchable: [...document.querySelectorAll('.writing-primary-tools .btn')]
                  .filter((button) => button.getClientRects().length)
                  .every((button) => button.getBoundingClientRect().height >= 44),
            },
         };
      })()`);
      assert(
         !writingLayout.overflow && writingLayout.navFits && writingLayout.activeRoute === "write" && writingLayout.crisp &&
            writingLayout.surfaceBeforeSelector && writingLayout.selectorBeforeNote && writingLayout.selectorInside &&
            writingLayout.gridOptionsTouchable && writingLayout.gridColumnCount === (width < 900 ? 2 : 4) &&
            writingLayout.compactTools.primaryTouchable &&
            (width <= 520
               ? writingLayout.compactTools.expanded === 'false' && writingLayout.compactTools.panelHidden && writingLayout.compactTools.toggleVisible
               : writingLayout.compactTools.expanded === 'true' && !writingLayout.compactTools.panelHidden && !writingLayout.compactTools.toggleVisible) &&
            writingLayout.nav.join("|") ===
               "学 Parcours|写 Écrire|查 Rechercher|库 Mes mots|复 Réviser",
         `Writing/navigation layout failed at ${width}px: ${JSON.stringify(writingLayout)}`,
      );
      if (width === 360) {
         await evaluate("document.querySelector('#toast').classList.remove('show')");
         const actionsBeforeMobileTouch = await evaluate("writingState.free.actions.length");
         const mobileTouch = await pointerGesture("#writing-canvas", {
            deltaX: 52,
            deltaY: 38,
            pointerType: "touch",
            pointerId: 83,
         });
         assert(
            !mobileTouch.selection &&
               (await evaluate("writingState.free.actions.length")) === actionsBeforeMobileTouch + 1,
            `Writing mobile touch/selection protection failed: ${JSON.stringify(mobileTouch)}`,
         );
         const writingMobileImage = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
         });
         await writeFile(
            path.join(screenshotDirectory, "writing-touch-callout-360.png"),
            Buffer.from(writingMobileImage.data, "base64"),
         );
      }

      await evaluate(`(() => {
         writingState.mode = 'practice';
         writingState.word = '你好';
         writingState.characters = ['你', '好'];
         writingState.index = 0;
         writingState.compactToolsViewport = null;
         writingState.toolsExpanded = null;
         writingPreferences().modelVisible = true;
         renderWriting();
      })()`);
      const writingPracticeLayout = await evaluate(`(() => {
         const surface = document.querySelector('#writing-surface').getBoundingClientRect();
         const eye = document.querySelector('#writing-model-visible').getBoundingClientRect();
         const grid = document.querySelector('.writing-grid-selector').getBoundingClientRect();
         return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            surfaceTop: surface.top,
            eyeSize: Math.min(eye.width, eye.height),
            eyeInside: eye.left >= surface.left && eye.right <= surface.right && eye.top >= surface.top && eye.bottom <= surface.bottom,
            eyePressed: document.querySelector('#writing-model-visible').getAttribute('aria-pressed'),
            gridBelow: grid.top >= surface.bottom - 1,
            opacityExists: !!document.querySelector('#writing-opacity'),
            panelHidden: document.querySelector('#writing-more-tools').hidden,
         };
      })()`);
      assert(
         !writingPracticeLayout.overflow && writingPracticeLayout.eyeSize >= 44 && writingPracticeLayout.eyeInside &&
            writingPracticeLayout.eyePressed === 'true' && writingPracticeLayout.gridBelow &&
            (width <= 520 ? writingPracticeLayout.surfaceTop < 380 && writingPracticeLayout.panelHidden : writingPracticeLayout.opacityExists),
         `Writing practice layout failed at ${width}px: ${JSON.stringify(writingPracticeLayout)}`,
      );
      if (width === 360) {
         const writingPracticeCompactImage = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
         });
         await writeFile(
            path.join(screenshotDirectory, "writing-practice-compact-360.png"),
            Buffer.from(writingPracticeCompactImage.data, "base64"),
         );
      }
      if (width <= 520) {
         await click("#writing-more-toggle");
         assert(
            await evaluate("!document.querySelector('#writing-more-tools').hidden && !!document.querySelector('#writing-opacity')"),
            `Writing compact tools did not expose opacity at ${width}px`,
         );
      }
      await click("#writing-model-visible");
      assert(
         await evaluate("document.querySelector('#writing-model').hidden && document.querySelector('#writing-model-visible').getAttribute('aria-pressed') === 'false'"),
         `Writing model eye did not work at ${width}px`,
      );
      if (width === 360) {
         await click("#writing-model-visible");
         await setValue("#writing-opacity", "27");
         assert(
            await evaluate("document.querySelector('#writing-opacity-value').textContent === '27%' && document.querySelector('#writing-model').style.opacity === '0.27'"),
            "Writing compact opacity control did not update the model",
         );
         const writingPracticeImage = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
         });
         await writeFile(
            path.join(screenshotDirectory, "writing-practice-tools-360.png"),
            Buffer.from(writingPracticeImage.data, "base64"),
         );
      }

      await evaluate(`(() => {
         writingState.word = '';
         writingState.characters = [];
         writingState.index = 0;
         writingState.compactToolsViewport = null;
         writingState.toolsExpanded = null;
         renderWriting();
      })()`);
      const writingEmptyPractice = await evaluate(`({
         overflow: document.documentElement.scrollWidth > innerWidth,
         canvas: !!document.querySelector('#writing-canvas'),
         eyeDisabled: document.querySelector('#writing-model-visible').disabled,
         gridCount: document.querySelectorAll('.writing-grid-option').length,
         fullscreenAvailable: !!document.querySelector('#writing-fullscreen'),
      })`);
      assert(
         !writingEmptyPractice.overflow && writingEmptyPractice.canvas && writingEmptyPractice.eyeDisabled &&
            writingEmptyPractice.gridCount === 4 && writingEmptyPractice.fullscreenAvailable,
         `Writing empty practice mode failed at ${width}px: ${JSON.stringify(writingEmptyPractice)}`,
      );
   }
   record(
      "writing board",
      "你好 route/navigation, iOS selection/callout protection, mouse and touch drawing, pen settings, eraser, undo/redo, clear recovery, 米字格, HiDPI, fullscreen control, and 360/430/1024px layouts passed",
   );

   await cdp.send("Emulation.clearDeviceMetricsOverride");
   await navigate("mo-studio.html");
   assert(await evaluate("activeView === 'learn' && db.cards.length === 150"), "Compatibility entry failed");
   record("mo-studio.html compatibility entry", "multi-file application initialized");

   await navigate("dist/mo-studio-portable.html");
   assert(await evaluate("activeView === 'learn' && db.cards.length === 150"), "Portable build failed");
   record("portable build", "embedded CSS/JavaScript build initialized with existing storage");

   const relevantErrors = runtimeErrors.filter(
      (error) =>
         !/favicon|font|ERR_BLOCKED_BY_CLIENT|net::ERR_ABORTED|net::ERR_NETWORK_ACCESS_DENIED/i.test(error),
   );
   assert(relevantErrors.length === 0, `Runtime errors: ${relevantErrors.join(" | ")}`);
   record("runtime console", "no uncaught application exceptions");

   const report = {
      browser: version.Browser,
      server: serverUrl,
      screenshots: screenshotDirectory,
      passed: results.length,
      results,
      runtimeErrors,
      measurements,
      serverLogLines: serverError.split(/\r?\n/).filter(Boolean).length,
   };
   console.log(`RESULT_JSON ${JSON.stringify(report)}`);
}

try {
   await main();
} catch (error) {
   console.error(`FAIL ${error.stack || error.message}`);
   if (runtimeErrors.length) {
      console.error(`RUNTIME_ERRORS ${JSON.stringify(runtimeErrors)}`);
   }
   process.exitCode = 1;
} finally {
   if (cdp) cdp.close();
   if (browser && !browser.killed) browser.kill();
   if (server && !server.killed) server.kill();
   await new Promise((resolve) => setTimeout(resolve, 300));
   await rm(browserProfile, { recursive: true, force: true }).catch(() => {});
}
