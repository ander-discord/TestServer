const http = require('http');
const url = require('url');

let chat = [];

http.createServer((req, res) => {
  const userAgent = req.headers['user-agent'].toLowerCase() || '';

  if (!userAgent.includes('roblox') && !userAgent.includes('linux')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access denied');
  }

  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  console.log(JSON.stringify(query));

  if (query.send !== undefined) {
    if ((query.username.length + query.text.length) > 50) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Too big');
    }
    chat.push(`[${query.username}]: ${query.text}`);
  }

  if (chat.length > 4) {
    chat = [];
  }

  console.log(chat);

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(chat.join('\n'));
}).listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
