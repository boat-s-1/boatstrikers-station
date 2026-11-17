// No dependencies or DB access. Source contracts run by default.
// Optional real-Next HTTP checks: SEO_TITLE_TEST_ORIGIN=https://<preview> node --test tests/seo/title-regression.test.mjs
// For protected Preview use an in-memory, origin-scoped caller-provided header; never log credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
async function metadata(file) {
  const source = await read(file);
  const match = source.match(/export const metadata\s*=\s*([\s\S]*?);\r?\n/);
  assert.ok(match, file + ': metadata export');
  return plain(runInNewContext('(' + match[1] + ')', {URL}));
}
async function generator(file, bindings) {
  const source = await read(file);
  const match = source.match(/export (async function generateMetadata\([^]*?\n})/);
  assert.ok(match, file + ': generateMetadata export');
  return runInNewContext('(' + match[1] + ')', bindings);
}
const staticCases = [
  {
    "file": "app/about/page.js",
    "title": "BoatStrikersについて",
    "preserved": {
      "description": "BoatStrikersは、出走表、展示情報、初心者講座、全国24場攻略、DATA LABによる独自データ検証などを発信するボートレース情報サイトです。",
      "alternates": {
        "canonical": "/about"
      },
      "openGraph": {
        "title": "BoatStrikersについて",
        "description": "ボートレースをもっと楽しく、もっと分かりやすく。BoatStrikersのコンセプト、DATA LABの検証方針、掲載情報の考え方をご紹介します。",
        "url": "/about",
        "type": "website"
      }
    }
  },
  {
    "file": "app/newspapers/page.js",
    "title": "予想新聞",
    "preserved": {
      "description": "一果・初音・キイナの予想新聞。前日版・直前版と過去記事を公式サイトで確認できます。"
    }
  },
  {
    "file": "app/library/stadiums/page.js",
    "title": "全国24場 DATA BOOK",
    "preserved": {
      "description": "全国24場の直近1年データ、出目、季節、風、展示AI、今日の出走表と直前評価を場別に確認できます。"
    }
  },
  {
    "file": "app/library/stadium/shimonoseki/page.js",
    "title": "ボートレース下関の特徴・水面・風・コース傾向",
    "preserved": {
      "description": "ボートレース下関の特徴を初心者向けに解説。海水面、風や潮位の見方、イン逃げ・コース別傾向、展示で確認したいポイントをBoatStrikersのデータブックとあわせて紹介します。",
      "alternates": {
        "canonical": "/library/stadium/shimonoseki"
      },
      "openGraph": {
        "title": "ボートレース下関の特徴・水面・風・コース傾向｜BoatStrikers",
        "description": "ボートレース下関の水面・風・潮位・コース傾向を、データと初心者向け解説で確認できます。",
        "url": "/library/stadium/shimonoseki",
        "type": "article"
      }
    }
  },
  {
    "file": "app/schedule/page.js",
    "title": "ボートレース番組表・今週の配信予定",
    "preserved": {
      "description": "BoatStrikersの週間番組表。今週のボートレース関連動画、ラジオ、記事などの公開予定を曜日別に確認できます。今日の出走表や初心者ガイドにもつながります。",
      "alternates": {
        "canonical": "/schedule"
      },
      "openGraph": {
        "title": "ボートレース番組表・今週の配信予定｜BoatStrikers",
        "description": "今週のボートレース関連コンテンツの公開予定をまとめて確認できます。",
        "url": "/schedule",
        "type": "website"
      }
    }
  },
  {
    "file": "app/races/layout.js",
    "title": "本日のボートレース出走表・レース情報",
    "preserved": {
      "description": "今日のボートレース開催場、出走表、締切時刻、選手・モーター・展示情報、AI注目レースをBoatStrikersでまとめて確認できます。",
      "alternates": {
        "canonical": "/races"
      },
      "openGraph": {
        "title": "本日のボートレース出走表・レース情報｜BoatStrikers",
        "description": "今日の開催場・出走表・展示・モーター・AI注目レースをまとめて確認。",
        "url": "/races",
        "type": "website"
      }
    }
  },
  {
    "file": "app/hatsune/schedule/page.js",
    "title": "女子戦スケジュール | 初音",
    "preserved": {
      "description": "オールレディース、ヴィーナスシリーズなど女子ボートレースの開催予定を見やすくまとめています。"
    }
  },
  {
    "file": "app/library/free/page.js",
    "title": "無料新聞",
    "preserved": {
      "description": "一果・初音・キイナの前日版への案内ページです。",
      "alternates": {
        "canonical": "/library/free"
      },
      "robots": {
        "index": false,
        "follow": true
      }
    }
  },
  {
    "file": "app/library/ichika-seminar/page.js",
    "title": "一果のイン逃げ鉄板ゼミ",
    "preserved": {}
  },
  {
    "file": "app/library/hatsune-seminar/page.js",
    "title": "初音の女子戦攻略マガジン",
    "preserved": {}
  },
  {
    "file": "app/library/kiina-seminar/page.js",
    "title": "キイナの穴党新聞",
    "preserved": {}
  }
];
const guards = [
  {
    "file": "app/layout.js",
    "expected": {
      "metadataBase": "https://www.boat-strike.online/",
      "title": {
        "default": "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
        "template": "%s｜BoatStrikers"
      },
      "description": "BoatStrikersは、ボートレースの出走表、展示比較、初心者講座、漫画、ラジオ、24場攻略を楽しめる情報サイトです。"
    }
  },
  {
    "file": "app/page.js",
    "expected": {
      "title": {
        "absolute": "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく"
      },
      "description": "BoatStrikersは、出走表、展示比較、キャラクター予想、初心者講座、漫画、ラジオ、24場攻略を楽しめるボートレース情報サイトです。",
      "alternates": {
        "canonical": "/"
      },
      "openGraph": {
        "title": "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
        "description": "全国24場攻略、展示データ、選手・女子戦ニュース、初心者講座を発信するボートレース情報メディアです。",
        "url": "/",
        "type": "website"
      }
    }
  },
  {
    "file": "app/ichika/page.js",
    "expected": {
      "title": "一果｜イン逃げ・1号艇分析・ボートレース攻略",
      "description": "BoatStrikers一果の専門ページ。イン逃げ、1号艇、進入、スタート、展示、相手関係の見方を解説し、新聞・研究記事・成績とあわせて確認できます。",
      "alternates": {
        "canonical": "/ichika"
      },
      "openGraph": {
        "title": "一果｜イン逃げ・1号艇分析｜BoatStrikers",
        "description": "イン逃げを艇番だけで決めず、進入・スタート・展示・相手関係まで重ねて見るBoatStrikers一果の専門ページです。",
        "url": "/ichika",
        "type": "website"
      }
    }
  },
  {
    "file": "app/hatsune/page.js",
    "expected": {
      "title": "初音｜女子戦・女子レーサー分析・ボートレース攻略",
      "description": "BoatStrikers初音の専門ページ。女子戦を級別だけで決めず、コース、今節成績、スタート、モーター、展示の順に確認する見方を解説します。",
      "alternates": {
        "canonical": "/hatsune"
      },
      "openGraph": {
        "title": "初音｜女子戦・女子レーサー分析｜BoatStrikers",
        "description": "女子戦をコース・今節成績・スタート・モーター・展示から整理するBoatStrikers初音の専門ページです。",
        "url": "/hatsune",
        "type": "website"
      }
    }
  },
  {
    "file": "app/kiina/page.js",
    "expected": {
      "title": "キイナ｜5号艇・穴狙い・ボートレース分析",
      "description": "BoatStrikersキイナの専門ページ。5号艇や人気薄をオッズだけで選ばず、スタート、センターの攻め、展示、モーター、展開から穴の入口を探す見方を解説します。",
      "alternates": {
        "canonical": "/kiina"
      },
      "openGraph": {
        "title": "キイナ｜5号艇・穴狙い分析｜BoatStrikers",
        "description": "5号艇や人気薄をスタート・展示・モーター・展開から比較するBoatStrikersキイナの専門ページです。",
        "url": "/kiina",
        "type": "website"
      }
    }
  },
  {
    "file": "app/races/page.js",
    "expected": {
      "title": "本日のボートレース出走表・レース情報",
      "description": "本日開催されるボートレースの出走表、選手情報、モーター成績、展示情報、BoatStrikers独自分析を確認できます。"
    }
  }
];

