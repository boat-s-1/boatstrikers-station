"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./radioBlogAdmin.module.css";

const EMPTY_POST = {
  id: null,
  slug: "",
  episode_number: "",
  title: "",
  host: "一果",
  summary: "",
  cover_image_url: "",
  content_blocks: [],
  status: "draft",
  published_at: "",
};

function createBlock(type) {
  const base = {
    id: crypto.randomUUID(),
    type,
  };

  if (type === "image") {
    return { ...base, url: "", alt: "", caption: "" };
  }
  if (type === "youtube") {
    return { ...base, url: "" };
  }
  if (type === "list") {
    return { ...base, items: [""] };
  }
  return { ...base, text: "" };
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

function toApiPost(post) {
  return {
    ...post,
    published_at: post.published_at
      ? new Date(post.published_at).toISOString()
      : null,
  };
}

export default function RadioBlogAdminClient() {
  const [posts, setPosts] = useState([]);
  const [post, setPost] = useState(EMPTY_POST);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const isEditing = Boolean(post.id);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/radio-blog/posts", {
      cache: "no-store",
    });

    if (response.status === 401) {
      location.href = "/admin/radio-blog/login";
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "記事一覧を取得できませんでした。");
    } else {
      setPosts(data.posts || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  function newPost() {
    setPost({
      ...EMPTY_POST,
      content_blocks: [createBlock("paragraph")],
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editPost(row) {
    setPost({
      ...row,
      cover_image_url: row.cover_image_url || "",
      published_at: toDatetimeLocal(row.published_at),
      content_blocks: Array.isArray(row.content_blocks)
        ? row.content_blocks.map((block) => ({
            ...block,
            id: block.id || crypto.randomUUID(),
          }))
        : [],
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField(key, value) {
    setPost((current) => ({ ...current, [key]: value }));
  }

  function updateBlock(index, patch) {
    setPost((current) => ({
      ...current,
      content_blocks: current.content_blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block
      ),
    }));
  }

  function addBlock(type) {
    setPost((current) => ({
      ...current,
      content_blocks: [...current.content_blocks, createBlock(type)],
    }));
  }

  function removeBlock(index) {
    setPost((current) => ({
      ...current,
      content_blocks: current.content_blocks.filter(
        (_, blockIndex) => blockIndex !== index
      ),
    }));
  }

  function moveBlock(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= post.content_blocks.length) return;

    setPost((current) => {
      const blocks = [...current.content_blocks];
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, content_blocks: blocks };
    });
  }

  async function uploadImage(file, onUploaded) {
    if (!file) return;

    setBusy(true);
    setMessage("画像をアップロードしています…");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/radio-blog/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "画像をアップロードできませんでした。");
      setBusy(false);
      return;
    }

    onUploaded(data.url);
    setMessage("画像をアップロードしました。");
    setBusy(false);
  }

  async function savePost(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const endpoint = isEditing
      ? `/api/admin/radio-blog/posts/${post.id}`
      : "/api/admin/radio-blog/posts";

    const response = await fetch(endpoint, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiPost(post)),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "保存に失敗しました。");
      setBusy(false);
      return;
    }

    setPost({
      ...data.post,
      cover_image_url: data.post.cover_image_url || "",
      published_at: toDatetimeLocal(data.post.published_at),
    });
    setMessage("記事を保存しました。");
    await loadPosts();
    setBusy(false);
  }

  async function deletePost() {
    if (!post.id || !confirm("この記事を削除しますか？")) return;

    setBusy(true);
    const response = await fetch(
      `/api/admin/radio-blog/posts/${post.id}`,
      { method: "DELETE" }
    );
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "削除に失敗しました。");
      setBusy(false);
      return;
    }

    setPost(EMPTY_POST);
    setMessage("記事を削除しました。");
    await loadPosts();
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/admin/radio-blog/logout", { method: "POST" });
    location.href = "/admin/radio-blog/login";
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>BOAT NIGHT NIPPON</p>
          <h1>放送ブログ管理</h1>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={newPost}>新規記事</button>
          <button type="button" onClick={logout}>ログアウト</button>
        </div>
      </header>

      {message && <div className={styles.notice}>{message}</div>}

      <form className={styles.editor} onSubmit={savePost}>
        <section className={styles.panel}>
          <h2>{isEditing ? "記事を編集" : "新しい記事"}</h2>

          <div className={styles.twoColumns}>
            <label>
              回数
              <input
                value={post.episode_number}
                onChange={(e) =>
                  updateField("episode_number", e.target.value)
                }
                placeholder="VOL.004"
              />
            </label>

            <label>
              担当
              <select
                value={post.host}
                onChange={(e) => updateField("host", e.target.value)}
              >
                <option value="一果">一果</option>
                <option value="初音">初音</option>
                <option value="キイナ">キイナ</option>
              </select>
            </label>
          </div>

          <label>
            タイトル
            <input
              value={post.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </label>

          <label>
            URL用slug
            <input
              value={post.slug}
              onChange={(e) =>
                updateField(
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                )
              }
              placeholder="vol-004-ichika"
              required
            />
          </label>

          <label>
            一覧用の概要
            <textarea
              rows="3"
              value={post.summary}
              onChange={(e) => updateField("summary", e.target.value)}
            />
          </label>

          <div className={styles.coverArea}>
            <label>
              アイキャッチ画像
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) =>
                  uploadImage(e.target.files?.[0], (url) =>
                    updateField("cover_image_url", url)
                  )
                }
              />
            </label>
            {post.cover_image_url && (
              <img src={post.cover_image_url} alt="アイキャッチ確認" />
            )}
          </div>

          <div className={styles.twoColumns}>
            <label>
              公開状態
              <select
                value={post.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                <option value="draft">下書き</option>
                <option value="published">公開</option>
              </select>
            </label>

            <label>
              公開日時
              <input
                type="datetime-local"
                value={post.published_at || ""}
                onChange={(e) =>
                  updateField("published_at", e.target.value)
                }
              />
            </label>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <h2>記事本文</h2>
            <p>文章や画像を追加し、上下ボタンで並べ替えます。</p>
          </div>

          <div className={styles.blockAddButtons}>
            <button type="button" onClick={() => addBlock("paragraph")}>＋文章</button>
            <button type="button" onClick={() => addBlock("heading")}>＋見出し</button>
            <button type="button" onClick={() => addBlock("image")}>＋画像</button>
            <button type="button" onClick={() => addBlock("list")}>＋箇条書き</button>
            <button type="button" onClick={() => addBlock("quote")}>＋引用</button>
            <button type="button" onClick={() => addBlock("youtube")}>＋YouTube</button>
          </div>

          <div className={styles.blocks}>
            {post.content_blocks.map((block, index) => (
              <article className={styles.block} key={block.id || index}>
                <div className={styles.blockHeader}>
                  <strong>
                    {index + 1}. {block.type}
                  </strong>
                  <div>
                    <button type="button" onClick={() => moveBlock(index, -1)}>↑</button>
                    <button type="button" onClick={() => moveBlock(index, 1)}>↓</button>
                    <button type="button" onClick={() => removeBlock(index)}>削除</button>
                  </div>
                </div>

                {(block.type === "paragraph" ||
                  block.type === "quote") && (
                  <textarea
                    rows="5"
                    value={block.text || ""}
                    onChange={(e) =>
                      updateBlock(index, { text: e.target.value })
                    }
                  />
                )}

                {block.type === "heading" && (
                  <input
                    value={block.text || ""}
                    onChange={(e) =>
                      updateBlock(index, { text: e.target.value })
                    }
                    placeholder="見出し"
                  />
                )}

                {block.type === "youtube" && (
                  <input
                    value={block.url || ""}
                    onChange={(e) =>
                      updateBlock(index, { url: e.target.value })
                    }
                    placeholder="YouTubeのURL"
                  />
                )}

                {block.type === "list" && (
                  <textarea
                    rows="5"
                    value={(block.items || []).join("\n")}
                    onChange={(e) =>
                      updateBlock(index, {
                        items: e.target.value.split("\n"),
                      })
                    }
                    placeholder={"1行目\n2行目\n3行目"}
                  />
                )}

                {block.type === "image" && (
                  <div className={styles.imageBlock}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) =>
                        uploadImage(e.target.files?.[0], (url) =>
                          updateBlock(index, { url })
                        )
                      }
                    />
                    {block.url && (
                      <img src={block.url} alt={block.alt || "記事画像"} />
                    )}
                    <input
                      value={block.alt || ""}
                      onChange={(e) =>
                        updateBlock(index, { alt: e.target.value })
                      }
                      placeholder="画像の説明（alt）"
                    />
                    <input
                      value={block.caption || ""}
                      onChange={(e) =>
                        updateBlock(index, { caption: e.target.value })
                      }
                      placeholder="画像下のキャプション"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <div className={styles.saveBar}>
          {isEditing && (
            <button
              className={styles.deleteButton}
              type="button"
              onClick={deletePost}
              disabled={busy}
            >
              記事を削除
            </button>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "処理中…" : "記事を保存"}
          </button>
        </div>
      </form>

      <section className={styles.panel}>
        <h2>保存済み記事</h2>
        {loading ? (
          <p>読み込み中…</p>
        ) : (
          <div className={styles.postList}>
            {posts.map((row) => (
              <button
                type="button"
                className={styles.postRow}
                key={row.id}
                onClick={() => editPost(row)}
              >
                <span>{row.episode_number || "BLOG"}</span>
                <strong>{row.title}</strong>
                <small>
                  {row.host}／
                  {row.status === "published" ? "公開" : "下書き"}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
