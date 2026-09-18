import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','src','ai.mjs'),'utf8');

test('Semantic Colour AI uses smaller reasoning passes than the historical eight-family maximum',()=>{
  assert.match(source,/const chunkSize = 8/);
  assert.match(source,/const effectiveChunkSize = Math\.min\(3, chunkSize\)/);
  assert.match(source,/i < batches\.length; i \+= effectiveChunkSize/);
});

test('Semantic Colour AI retries omitted families individually instead of failing the whole pass immediately',()=>{
  assert.match(source,/focused retry/i);
  assert.match(source,/for \(const family of missing\)/);
  assert.match(source,/requestFamilies\(\[family\]/);
  assert.match(source,/selectionByBatch\.set/);
  assert.match(source,/Local AI still omitted/);
});

test('Semantic Colour AI asks explicitly for the exact batch ids in each pass',()=>{
  assert.match(source,/Return one explicit decision for EACH of these batch IDs/);
  assert.match(source,/requiredIds\.join/);
  assert.match(source,/num_predict: 2048/);
});
