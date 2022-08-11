const http = require('http');
const fs = require('fs');
const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.readFile('./index.html', (err, data) => {
        res.end(data);
      });
    }else if (req.url === '/assets/styles/app.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      fs.readFile('./assets/styles/app.css', (err, data) => {
        res.end(data);
      } );
    }
});

server.listen(process.env.PORT || 3000);

