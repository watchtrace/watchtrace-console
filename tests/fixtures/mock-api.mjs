import http from 'node:http';

const server = http.createServer((request, response) => {
  if (request.url?.endsWith('/events')) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    response.end('event: refresh\ndata: {"resource_type":"monitor"}\n\n');
    return;
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      host: request.headers.host,
      forwardedProto: request.headers['x-forwarded-proto'],
      url: request.url,
    }),
  );
});

server.listen(8080, '0.0.0.0');
