const make=(key,basePath,name,shortName,eyebrow,description,hero,accent)=>({key,slug:key,basePath,name,shortName,eyebrow,description,hero,accent,collectionLabel:"本の一覧",issues:[]});

export const characterBookSeries={
  "hatsune-women":make("hatsune-women","/hatsune-books/women","初音の女子戦攻略","女子戦攻略","HATSUNE WOMEN RACE BOOKS","女子戦のコース・今節成績・スタート・展示をマンガと文章で学ぶシリーズ。","/top/IMG_7960.jpeg","hatsune"),
  "hatsune-sensei":make("hatsune-sensei","/hatsune-books/sensei","教えて！初音センセー","初音センセー","HATSUNE BEGINNER BOOKS","女子戦や女子レーサーについての疑問を、マンガ風スライドと初音の解説で学ぶシリーズ。","/8A7A7A27-B954-4A3F-9DC3-52DB3DCE80AB.png","hatsune"),
  "hatsune-meikan":make("hatsune-meikan","/hatsune-books/meikan","初音の女子レーサー名鑑","女子レーサー名鑑","HATSUNE RACER BOOKS","女子レーサーをテーマごとにマンガとデータ解説で読む選手名鑑。","/top/IMG_7960.jpeg","hatsune"),
  "hatsune-data-lab":make("hatsune-data-lab","/hatsune-books/data-lab","初音の女子戦 DATA LAB","女子戦 DATA LAB","HATSUNE DATA RESEARCH","女子戦の数字をテーマごとに検証するデータ研究シリーズ。","/top/IMG_7960.jpeg","hatsune"),
  "kiina-hole":make("kiina-hole","/kiina-books/hole","キイナの穴狙い講座","穴狙い講座","KIINA LONGSHOT BOOKS","5アタマや穴狙いの考え方を、展開・展示・スタートから学ぶシリーズ。","/top/IMG_7992.jpeg","kiina"),
  "kiina-sensei":make("kiina-sensei","/kiina-books/sensei","教えて！キイナセンセー","キイナセンセー","KIINA BEGINNER BOOKS","穴狙いの疑問をマンガ風スライドとキイナの解説で学ぶシリーズ。","/6D4CA65A-8CA7-403B-AF8D-C4A6581C423F.png","kiina"),
  "kiina-meikan":make("kiina-meikan","/kiina-books/meikan","キイナの穴ツヨ選手名鑑","穴ツヨ選手名鑑","KIINA RACER BOOKS","人気薄でも狙い目になる選手をマンガとデータ解説で読む選手名鑑。","/top/IMG_7992.jpeg","kiina"),
  "kiina-data-lab":make("kiina-data-lab","/kiina-books/data-lab","キイナの穴党 DATA LAB","穴党 DATA LAB","KIINA DATA RESEARCH","高配当・5号艇・展開の数字をテーマごとに検証するデータ研究シリーズ。","/top/IMG_7992.jpeg","kiina")
};
export function getCharacterBookSeries(key){return characterBookSeries[key]||null;}
export function getCharacterBookIssue(key,id){return getCharacterBookSeries(key)?.issues.find(x=>x.id===id)||null;}
export const HATSUNE_BOOK_KEYS=["hatsune-women","hatsune-sensei","hatsune-meikan","hatsune-data-lab"];
export const KIINA_BOOK_KEYS=["kiina-hole","kiina-sensei","kiina-meikan","kiina-data-lab"];
