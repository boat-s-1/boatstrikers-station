import { AUDIENCES, REPLY_POLICIES } from './accessPolicy.mjs';
export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 20000;
export const MAX_EXCERPT_LENGTH = 240;
const CHARACTER_KEYS = new Set(['ichika','hatsune','kiina']);
const AUDIENCE_VALUES = new Set(Object.values(AUDIENCES));
const REPLY_VALUES = new Set(Object.values(REPLY_POLICIES));
export function validateOfficialPost(input) {
  const errors = [];
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  const excerpt = typeof input?.excerpt === 'string' ? input.excerpt.trim() : '';
  const audience = input?.audience;
  const reply_policy = input?.reply_policy;
  const character_key = input?.character_key;
  if (!title || title.length > MAX_TITLE_LENGTH) errors.push('タイトルは1〜120文字で入力してください。');
  if (!body || body.length > MAX_BODY_LENGTH) errors.push('本文は1〜20000文字で入力してください。');
  if (excerpt.length > MAX_EXCERPT_LENGTH) errors.push('概要は240文字以内で入力してください。');
  if (!AUDIENCE_VALUES.has(audience)) errors.push('公開範囲を選択してください。');
  if (!REPLY_VALUES.has(reply_policy)) errors.push('返信設定を選択してください。');
  if (!CHARACTER_KEYS.has(character_key)) errors.push('投稿キャラクターを選択してください。');
  return { valid: errors.length === 0, errors, value: { title, body, excerpt, audience, reply_policy, character_key } };
}
