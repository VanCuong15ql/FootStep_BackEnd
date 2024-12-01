const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator")
const crypto = require("crypto");

const mailService = require("../services/mailer");

const User = require("../models/user");

const otpPattern = require("../pattern/otpPattern");
const resetPasswordPattern = require("../pattern/resetPasswordPattern");

const { JWT_SECRET, MAILER } = require("../config/secrets");
const filterObj = require("../utils/filterObj");
const { promisify } = require("util");

const signToken = (userId) => jwt.sign({ userId }, JWT_SECRET);

// Signup => register - sendOTp - verifyOTP

// Register New User
exports.register = async (req, res, next) => {
    const { firstName, lastName, email, password, verified } = req.body;

    const filteredBody = filterObj(req.body, "firstName", "lastName", "password", "email");

    //check if verified user with given email exists

    const existing_user = await User.findOne({ email: email });

    if (existing_user && existing_user.verified) {
        res.status(400).json({
            status: "error",
            message: "Email is already in use, Please login."
        })
    }
    else if (existing_user) {
        await User.findOneAndUpdate({ email: email }, filteredBody, { new: true, validateModifiedOnly: true },);
        req.userId = existing_user._id;
        next();
    } else {
        //if user record is not available in DB
        const new_user = await User.create(filteredBody);

        //gererate OTP and send email to user
        req.userId = new_user._id;
        next();
    }
}

exports.sendOTP = async (req, res, next) => {
    const { userId } = req;
    const new_otp = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false
    });

    const otp_expiry_time = Date.now() + 10 * 60 * 1000;

    const user = await User.findById(userId);

    user.otp_expiry_time = otp_expiry_time;
    user.otp = new_otp.toString();

    await user.save({ new: true, validateModifiedOnly: true });

    mailService.sendEmail({
        from: MAILER,
        to: user.email,
        subject: "OTP for Chat App",
        text: `${new_otp}`,
        html: otpPattern(user.firstName, new_otp)
    })
        .then(() => { })
        .catch((err) => {
            console.log("Error sending otp");
            console.log(err);
        })

    res.status(200).json({
        status: "success",
        message: "OTP Sent Successfully!"
    })
}

exports.verifyOTP = async (req, res, next) => {
    //verify OTP and update user record accordingly

    const { email, otp } = req.body; console.log(email, otp);

    const user = await User.findOne({
        email: email,
        otp_expiry_time: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Email is Invalid or OTP is expired"
        });
        return;
    }

    if (!await user.correctPassword(otp, user.otp)) {
        res.status(400).json({
            status: "error",
            message: "OTP is incorrect"
        });
        return;
    }

    //OTP is correct
    user.verified = true;
    user.otp = undefined;

    await user.save({ new: true, validateModifiedOnly: true })

    const token = signToken(user._id);

    res.status(200).json({
        status: "success",
        message: "OTP verified successfully!",
        token,
        user_id: user._id
    })
}

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({
            status: "error",
            message: "Both email and password are required"
        });
    }

    const userDoc = await User.findOne({ email: email }).select("+password");

    if (!userDoc || !(await userDoc.correctPassword(password, userDoc.password))) {
        res.status(400).json({
            status: "error",
            message: "Email or password is incorrect",
        })
    }

    const token = signToken(userDoc._id);

    res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        token,
        user_id: userDoc._id
    })
}

exports.protect = async (req, res, next) => {
    // 1. Getting token (JWT) and check if it's there

    let token;

    // 'Bearer klashgf09lks09urns'

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];

    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    } else {
        res.status(400).json({
            status: "error",
            message: "You are not Logged In! Please log in to get access"
        })
        return;
    }

    // 2. Verification 
    const decode = await promisify(jwt.verify)(token, JWT_SECRET);

    console.log(decode);

    // 3. Check if user still exist

    const this_user = await User.findById(decode.userId);

    if (!this_user) {
        res.status(400).json({
            status: "error",
            message: "The user doesn't exits"
        })
    }

    // 4. check if user changed their password after token was issued

    if (this_user.changedPasswordAfter(decode.iat)) {
        res.status(400).json({
            status: "error",
            message: "User recently updated password! Please log in again"
        })
    }

    req.user = this.user;
    next();
}

exports.forgotPassword = async (req, res, next) => {
    // 1. Get users email
    const { email } = req.body;
    const userDoc = await User.findOne({ email: email })

    if (!userDoc) {
        res.status(400).json({
            status: "error",
            message: "There is no user with given email address"
        });
        return;
    }

    // 2. Generate the random reset token
    const resetToken = await userDoc.createPasswordResetToken();

    console.log(resetToken);

    await userDoc.save({ validateBeforeSave: false });

    try {
        const resetURL = `http://localhost:3000/auth/new-password/?token=${resetToken}`;
        console.log(resetURL);

        //TODO => Send Email With Reset URL
        mailService.sendEmail({
            from: process.env.MAILER,
            to: userDoc.email,
            subject: "Reset Password",
            text: `${resetURL}`,
            html: resetPasswordPattern(userDoc.firstName, resetURL),
        });

        res.status(200).json({
            status: "success",
            message: "Token sent to email!",
        })
    } catch (error) {
        userDoc.passwordResetToken = undefined
        userDoc.passwordResetExpires = undefined

        await userDoc.save({ validateBeforeSave: false });

        console.log(error);

        res.status(500).json({
            status: "error",
            message: "There was an error sending email, Please try again later."
        })
    }
}

exports.resetPassword = async (req, res, next) => {
    const { token, password, passwordConfirm } = req.body;
    console.log(token, password, passwordConfirm);

    // 1. Get user based on token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });

    // 2. If token has expired or submission  is out of  time window
    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Token is Invalid or Expired"
        })

        return;
    }

    // 3. Update users password and set resetToken & expiry to undefined
    user.password = password
    user.passwordConfirm = passwordConfirm
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined

    await user.save()

    // 4. Log in the user and Send new JWT

    // TODO => send an email to user informing about password reset

    const tokenSign = signToken(user._id);

    res.status(200).json({
        status: "success",
        message: "Password Reseted Successfully",
        token: tokenSign,
    })

}