"use strict";

/* ================= sheet & toast ================= */
         let sheetReturnFocus = null;
         let sheetAbortController = null;
         let sheetScrollPosition = { x: 0, y: 0 };
         let sheetPreviousBodyOverflow = "";
         function requestSheetClose() {
            if (
               typeof activeView !== "undefined" &&
               activeView === "search" &&
               history.state &&
               history.state.moStudioSearch &&
               history.state.mode === "detail" &&
               typeof closeSearchDictionaryDetail === "function"
            )
               closeSearchDictionaryDetail();
            else closeSheet();
         }
         function openSheet(html) {
            if (typeof destroyStrokeWorkspace === "function") destroyStrokeWorkspace();
            const o = $("sheet");
            const wasOpen = o.classList.contains("open");
            if (!wasOpen) {
               sheetReturnFocus = document.activeElement;
               sheetScrollPosition = { x: window.scrollX, y: window.scrollY };
               sheetPreviousBodyOverflow = document.body.style.overflow;
            }
            if (sheetAbortController) sheetAbortController.abort();
            sheetAbortController = new AbortController();
            const signal = sheetAbortController.signal;
            o.querySelector(".sheet-card").innerHTML = html;
            o.classList.add("open");
            o.setAttribute("aria-hidden", "false");
            o.setAttribute("role", "dialog");
            o.setAttribute("aria-modal", "true");
            o.removeAttribute("aria-label");
            o.removeAttribute("aria-labelledby");
            const heading = o.querySelector("h1, h2, h3, .cd-hz, .dictionary-loading b");
            if (heading) {
               heading.id = heading.id || "mo-sheet-title";
               o.setAttribute("aria-labelledby", heading.id);
            } else {
               o.setAttribute("aria-label", "Dialogue Mò Studio");
            }
            document.querySelectorAll(".top, #view, .nav").forEach((element) => {
               element.inert = true;
            });
            document.body.style.overflow = "hidden";
            o.addEventListener("click", (event) => {
               if (event.target === o || event.target.closest("[data-sheet-close]"))
                  requestSheetClose();
            }, { signal });
            document.addEventListener("keydown", (event) => {
               if (event.key !== "Escape" || !sheetOpen()) return;
               event.preventDefault();
               event.stopImmediatePropagation();
               requestSheetClose();
            }, { signal });
            const focusSheet = () => {
               const focusTarget =
                  o.querySelector("[data-sheet-close]") ||
                  o.querySelector(
                     "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
                  );
               if (focusTarget) focusTarget.focus({ preventScroll: true });
            };
            focusSheet();
            requestAnimationFrame(focusSheet);
         }
         function closeSheet() {
            if (typeof destroyStrokeWorkspace === "function") destroyStrokeWorkspace();
            const o = $("sheet");
            if (!o.classList.contains("open")) return;
            if (sheetAbortController) sheetAbortController.abort();
            sheetAbortController = null;
            o.classList.remove("open");
            o.setAttribute("aria-hidden", "true");
            o.removeAttribute("role");
            o.removeAttribute("aria-modal");
            o.removeAttribute("aria-label");
            o.removeAttribute("aria-labelledby");
              document.querySelectorAll(".top, #view, .nav").forEach((element) => {
                 element.inert = false;
              });
              document.body.style.overflow = sheetPreviousBodyOverflow;
              o.querySelector(".sheet-card").innerHTML = "";
              window.scrollTo(sheetScrollPosition.x, sheetScrollPosition.y);
              if (sheetReturnFocus && sheetReturnFocus.isConnected)
               sheetReturnFocus.focus({ preventScroll: true });
            sheetReturnFocus = null;
         }
         const sheetOpen = () => $("sheet").classList.contains("open");
         let toastTimer = null;
         function toast(msg) {
            const t = $("toast");
            t.textContent = msg;
            t.classList.add("show");
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
         }
