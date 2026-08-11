import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const inputPath = path.join(projectRoot, "index.html");
const outputPath = path.join(projectRoot, "dist", "mo-studio-portable.html");

let html = await readFile(inputPath, "utf8");

const stylesheetPattern = /^\s*<link rel="stylesheet" href="(css\/[^"]+\.css)" \/>\s*$/gm;
const stylesheetMatches = [...html.matchAll(stylesheetPattern)];
if (!stylesheetMatches.length) {
   throw new Error("No application stylesheets found in index.html");
}

const css = (
   await Promise.all(
      stylesheetMatches.map((match) =>
         readFile(path.join(projectRoot, match[1]), "utf8"),
      ),
   )
).join("\n");

html = html.replace(stylesheetPattern, "");
const headEnd = html.indexOf("</head>");
if (headEnd < 0) throw new Error("Missing </head> in index.html");
html = `${html.slice(0, headEnd)}   <style>\n${css}   </style>\n   ${html.slice(headEnd)}`;

const scriptPattern = /^\s*<script data-mo-app src="([^"?]+\.js)(?:\?[^"]*)?"><\/script>\s*$/gm;
const scriptMatches = [...html.matchAll(scriptPattern)];
if (!scriptMatches.length) {
   throw new Error("No application scripts found in index.html");
}

const javascript = (
   await Promise.all(
      scriptMatches.map((match) =>
         readFile(path.join(projectRoot, match[1]), "utf8"),
      ),
   )
)
   .join("\n")
   .replace(/<\/script/gi, "<\\/script");

html = html.replace(scriptPattern, "");
const bodyEnd = html.indexOf("</body>");
if (bodyEnd < 0) throw new Error("Missing </body> in index.html");
html = `${html.slice(0, bodyEnd)}   <script>\n${javascript}   </script>\n${html.slice(bodyEnd)}`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(path.relative(projectRoot, outputPath));
