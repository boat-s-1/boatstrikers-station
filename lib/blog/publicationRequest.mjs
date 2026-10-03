export function publicationPayload(version, action, localTime='', now=Date.now()) {
  if(action==='publish') return {version,publish_at:null};
  if(action==='schedule') {
    const at=Date.parse(localTime);
    if(!localTime||!Number.isFinite(at)||at<=now) throw new Error('未来の予約日時を選択してください。');
    return {version,publish_at:new Date(at).toISOString()};
  }
  return {version,action};
}
export function releaseTime(body) {
  // An omitted/misspelled schedule must never silently become an immediate release.
  if(!Object.hasOwn(body,'publish_at')||(body.publish_at!==null&&typeof body.publish_at!=='string'))
    throw Object.assign(new Error('公開日時の指定を確認してください。'),{status:400});
  return body.publish_at;
}
