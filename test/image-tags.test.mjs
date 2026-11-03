import test from 'node:test';
import assert from 'node:assert/strict';
import {imageTags} from '../scripts/image-tags.mjs';
const input={repository:'D-Kholin/virtues-and-vices',sha:'a'.repeat(40),runNumber:'23'};
test('feature images use normalized branch names and commit tags',()=>{
 assert.deepEqual(imageTags({...input,branch:'feature/Calendar-controls'}).tags,['ghcr.io/d-kholin/virtues-and-vices:feature-calendar-controls','ghcr.io/d-kholin/virtues-and-vices:sha-aaaaaaaaaaaa']);
});
test('main publishes numbered 1.x builds plus the moving major tag',()=>{
 assert.deepEqual(imageTags({...input,branch:'main'}).tags,['ghcr.io/d-kholin/virtues-and-vices:1.23','ghcr.io/d-kholin/virtues-and-vices:1','ghcr.io/d-kholin/virtues-and-vices:sha-aaaaaaaaaaaa']);
});
test('branches cannot replace release or commit tags',()=>{
 for(const branch of ['1','1.23','latest','sha-aaaaaaaaaaaa','...'])assert.throws(()=>imageTags({...input,branch}));
});
test('invalid inputs cannot inject workflow outputs',()=>{
 assert.throws(()=>imageTags({...input,branch:'main',runNumber:'1\nextra=true'}));
 assert.throws(()=>imageTags({...input,branch:'feature/x',repository:'owner/repo\n'}));
 assert.equal(imageTags({...input,branch:'feature/'+ 'x'.repeat(180)}).tags[0].split(':').at(-1).length,128);
});
