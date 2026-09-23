const https = require('https');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(options.headers || {}) };
    Object.keys(headers).forEach(k => { if (headers[k] === undefined) delete headers[k]; });
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || 443,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  const loginBody = JSON.stringify({
    email: 'deploytest1924551704@gmail.com',
    password: 'SenhaForte123456',
  });
  const login = await request('https://byemidias.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) },
    body: loginBody,
  });
  const cookie = login.headers['set-cookie']?.[0]?.split(';')[0];

  // Cria playlist
  const playlistBody = JSON.stringify({
    name: 'Test Playlist',
    organization_id: '33058ec18d6fc1e',
    status: 'draft',
  });
  const playlist = await request('https://byemidias.vercel.app/api/admin/crud/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(playlistBody), 'Cookie': cookie },
    body: playlistBody,
  });
  console.log('Create playlist:', playlist.status);
  console.log(playlist.body);

  const playlistId = JSON.parse(playlist.body).data?.id;

  // Pega primeira mídia
  const media = await request('https://byemidias.vercel.app/api/admin/crud/media?limit=5', { headers: { Cookie: cookie } });
  const mediaData = JSON.parse(media.body);
  const mediaId = mediaData.data[0]?.id;

  if (playlistId && mediaId) {
    // Adiciona mídia na playlist (com order_index)
    const addBody = JSON.stringify({
      playlist_id: playlistId,
      media_id: mediaId,
      order_index: 0,
      duration: 10,
      transition: 'fade',
    });
    const add = await request('https://byemidias.vercel.app/api/admin/crud/playlist_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(addBody), 'Cookie': cookie },
      body: addBody,
    });
    console.log('\nAdd item:', add.status);
    console.log('Body:', add.body);

    // Pega itens da playlist
    const items = await request(`https://byemidias.vercel.app/api/admin/crud/playlist_items?playlist_id=${playlistId}&order=order_index`, {
      headers: { Cookie: cookie },
    });
    const itemsData = JSON.parse(items.body);
    console.log('\nItems:', items.status, '| count:', itemsData.data?.length || 0);
    if (itemsData.data?.length > 0) {
      console.log('First item:', JSON.stringify(itemsData.data[0], null, 2));
    }
  }
})().catch(console.error);
