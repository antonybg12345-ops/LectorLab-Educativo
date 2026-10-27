import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['.git', 'node_modules', 'test-results', 'playwright-report', 'coverage']);

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) check(filename);
    else if (entry.isFile() && /\.(?:mjs|cjs|js)$/.test(entry.name)) {
      execFileSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
    }
  }
}

check(root);
console.log('Sintaxis JavaScript comprobada. Para verificar comportamiento: npm test y npm run test:e2e.');
