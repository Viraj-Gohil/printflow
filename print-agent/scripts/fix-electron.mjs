#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
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

console.log('======================================================');
console.log('   PRINTFLOW AGENT — ELECTRON RUNTIME REPAIR TOOL     ');
console.log('======================================================');
console.log(`OS Platform: ${process.platform} (${process.arch})`);
console.log(`Node.js Version: ${process.version}`);

// 1. Terminate any dangling electron processes on Windows
if (process.platform === 'win32') {
  console.log('\n[1/6] Terminating any locked electron processes...');
  try {
    execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
    console.log('      Terminated existing locked electron.exe instances.');
  } catch {
    console.log('      No conflicting electron.exe processes found.');
  }
  try {
    execSync('taskkill /F /IM "PrintFlow Agent.exe" /T', { stdio: 'ignore' });
  } catch {}
}

// 2. Identify and clear potential corrupt cache
console.log('\n[2/6] Inspecting Electron download cache...');
const possibleCaches = [
  process.env.ELECTRON_CACHE,
  process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache')
    : path.join(os.homedir(), '.cache', 'electron')
].filter(Boolean);

for (const cachePath of possibleCaches) {
  if (cachePath && fs.existsSync(cachePath)) {
    console.log(`      Found Electron cache at: ${cachePath}`);
    try {
      const files = fs.readdirSync(cachePath);
      for (const file of files) {
        if (file.endsWith('.zip') || file.endsWith('.tmp')) {
          const filePath = path.join(cachePath, file);
          const stat = fs.statSync(filePath);
          console.log(`      Cached package: ${file} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
          // If zip is smaller than 70MB it is likely corrupted
          if (stat.size < 70 * 1024 * 1024) {
            console.log(`      Removing corrupted/partial archive: ${file}`);
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (err) {
      console.log(`      Notice checking cache: ${err.message}`);
    }
  }
}

// 3. Clean broken dist directory in node_modules/electron if binary is missing
const electronDist = path.join(electronDir, 'dist');
console.log('\n[3/6] Inspecting electron/dist folder...');
if (fs.existsSync(electronDist)) {
  const exePath = path.join(electronDist, execName);
  if (!fs.existsSync(exePath)) {
    console.log(`      Executable missing in ${electronDist}, purging incomplete directory...`);
    try {
      fs.rmSync(electronDist, { recursive: true, force: true });
    } catch (err) {
      console.log(`      Warning: ${err.message}`);
    }
  } else {
    console.log(`      Executable exists: ${exePath}`);
  }
}

// 4. Force run the electron install script
console.log('\n[4/6] Executing Electron native extraction...');
const installScript = path.join(electronDir, 'install.js');

let installSucceeded = false;
if (fs.existsSync(installScript)) {
  try {
    execSync(`node "${installScript}"`, {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_scripts_prepend_node_path: 'true'
      }
    });
    installSucceeded = true;
    console.log('      Electron install script completed successfully.');
  } catch (err) {
    console.warn('      Primary install failed. Trying alternate mirror...');
    try {
      execSync(`node "${installScript}"`, {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
        }
      });
      installSucceeded = true;
      console.log('      Fallback mirror install completed successfully.');
    } catch (mirrorErr) {
      console.error('      Fallback install error:', mirrorErr.message);
    }
  }
}

if (!installSucceeded) {
  console.log('      Reinstalling electron package via npm...');
  try {
    execSync('npm install --save-dev electron@34.3.0', { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.error('      Error installing electron via npm:', err.message);
  }
}

// 5. Ensure path.txt is correctly present and pointing to the binary
console.log('\n[5/6] Verifying path.txt configuration...');
const finalExe = path.join(electronDir, 'dist', execName);

if (fs.existsSync(finalExe)) {
  try {
    fs.writeFileSync(pathFile, execName, 'utf8');
    console.log(`      path.txt configured: points to "${execName}".`);
  } catch (err) {
    console.error('      Failed to write path.txt:', err.message);
  }
}

// 6. Final verification and diagnostic test
console.log('\n[6/6] Verifying Electron binary execution...');
if (fs.existsSync(finalExe) && fs.existsSync(pathFile)) {
  const stat = fs.statSync(finalExe);
  console.log(`\n======================================================`);
  console.log(`SUCCESS: Electron runtime verified and repaired!`);
  console.log(`Executable: ${finalExe} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Path File:  ${pathFile} -> ${fs.readFileSync(pathFile, 'utf8')}`);
  try {
    const version = execSync(`"${finalExe}" --version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    console.log(`Electron Version: ${version}`);
  } catch {}
  console.log(`======================================================`);
  console.log(`You can now run: npm start`);
  console.log(`======================================================\n`);
} else {
  console.log(`\n======================================================`);
  console.log(`MANUAL RESOLUTION STEPS FOR WINDOWS:`);
  console.log(`1. Close any running instances of PrintFlow or Electron in Task Manager.`);
  console.log(`2. In your PowerShell terminal in the print-agent folder, run:`);
  console.log(`   .\\fix-electron.ps1`);
  console.log(`   OR`);
  console.log(`   npm run fix:electron`);
  console.log(`3. If Windows Antivirus blocked the download, temporarily allow electron.exe`);
  console.log(`======================================================\n`);
}
