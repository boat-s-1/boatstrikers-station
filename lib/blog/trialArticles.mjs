// PHASE 10: editorial trials, imported only after /blog/preview/trials environment gates.
// No Supabase reads/writes, public post state, publication dates, ranking or fabricated race data.
import { BLOG_AUTHORS, BLOG_CATEGORIES } from './catalogue.mjs';
export const TRIAL_SOURCE_COMMIT='1d578e0587cded138ea804314cb685bd74bdd576';
export const TRIAL_SOURCE_HASHES={
  "app/data-lab/articles.js": "157d656ab1897ea24969a43cfc314ac65e8975e0f1b06d49c508d2d96b6a52d3",
  "app/guide/course-entry/page.js": "8338b1b0cefb43899b8d929ca9e4bf33d288126092fe2d848b834d6f1cb9ee28",
  "app/guide/guideData.js": "3e1f06b52322fa2c0189ffa505ed985a219c60a84289b1d763a3b77e3b573a55",
  "app/guide/start-exhibition/page.js": "517c47d94ce1868a531107644651ffb8f2db2c56c33990b37bf64c82f42b8668",
  "app/kiina/page.js": "30c6f2c5f29e2e06f582dd021750d6ba55fff7d8abeac8272f03c02768c1630f"
};
const editorialDrafts=[
  {
    "slug": "first-race-card",
    "title": "出走表の数字、何から読む？\n3人と整理する最初の確認順",
    "excerpt": "級別、勝率、ST、モーター。全部を一度に覚えるより、「何の情報か」を分けるところから。3人の違う視点で、出走表から展示へ進む読み方を整理します。",
    "category": "beginner",
    "authorKeys": [
      "ichika",
      "hatsune",
      "kiina"
    ],
    "blocks": [
      {
        "type": "LIST",
        "data": {
          "text": "",
          "placement": "takeaways",
          "items": [
            "艇番・コース・級別を混同しない読み方",
            "全国・当地・コース別の成績を使い分ける理由",
            "平均STと展示、モーターの数字を重ねる順番"
          ]
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "出走表を開いたら",
          "turns": [
            {
              "character": "kiina",
              "pose": "pose3",
              "text": "数字がずらっと並ぶと、どれを見ればいいか迷うよね。高い数字の艇から選べばいいの？",
              "alignment": "auto"
            },
            {
              "character": "hatsune",
              "pose": "pose1",
              "text": "まずは、その数字が何を表すのかを分けましょう。選手の成績なのか、スタートなのか、モーターなのかで見る意味が違います。",
              "alignment": "right"
            },
            {
              "character": "ichika",
              "pose": "pose1",
              "text": "私はイン逃げを考えるから、艇番と実際のコースから確認するよ。番号だけを見て、そのまま進入まで決めつけないのが最初の一歩。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "艇番と選手を読む。級別は結論にしない"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "出走表の艇番は、各艇に付いた番号です。一方、スタートする位置を表すのがコース。進入の動きがあれば、艇番とコースが一致しないこともあります。\n\n選手名と級別を確かめたら、実際にどのコースへ入るかも見ます。級別にはA1・A2・B1・B2がありますが、その区分だけで今回の着順は決まりません。スタート、モーター、当日の動きまで読み進めるための入口と考えましょう。"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "3人の読み分け",
          "turns": [
            {
              "character": "hatsune",
              "pose": "pose2",
              "text": "初心者さんは「級別が高いから確実」と考えがちですが、同じレースの相手や担当コースも見たいですね。",
              "alignment": "right"
            },
            {
              "character": "kiina",
              "pose": "pose2",
              "text": "私は人気薄も気になるけど、級別が低いというだけで外すのも、高配当だけで選ぶのも違うよね。",
              "alignment": "auto"
            },
            {
              "character": "ichika",
              "pose": "pose1",
              "text": "うん。1号艇の番号だけでイン逃げを決めるのと同じで、ひとつの表示を答えにしないことが大事だね。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "勝率は「どこでの成績か」まで読む"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "全国勝率は一定期間を通した成績を見る情報、当地勝率はその場での成績を見る情報です。コース別成績が確認できるなら、担当するコースでの実績も別に見ます。\n\n同じ「成績」の欄でも、対象は同じではありません。総合的な実績を見たあと、その場・そのコースへ視点を近づけると、数字の役割を整理できます。"
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "平均STとモーターの数字を、展示へつなぐ"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "平均STは普段のスタートタイミングの目安です。値が小さいほど早い傾向を表しますが、平均値だけで当日のスタートが決まるわけではありません。今節のSTやスタート展示が確認できるときは、別の情報として見比べます。\n\nモーター2連率は、そのモーターを使用した艇が2着以内に入った割合です。過去に使用した選手や集計期間の影響も受けるため、数値の大小だけで今回の動きを判断できません。展示タイムに加え、周回展示の直線やターンの気配も確かめましょう。"
        }
      },
      {
        "type": "POINT",
        "data": {
          "text": "選手・級別 → 全国／当地／コース別成績 → スタート → モーター → 展示と進入・水面。\n\nこれは情報を整理する順番です。ひとつの数字から勝つ艇を自動的に決める手順ではありません。",
          "title": "迷ったときの読み順"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "確認できない欄があったら",
          "turns": [
            {
              "character": "kiina",
              "pose": "pose3",
              "text": "平均STや展示がまだ出ていなかったら、どうする？",
              "alignment": "auto"
            },
            {
              "character": "hatsune",
              "pose": "pose1",
              "text": "確認できた情報と、まだ分からない情報を分けて残しましょう。空欄を別の数字で埋める必要はありません。",
              "alignment": "right"
            },
            {
              "character": "ichika",
              "pose": "pose4",
              "text": "材料が揃うまで待つのも、見送るのも判断のひとつ。出走表を読む練習なら、購入を急がず展示との違いを見てみよう。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "出走表は、数字を一列に並べて比べるだけの表ではありません。何を対象にした数字かを確認し、コース・今節・展示へ順に視点を移すと、3人の見方もつながります。分からない情報は推測で補わず、次に確認したいこととして残しましょう。",
          "placement": "summary"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "本記事は既存教材をBLOG向けに再編集したPreview専用の試験記事です。個別レースの実測値や買い目を追加していません。展示と過去傾向は結果を保証するものではなく、確認できない情報は推測で補いません。最終判断は読者自身で行ってください。",
          "placement": "notes"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "以下の既存教材を参照し、構成と会話を新しく編集しています。AI MATESの発言は確認項目の整理、一果・初音・キイナの発言は編集キャラクターとしての考察です。",
          "placement": "sources"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/race-card",
          "source_label": "出走表の見方"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/course-entry",
          "source_label": "進入・前付けとは？"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/exhibition",
          "source_label": "展示航走の見方"
        }
      },
      {
        "type": "RELATED_ARTICLES",
        "data": {
          "post_ids": [],
          "paths": [
            "/guide/race-card",
            "/guide/course-entry",
            "/guide/exhibition"
          ]
        }
      },
      {
        "type": "CTA",
        "data": {
          "placement": "ending",
          "href": "/today",
          "label": "今日のレースで、学んだ視点を確かめる"
        }
      }
    ],
    "sources": [
      {
        "path": "/guide/race-card",
        "label": "出走表の見方"
      },
      {
        "path": "/guide/course-entry",
        "label": "進入・前付けとは？"
      },
      {
        "path": "/guide/exhibition",
        "label": "展示航走の見方"
      }
    ],
    "claims": [
      {
        "file": "app/guide/guideData.js",
        "anchor": "級別はA1・A2・B1・B2の4段階",
        "description": "級別と着順を分ける"
      },
      {
        "file": "app/guide/guideData.js",
        "anchor": "数字が小さいほど早い傾向",
        "description": "平均STの読み方"
      },
      {
        "file": "app/guide/guideData.js",
        "anchor": "そのモーターを使った艇が2着以内に入った割合",
        "description": "モーター2連率の意味"
      },
      {
        "file": "app/guide/guideData.js",
        "anchor": "全国勝率は一定期間の総合的な成績",
        "description": "成績の対象を分ける"
      }
    ]
  },
  {
    "slug": "ichika-inside-check",
    "title": "イン逃げは1号艇だけでは決まらない。\n一果といちまるの確認ノート",
    "excerpt": "1コースを確保できるか、外から誰が攻めるか。いちまるが確認項目を整理し、一果がイン逃げを見る視点へつなぎます。数字のないところに確率は作りません。",
    "category": "inside-course",
    "authorKeys": [
      "ichika"
    ],
    "blocks": [
      {
        "type": "LIST",
        "data": {
          "text": "",
          "placement": "takeaways",
          "items": [
            "1号艇と1コースを分けて考える理由",
            "スタート・機力・相手艇・水面の確認順",
            "イン逃げを強く決めつけないための見直し方"
          ]
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "いちまる DATA CHECK → 一果の視点",
          "turns": [
            {
              "character": "ichimaru",
              "pose": "pose1",
              "text": "既存ガイドの確認項目を整理したよ。進入、1コース成績、スタート、モーターと展示、相手艇、水面。今日は見る項目を確認する回で、個別レースの数値を取得したわけではないよ。",
              "alignment": "auto"
            },
            {
              "character": "ichika",
              "pose": "pose1",
              "text": "ありがとう。私は「1号艇だから逃げる」で終わらせず、インから先に回れる条件が揃いそうかを、この順で考えるよ。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "最初に確かめるのは、番号ではなくコース"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "イン逃げを考える前に、1号艇が実際に1コースへ入るかを確認します。艇番とスタート位置は別の情報で、進入によって並びが変わることがあります。スタート展示で見えた並びも、本番まで固定された答えではありません。\n\n逃げは、1コースの艇がスタートから先に第1ターンマークを回り、先頭を保って1着になる勝ち方です。内側の位置を活かす話だからこそ、出走表の番号だけでなく、実際の進入が出発点になります。"
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "いちまるが整理する、イン逃げの判断材料"
        }
      },
      {
        "type": "DATA_CHECK",
        "data": {
          "text": "進入：1コースを確保できるか。助走が短くなる動きはないか。\n選手：1コースでの成績が確認できるか。\nスタート：平均ST、今節ST、展示を分けて見る。\n機力：モーター成績と当日の展示気配を照らし合わせる。\n相手：2〜4コースからの攻めを確認する。\n水面：風向・波など、今回の条件を見る。\n\nここに並べたのは確認項目です。実測値や採点結果ではありません。",
          "title": "インの条件を、相手と一緒に確認",
          "source_url": "/guide/inside-course",
          "source_label": "1号艇とイン逃げの基本"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "分析項目から、一果の見解へ",
          "turns": [
            {
              "character": "ichimaru",
              "pose": "pose2",
              "text": "スタートと展示は別の材料だね。展示で先行して見えても、本番が同じになるとは限らない。相手艇の攻めも、確認する項目に入れておいたよ。",
              "alignment": "auto"
            },
            {
              "character": "ichika",
              "pose": "pose2",
              "text": "私が見たいのは、1コースの艇が外に先行されず、先に回る形を作れそうか。本人の平均だけでなく、隣やセンターの艇と比べて考えるよ。",
              "alignment": "auto"
            },
            {
              "character": "ichika",
              "pose": "pose1",
              "text": "モーターの過去成績が良くても、今日の展示と噛み合っているかは別に確認したい。数字と動きが違って見えるなら、その違いを残しておこう。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "インを見る記事でも、外の攻めを省かない"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "2コースからの差し、3・4コースからの攻め、その外へ向く展開も検討材料です。1コースの艇に良い材料があるかだけでなく、相手がどのように競りかけられそうかを見ます。\n\n相手艇の展示やスタートを読むことは、イン逃げの見方から外れる作業ではありません。逃げやすさを、同じレースの相手との比較で考えるための確認です。"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "結論を急がないための一果の見直し",
          "turns": [
            {
              "character": "ichimaru",
              "pose": "pose3",
              "text": "進入が読みづらかったり、水面条件が変わったりしたら、確認項目をもう一度見直す必要があるね。分からない値は空欄のままにするよ。",
              "alignment": "auto"
            },
            {
              "character": "ichika",
              "pose": "pose4",
              "text": "私は、材料が揃わないレースを無理に本線にしない。イン逃げを研究するからこそ、逃げる条件を説明できないときは待つ判断も大切にしたいな。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "いちまるの役目は、進入・スタート・機力・相手艇・水面の情報を整理すること。一果は、その材料を受け取り「先に回る形を作れそうか」を考えます。今回は確認の考え方を整理した記事で、特定レースの確率・買い目・結論を提示するものではありません。",
          "placement": "summary"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "本記事は既存教材をBLOG向けに再編集したPreview専用の試験記事です。個別レースの実測値や買い目を追加していません。展示と過去傾向は結果を保証するものではなく、確認できない情報は推測で補いません。最終判断は読者自身で行ってください。",
          "placement": "notes"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "以下の既存教材を参照し、構成と会話を新しく編集しています。AI MATESの発言は確認項目の整理、一果・初音・キイナの発言は編集キャラクターとしての考察です。",
          "placement": "sources"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/inside-course",
          "source_label": "1号艇とイン逃げの基本"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/start-exhibition",
          "source_label": "スタート展示の見方"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/course-entry",
          "source_label": "進入・前付けとは？"
        }
      },
      {
        "type": "RELATED_ARTICLES",
        "data": {
          "post_ids": [],
          "paths": [
            "/guide/inside-course",
            "/guide/start-exhibition",
            "/guide/course-entry"
          ]
        }
      },
      {
        "type": "CTA",
        "data": {
          "placement": "ending",
          "href": "/today",
          "label": "今日のレースで、学んだ視点を確かめる"
        }
      }
    ],
    "sources": [
      {
        "path": "/guide/inside-course",
        "label": "1号艇とイン逃げの基本"
      },
      {
        "path": "/guide/start-exhibition",
        "label": "スタート展示の見方"
      },
      {
        "path": "/guide/course-entry",
        "label": "進入・前付けとは？"
      }
    ],
    "claims": [
      {
        "file": "app/guide/guideData.js",
        "anchor": "先に第1ターンマークを回り",
        "description": "逃げの意味"
      },
      {
        "file": "app/guide/guideData.js",
        "anchor": "2～4コースの攻める力",
        "description": "相手艇の確認"
      },
      {
        "file": "app/guide/start-exhibition/page.js",
        "anchor": "展示と本番で進入やスタートが変わる",
        "description": "展示と本番を区別"
      },
      {
        "file": "app/guide/course-entry/page.js",
        "anchor": "スタートまでの助走距離が短い状態",
        "description": "深い進入の確認"
      }
    ]
  },
  {
    "slug": "hatsune-women-comparison",
    "title": "女子戦の数字を、そのまま混合戦に使っていい？\n初音とはつころの比較ノート",
    "excerpt": "同じ選手でも、相手・コース・シリーズが変われば数字の背景が変わります。はつころが比較条件を整理し、初音が選手を見る視点を補足します。",
    "category": "women",
    "authorKeys": [
      "hatsune"
    ],
    "blocks": [
      {
        "type": "LIST",
        "data": {
          "text": "",
          "placement": "takeaways",
          "items": [
            "女子戦と混合戦を分けて読む理由",
            "総合成績とコース別成績の役割の違い",
            "長期の平均STと今節の変化を混同しない方法"
          ]
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "はつころ DATA CHECK → 初音の視点",
          "turns": [
            {
              "character": "hatsukoro",
              "pose": "pose1",
              "text": "女子戦研究の記事を確認しました♪ 比べる相手の範囲、コース、対象期間、グレード、スタートの情報を分けることがポイントです。新しい集計値はまだ用意していません。",
              "alignment": "auto"
            },
            {
              "character": "hatsune",
              "pose": "pose1",
              "text": "ありがとう。私は「女子戦だからこうなる」とまとめず、その選手がどんな相手・コース・シリーズで走っているのかから見ていきます。",
              "alignment": "right"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "女子戦と混合戦では、対戦相手の構成が変わる"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "女子戦での成績と混合戦での成績は、同じ条件で残された数字とは限りません。出場する選手の構成が異なるため、女子戦内での位置づけが、そのまま混合戦でも当てはまるとは言えないからです。\n\n比較するときは、女子戦の成績・混合戦の成績・全体の成績を別に整理します。これはどちらが強いかを一括りで決めるためではなく、数字の背景を混ぜないための作業です。"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "初心者さんに伝えたい補足",
          "turns": [
            {
              "character": "hatsukoro",
              "pose": "pose2",
              "text": "全体の数字だけを見ると、どの条件の成績なのか分かりにくくなるんですね。",
              "alignment": "auto"
            },
            {
              "character": "hatsune",
              "pose": "pose1",
              "text": "そうですね。「誰と走ったか」を分けるだけでも、読み方が変わります。差があるように見えても、比較条件を確かめる前に選手の能力差と決めないようにしたいです。",
              "alignment": "right"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "コース別成績を重ねると、問いが具体的になる"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "総合的な成績だけでは、インで強いのか、センターやアウトから着を取っているのかは読み分けられません。コース別の1着率・2連対率・3連対率が確認できる場合は、それぞれを総合成績とは別に見ます。\n\n特定コースからの1着を研究するなら、そのあとに2着・3着へ入ったコースの分布を見る方法もあります。ただし、今回の記事は比較の組み立て方を説明するもので、その分布を新たに集計した結果ではありません。"
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "平均STと今節のスタートは、別の時間軸"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "長期の平均STは選手の傾向を見る材料です。今節のSTや展示は、開催中の状態を見る材料です。平均値が同じでも、シリーズの途中で見える動きまで同じとは限りません。\n\n今節成績を読むときは、着順だけでなくスタートや展示の変化も確認します。女子戦という区分だけで結論を出さず、そのシリーズの情報を重ねるのが初音の見方です。"
        }
      },
      {
        "type": "DATA_CHECK",
        "data": {
          "text": "対象：女子戦・混合戦・全体を混ぜない。\n期間：比較している集計期間を確認する。\n相手：グレードや選手構成の違いを残す。\n位置：コースを分け、必要に応じて2着・3着の分布も見る。\n時間軸：長期平均と今節・展示を分ける。\n件数：比較対象のレース数も確認する。\n\n差の大きさや優劣は、実データを揃えてから判断します。",
          "title": "はつころの比較条件チェック",
          "source_url": "/data-lab/women-vs-mixed",
          "source_label": "女子戦と混合戦は何が違う？"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "初音の見解",
          "turns": [
            {
              "character": "hatsukoro",
              "pose": "pose3",
              "text": "今ある情報だけでは比べられない部分も、そのまま残すんですね。女子戦が有利・不利という数字は作りません。",
              "alignment": "auto"
            },
            {
              "character": "hatsune",
              "pose": "pose2",
              "text": "私は、比較条件の違いを消さずに選手を見たいです。コースと今節の状態まで確かめて、ようやく今回どこに注目するかを考えられます。",
              "alignment": "right"
            },
            {
              "character": "hatsune",
              "pose": "pose4",
              "text": "女子戦の特徴を知ることと、特定の選手が今回勝つと決めることは別です。はつころの整理を受け取っても、最後にどう読むかは自分の言葉で説明したいですね。",
              "alignment": "right"
            }
          ]
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "女子戦と混合戦を比較するときは、相手・コース・対象期間・グレード・レース数を確認します。はつころは比較の土台を整理し、初音は選手と今節の変化を重ねて考察します。比較用のデータがないところに、勝率の差や優劣を付け足さないことも研究の基本です。",
          "placement": "summary"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "本記事は既存教材をBLOG向けに再編集したPreview専用の試験記事です。個別レースの実測値や買い目を追加していません。展示と過去傾向は結果を保証するものではなく、確認できない情報は推測で補いません。最終判断は読者自身で行ってください。",
          "placement": "notes"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "以下の既存教材を参照し、構成と会話を新しく編集しています。AI MATESの発言は確認項目の整理、一果・初音・キイナの発言は編集キャラクターとしての考察です。",
          "placement": "sources"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/data-lab/women-vs-mixed",
          "source_label": "女子戦と混合戦は何が違う？"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/race-card",
          "source_label": "出走表の見方"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/series-performance",
          "source_label": "今節成績の見方"
        }
      },
      {
        "type": "RELATED_ARTICLES",
        "data": {
          "post_ids": [],
          "paths": [
            "/data-lab/women-vs-mixed",
            "/guide/race-card",
            "/guide/series-performance"
          ]
        }
      },
      {
        "type": "CTA",
        "data": {
          "placement": "ending",
          "href": "/today",
          "label": "今日のレースで、学んだ視点を確かめる"
        }
      }
    ],
    "sources": [
      {
        "path": "/data-lab/women-vs-mixed",
        "label": "女子戦と混合戦は何が違う？"
      },
      {
        "path": "/guide/race-card",
        "label": "出走表の見方"
      },
      {
        "path": "/guide/series-performance",
        "label": "今節成績の見方"
      }
    ],
    "claims": [
      {
        "file": "app/data-lab/articles.js",
        "anchor": "女子戦のみの成績、混合戦のみの成績、全レース成績を分けて集計",
        "description": "レース母集団の区別"
      },
      {
        "file": "app/data-lab/articles.js",
        "anchor": "対象期間、レース数、グレード、コースをそろえないと",
        "description": "比較条件"
      },
      {
        "file": "app/data-lab/articles.js",
        "anchor": "節間のリズムや展示でも変化",
        "description": "長期平均と今節を分ける"
      },
      {
        "file": "app/data-lab/articles.js",
        "anchor": "コース別の1着率、2連対率、3連対率",
        "description": "コース別の指標"
      }
    ]
  },
  {
    "slug": "kiina-five-head-flow",
    "title": "5アタマを考える前に、4号艇を見る。\nキイナときいもこの展開研究",
    "excerpt": "5号艇の良い材料だけでは、展開の理由は説明できません。内側の不安とセンター勢の攻め、5号艇自身の気配を、きいもことキイナが順に整理します。",
    "category": "longshot",
    "authorKeys": [
      "kiina"
    ],
    "blocks": [
      {
        "type": "LIST",
        "data": {
          "text": "",
          "placement": "takeaways",
          "items": [
            "5号艇と5コースを分ける理由",
            "4号艇の攻めと5号艇の展開をセットで見る視点",
            "高配当例だけで傾向を判断しないための研究方法"
          ]
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "きいもこ DATA CHECK → キイナの視点",
          "turns": [
            {
              "character": "kiimoko",
              "pose": "pose1",
              "text": "5号艇研究の確認項目を整理したよ！ 進入、内側の状態、4号艇の攻め、スタート、展示とモーター。今回は研究の見方で、穴確率や買い目は計算していないよ。",
              "alignment": "auto"
            },
            {
              "character": "kiina",
              "pose": "pose3",
              "text": "5号艇が良さそう、だけじゃ足りないんだよね。どうやって前へ出る余地が生まれるのか、私はそこから考えたい！",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "5号艇と5コースを、最初に分ける"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "5アタマは、5号艇が1着になる形を考える呼び方です。艇番は番号であり、スタート位置まで表すものではありません。外側からの展開を考える前に、実際の進入を確認します。\n\n5コースから走る場面を研究しているのか、5号艇の成績を研究しているのかでも対象は変わります。番号と位置を混ぜないことが、穴条件を整理する最初の約束です。"
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "4号艇が攻めると、何が変わるか"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "5コースからの攻めを考える場合、その内側にいる4号艇のスタートや攻め方が重要な材料になります。内側へ攻めて隊形が崩れれば、外側の艇に展開が向く可能性があります。\n\n一方、4号艇が攻めきれず進路の壁になる場合には、5号艇が外を回る形になることもあります。「4号艇がいるから有利」と決めるのではなく、どんな動きをしそうかまで考える必要があります。"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "展開の余地を、決まりごとにしない",
          "turns": [
            {
              "character": "kiimoko",
              "pose": "pose2",
              "text": "外へ展開が向く場合と、攻めきれず壁になる場合。両方を確認するんだね。1号艇の進入・スタート・展示も、内側の材料として見るよ。",
              "alignment": "auto"
            },
            {
              "character": "kiina",
              "pose": "pose2",
              "text": "そう！ 私は、内側に崩れる材料があって、攻め艇の外に余地ができそうかを考える。でも可能性の話を「5号艇が必ず来る」に変えないのが大切だよ。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "スタートと機力は、相手との比較で読む"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "平均STは長期の傾向、今節や展示のスタートは直近の状態を見る材料です。過去の平均だけで今回のスタートを決めつけず、確認できる情報を別々に整理します。\n\n5号艇の展示タイムやモーター成績が良くても、内側の艇も良ければ、その情報だけで大きな差があるとは言えません。直線、周回展示、ターン出口の気配まで見て、同じレースの相手と比較します。"
        }
      },
      {
        "type": "POINT",
        "data": {
          "text": "高オッズそのものを、狙う根拠にしない。\n\n進入・スタート・相手の攻め・展示に理由を探し、そのあとでオッズを確認する。条件が噛み合わなければ、無理に5アタマへ結びつけない。",
          "title": "キイナの「穴だから買う」を避ける約束",
          "source_url": "/guide/odds-payout",
          "source_label": "オッズと払戻金の見方"
        }
      },
      {
        "type": "HEADING",
        "data": {
          "level": 2,
          "text": "研究するなら、的中した高配当例の外も見る"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "5号艇が勝ったレースを調べるときは、目立つ高配当の例だけを集めないことが大切です。対象期間を決め、該当するレース全体の件数や割合を確認し、2着・3着のコース分布も見ます。\n\nそれは次の検証を組み立てる方法であり、今回の確認項目だけで回収率が上がると証明したものではありません。本記事には、新しい集計結果・回収率・レース例を載せていません。"
        }
      },
      {
        "type": "DIALOGUE_SCENE",
        "data": {
          "label": "キイナの見解",
          "turns": [
            {
              "character": "kiimoko",
              "pose": "pose3",
              "text": "目立つ結果だけでなく、対象全体を揃えて確かめるんだね。まだ確認できない件数や割合は補わないよ。",
              "alignment": "auto"
            },
            {
              "character": "kiina",
              "pose": "pose4",
              "text": "私は「5号艇が良い」から一歩進んで、「相手の攻めでどこに余地ができるか」を言葉にしたい。説明できないレースは無理に狙わず、点数や予算を増やして穴を追いかけないようにするよ。",
              "alignment": "auto"
            }
          ]
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "きいもこは確認項目を整理し、キイナは進入・内側の不安・センター勢の攻め・5号艇自身の気配を合わせて考えます。高オッズは結論の根拠にならず、研究には対象全体の確認が必要です。穴条件の説明は、特定レースの購入推奨や利益の保証ではありません。",
          "placement": "summary"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "本記事は既存教材をBLOG向けに再編集したPreview専用の試験記事です。個別レースの実測値や買い目を追加していません。展示と過去傾向は結果を保証するものではなく、確認できない情報は推測で補いません。最終判断は読者自身で行ってください。",
          "placement": "notes"
        }
      },
      {
        "type": "TEXT",
        "data": {
          "text": "以下の既存教材を参照し、構成と会話を新しく編集しています。AI MATESの発言は確認項目の整理、一果・初音・キイナの発言は編集キャラクターとしての考察です。",
          "placement": "sources"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/data-lab/boat5-win",
          "source_label": "5号艇が1着になるレースには何がある？"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/average-st",
          "source_label": "平均STの見方"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/exhibition",
          "source_label": "展示航走の見方"
        }
      },
      {
        "type": "QUOTE",
        "data": {
          "text": "教材の元の説明はこちらで確認できます。",
          "placement": "sources",
          "source_url": "/guide/odds-payout",
          "source_label": "オッズと払戻金の見方"
        }
      },
      {
        "type": "RELATED_ARTICLES",
        "data": {
          "post_ids": [],
          "paths": [
            "/data-lab/boat5-win",
            "/guide/average-st",
            "/guide/exhibition"
          ]
        }
      },
      {
        "type": "CTA",
        "data": {
          "placement": "ending",
          "href": "/today",
          "label": "今日のレースで、学んだ視点を確かめる"
        }
      }
    ],
    "sources": [
      {
        "path": "/data-lab/boat5-win",
        "label": "5号艇が1着になるレースには何がある？"
      },
      {
        "path": "/guide/average-st",
        "label": "平均STの見方"
      },
      {
        "path": "/guide/exhibition",
        "label": "展示航走の見方"
      },
      {
        "path": "/guide/odds-payout",
        "label": "オッズと払戻金の見方"
      }
    ],
    "claims": [
      {
        "file": "app/data-lab/articles.js",
        "anchor": "4号艇が攻めきれず壁になる",
        "description": "4号艇の攻めと展開"
      },
      {
        "file": "app/data-lab/articles.js",
        "anchor": "全該当レースを対象に件数と割合を出す",
        "description": "高配当例だけで判断しない"
      },
      {
        "file": "app/kiina/page.js",
        "anchor": "高オッズそのものは買う理由にしない",
        "description": "穴の根拠とオッズを分ける"
      },
      {
        "file": "app/guide/guideData.js",
        "anchor": "艇番とスタート時のコースが同じとは限りません",
        "description": "艇番とコースを区別"
      }
    ]
  }
];
let counter=0;
const uuid=()=>`40000000-0000-4000-8000-${(++counter).toString(16).padStart(12,'0')}`;
export const TRIAL_ARTICLES=editorialDrafts.map(draft=>{
 const authors=draft.authorKeys.map(key=>({...BLOG_AUTHORS.find(a=>a.slug===key),id:uuid(),character_key:key}));
 const category={...BLOG_CATEGORIES.find(c=>c.slug===draft.category),id:uuid()};
 const blocks=draft.blocks.map((b,position)=>({...b,id:uuid(),position,data:b.type==='DIALOGUE_SCENE'?{...b.data,turns:b.data.turns.map(t=>({...t,id:uuid()}))}:b.data}));
 return {post:{id:uuid(),slug:draft.slug,first_published_at:null,last_published_at:null},
 document:{schema_version:1,title:draft.title,excerpt:draft.excerpt,category_id:category.id,seo:{},cover:{},noindex:true,author_ids:authors.map(a=>a.id),tag_ids:[],relations:[],blocks},
 authors,category,tags:[],media:{},relatedPosts:[],sources:draft.sources,claims:draft.claims};
});
export const trialHref=slug=>`/blog/preview/trials/${encodeURIComponent(slug)}`;
export const getTrialArticle=slug=>TRIAL_ARTICLES.find(a=>a.post.slug===slug);
