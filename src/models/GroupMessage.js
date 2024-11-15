const mongoose = require('mongoose');
const groupMessageSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    }],
    messages: [{
        from: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
        type: {
            type: String,
            enum: ['Text', 'Media', 'Document', 'Link'],
        },
        created_at: {
            type: Date,
            default: Date.now(),
        },
        text: {
            type: String,
        },
        file: {
            type: String,
        }
    }]
});

const GroupMessage = new mongoose.model('GroupMessage', groupMessageSchema);

module.exports = GroupMessage;