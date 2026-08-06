/**
 * BoatStrikers 24場共通設定。
 * デザイン・API・本棚リンクはこの1ファイルを参照します。
 */
export const STADIUMS = [
  [1, 'kiryu', '桐生', 'BOAT RACE KIRYU', ['桐生']],
  [2, 'toda', '戸田', 'BOAT RACE TODA', ['戸田']],
  [3, 'edogawa', '江戸川', 'BOAT RACE EDOGAWA', ['江戸川']],
  [4, 'heiwajima', '平和島', 'BOAT RACE HEIWAJIMA', ['平和島']],
  [5, 'tamagawa', '多摩川', 'BOAT RACE TAMAGAWA', ['多摩川']],
  [6, 'hamanako', '浜名湖', 'BOAT RACE HAMANAKO', ['浜名湖', 'hamana']],
  [7, 'gamagori', '蒲郡', 'BOAT RACE GAMAGORI', ['蒲郡']],
  [8, 'tokoname', '常滑', 'BOAT RACE TOKONAME', ['常滑', 'toki']],
  [9, 'tsu', '津', 'BOAT RACE TSU', ['津']],
  [10, 'mikuni', '三国', 'BOAT RACE MIKUNI', ['三国']],
  [11, 'biwako', 'びわこ', 'BOAT RACE BIWAKO', ['びわこ', '琵琶湖']],
  [12, 'suminoe', '住之江', 'BOAT RACE SUMINOE', ['住之江']],
  [13, 'amagasaki', '尼崎', 'BOAT RACE AMAGASAKI', ['尼崎']],
  [14, 'naruto', '鳴門', 'BOAT RACE NARUTO', ['鳴門']],
  [15, 'marugame', '丸亀', 'BOAT RACE MARUGAME', ['丸亀']],
  [16, 'kojima', '児島', 'BOAT RACE KOJIMA', ['児島']],
  [17, 'miyajima', '宮島', 'BOAT RACE MIYAJIMA', ['宮島']],
  [18, 'tokuyama', '徳山', 'BOAT RACE TOKUYAMA', ['徳山']],
  [19, 'shimonoseki', '下関', 'BOAT RACE SHIMONOSEKI', ['下関']],
  [20, 'wakamatsu', '若松', 'BOAT RACE WAKAMATSU', ['若松']],
  [21, 'ashiya', '芦屋', 'BOAT RACE ASHIYA', ['芦屋']],
  [22, 'fukuoka', '福岡', 'BOAT RACE FUKUOKA', ['福岡']],
  [23, 'karatsu', '唐津', 'BOAT RACE KARATSU', ['唐津', 'karatu']],
  [24, 'omura', '大村', 'BOAT RACE OMURA', ['大村']],
].map(([courseCode, slug, name, englishName, aliases]) => ({
  courseCode,
  slug,
  name,
  englishName,
  aliases,
}));

const ALIAS_MAP = new Map();
for (const stadium of STADIUMS) {
  ALIAS_MAP.set(stadium.slug.toLowerCase(), stadium.slug);
  ALIAS_MAP.set(String(stadium.courseCode), stadium.slug);
  ALIAS_MAP.set(String(stadium.courseCode).padStart(2, '0'), stadium.slug);
  ALIAS_MAP.set(stadium.name, stadium.slug);
  for (const alias of stadium.aliases || []) ALIAS_MAP.set(String(alias).toLowerCase(), stadium.slug);
}

export function resolveStadium(value) {
  const decoded = decodeURIComponent(String(value || 'kiryu')).trim();
  const slug = ALIAS_MAP.get(decoded) || ALIAS_MAP.get(decoded.toLowerCase()) || decoded.toLowerCase();
  return STADIUMS.find(item => item.slug === slug) || null;
}

export function stadiumPath(stadiumOrValue) {
  const stadium = typeof stadiumOrValue === 'object' ? stadiumOrValue : resolveStadium(stadiumOrValue);
  return stadium ? `/library/stadium/${stadium.slug}` : '/library/stadiums';
}
