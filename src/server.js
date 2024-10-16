const app = require('./app');

const http = require('http');

const server = http.createServer(app);

const {PORT} = require('./config/secrets');

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

