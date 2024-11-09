const app = require('./app');
const mongoose = require("mongoose")
const { PORT, DB_URL, DB_PASSWORD } = require("./config/secrets")

const http = require('http');
const server = http.createServer(app);

const User = require('./models/user');
const FriendRequest = require('./models/friendRequest');
const OneToOneMessage = require("./models/OneToOneMessage");

const { Server } = require("socket.io");

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

    socket.on("get_direct_conversations", async ({ user_id }, callback) => {
        const existing_conversations = await OneToOneMessage.find({
          participants: { $all: [user_id] },
        }).populate("participants", "firstName lastName avatar _id email status");
    
        // db.books.find({ authors: { $elemMatch: { name: "John Smith" } } })
    
        console.log(existing_conversations);
    
        callback(existing_conversations);
    });

    socket.on("start_conversation", async (data) => {
        // data: {to: from:}
    
        const { to, from } = data;
    
        // check if there is any existing conversation
    
        const existing_conversations = await OneToOneMessage.find({
          participants: { $size: 2, $all: [to, from] },
        }).populate("participants", "firstName lastName _id email status");
    
        console.log(existing_conversations[0], "Existing Conversation");
    
        // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
        if (existing_conversations.length === 0) {
          let new_chat = await OneToOneMessage.create({
            participants: [to, from],
          });
    
          new_chat = await OneToOneMessage.findById(new_chat).populate(
            "participants",
            "firstName lastName _id email status"
          );
    
          console.log(new_chat);
    
          socket.emit("start_chat", new_chat);
        }
        // if yes => just emit event "start_chat" & send conversation details as payload
        else {
          socket.emit("start_chat", existing_conversations[0]);
        }
    });

    socket.on("get_messages", async (data, callback) => {
        try {
          const { messages } = await OneToOneMessage.findById(data.conversation_id).select("messages");
          callback(messages);
        } catch (error) {
          console.log(error);
        }
    });

    // Handle incoming text/link messages
    socket.on("text_message", async (data) => {
        console.log("Received message:", data);
    
        // data: {to, from, text}
    
        const { message, conversation_id, from, to, type } = data;
    
        const to_user = await User.findById(to);
        const from_user = await User.findById(from);
    
        // message => {to, from, type, created_at, text, file}
    
        const new_message = {
            to: to,
            from: from,
            type: type,
            created_at: Date.now(),
            text: message,
        };
    
        // fetch OneToOneMessage Doc & push a new message to existing conversation
        const chat = await OneToOneMessage.findById(conversation_id);
        chat.messages.push(new_message);
        // save to db`
        await chat.save({ new: true, validateModifiedOnly: true });
    
        // emit incoming_message -> to user
    
        io.to(to_user?.socket_id).emit("new_message", {
            conversation_id,
            message: new_message,
        });
    
        // emit outgoing_message -> from user
        io.to(from_user?.socket_id).emit("new_message", {
            conversation_id,
            message: new_message,
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
