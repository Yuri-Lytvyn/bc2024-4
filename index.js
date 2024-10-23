const http = require('http');
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const superagent = require('superagent');

const program = new Command();
program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <cache>', 'cache directory');

program.parse(process.argv);
const { host, port, cache } = program.opts();

const getCachedFilePath = statusCode => path.join(cache, `${statusCode}.jpg`);

const fetchCatImage = async statusCode => {
  const url = `https://http.cat/${statusCode}`;
  try {
    const { body } = await superagent.get(url);
    return body;
  } catch {
    throw new Error('Image not found');
  }
};

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.slice(1);
  const filePath = getCachedFilePath(statusCode);

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Welcome to the proxy server');
    return;
  }

  if (req.method === 'PUT') {
    let body = [];

    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
      body = Buffer.concat(body);
      try {
        await fs.writeFile(filePath, body);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('Created');
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  } else if (req.method === 'GET') {
    try {
      const image = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end('ok');
    } catch {
      try {
        const imageBuffer = await fetchCatImage(statusCode);
        await fs.writeFile(filePath, imageBuffer);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end('ok');
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Image not found for status code ${statusCode}.`);
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Deleted');
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
