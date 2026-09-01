// Implementation inventory, not a claim that today's exhibition has been published.
export const INVENTORY_DATE = '2026-09-02';
const names = ['桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江','尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村'];
export const STAGES = ['接続済み','既存取得経路','調査中','公式休止中','公式対象項目なし'];
export const VENUES = names.map((name,i)=>{
 const code=i+1, verified=[5,6,10,12,14,15,18,19,20,21,22,23,24].includes(code), legacy=[4,7,9,11,13,16,17].includes(code);
 const stage=verified?'接続済み':legacy?'既存取得経路':code===8?'公式休止中':code===3?'公式対象項目なし':'調査中';
 return {code,name,stage,
  endpoint:verified?'/api/admin/verified-exhibition-check':null,
  straightAbsent:[12,13,18].includes(code),
  note:code===22?'固定HTTPS取得先を接続。公式6艇の登録番号・展示タイムを全国公式と照合。4項目対応。展示公開後の実値確認待ち。':[6,21].includes(code)?'公式の開催日・R・6艇の登録番号・展示タイムを全国公式と照合。4項目対応。':code===10?'開催中の公式ページで選択R・6艇の登録番号と独自3項目を照合。':code===24?'公式の進入コース・選手名・展示タイムを全国公式の艇番・登録番号と照合。4項目対応。':code===18?'HTTPS公式出走情報と6艇の登録番号・展示タイムを照合。直線なし。':[19,20].includes(code)?'公式HTTPSと全国公式直前情報で日付・R・6艇の登録番号・展示タイムを照合。4項目対応。':code===12?'公式の艇番・登録番号・展示タイムを全国公式と照合。直線なし。':code===23?'当日限定。翌日ページへの切替に注意。':code===5?'公式出走情報と6艇を照合。':code===8?'公式発表により機材トラブルでオリジナル展示データを当面休止。PC-KYOTEI補完を使用。':code===3?'公式オリジナル展示項目を確認できないため、通常展示またはPC-KYOTEI補完を使用。':code===1?'公式は半周ラップ・まわり足・直線を提供。取得構造と艇番照合を調査中。':code===2?'公式は一周・まわり足・直線を提供。固定取得先を調査中。':legacy?'既存の公式取得処理あり。この画面の個別診断は未接続。':'取得先・照合方法を調査中。',
 };
});
export function diagnosticStatus(body) {
 if(body?.ok && body?.identity?.verified && body?.rows?.length===6) return {label:'取得成功',tone:'good',detail:'指定レースの6艇を照合済み。理論成立・通知送信を意味しません。'};
 if(body?.ok && body?.candidateRows?.length===6) return {label:'検証データ取得',tone:'warn',detail:'6件を解析。通知未接続・追加照合が必要です。'};
 const error=String(body?.error||'');
 if(['not_published','exhibition_pending'].includes(error))return {label:'展示待ち',tone:'warn',detail:'取得元が展示未公開と明示しています。'};
 if(/identity|date|race_mismatch|current_day/.test(error))return {label:'照合不一致',tone:'bad',detail:'開催日・レース等が一致しないため採用しません。'};
 if(/measurements|six_unique|boat|row_changed/.test(error))return {label:'欠測・要確認',tone:'warn',detail:'欠測・欠場・艇番等を確認してください。未公開とは断定しません。'};
 return {label:'取得失敗',tone:'bad',detail:error==='retry_later'?'間隔を空けて再確認してください。':'通信またはページ構造の確認が必要です。'};
}
