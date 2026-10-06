import { characterImage } from './characterAssets.mjs';
// Editorial identity/navigation, not invented articles. Mirrors PHASE 1 catalogue.
export const BLOG_CATEGORIES = [
  ['beginner','初心者'],['inside-course','イン逃げ'],['women','女子戦'],['longshot','穴・5アタマ'],
  ['data-lab','DATA LAB'],['stadiums','24場攻略'],['racers','選手'],['news','ニュース'],['columns','コラム'],['comics','漫画・読み物'],
].map(([slug,name]) => ({slug,name}));
export const BLOG_AUTHORS = [
  {slug:'ichika',name:'一果',role:'イン逃げ・1コース・データ研究',bio:'イン逃げを中心に、データと条件を読み解きます。',image_path:characterImage('ichika','pose5')},
  {slug:'hatsune',name:'初音',role:'女子戦・選手・初心者向け解説',bio:'選手の情報を、初心者にも分かりやすく伝えます。',image_path:characterImage('hatsune','pose5')},
  {slug:'kiina',name:'キイナ',role:'穴・5アタマ・展開・高配当研究',bio:'読者の疑問から、穴条件や展開を考えます。',image_path:characterImage('kiina','pose5')},
  {slug:'editorial',name:'BoatStrikers編集部',role:'総合記事・ニュース・運営記事',bio:'ボートレースの情報を整理し、読む楽しさを届けます。',image_path:null},
];
