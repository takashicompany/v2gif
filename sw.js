// V2GIF Service Worker
// POST /convert をインターセプトし、クライアントページのFFmpeg.wasmで変換してGIFを返す

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname.endsWith('/convert')) {
    event.respondWith(handleConvert(event.request));
  }
});

async function handleConvert(request) {
  try {
    const formData = await request.formData();
    const video = formData.get('video');

    if (!video) {
      return jsonResponse(400, { error: 'video field is required' });
    }

    const params = {
      fps: formData.get('fps') || '10',
      width: formData.get('width') || '600',
      height: formData.get('height') || '-1',
      startTime: formData.get('startTime') || '0',
      endTime: formData.get('endTime') || null,
      cropX: formData.get('cropX') || null,
      cropY: formData.get('cropY') || null,
      cropWidth: formData.get('cropWidth') || null,
      cropHeight: formData.get('cropHeight') || null,
    };

    const videoBuffer = await video.arrayBuffer();

    // アクティブなV2GIFページを探す
    const allClients = await self.clients.matchAll({ type: 'window' });

    if (allClients.length === 0) {
      return jsonResponse(503, {
        error: 'No active V2GIF page. Please open the V2GIF page in a browser tab first.'
      });
    }

    // MessageChannelでページに処理を委譲し、結果を待つ
    const client = allClients[0];
    const messageChannel = new MessageChannel();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(jsonResponse(504, { error: 'Conversion timed out' }));
      }, 300000); // 5分タイムアウト

      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data.error) {
          resolve(jsonResponse(500, { error: event.data.error }));
        } else {
          resolve(new Response(event.data.gif, {
            status: 200,
            headers: {
              'Content-Type': 'image/gif',
              'Content-Disposition': 'attachment; filename="output.gif"'
            }
          }));
        }
      };

      client.postMessage(
        { type: 'v2gif-convert', video: videoBuffer, params },
        [messageChannel.port2, videoBuffer]
      );
    });

  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
