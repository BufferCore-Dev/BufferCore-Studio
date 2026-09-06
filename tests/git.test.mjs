import test from 'node:test';
import assert from 'node:assert/strict';
import { repoState, commitAndPush } from '../src/git.mjs';

function fakeRunner(responses, calls) {
  return (cmd,args,opts)=>{ calls.push({cmd,args,cwd:opts.cwd}); const key=args.join(' '); if(key in responses){const v=responses[key]; if(v instanceof Error) throw v; return v;} return ''; };
}

test('repoState reports stable branch commit and dirty files',()=>{
  const calls=[];
  const run=fakeRunner({
    'rev-parse --is-inside-work-tree':'true',
    'branch --show-current':'main',
    'rev-parse HEAD':'abcdef1234567890',
    'status --porcelain=v1':' M file.txt',
    'remote get-url origin':'git@example/repo.git'
  },calls);
  const state=repoState(process.cwd(),run);
  assert.equal(state.available,true);
  assert.equal(state.branch,'main');
  assert.equal(state.dirty,true);
  assert.deepEqual(state.status,[' M file.txt']);
});

test('commitAndPush stages all, commits and pushes current branch',()=>{
  const calls=[];
  let statusCount=0;
  const run=(cmd,args,opts)=>{
    calls.push(args.join(' '));
    const key=args.join(' ');
    if(key==='rev-parse --is-inside-work-tree') return 'true';
    if(key==='branch --show-current') return 'main';
    if(key==='rev-parse HEAD') return statusCount ? 'after' : 'before';
    if(key==='status --porcelain=v1') { statusCount++; return statusCount===1?' M file.txt':''; }
    if(key==='remote get-url origin') return 'git@example/repo.git';
    return '';
  };
  const result=commitAndPush(process.cwd(),'Update tokens',run);
  assert.ok(calls.includes('add --all'));
  assert.ok(calls.includes('commit -m Update tokens'));
  assert.ok(calls.includes('push origin main'));
  assert.equal(result.dirty,false);
});

test('commitAndPush refuses an empty commit message',()=>{
  const run=fakeRunner({
    'rev-parse --is-inside-work-tree':'true','branch --show-current':'main','rev-parse HEAD':'abc','status --porcelain=v1':' M x','remote get-url origin':'x'
  },[]);
  assert.throws(()=>commitAndPush(process.cwd(),'   ',run),/Commit message is required/);
});
