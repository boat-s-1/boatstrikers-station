// Imported ONLY by /blog/preview/article after the environment gate.
// This is a render fixture, not a seed, public post, or publication template.
import { BLOG_AUTHORS } from './catalogue.mjs';
let counter=0;
const uuid=()=>`30000000-0000-4000-8000-${(++counter).toString(16).padStart(12,'0')}`;
const block=(type,data)=>({id:uuid(),type,data});
const turn=(character,pose,text,alignment='auto')=>({id:uuid(),character,pose,text,alignment});
const authors=BLOG_AUTHORS.filter(a=>a.slug!=='editorial').map(a=>({...a,id:uuid(),character_key:a.slug}));
const category={id:uuid(),slug:'beginner',name:'初心者'};
const coverId=uuid(),diagramId=uuid();
export const BLOG_ARTICLE_FIXTURE={
  post:{id:uuid(),slug:'preview-layout',first_published_at:null,last_published_at:null},
  document:{schema_version:1,title:'1号艇と1コースは同じ？\n3人で整理する、進入の見方',
    excerpt:'艇番は出走表の番号、コースはスタートする位置。イン逃げ・選手・展開という3つの視点から、混同しやすい言葉を読み解きます。',
    category_id:category.id,seo:{},cover:{media_id:coverId,alt:'艇番とコースの読み方を学ぶ、表示確認用のアイキャッチ'},noindex:true,
    author_ids:authors.map(a=>a.id),tag_ids:[],relations:[],blocks:[
      block('POINT',{placement:'takeaways',text:'艇番とコースが表すものの違い\nスタート展示で進入を確認する理由\nイン逃げ・選手・展開を考えるときの注意点'}),
      block('HEADING',{level:2,text:'艇番とコースを、分けて読む'}),
      block('TEXT',{text:'出走表に書かれた艇番と、実際にスタートするコースは別の情報です。艇番は各艇に割り当てられた番号。コースは、スタート時に内側から何番目の位置に入るかを表します。\n\n番号だけで進入を決めつけず、スタート展示で並びを確認するところから始めましょう。展示の進入と本番の進入が同じになるとは限りません。'}),
      block('DIALOGUE',{character:'ichika',pose:'pose1',alignment:'auto',text:'私がイン逃げを考えるときも、まず艇番とコースを分けて見るよ。1号艇という番号だけで、1コースから逃げると決めつけないことが大切。'}),
      block('DIALOGUE',{character:'hatsune',pose:'pose1',alignment:'right',text:'選手を見るときは、進入への考え方にも注目したいですね。女子戦でも、艇番だけでは分からない情報があります。初心者さんは、まず「番号」と「位置」の違いを押さえましょう。'}),
      block('DIALOGUE',{character:'kiina',pose:'pose1',alignment:'auto',text:'5アタマを考える私にも、この区別は大事！ 5号艇というだけで、5コースから同じ攻め方をするとは限らないよね。展開を考える前に、並びを見たいな。'}),
      block('IMAGE',{media_id:diagramId,alt:'艇番は艇の番号、コースはスタート位置という概念の違いを示す図',caption:'概念を整理する教材図です。特定レースの進入や実データを表す図ではありません。'}),
      block('POINT',{title:'最初の確認ポイント',text:'1号艇＝必ず1コース、と決めつけない。\n艇番を確認したら、展示で実際の進入も確認する。'}),
      block('HEADING',{level:2,text:'展示で確認し、選手と展開へつなげる'}),
      block('DATA_CHECK',{title:'データを見る前に、情報の種類を整理',text:'出走表：艇番と出走する選手を確認する。\nスタート展示：展示時の進入を確認する。\n本番前：確認できる情報が更新されていないか見直す。\n\nこの表示確認用記事には、平均ST・勝率・モーター成績・買い目などの実データは入れていません。',source_url:'/guide/course-entry',source_label:'進入とコースの見方（既存ガイド）'}),
      block('DIALOGUE_SCENE',{label:'3人の補足 · それぞれの見るところ',turns:[
        turn('ichika','pose2','進入を確認したら、インから逃げるための条件を一つずつ考えるよ。数字を見る前に、その数字がどの艇・どのコースの情報かも確かめたいね。'),
        turn('ichika','pose3','ただし、今確認できないデータを想像で埋めることはしないよ。判断材料が足りないときは、無理に結論を出さずに見送ることも大切。'),
        turn('hatsune','pose3','選手の傾向を知ると、進入やレースの見方が広がりますね。でも、過去の傾向だけで今回も同じになるとは限りません。情報の時点も確認しましょう。','right'),
        turn('kiina','pose2','私は、並びが変わったときに誰が攻めて、誰に展開が向くかを考えたい。高配当になりそうという期待だけで、5号艇を選ぶのは避けたいね。'),
      ]}),
      block('HEADING',{level:3,text:'展示を、確定した未来として扱わない'}),
      block('TEXT',{text:'展示は判断材料のひとつです。展示で見えた並びや動きを整理し、選手や条件の情報と合わせて考えます。ひとつの情報だけで結果が決まると捉えないことが、読み違いを減らす第一歩になります。'}),
      block('QUOTE',{text:'確認したことと、これから考えることを分ける。分からないことは、分からないまま残す。',attribution:'BoatStrikers編集部 · 表示確認用の編集メモ'}),
      block('DIALOGUE_SCENE',{label:'読み終えたら · 3人からひとこと',turns:[
        turn('ichika','pose4','イン逃げを見る入口は、1号艇という番号と実際のコースを分けること。そこから、確認できた情報を順番に重ねてみよう。'),
        turn('hatsune','pose4','初心者さんは、言葉を一度に覚えなくても大丈夫です。出走表と展示を見比べながら、選手を見る視点も少しずつ増やしていきましょう。','right'),
        turn('kiina','pose5','展開を考える楽しさも、確かな情報から始まるね。気になるレースがあっても、最後は自分の判断で。見送る選択も忘れずに！'),
      ]}),
      block('TEXT',{placement:'summary',text:'艇番は各艇の番号、コースはスタート時の位置です。展示で進入を確認し、選手・イン逃げ・展開の視点を合わせて考えましょう。展示と本番は同じになるとは限らず、確認できない情報を推測で補わないことも大切です。'}),
      block('WARNING',{placement:'notes',text:'このページは記事詳細の表示確認用fixtureです。公開記事・実際のレース予想ではありません。\n\n教材の説明や展示の情報は、レース結果を保証するものではありません。舟券購入を含む最終判断は読者自身で行ってください。'}),
      block('TEXT',{placement:'sources',text:'今回の教材内容は、BoatStrikersの既存ガイド「進入とコースの見方」「イン逃げの基本」を参考に整理しています。'}),
      block('QUOTE',{placement:'sources',text:'詳しい教材は、既存ガイドで確認できます。',source_url:'/guide/course-entry',source_label:'進入とコースの見方'}),
      block('RELATED_ARTICLES',{post_ids:[],paths:['/guide/course-entry','/guide/inside-course']}),
      block('CTA',{placement:'ending',label:'今日の出走表で、艇番と進入を確かめる',href:'/races'}),
    ]},
  category,authors,tags:[],relatedPosts:[],
  media:{[coverId]:{id:coverId,public_path:'/blog-preview/reading-cover.svg',alt:'艇番とコースの読み方',width:1200,height:675},
    [diagramId]:{id:diagramId,public_path:'/blog-preview/course-guide.svg',alt:'艇番とコースの違いを示す教材図',width:1200,height:760}},
};
