const sgMail = require('@sendgrid/mail');

const { SG_KEY } = require('../config/secrets');

sgMail.setApiKey(SG_KEY);

const sendSGMail = async (args) => {
    try {
        const {from , to, subject, text, html} = args;
        console.log(from, to, subject, text);

        const msg = {
            from: from,
            to: to,
            subject: subject,
            // text: text,
            html: html
        }

        return sgMail.send(msg);
    } catch (err) {
        console.log(err);
    }
}

exports.sendEmail = async (args) => {
    await sendSGMail(args);
}