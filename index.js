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
    } else if (req.url === '/assets/styles/styles.css') {
      fs.readFile('./assets/styles/styles.css', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(data);
      } );
    } else if( req.url === '/assets/styles/fonts.css') {
      fs.readFile('./assets/styles/fonts.css', (err, data) => {
      res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(data);
      } );
    } else if(req.url === '/favicon.ico') {
      fs.readFile('./favicon.ico', (err, data) => {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        res.end(data);
      } );
    }
});

server.listen(process.env.PORT || 3000);

