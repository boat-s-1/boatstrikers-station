import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyKiryuExhibition } from '../lib/kiryuExhibitionDiagnostic.js';

const ranking=`<table><tr><th></th><th>1位</th><th>2位</th><th>3位</th></tr>
<tr><th>半周ラップ</th><td>1</td><td>2</td><td>5</td></tr>
<tr><th>まわり足</th><td>3 4</td><td>2</td><td>1</td></tr>
<tr><th>直線</th><td>1</td><td>2</td><td>5</td></tr></table>`;

test('Kiryu rank table is kept separate from measurement times',()=>{
 const result=classifyKiryuExhibition(ranking);
 assert.equal(result.classification,'rank_only');
 assert.equal(result.persistenceAllowed,false);
 assert.deepEqual(result.rankings.straight[0],{rank:1,boats:[1]});
 assert.equal(result.theoryUse.kiinaRankCandidate,true);
 assert.equal('rows' in result,false);
});
test('Kiryu non-racing page is explicit',()=>assert.equal(classifyKiryuExhibition('<h2>非開催</h2><p>次節開催までお待ちください</p>').classification,'not_published'));
test('labels without verified six-boat values remain candidates only',()=>{
 const result=classifyKiryuExhibition('<p>半周ラップ/まわり足/直線/展示の測定位置とは</p>');
 assert.equal(result.classification,'measurement_candidate');assert.equal(result.persistenceAllowed,false);
});
