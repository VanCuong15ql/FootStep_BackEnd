const app = require('./app');
const mongoose = require("mongoose")
const { PORT, DB_URL, DB_PASSWORD } = require("./config/secrets")

const { Server } = require("socket.io")

const http = require('http');
const { Socket } = require('dgram');
const User = require('./models/user');
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const DB = DB_URL.replace("<PASSWORD>", DB_PASSWORD)
mongoose.connect(DB, {
    // useNewUrlParser: true,
    // userCreateIndex: true,
    // userFindAndModify: false,
    // useUnifiedToplogy: true
    dbName: "chat-online-app"
}).then((con) => {
    console.log("DB connection is successful");
}).catch((err) => {
    console.log(err);
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

io.on("connection", async (socket) => {
    console.log(socket)
    const user_id = socket.handshake.query["user_id"];

    const socket_id = socket.id;

    console.log(`User connected ${socket_id}`);
    if (user_id) {
        await User.findByIdAndUpdate(user_id,)
    }

    socket.on("friend_request", async (data) => {
        console.log(data.to);

        const to = await User.findById(data.to);

        io.to(to.socket_id).emit("new_friend_request", {

        })
    })
})

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
})

process.on("unhandledRejection", (err) => {
    console.log(err);
    process.close(() => {
        process.exit(1);
    })
})
