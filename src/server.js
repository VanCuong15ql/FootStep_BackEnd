const app = require('./app');
const dotenv = require("dotenv");
const mongoose = require("mongoose")
const { PORT, DB_URL, DB_PASSWORD } = require("./config/secrets")

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
})

const http = require('http');

const server = http.createServer(app);

const DB = DB_URL.replace("<PASSWORD>", DB_PASSWORD)

mongoose.connect(DB, {
    useNewUrlParser: true,
    userCreateIndex: true,
    userFindAndModify: false,
    useUnifiedToplogy: true
}).then((con) => {
    console.log("DB connection is successful");
}).catch((err) => {
    console.log(err);
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
    console.log(err);
    process.close(() => {
        process.exit(1);
    })
})
