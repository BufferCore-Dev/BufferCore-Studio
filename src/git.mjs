import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function defaultRunner(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe']
  }).trim();
}

function git(run, repoPath, args) {
  return run('git', args, { cwd: repoPath });
}

export function repoState(repoPath, run = defaultRunner) {
  if (!fs.existsSync(repoPath)) return { available: false, path: path.resolve(repoPath) };
  try {
    const inside = git(run, repoPath, ['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') return { available: false, path: path.resolve(repoPath) };
    const branch = git(run, repoPath, ['branch', '--show-current']);
    const commit = git(run, repoPath, ['rev-parse', 'HEAD']);
    const porcelain = git(run, repoPath, ['status', '--porcelain=v1']);
    let remoteUrl = null;
    try { remoteUrl = git(run, repoPath, ['remote', 'get-url', 'origin']); } catch {}
    const status = porcelain ? porcelain.split(/\r?\n/).filter(Boolean) : [];
    return {
      available: true,
      path: path.resolve(repoPath),
      branch,
      commit,
      remoteUrl,
      dirty: status.length > 0,
      status
    };
  } catch (error) {
    return { available: false, path: path.resolve(repoPath), error: error?.message || String(error) };
  }
}

export function commitAndPush(repoPath, message, run = defaultRunner) {
  const before = repoState(repoPath, run);
  if (!before.available) throw new Error(`Not a Git repository: ${repoPath}`);
  if (!message || !message.trim()) throw new Error('Commit message is required.');
  if (!before.dirty) throw new Error('There are no changes to commit.');
  git(run, repoPath, ['add', '--all']);
  git(run, repoPath, ['commit', '-m', message.trim()]);
  git(run, repoPath, ['push', 'origin', before.branch]);
  return repoState(repoPath, run);
}
