// Isolate upstream availability from rendering; unavailable is not an empty successful feed.
export async function loadStadiumArticles(parser, place) {
  try {
    const feed = await parser.parseURL('https://note.com/boat_strikers/rss');
    if (!Array.isArray(feed?.items)) throw new Error('Invalid RSS items');
    return { unavailable: false, articles: feed.items
      .filter(item => typeof item?.title === 'string' && item.title.includes(place))
      .slice(0, 20).map(item => ({ title: item.title, link: item.link, date: item.pubDate,
        image: item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || '/book-24-stadiums.jpg' })) };
  } catch { return { unavailable: true, articles: [] }; }
}
