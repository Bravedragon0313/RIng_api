import * as express from 'express';
 
const app = express();
 
app.get('/', (request, response) => {
  response.sendFile('index.html');
});
 
app.listen(5000);