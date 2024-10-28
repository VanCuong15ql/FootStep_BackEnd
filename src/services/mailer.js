const sgMail = require('@sendgrid/mail');

const { NODE_ENV, SG_KEY } = require('../config/secrets');

sgMail.setApiKey(SG_KEY);

const sendSGMail = async ({
    recipient,
    sender,
    subject,
    html,
    text,
    attachments,
}) => {
    try {
        const from = sender || "";

        const msg = {
            to: recipient,
            from: from,
            subject,
            html: html,
            text: text,
            attachments,
        }

        return sgMail.send(msg);
    } catch (err) {
        console.log(err);
    }
}

exports.sendEmail = async (args) => {
    if (NODE_ENV === 'development') {
        return new Promise.resolve();
    } else {
        return sendSGMail(args);
    }
}