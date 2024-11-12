const app = require('./app');
const mongoose = require("mongoose")
const { PORT, DB_URL, DB_PASSWORD } = require("./config/secrets")

const { Server } = require("socket.io")

const http = require('http');
const { Socket } = require('dgram');
const User = require('./models/user');
const FriendRequest = require('./models/friendRequest');
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
    if (Boolean(user_id)) {
        await User.findByIdAndUpdate(user_id, { socket_id })
    }

    socket.on("friend_request", async (data) => {
        console.log(data.to);

        const to_user = await User.findById(data.to).select("socket_id");
        const from_user = await User.findById(data.from).select("socket_id");

        await FriendRequest.create({
            sender: data.from,
            recipient: data.to
        })

        io.to(to_user.socket_id).emit("new_friend_request", {
            message: "New friend request received",
        });

        io.to(from_user.socket_id).emit("request_sent", {
            message: "Request Sent successfully!",
        });
    })

    socket.on("accept_request", async (data) => {
        console.log(data);
        const request_doc = await FriendRequest.findById(data.request_id);

        console.log(request_doc);

        const sender = await User.findById(request_doc.sender);
        const receiver = await User.findById(request_doc.recipient);

        sender.friends.push(request_doc.recipient);
        receiver.friends.push(request_doc.sender);

        await receiver.save({ new: true, validateModifiedOnly: true });
        await sender.save({ new: true, validateModifiedOnly: true });

        await FriendRequest.findByIdAndDelete(data.request_id);

        io.to(sender.socket_id).emit("request_accepted", {
            message: "Friend Request Accepted",
        });
        io.to(receiver.socket_id).emit("request_accepted", {
            message: "Friend Request Accepted",
        });
    });

    socket.on("end", function () {
        console.log("Closing connection")
        socket.disconnect(0)
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
