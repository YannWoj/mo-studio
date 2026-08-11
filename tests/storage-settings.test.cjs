"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const storageSource = fs.readFileSync(path.join(projectRoot, "js", "storage.js"), "utf8");

function loadSettings(strokeGallery) {
   const values = new Map([
      [
         "mo-studio-v1",
         JSON.stringify({
            cards: [],
            packs: [],
            categories: [],
            memberships: [],
            units: {},
            settings: { strokeGallery },
         }),
      ],
   ]);
   const context = {
      console,
      Date,
      JSON,
      Map,
      Set,
      Object,
      Number,
      String,
      Array,
      localStorage: {
         getItem(key) {
            return values.has(key) ? values.get(key) : null;
         },
         setItem(key, value) {
            values.set(key, String(value));
         },
         removeItem(key) {
            values.delete(key);
         },
      },
   };
   vm.createContext(context);
   vm.runInContext(
      `${storageSource}\n;globalThis.__storageSettingsTest = { load, defaultSettings };`,
      context,
      { filename: "js/storage.js" },
   );
   return {
      defaults: context.__storageSettingsTest.defaultSettings().strokeGallery,
      loaded: context.__storageSettingsTest.load().settings.strokeGallery,
   };
}

const enabled = loadSettings({
   showFuture: false,
   showGrid: false,
   highlightRadical: true,
});
assert.deepEqual(
   { ...enabled.defaults },
   { showFuture: true, showGrid: true, highlightRadical: false },
   "Stroke-gallery defaults must define every persisted boolean",
);
assert.deepEqual(
   { ...enabled.loaded },
   { showFuture: false, showGrid: false, highlightRadical: true },
   "Loading settings must preserve an enabled radical highlight",
);

const disabled = loadSettings({ highlightRadical: false, showGhost: true });
assert.deepEqual(
   { ...disabled.loaded },
   { showFuture: true, showGrid: true, highlightRadical: false },
   "Loading settings must preserve false, apply defaults, and retire showGhost",
);

const malformed = loadSettings({ highlightRadical: "yes" });
assert.equal(
   malformed.loaded.highlightRadical,
   false,
   "Malformed radical-highlight settings must fall back to false",
);

console.log("PASS storage settings — stroke-gallery booleans survive normalization and legacy migration");