for (const {file,title,preserved} of staticCases) {
  test(file + ': HTML title and all other metadata', async () => {
    const actual = await metadata(file);
    assert.equal(actual.title, title);
    assert.doesNotMatch(actual.title, /[｜|]\s*BoatStrikers$/);
    delete actual.title;
    assert.deepEqual(actual, preserved);
  });
}
for (const {file,expected} of guards) {
  test(file + ': normal metadata including parent template stays intact', async () => {
    assert.deepEqual(await metadata(file), expected);
  });
}

const stadiumSource = await read('lib/stadiums.js');
const {STADIUMS,resolveStadium} = await import('data:text/javascript;base64,' + Buffer.from(stadiumSource).toString('base64'));
assert.equal(STADIUMS.length, 24);
const stadiumMetadata = await generator('app/library/stadium/[place]/layout.js', {resolveStadium});
for (const stadium of STADIUMS) {
  test('stadium ' + stadium.slug + ': HTML title, OGP and canonical', async () => {
    const title = 'ボートレース' + stadium.name + 'の特徴・水面・風・コース傾向';
    const actual = stadium.slug === 'shimonoseki'
      ? await metadata('app/library/stadium/shimonoseki/page.js')
      : plain(await stadiumMetadata({params:Promise.resolve({place:stadium.slug})}));
    assert.equal(actual.title, title);
    assert.equal(actual.openGraph.title, title + '｜BoatStrikers');
    assert.equal(actual.alternates.canonical, '/library/stadium/' + stadium.slug);
    assert.equal(actual.openGraph.url, actual.alternates.canonical);
    assert.equal(actual.openGraph.type, 'article');
    assert.doesNotMatch(actual.title + '｜BoatStrikers', /BoatStrikers｜BoatStrikers/);
    // Next also derives Twitter title from this unchanged openGraph.title.
    assert.equal(Object.hasOwn(actual, 'twitter'), false);
  });
}
test('invalid stadium preserves its existing fallback', async () => {
  assert.deepEqual(plain(await stadiumMetadata({params:Promise.resolve({place:'not-a-stadium'})})), {
    title:'24場攻略｜BoatStrikers',description:'全国24ボートレース場の場別データと攻略情報を掲載しています。',
  });
});
test('newspaper uses the original dynamic item title without removing its content', async () => {
  for (const title of ['【9/28 前日版】芦屋7R｜初音新聞','BoatStrikers取材記録｜原典タイトル']) {
    let requested;
    const item = {title,summary:'原文の要約',slug:'新聞-テスト',course_name:'芦屋',race_no:7};
    const generate = await generator('app/newspapers/[slug]/page.js', {getNewspaperCached:async slug => {requested=slug;return item;}});
    const result = plain(await generate({params:Promise.resolve({slug:encodeURIComponent(item.slug)})}));
    assert.equal(requested,item.slug);
    assert.deepEqual(result,{title,description:item.summary,alternates:{canonical:'/newspapers/'+encodeURIComponent(item.slug)}});
  }
});
test('newspaper summary and missing-item fallbacks stay intact', async () => {
  const generate = await generator('app/newspapers/[slug]/page.js', {getNewspaperCached:async slug => slug==='missing'?null:{title:'元の記事名',course_name:'芦屋',race_no:7}});
  assert.deepEqual(plain(await generate({params:{slug:'missing'}})),{title:'新聞が見つかりません｜BoatStrikers'});
  assert.deepEqual(plain(await generate({params:{slug:'original'}})),{title:'元の記事名',description:'芦屋7Rの予想新聞',alternates:{canonical:'/newspapers/original'}});
});

