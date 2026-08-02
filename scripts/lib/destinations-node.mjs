// Makes the app's destination dataset importable from plain Node scripts.
//
// src/data/destinations.ts is TypeScript and imports '@/lib/coords' through
// the Next path alias, so Node can't load it directly. Rather than duplicate
// the dataset here (and let it drift), transpile the two files with the
// repo's own TypeScript into temp/ and import the result.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'temp', 'compiled');
fs.mkdirSync(outDir, { recursive: true });

function transpile(rel, rewrite = (s) => s) {
  const src = fs.readFileSync(path.join(root, rel), 'utf-8');
  const js = ts.transpileModule(rewrite(src), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const outFile = path.join(outDir, path.basename(rel).replace(/\.ts$/, '.mjs'));
  fs.writeFileSync(outFile, js);
  return outFile;
}

transpile('src/lib/coords.ts');
const destFile = transpile('src/data/destinations.ts', (s) => s.replace('../lib/coords', './coords.mjs'));

export const { destinations } = await import(pathToFileURL(destFile).href);
