"use strict";

/* ================= initialisation ================= */
         async function init() {
            await personalLibraryInit();
            refreshVoices();
            document
               .querySelectorAll(".nav button")
               .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
            $("btn-settings").onclick = openSettings;
            // audio : tout élément portant data-say est cliquable
            document.addEventListener("click", (e) => {
               const el = e.target.closest("[data-say]");
               if (el) speak(el.getAttribute("data-say"));
            });
            // import de fichier
            $("file-global").addEventListener("change", (e) => {
               const f = e.target.files[0];
               e.target.value = "";
               if (!f) return;
               const r = new FileReader();
               r.onload = () => {
                  try {
                     openImportSheet(JSON.parse(r.result));
                  } catch (err) {
                     toast("Fichier JSON invalide.");
                  }
               };
               r.onerror = () => toast("Impossible de lire le fichier.");
               r.readAsText(f);
            });
            // raccourcis clavier
            document.addEventListener("keydown", (e) => {
               if (sheetOpen()) {
                  const tag = (e.target.tagName || "").toLowerCase();
                  const editing =
                     tag === "input" || tag === "textarea" || tag === "select" ||
                     (e.target && e.target.isContentEditable);
                  if (e.defaultPrevented || editing) return;
                  const characterButton =
                     e.key === "ArrowLeft"
                        ? $("dd-character-prev")
                        : e.key === "ArrowRight"
                          ? $("dd-character-next")
                          : null;
                  if (
                     characterButton &&
                     typeof ddStrokeTab !== "undefined" &&
                     ddStrokeTab === "practice"
                  )
                     return;
                  if (characterButton && !characterButton.disabled) {
                     e.preventDefault();
                     characterButton.click();
                  }
                  return;
               }
               if (seq) {
                  if (typeof ddStrokeTab !== "undefined" && ddStrokeTab === "practice") {
                     if (e.key === "Escape") closeSequence();
                     return;
                  }
                  if (
                     e.defaultPrevented ||
                     (e.target.closest && e.target.closest(".stroke-workspace, .stroke-focus"))
                  ) return;
                  const tag = (e.target.tagName || "").toLowerCase();
                  if (
                     tag === "input" || tag === "textarea" || tag === "select" ||
                     (e.target && e.target.isContentEditable)
                  ) return;
                  if (e.key === "ArrowRight" && $("seq-next"))
                     $("seq-next").click();
                  else if (
                     e.key === "ArrowLeft" &&
                     $("seq-prev") &&
                     !$("seq-prev").disabled
                  )
                     $("seq-prev").click();
                  else if (e.key === "Escape") closeSequence();
                  return;
               }
               if (!session.active || activeView !== "learn") return;
               const tag = (e.target.tagName || "").toLowerCase();
               if (tag === "input" || tag === "textarea" || tag === "select") {
                  if (e.key === "Enter" && $("s-check")) {
                     e.preventDefault();
                     checkWritten();
                  }
                  return;
               }
               const grades = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
               if (grades[e.key]) {
                  const b = document.querySelector(
                     '[data-grade="' + grades[e.key] + '"]',
                  );
                  if (b) {
                     e.preventDefault();
                     b.click();
                     return;
                  }
               }
               if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if ($("s-flip")) $("s-flip").click();
                  else if ($("s-next")) $("s-next").click();
               } else if (e.key === "ArrowRight" && $("s-next"))
                  $("s-next").click();
               else if (
                  e.key === "ArrowLeft" &&
                  $("s-prev") &&
                  !$("s-prev").disabled
               )
                  $("s-prev").click();
               else if (e.key === "Escape") endSession();
            });
            if (!history.state)
               history.replaceState({ moStudioView: "learn" }, "");
            if (history.state && history.state.moStudioSearch)
               restoreSearchHistory(history.state);
            else
               setView((history.state && history.state.moStudioView) || "learn", {
                  fromHistory: true,
               });
         }
         init();
