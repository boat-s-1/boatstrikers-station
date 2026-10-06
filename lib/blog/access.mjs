function denied(status, message) { throw Object.assign(new Error(message), { status }); }
export function createBlogGuard({ authenticate, configuration }) {
  return async function requireBlogAdmin(request, { write = false } = {}) {
    const config = configuration();
    if (!config.enabled) denied(503, 'BLOG管理はまだ有効になっていません。');
    if (!await authenticate()) denied(401, '管理者ログインが必要です。');
    if (write) {
      if (request.headers.get('origin') !== new URL(request.url).origin) denied(403, '同じサイトから操作してください。');
      if (!config.writesEnabled) denied(503, 'BLOGの保存はまだ有効になっていません。');
    }
  };
}
