"use strict";

/* Le catalogue et les index volumineux restent hors du fil d’interface. */
var db = { cards: [] };

importScripts(
   "../dictionary/dictionary-loader.js?runtime=5",
   "normalization.js?runtime=5",
   "ranking.js?runtime=5",
   "search-engine.js?runtime=5",
);

self.addEventListener("message", async (event) => {
   const message = event.data || {};
   if (message.type === "reset") {
      resetDictionaryMemory();
      return;
   }
   if (message.type !== "search") return;

   db.cards = Array.isArray(message.personalCards) ? message.personalCards : [];
   dictionaryPersonalRevision = Number(message.personalRevision) || 0;
   try {
      const response = await searchDictionaryLocally(message.rawQuery, {
         ...message.settings,
         onStatus(statusMessage) {
            self.postMessage({ type: "status", id: message.id, message: statusMessage });
         },
      });
      self.postMessage({ type: "result", id: message.id, response });
   } catch (error) {
      self.postMessage({
         type: "error",
         id: message.id,
         stale: error instanceof StaleDictionarySearchError,
         error: error && error.message ? error.message : String(error),
      });
   }
});
