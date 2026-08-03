import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const packageRoot = path.join(projectRoot, "node_modules");
const dataPackageRoot = path.join(packageRoot, "hanzi-writer-data");
const writerPackageRoot = path.join(packageRoot, "hanzi-writer");
const dataOutput = path.join(projectRoot, "data", "generated", "hanzi-writer", "2.0.1");
const writerOutput = path.join(projectRoot, "vendor", "hanzi-writer", "3.7.3");

async function readPackage(directory, expectedName, expectedVersion) {
   const metadata = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
   if (metadata.name !== expectedName || metadata.version !== expectedVersion) {
      throw new Error(
         `Expected ${expectedName}@${expectedVersion}, found ${metadata.name}@${metadata.version}`,
      );
   }
   return metadata;
}

await readPackage(dataPackageRoot, "hanzi-writer-data", "2.0.1");
await readPackage(writerPackageRoot, "hanzi-writer", "3.7.3");

const sourceFiles = (await readdir(dataPackageRoot, { withFileTypes: true }))
   .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
   .map((entry) => entry.name)
   .sort((left, right) => left.localeCompare(right, "zh"));

if (!sourceFiles.length) throw new Error("No Hanzi Writer character JSON files found");

await rm(dataOutput, { recursive: true, force: true });
await mkdir(dataOutput, { recursive: true });
for (const filename of sourceFiles) {
   await copyFile(path.join(dataPackageRoot, filename), path.join(dataOutput, filename));
}
await copyFile(
   path.join(dataPackageRoot, "ARPHICPL.TXT"),
   path.join(dataOutput, "ARPHICPL.TXT"),
);
await writeFile(
   path.join(dataOutput, "manifest.json"),
   `${JSON.stringify(
      {
         format: "mo-studio-hanzi-writer-data",
         package: "hanzi-writer-data",
         version: "2.0.1",
         characterFileCount: sourceFiles.length,
         source: "https://github.com/chanind/hanzi-writer-data",
         derivedFrom: "Make Me a Hanzi",
         license: "Arphic Public License; see ARPHICPL.TXT",
      },
      null,
      2,
   )}\n`,
   "utf8",
);

await rm(writerOutput, { recursive: true, force: true });
await mkdir(writerOutput, { recursive: true });
await copyFile(
   path.join(writerPackageRoot, "dist", "hanzi-writer.min.js"),
   path.join(writerOutput, "hanzi-writer.min.js"),
);
await copyFile(path.join(writerPackageRoot, "LICENSE"), path.join(writerOutput, "LICENSE"));

console.log(
   `Prepared ${sourceFiles.length} characters from hanzi-writer-data@2.0.1 and hanzi-writer@3.7.3`,
);
