const http = require('http');
const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const superagent = require('superagent'); // Додаємо superagent для запитів на сервер http.cat
const program = new Command();

program
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <cachePath>', 'cache directory path');

program.parse(process.argv);
const options = program.opts();

// Створення сервера
const server = http.createServer();

// Додаємо обробку запитів
server.on('request', async (req, res) => {
  const code = req.url.slice(1); // Отримуємо HTTP код зі шляху
  const cacheFile = path.join(options.cache, `${code}.jpg`);

  if (req.method === 'GET') {
    try {
      // Читання файлу з кешу
      const data = await fs.readFile(cacheFile);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    } catch (err) {
      // Якщо зображення немає в кеші, надсилаємо запит на сервер http.cat
      try {
        const response = await superagent.get(`https://http.cat/status/${code}`);
        const image = response.body;
        await fs.writeFile(cacheFile, image); // Збереження картинки в кеш
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(image);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Image not found on server\n');
      }
    }
  } else if (req.method === 'PUT') {
    let body = [];
    req.on('data', chunk => {
      body.push(chunk);
    }).on('end', async () => {
      body = Buffer.concat(body);
      // Запис у кеш
      await fs.writeFile(cacheFile, body);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Image cached\n');
    });
  } else if (req.method === 'DELETE') {
    try {
      // Видалення файлу з кешу
      await fs.unlink(cacheFile);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Image deleted\n');
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Image not found\n');
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed\n');
  }
});

// Запуск сервера
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});