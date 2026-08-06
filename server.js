const { spawn } = require('node:child_process');

const lifecycleScript = process.env.NODE_ENV === 'production' ? 'start:prod' : 'start:dev';
const child = spawn('npm', ['run', lifecycleScript, '-w', 'backend'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});