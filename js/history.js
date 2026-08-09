"use strict";

/* ================= navigation ================= */
         let activeView = "learn";
         let session = { active: false };
         function setView(v, options) {
            const settings = options || {};
            if (seq && v !== "search") teardownSequence();
            if (lesson && v !== "units") teardownLesson();
            if (!settings.fromHistory && typeof history !== "undefined") {
               if (v === "search" && typeof searchHistoryPayload === "function")
                  history.pushState(searchHistoryPayload(srch.q ? "results" : "landing"), "");
               else history.pushState({ moStudioView: v }, "");
            }
            if (activeView === "search" && v !== "search") {
               cancelDictionarySearches();
               if (typeof cleanupSearchView === "function") cleanupSearchView();
               closeSheet();
            }
            if (activeView === "write" && v !== "write" && typeof destroyWritingBoard === "function")
               destroyWritingBoard();
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
            else if (activeView === "write") renderWriting();
            else if (activeView === "search") renderSearch();
            else if (activeView === "path") renderPath();
            else if (activeView === "listen") renderListen();
            else if (activeView === "units") renderLearningUnitsPicker();
            else renderGrammar();
         }
         function refreshActive() {
            render();
         }

         window.addEventListener("popstate", (event) => {
            if (seq && (!event.state || event.state.mode !== "sequence")) teardownSequence();
            if (lesson && event.state && event.state.mode === "lesson" && event.state.unitId === lesson.unit?.id) {
               lesson.step = event.state.step;
               lesson.historyDepth = event.state.historyDepth;
               renderLesson();
               return;
            }
            if (lesson) teardownLesson();
            if (event.state && event.state.moStudioSearch) {
               restoreSearchHistory(event.state);
               return;
            }
            cancelDictionarySearches();
            if (activeView === "search" && typeof cleanupSearchView === "function")
               cleanupSearchView();
            closeSheet();
            setView((event.state && event.state.moStudioView) || "learn", {
               fromHistory: true,
            });
         });
