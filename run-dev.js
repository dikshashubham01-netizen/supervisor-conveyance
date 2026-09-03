import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════════════════════════');
console.log('\x1b[32m%s\x1b[0m', '  🚀 Starting Supervisor Location & Bike Conveyance System...   ');
console.log('\x1b[32m%s\x1b[0m', '══════════════════════════════════════════════════════════════════');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = isWindows ? 'node.exe' : 'node';

// 1. Launch Backend
const server = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[36m[Backend]\x1b[0m ${data}`);
});
server.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[Backend Err]\x1b[0m ${data}`);
});

// 2. Launch Client
const client = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'pipe',
  shell: true
});

client.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[32m[Client]\x1b[0m ${data}`);
});
client.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[33m[Client Err]\x1b[0m ${data}`);
});

function cleanup() {
  console.log('\nStopping servers...');
  server.kill();
  client.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
