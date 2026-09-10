import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateImageFrames, resolveImageDurations } from '../src/lib/scene-timing.js';
test('overlong first image cannot consume scene', () => {
  assert.deepEqual(allocateImageFrames([{duration:30},{duration:10},{duration:10}],3,1800,60),[600,600,600]);
});
test('stale five-second Modal plan falls back to actual thirty seconds', () => {
  assert.deepEqual(allocateImageFrames([{duration:1.67},{duration:1.67},{duration:1.66}],3,1800,60),[600,600,600]);
});
test('valid unequal plan and explicit image order survive', () => {
  assert.deepEqual(resolveImageDurations([{image_number:3,duration:15},{image_number:1,duration:5},{image_number:2,duration:10}],3,30),[5,10,15]);
});
test('malformed and collapsed plans are replaced', () => {
  for (const plan of [null, [null,{},{}], [{duration:30},{duration:.2},{duration:.2}], [{duration:-2},{duration:2},{duration:30}]]) {
    assert.deepEqual(allocateImageFrames(plan,3,1800,60),[600,600,600]);
  }
});
test('frame rounding stays exact with no lost images', () => {
  for (let n=1;n<=40;n++) for (const frames of [n*2,n*2+1,1801]) {
    const result=allocateImageFrames(null,n,frames,60);
    assert.equal(result.length,n);
    assert.equal(result.reduce((a,b)=>a+b,0),frames);
    assert.ok(result.every(x=>Number.isInteger(x)&&x>=2));
  }
  assert.throws(()=>allocateImageFrames(null,3,5,60));
});
