import "./globals.css";

export const metadata = {
  title: "BoatStrikers放送局",
  description: "一果・初音・キイナと一緒に、競艇をもっと楽しく！",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
