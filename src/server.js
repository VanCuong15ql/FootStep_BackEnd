const app = require('./app');
const dotenv = require("dotenv");
const mongoose = require("mongoose")

dotenv.config({ path: "./config.env" })

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
})

const http = require('http');

const server = http.createServer(app);

const DB = process.env.DBURI.replace("<PASSWORD>", process.env.DBPASSWORD)

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

const { PORT } = require('./config/secrets');

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on("unhandledRejection", (err) => {
    console.log(err);
    process.close(() => {
        process.exit(1);
    })
})
