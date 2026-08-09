"use strict";

const LEARNING_UNITS_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable ? "../data/generated/learning-units/" : "data/generated/learning-units/",
      document.baseURI,
   ).href;
})();

const learningUnitsState = {
   manifest: null,
   manifestPending: null,
   index: null,
   indexById: null,
   indexPending: null,
   chunkCache: new Map(),
   chunkPending: new Map(),
   unitCache: new Map(),
   graph: null,
   graphPending: null,
};

async function loadLearningUnitsManifest() {
   if (learningUnitsState.manifest) return learningUnitsState.manifest;
   if (learningUnitsState.manifestPending) return learningUnitsState.manifestPending;
   learningUnitsState.manifestPending = fetch(
      new URL("manifest.json", LEARNING_UNITS_ROOT).href,
      { cache: "default" },
   )
      .then(async (response) => {
         if (!response.ok) throw new Error("HTTP " + response.status);
         const manifest = await response.json();
         if (manifest?.format !== "mo-studio-learning-units" || manifest.schemaVersion !== 1)
            throw new Error("Manifeste des unités d'apprentissage incompatible.");
         learningUnitsState.manifest = manifest;
         return manifest;
      })
      .finally(() => {
         learningUnitsState.manifestPending = null;
      });
   return learningUnitsState.manifestPending;
}

async function loadLearningUnitsIndex() {
   if (learningUnitsState.index) return learningUnitsState.index;
   if (learningUnitsState.indexPending) return learningUnitsState.indexPending;
   learningUnitsState.indexPending = (async () => {
      const manifest = await loadLearningUnitsManifest();
      const response = await fetch(
         new URL(manifest.files.unitsIndex.path, LEARNING_UNITS_ROOT).href,
         { cache: "default" },
      );
      if (!response.ok) throw new Error("HTTP " + response.status);
      const index = await response.json();
      if (!Array.isArray(index) || index.length !== manifest.files.unitsIndex.count)
         throw new Error("Index des unités d'apprentissage incohérent.");
      learningUnitsState.index = index;
      learningUnitsState.indexById = new Map(index.map((row, position) => [row.id, position]));
      return index;
   })().finally(() => {
      learningUnitsState.indexPending = null;
   });
   return learningUnitsState.indexPending;
}

async function loadLearningUnitsGraph() {
   if (learningUnitsState.graph) return learningUnitsState.graph;
   if (learningUnitsState.graphPending) return learningUnitsState.graphPending;
   learningUnitsState.graphPending = (async () => {
      const manifest = await loadLearningUnitsManifest();
      const response = await fetch(new URL(manifest.files.graph.path, LEARNING_UNITS_ROOT).href, { cache: "default" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const graph = await response.json();
      if (graph?.format !== "mo-studio-learning-units-graph" || graph.schemaVersion !== 1 || !graph.prerequisites)
         throw new Error("Graphe des unités d'apprentissage incompatible.");
      learningUnitsState.graph = graph;
      return graph;
   })().finally(() => {
      learningUnitsState.graphPending = null;
   });
   return learningUnitsState.graphPending;
}

async function loadLearningUnitsChunk(key) {
   if (learningUnitsState.chunkCache.has(key)) return learningUnitsState.chunkCache.get(key);
   if (learningUnitsState.chunkPending.has(key)) return learningUnitsState.chunkPending.get(key);
   const request = (async () => {
      try {
         const manifest = await loadLearningUnitsManifest();
         const relativePath = manifest.files.units.chunked
            ? manifest.files.units.chunkPathTemplate.replace("{key}", key)
            : manifest.files.units.path;
         const response = await fetch(new URL(relativePath, LEARNING_UNITS_ROOT).href, { cache: "default" });
         if (!response.ok) throw new Error("HTTP " + response.status);
         const chunk = await response.json();
         if (!Array.isArray(chunk)) throw new Error("Fragment d'unités d'apprentissage invalide.");
         learningUnitsState.chunkCache.set(key, chunk);
         return chunk;
      } catch (error) {
         return [];
      }
   })().finally(() => {
      learningUnitsState.chunkPending.delete(key);
   });
   learningUnitsState.chunkPending.set(key, request);
   return request;
}

async function scanAllLearningUnitsChunksForUnit(unitId, manifest) {
   const keys = manifest.files.units.chunked
      ? manifest.files.units.chunks.map((chunk) => chunk.key)
      : ["__single__"];
   for (const key of keys) {
      const chunk = await loadLearningUnitsChunk(key);
      const found = chunk.find((row) => row.id === unitId);
      if (found) return found;
   }
   return null;
}

async function loadLearningUnit(unitId) {
   if (learningUnitsState.unitCache.has(unitId)) return learningUnitsState.unitCache.get(unitId);
   const manifest = await loadLearningUnitsManifest();
   await loadLearningUnitsIndex();
   const position = learningUnitsState.indexById.get(unitId);
   let unit = null;
   if (position != null) {
      const key = manifest.files.units.chunked
         ? String(Math.floor(position / (manifest.files.units.chunks[0]?.count || 30))).padStart(3, "0")
         : "__single__";
      const chunk = await loadLearningUnitsChunk(key);
      unit = chunk.find((row) => row.id === unitId) || null;
   }
   if (!unit) unit = await scanAllLearningUnitsChunksForUnit(unitId, manifest);
   learningUnitsState.unitCache.set(unitId, unit);
   return unit;
}