// These checks exercise the real Next.js response, rather than reproducing its template resolver.
// Published article fixtures may change; update them only after checking the public original.
const httpCases = [
  {
    "path": "/about",
    "title": "BoatStrikersについて｜BoatStrikers"
  },
  {
    "path": "/",
    "title": "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく"
  },
  {
    "path": "/schedule",
    "title": "ボートレース番組表・今週の配信予定｜BoatStrikers"
  },
  {
    "path": "/program",
    "title": "ボートレース番組表・今週の配信予定｜BoatStrikers"
  },
  {
    "path": "/races",
    "title": "本日のボートレース出走表・レース情報｜BoatStrikers"
  },
  {
    "path": "/races/01?date=2026-10-19",
    "title": "本日のボートレース出走表・レース情報｜BoatStrikers"
  },
  {
    "path": "/races/01/info?date=2026-10-19",
    "title": "本日のボートレース出走表・レース情報｜BoatStrikers"
  },
  {
    "path": "/races/01/1?date=2026-10-19",
    "title": "本日のボートレース出走表・レース情報｜BoatStrikers"
  },
  {
    "path": "/races/01/newspaper?date=2026-10-19",
    "title": "本日のボートレース出走表・レース情報｜BoatStrikers"
  },
  {
    "path": "/newspapers",
    "title": "予想新聞｜BoatStrikers"
  },
  {
    "path": "/news",
    "title": "BoatStrikers NEWS | ボートレース最新ニュース｜BoatStrikers"
  },
  {
    "path": "/news/media",
    "title": "MEDIA | BoatStrikers NEWS｜BoatStrikers"
  },
  {
    "path": "/blog",
    "title": "BOATSTRIKERS BLOG｜ボートレースを調べる・学ぶ・読む"
  },
  {
    "path": "/blog?q=展示",
    "title": "BOATSTRIKERS BLOG｜ボートレースを調べる・学ぶ・読む"
  },
  {
    "path": "/blog/authors",
    "title": "著者一覧｜BOATSTRIKERS BLOG"
  },
  {
    "path": "/blog/authors/ichika",
    "title": "一果の記事一覧｜BOATSTRIKERS BLOG"
  },
  {
    "path": "/blog/categories",
    "title": "カテゴリー一覧｜BOATSTRIKERS BLOG"
  },
  {
    "path": "/blog/tags",
    "title": "タグ一覧｜BOATSTRIKERS BLOG"
  },
  {
    "path": "/hatsune",
    "title": "初音｜女子戦・女子レーサー分析・ボートレース攻略｜BoatStrikers"
  },
  {
    "path": "/ichika",
    "title": "一果｜イン逃げ・1号艇分析・ボートレース攻略｜BoatStrikers"
  },
  {
    "path": "/library/stadiums",
    "title": "全国24場 DATA BOOK｜BoatStrikers"
  },
  {
    "path": "/kiina",
    "title": "キイナ｜5号艇・穴狙い・ボートレース分析｜BoatStrikers"
  },
  {
    "path": "/library/stadium/kiryu",
    "title": "ボートレース桐生の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/toda",
    "title": "ボートレース戸田の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/edogawa",
    "title": "ボートレース江戸川の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/heiwajima",
    "title": "ボートレース平和島の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/hamanako",
    "title": "ボートレース浜名湖の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/tamagawa",
    "title": "ボートレース多摩川の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/gamagori",
    "title": "ボートレース蒲郡の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/tokoname",
    "title": "ボートレース常滑の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/mikuni",
    "title": "ボートレース三国の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/tsu",
    "title": "ボートレース津の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/suminoe",
    "title": "ボートレース住之江の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/biwako",
    "title": "ボートレースびわこの特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/amagasaki",
    "title": "ボートレース尼崎の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/naruto",
    "title": "ボートレース鳴門の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/marugame",
    "title": "ボートレース丸亀の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/kojima",
    "title": "ボートレース児島の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/tokuyama",
    "title": "ボートレース徳山の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/miyajima",
    "title": "ボートレース宮島の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/shimonoseki",
    "title": "ボートレース下関の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/wakamatsu",
    "title": "ボートレース若松の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/fukuoka",
    "title": "ボートレース福岡の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/ashiya",
    "title": "ボートレース芦屋の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/karatsu",
    "title": "ボートレース唐津の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/stadium/omura",
    "title": "ボートレース大村の特徴・水面・風・コース傾向｜BoatStrikers"
  },
  {
    "path": "/library/free",
    "title": "無料新聞｜BoatStrikers"
  },
  {
    "path": "/library/ichika-seminar",
    "title": "一果のイン逃げ鉄板ゼミ｜BoatStrikers"
  },
  {
    "path": "/library/hatsune-seminar",
    "title": "初音の女子戦攻略マガジン｜BoatStrikers"
  },
  {
    "path": "/library/kiina-seminar",
    "title": "キイナの穴党新聞｜BoatStrikers"
  },
  {
    "path": "/hatsune/schedule",
    "title": "女子戦スケジュール | 初音｜BoatStrikers"
  },
  {
    "path": "/hatsune/news",
    "title": "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく"
  },
  {
    "path": "/library/weekly",
    "title": "BoatStrikers Weekly｜BoatStrikers図書館｜BoatStrikers"
  },
  {
    "path": "/newspapers/2026-09-28-hatsune-芦屋-7r-previous_day",
    "title": "【9/28 前日版】芦屋7R｜初音新聞｜BoatStrikers"
  },
  {
    "path": "/newspapers/2026-09-28-hatsune-芦屋-9r-previous_day",
    "title": "【9/28 前日版】芦屋9R｜初音新聞｜BoatStrikers"
  },
  {
    "path": "/newspapers/2026-09-28-hatsune-芦屋-8r-previous_day",
    "title": "【9/28 前日版】芦屋8R｜初音新聞｜BoatStrikers"
  },
  {
    "path": "/news/2081",
    "title": "堀之内紀代子が若松3度目のV/若松・ヴィーナスシリーズ マクール杯 | ボートレース（競艇）【マクール】 | BoatStrikers NEWS｜BoatStrikers"
  },
  {
    "path": "/news/2078",
    "title": "【ボートレース】堀之内紀代子がきっちり逃げて今年２度目Ｖ「舟が向きすぎました」／若松 - ボート : 日刊スポーツ | BoatStrikers NEWS｜BoatStrikers"
  },
  {
    "path": "/news/media/9Ll0H3mBGzE",
    "title": "三国・たけふ菊人形賞5日目公式動画 | BoatStrikers MEDIA｜BoatStrikers"
  },
  {
    "path": "/blog/categories/beginner",
    "title": "初心者の記事一覧｜BOATSTRIKERS BLOG"
  }
];
const origin = process.env.SEO_TITLE_TEST_ORIGIN;
function decodeTitle(text) {
  return text.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos);/gi, (_,number,name) =>
    number ? String.fromCodePoint(number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number))
      : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name.toLowerCase()]);
}
test('HTTP: all 60 design routes resolve their expected HTML titles', {skip:!origin}, async t => {
  const base = new URL(origin);
  assert.ok(['https:','http:'].includes(base.protocol));
  assert.equal(base.username + base.password, '');
  for (const item of httpCases) await t.test(item.path, async () => {
    const headers = {'User-Agent':'facebookexternalhit/1.1'};
    if (process.env.VERCEL_OIDC_TOKEN) headers['x-vercel-trusted-oidc-idp-token']=process.env.VERCEL_OIDC_TOKEN;
    const target = new URL(item.path,base);
    assert.equal(target.origin,base.origin);
    // Manual redirects avoid forwarding a protection header to another origin.
    let response = await fetch(target,{headers,redirect:'manual',signal:AbortSignal.timeout(60000)});
    if ([301,302,303,307,308].includes(response.status)) {
      const location = new URL(response.headers.get('location'),target);
      assert.equal(location.origin,base.origin);
      response = await fetch(location,{headers,redirect:'manual',signal:AbortSignal.timeout(60000)});
    }
    assert.equal(response.status,200,'expected public page, not a login or error response');
    const html = await response.text();
    const titles = [...html.matchAll(/<title[^>]*>([^]*?)<\/title>/gi)].map(m=>decodeTitle(m[1]));
    assert.deepEqual(titles,[item.title]);
  });
});
