#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const electronDir = path.join(rootDir, 'node_modules', 'electron');
const pathFile = path.join(electronDir, 'path.txt');

function getPlatformExecutableName() {
  switch (process.platform) {
    case 'win32':
      return 'electron.exe';
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    default:
      return 'electron';
  }
}

const execName = getPlatformExecutableName();
const binaryPath = path.join(electronDir, 'dist', execName);

console.log('[PrintFlow Agent] Ensuring Electron runtime environment...');

// 1. Check if node_modules/electron directory exists
if (!fs.existsSync(electronDir)) {
  console.log('[WARN] node_modules/electron not found. Installing Electron...');
  try {
    execSync('npm install --save-dev electron@34.3.0', { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.error('[ERROR] Failed to install electron package:', err.message);
  }
}

// 2. Check if binary exists in dist/
let binaryExists = fs.existsSync(binaryPath);

// 3. If binary is missing, attempt to run install.js
if (!binaryExists) {
  console.log(`[INFO] Electron binary missing at ${binaryPath}. Running electron install script...`);
  const installScript = path.join(electronDir, 'install.js');
  
  if (fs.existsSync(installScript)) {
    // Kill any dangling locked processes on Windows
    if (process.platform === 'win32') {
      try {
        execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
      } catch {}
    }

    try {
      execSync(`node "${installScript}"`, { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      console.warn('[WARN] Standard install script encountered an issue. Trying fallback mirror...');
      try {
        execSync(`node "${installScript}"`, {
          cwd: rootDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
          }
        });
      } catch (mirrorErr) {
        console.error('[ERROR] Fallback install also failed:', mirrorErr.message);
      }
    }
    binaryExists = fs.existsSync(binaryPath);
  }
}

// 4. Ensure path.txt exists and contains the correct relative executable path
// Electron's index.js strictly relies on path.txt:
// if (!fs.existsSync(pathFile)) throw new Error('Electron failed to install correctly...')
let pathTxtValid = false;
if (fs.existsSync(pathFile)) {
  try {
    const content = fs.readFileSync(pathFile, 'utf8').trim();
    if (content === execName) {
      pathTxtValid = true;
    }
  } catch {}
}

if (!pathTxtValid && binaryExists) {
  try {
    console.log(`[FIX] Writing missing/invalid path.txt (${execName})...`);
    fs.writeFileSync(pathFile, execName, 'utf8');
    pathTxtValid = true;
    console.log('[OK] path.txt successfully restored.');
  } catch (err) {
    console.error('[ERROR] Failed to write path.txt:', err.message);
  }
}

// 5. Final status output
if (binaryExists && pathTxtValid) {
  const stat = fs.statSync(binaryPath);
  console.log(`[OK] Electron is ready: ${binaryPath} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
} else {
  console.error('\n[ATTENTION] Electron binary or path.txt is not yet configured.');
  console.error('To automatically fix this, run:');
  console.error('  npm run fix:electron');
  console.error('Or on Windows PowerShell:');
  console.error('  .\\fix-electron.ps1\n');
}
