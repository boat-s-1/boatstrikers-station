const PREVIOUS_KIINA_ROLE = '穴・5アタマ・展開・高配当研究';
export const KIINA_DISPLAY_ROLE = '穴・5アタマ・展開・配当分布の研究';
export function getAuthorRole(author) {
  const kiina = author?.slug === 'kiina' || author?.character_key === 'kiina';
  return kiina && author?.role === PREVIOUS_KIINA_ROLE ? KIINA_DISPLAY_ROLE : (author?.role || '');
}
