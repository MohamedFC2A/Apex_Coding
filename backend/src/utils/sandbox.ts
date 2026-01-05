import { SpawnOptions } from 'child_process';

const BLOCKED_COMMANDS = [
  'rm -rf',
  'sudo',
  'chmod',
  'chown',
  'dd',
  'mkfs',
  'fdisk',
  ':(){:|:&};:',
  'wget',
  'curl http',
  'curl https'
];

export function validateCommand(command: string): boolean {
  const lowerCmd = command.toLowerCase();
  return !BLOCKED_COMMANDS.some(blocked => lowerCmd.includes(blocked));
}

export function getSafeSpawnOptions(workDir: string): SpawnOptions {
  return {
    cwd: workDir,
    timeout: 30000, // 30 seconds
    env: {
      ...process.env,
      NODE_ENV: 'sandbox',
      // Disable proxies for sandboxed execution
      NO_PROXY: '*',
      HTTP_PROXY: '',
      HTTPS_PROXY: ''
    }
    // Note: Resource limits (CPU ≤ 70%, RAM ≤ 60%) are enforced at the OS level
    // For production, use containerization (Docker) with resource constraints
    // or OS-specific tools (cgroups on Linux, Job Objects on Windows)
  };
}

export function sanitizePath(path: string): string {
  // Remove any attempt to escape the working directory
  return path.replace(/\.\./g, '').replace(/~/g, '');
}
