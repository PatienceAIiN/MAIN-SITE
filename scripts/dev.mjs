/* global process, console, setTimeout */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const nodeBin = process.execPath;
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  throw new Error('Vite is not installed. Run npm install first.');
}

const children = [];
let shuttingDown = false;

const stopAll = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => process.exit(code), 150);
};

const spawnProcess = (label, command, args) => {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      stopAll(0);
      return;
    }

    if (code !== null) {
      if (code !== 0) {
        console.error(`${label} exited with code ${code}`);
      }
      stopAll(code);
    }
  });

  children.push(child);
  return child;
};

spawnProcess('server', nodeBin, ['server.js']);
spawnProcess('client', nodeBin, [viteBin, '--host', '0.0.0.0', '--strictPort']);

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
