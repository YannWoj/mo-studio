"use strict";

/* ================= navigation ================= */
         let activeView = "learn";
         let session = { active: false };
         function setView(v, options) {
            const settings = options || {};
            if (!settings.fromHistory && typeof history !== "undefined") {
               if (v === "write" && typeof searchHistoryPayload === "function")
                  history.pushState(searchHistoryPayload(srch.q ? "results" : "landing"), "");
               else history.pushState({ moStudioView: v }, "");
            }
            if (activeView === "write" && v !== "write") {
               cancelDictionarySearches();
               if (typeof cleanupSearchView === "function") cleanupSearchView();
               closeSheet();
            }
            activeView = v;
            document
               .querySelectorAll(".nav button")
               .forEach((b) =>
                  b.setAttribute("aria-pressed", String(b.dataset.view === v)),
               );
            render();
            window.scrollTo(0, 0);
         }
         function render() {
            document.body.classList.toggle(
               "in-session",
               activeView === "learn" && session.active,
            );
            if (activeView === "learn") renderLearn();
            else if (activeView === "lib") renderLib();
            else if (activeView === "write") renderSearch();
            else if (activeView === "listen") renderListen();
            else renderGrammar();
         }
         function refreshActive() {
            render();
         }

         window.addEventListener("popstate", (event) => {
            if (seq && (!event.state || event.state.mode !== "sequence")) teardownSequence();
            if (event.state && event.state.moStudioSearch) {
               restoreSearchHistory(event.state);
               return;
            }
            cancelDictionarySearches();
            if (activeView === "write" && typeof cleanupSearchView === "function")
               cleanupSearchView();
            closeSheet();
            setView((event.state && event.state.moStudioView) || "learn", {
               fromHistory: true,
            });
         });
