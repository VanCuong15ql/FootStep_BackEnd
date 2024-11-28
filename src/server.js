const app = require('./app');
const mongoose = require("mongoose")
const { PORT, DB_URL, DB_PASSWORD, S3_BUCKET_NAME, AWS_S3_REGION, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY } = require("./config/secrets")

const http = require('http');
const server = http.createServer(app);

require('aws-sdk/lib/maintenance_mode_message').suppress = true;
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const User = require('./models/user');
const FriendRequest = require('./models/friendRequest');
const OneToOneMessage = require("./models/OneToOneMessage");
const GroupMessage = require("./models/GroupMessage");
const AudioCall = require("./models/audioCall");
const VideoCall = require("./models/videoCall");

const { Server } = require("socket.io");
const { text } = require('body-parser');

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    }
});

const DB = DB_URL.replace("<PASSWORD>", DB_PASSWORD)
mongoose.connect(DB, {
    // useNewUrlParser: true,
    // userCreateIndex: true,
    // userFindAndModify: false,
    // useUnifiedToplogy: true
    dbName: "chat-app-yt"
}).then((con) => {
    console.log("DB connection is successful");
}).catch((err) => {
    console.log(err);
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

io.on("connection", async (socket) => {
    console.log(JSON.stringify(socket.handshake.query));
    const user_id = socket.handshake.query["user_id"];

    console.log(`User connected ${socket.id}`);

    if (user_id != null && Boolean(user_id)) {
        try {
            await User.findByIdAndUpdate(user_id, {
                socket_id: socket.id,
                status: "Online",
            });
        } catch (e) {
            console.log(e);
        }
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

    // -------------- HANDLE ONE TO ONE MESSAGES SOCKET EVENTS ------------------------------------------------------------------------- //

    socket.on("get_direct_conversations", async ({ user_id }, callback) => {
        const existing_conversations = await OneToOneMessage.find({
            participants: { $all: [user_id] },
        }).populate("participants", "firstName lastName avatar _id email status");
    
        console.log("existing conversation", existing_conversations);
    
        callback(existing_conversations);
    });

    socket.on("start_conversation", async (data) => {
        // data: {to: from:}
    
        const { to, from } = data;
        console.log("Start Conversation", data);
    
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
            const chat = await OneToOneMessage.findById(data.conversation_id).select("messages");
            if (!chat) callback([]);
            else callback(chat.messages);
            return;
        } catch (error) {
            console.log(error);
        }
    });

    socket.on("text_message", async (data) => {
        console.log("Received message:", data);
    
        let { message, conversation_id, from, to, type } = data;

        let chat;
        if (conversation_id) chat = await OneToOneMessage.findById(conversation_id);
        else if (from != to) chat = await OneToOneMessage.findOne({
            participants: { 
                $all: [
                    new mongoose.Types.ObjectId(from), 
                    new mongoose.Types.ObjectId(to)
                ]
            },
        }); 
        if (!chat) return;
    
        console.log(chat.participants); 
        to = chat.participants[0].toString();
        if (to == from) to = chat.participants[1].toString();

        console.log(from, to);

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);
    
        // message => {to, from, type, created_at, text}
    
        const new_message = {
            to: to,
            from: from,
            type: type,
            created_at: Date.now(),
            text: message,
        };
    
        // fetch OneToOneMessage Doc & push a new message to existing conversation
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

    socket.on("file_message", async (data) => {
        try {
            console.log("Received message:", data);
    
            // data: {to, from, nameFile, file}
            let { from, to, name_file, file } = data;

            let type = "File";
            let ext = name_file.split('.').pop();

            const image_foot = ["jpg", "jpeg", "png", "gif"];
            if (image_foot.includes(ext)) type = "Image";

            const video_foot = ["mp4", "avi", "mov", "flv"];
            if (video_foot.includes(ext)) type = "Video";

        
            // Generate a unique filename
            const fileNameConfig = `${Number(Date.now())}_${name_file}`;

            // Tạo đường dẫn
            const uploadsDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir);
            }
            const filePath = path.join(uploadsDir, fileNameConfig);

            // Ghi Buffer vào file
            fs.writeFile(filePath, file, (err) => {
                if (err) {
                    console.error('Error saving file:', err);
                } else {
                    console.log(`File saved: ${filePath}`);
                }
            });
        
            // upload file to AWS s3
            const fileStream = fs.createReadStream(filePath);
            fileStream.on('error', function(err) {
                console.log('File Error', err);
            });
            const params = {
                Bucket: S3_BUCKET_NAME,
                Key: fileNameConfig,
                Body: fileStream,
            };
            const s3 = new AWS.S3({
                region: AWS_S3_REGION,
                accessKeyId: AWS_ACCESS_KEY,
                secretAccessKey: AWS_SECRET_ACCESS_KEY, 
            });
            let location_file = "";
            s3.upload(params, async (err, data) => {
                if (err) {
                    console.log('Error', err);
                }
                if (data) {
                    location_file = data.Location;
                    console.log('Uploaded in:', location_file);

                    // save to db
                    let chat = await OneToOneMessage.findOne({participants: { $size: 2, $all: [to, from] }});
                    if (!chat) return;
                    const new_message = {
                        to: to,
                        from: from,
                        type: type,
                        created_at: Date.now(),
                        text: name_file,
                        file: location_file,
                    };
                    chat.messages.push(new_message);
                    await chat.save({ new: true, validateModifiedOnly: true });
                
                    // emit incoming_message -> to user
                    const to_user = await User.findById(to);
                    if (to_user) {
                        io.to(to_user.socket_id).emit("new_message", {
                            conversation_id: chat._id,
                            message: new_message,
                        });
                    }
                
                    // emit outgoing_message -> from user
                    const from_user = await User.findById(from);
                    if (from_user) {
                        io.to(from_user.socket_id).emit("new_message", {
                            conversation_id: chat._id,
                            message: new_message,
                        });
                    }
                }

                // delete file
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                    } else {
                        console.log(`File deleted: ${filePath}`);
                    }
                });
            });
        } catch (err) {
            console.log(err);
        }
    });

    // -------------- HANDLE GROUP MESSAGES SOCKET EVENTS ---------------------------------------------------------------------------------- //
    socket.on("get_direct_conversations_group", async ({ user_id }, callback) => {
        const existing_conversations = await GroupMessage.find({
            participants: { $all: [user_id] },
        }).populate("participants", "firstName lastName avatar _id email status");
    
        console.log("existing conversation", existing_conversations);
    
        callback(existing_conversations);
    });

    socket.on("start_conversation_group", async (data) => {
        // data: {to: from:}
    
        const { participants } = data;
        console.log("Start Conversation", data);
    
        // check if there is any existing conversation
    
        const existing_conversations = await GroupMessage.find({
            participants: { $size: participants.length, $all: participants },
        }).populate("participants", "firstName lastName _id email status");
    
        console.log(existing_conversations[0], "Existing Conversation");
    
        // if no => create a new GroupMessage doc & emit event "start_chat" & send conversation details as payload
        if (existing_conversations.length === 0) {
            let new_chat = await GroupMessage.create({
                participants: participants,
            });
        
            new_chat = await GroupMessage.findById(new_chat).populate(
                "participants",
                "firstName lastName _id email status"
            );
        
            console.log(new_chat);
        
            socket.emit("start_chat_group", new_chat);
        }
        // if yes => just emit event "start_chat" & send conversation details as payload
        else {
            socket.emit("start_chat_group", existing_conversations[0]);
        }
    });

    socket.on("get_messages_group", async (data, callback) => {
        try {
            const chat = await GroupMessage.findById(data.conversation_id).select("messages");
            if (!chat) callback([]);
            else callback(chat.messages);
            return;
        } catch (error) {
            console.log(error);
        }
    });

    socket.on("text_message_group", async (data) => {
        console.log("Received message:", data);
    
        let { message, from, conversation_id, participants } = data;

        let chat;
        if (conversation_id) {
            chat = await GroupMessage.findById(conversation_id);
            participants = chat.participants;
        } else {
            chat = await GroupMessage.findOne({participants: { $size: participants.length, $all: participants }}); 
        }
        if (!chat) return;
    
        console.log(chat.participants); 
        let users = [];
        for (let user_id of participants) {
            users.push(await User.findById(user_id));
        }
    
        const new_message = {
            from: from,
            type: "text",
            created_at: Date.now(),
            text: message,
        };
        chat.messages.push(new_message);
        await chat.save({ new: true, validateModifiedOnly: true });

        // emit to user
        for (let user of users) {
            io.to(user?.socket_id).emit("new_message_group", {
                conversation_id,
                message: new_message
            });
        }
    });

    socket.on("file_message_group", async (data) => {
        console.log("Received message:", data);
    
        // data: {from, conversation_id, participants, file}
        let {from, conversation_id, participants, name_file, file} = data;
    
        // Generate a unique filename
        const fileNameConfig = `${Number(Date.now())}_${name_file}`;

        // Tạo đường dẫn
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        const filePath = path.join(uploadsDir, fileNameConfig);

        // Ghi Buffer vào file
        fs.writeFile(filePath, file, (err) => {
            if (err) {
                console.error('Error saving file:', err);
            } else {
                console.log(`File saved: ${filePath}`);
            }
        });
    
        // upload file to AWS s3
        const fileStream = fs.createReadStream(filePath);
        fileStream.on('error', function(err) {
            console.log('File Error', err);
        });
        const params = {
            Bucket: S3_BUCKET_NAME,
            Key: fileNameConfig,
            Body: fileStream,
        };
        const s3 = new AWS.S3({
            region: AWS_S3_REGION,
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_ACCESS_KEY, 
        });
        let location = "";
        s3.upload(params, (err, data) => {
            if (err) {
                console.log('Error', err);
            }
            if (data) {
                location = data.Location;
                console.log('Uploaded in:', data.Location);
            }
            // Xóa file
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                } else {
                    console.log(`File deleted: ${filePath}`);
                }
            });
        });
    
        // save to db
        let chat;
        if (conversation_id) {
            chat = await GroupMessage.findById(conversation_id);
            participants = chat.participants;
        } else {
            chat = await GroupMessage.findOne({participants: { $size: participants.length, $all: participants }}); 
        }
        if (!chat) return;
        const new_message = {
            from: from,
            type: "file",
            created_at: Date.now(),
            text: name_file,
            file: location,
        };
        chat.messages.push(new_message);
        await chat.save({ new: true, validateModifiedOnly: true });
    
        // emit incoming_message -> user
        for(let participant of participants) {
            const user = await User.findById(participant);
            if (user) {
                io.to(user.socket_id).emit("new_file_message_group", {
                    conversation_id: chat._id,
                    message: new_message,
                });
            }
        }
    });


    // -------------- HANDLE AUDIO CALL SOCKET EVENTS -------------------------------------------------------------------------------------- //

    // handle start_audio_call event
    socket.on("start_audio_call", async (data) => {
        const { from, to, roomID } = data;

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);

        console.log("to_user", to_user);

        // send notification to receiver of call
        io.to(to_user?.socket_id).emit("audio_call_notification", {
            from: from_user,
            roomID,
            streamID: from,
            userID: to,
            userName: to,
        });
    });

    // handle audio_call_not_picked
    socket.on("audio_call_not_picked", async (data) => {
        console.log(data);
        // find and update call record
        const { to, from } = data;

        const to_user = await User.findById(to);

        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { 
                verdict: "Missed", 
                status: "Ended", 
                endedAt: Date.now() 
            }
        );

        // TODO => emit call_missed to receiver of call
        io.to(to_user?.socket_id).emit("audio_call_missed", {
            from,
            to,
        });
    });

    // handle audio_call_accepted
    socket.on("audio_call_accepted", async (data) => {
        const { to, from } = data;

        const from_user = await User.findById(from);

        // find and update call record
        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            {   
                verdict: "Accepted" 
            }
        );

        // TODO => emit call_accepted to sender of call
        io.to(from_user?.socket_id).emit("audio_call_accepted", {
            from,
            to,
        });
    });

    // handle audio_call_denied
    socket.on("audio_call_denied", async (data) => {
        // find and update call record
        const { to, from } = data;

        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            {   
                verdict: "Denied", 
                status: "Ended", 
                endedAt: Date.now() 
            }
        );

        const from_user = await User.findById(from);
        // TODO => emit call_denied to sender of call

        io.to(from_user?.socket_id).emit("audio_call_denied", {
            from,
            to,
        });
    });

    // handle user_is_busy_audio_call
    socket.on("user_is_busy_audio_call", async (data) => {
        const { to, from } = data;
        // find and update call record
        await AudioCall.findOneAndUpdate(
        {
            participants: { $size: 2, $all: [to, from] },
        },
        { 
            verdict: "Busy", 
            status: "Ended", 
            endedAt: Date.now() 
        }
        );

        const from_user = await User.findById(from);
        // TODO => emit on_another_audio_call to sender of call
        io.to(from_user?.socket_id).emit("on_another_audio_call", {
            from,
            to,
        });
    });

    // --------------------- HANDLE VIDEO CALL SOCKET EVENTS ---------------------- //

    // handle start_video_call event
    socket.on("start_video_call", async (data) => {
        const { from, to, roomID } = data;

        console.log(data);

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);

        console.log("to_user", to_user);

        // send notification to receiver of call
        io.to(to_user?.socket_id).emit("video_call_notification", {
            from: from_user,
            roomID,
            streamID: from,
            userID: to,
            userName: to,
        });
    });

    // handle video_call_not_picked
    socket.on("video_call_not_picked", async (data) => {
        console.log(data);
        // find and update call record
        const { to, from } = data;

        const to_user = await User.findById(to);

        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { 
                verdict: "Missed", 
                status: "Ended", 
                endedAt: Date.now() 
            }
        );

        // TODO => emit call_missed to receiver of call
        io.to(to_user?.socket_id).emit("video_call_missed", {
            from,
            to,
        });
    });

    // handle video_call_accepted
    socket.on("video_call_accepted", async (data) => {
        const { to, from } = data;

        const from_user = await User.findById(from);

        // find and update call record
        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { 
                verdict: "Accepted" 
            }
        );

        // TODO => emit call_accepted to sender of call
        io.to(from_user?.socket_id).emit("video_call_accepted", {
            from,
            to,
        });
    });

    // handle video_call_denied
    socket.on("video_call_denied", async (data) => {
        // find and update call record
        const { to, from } = data;

        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { 
                verdict: "Denied", 
                status: "Ended", 
                endedAt: Date.now() 
            }
        );

        const from_user = await User.findById(from);
        // TODO => emit call_denied to sender of call

        io.to(from_user?.socket_id).emit("video_call_denied", {
            from,
            to,
        });
    });

    // handle user_is_busy_video_call
    socket.on("user_is_busy_video_call", async (data) => {
        const { to, from } = data;
        // find and update call record
        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { 
                verdict: "Busy", 
                status: "Ended", 
                endedAt: Date.now() 
            }
        );

        const from_user = await User.findById(from);
        // TODO => emit on_another_video_call to sender of call
        io.to(from_user?.socket_id).emit("on_another_video_call", {
            from,
            to,
        });
    });

    // -------------- HANDLE SOCKET DISCONNECTION ----------------- //

    socket.on("end", async (data) => {
        // Find user by ID and set status as offline

        if (data.user_id) {
            await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
        }

        // broadcast to all conversation rooms of this user that this user is offline (disconnected)

        console.log("closing connection");
        socket.disconnect(0);
    });
})

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
})

process.on("unhandledRejection", (err) => {
    console.log(err);
    process.exit(1);
})
