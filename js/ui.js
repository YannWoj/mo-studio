"use strict";

/* ================= sheet & toast ================= */
         let sheetReturnFocus = null;
         function openSheet(html) {
            if (typeof destroyStrokeWorkspace === "function") destroyStrokeWorkspace();
            const o = $("sheet");
            if (!o.classList.contains("open")) sheetReturnFocus = document.activeElement;
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
            const focusSheet = () => {
               const focusTarget = o.querySelector(
                  "[data-sheet-close], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
               );
               if (focusTarget) focusTarget.focus({ preventScroll: true });
            };
            focusSheet();
            requestAnimationFrame(focusSheet);
         }
         function closeSheet() {
            if (typeof destroyStrokeWorkspace === "function") destroyStrokeWorkspace();
            const o = $("sheet");
            o.classList.remove("open");
            o.setAttribute("aria-hidden", "true");
            o.removeAttribute("role");
            o.removeAttribute("aria-modal");
            o.removeAttribute("aria-label");
            o.removeAttribute("aria-labelledby");
              document.querySelectorAll(".top, #view, .nav").forEach((element) => {
                 element.inert = false;
              });
              document.body.style.overflow = "";
              o.querySelector(".sheet-card").innerHTML = "";
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
