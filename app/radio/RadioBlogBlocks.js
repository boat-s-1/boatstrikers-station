function getYouTubeId(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "");
    }

    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/")[2];
    }

    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export default function RadioBlogBlocks({ blocks = [] }) {
  return (
    <div className="radioBlogBlocks">
      {blocks.map((block, index) => {
        const key = block.id || `${block.type}-${index}`;

        if (block.type === "heading") {
          return <h2 key={key}>{block.text}</h2>;
        }

        if (block.type === "paragraph") {
          return <p key={key}>{block.text}</p>;
        }

        if (block.type === "quote") {
          return <blockquote key={key}>{block.text}</blockquote>;
        }

        if (block.type === "list") {
          return (
            <ul key={key}>
              {(block.items || [])
                .filter(Boolean)
                .map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{item}</li>
                ))}
            </ul>
          );
        }

        if (block.type === "image" && block.url) {
          return (
            <figure key={key}>
              <img src={block.url} alt={block.alt || ""} />
              {block.caption && <figcaption>{block.caption}</figcaption>}
            </figure>
          );
        }

        if (block.type === "youtube") {
          const videoId = getYouTubeId(block.url);
          if (!videoId) return null;

          return (
            <div className="radioBlogYoutube" key={key}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title="YouTube動画"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
