const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator")
const crypto = require("crypto");

const User = require("../models/user");

const { JWT_SECRET } = require("../config/secrets");
const filterObj = require("../utils/filterObj");
const { promisify } = require("util");

const signToken = (userId) => jwt.sign({ userId }, JWT_SECRET);

// Signup => register - sendOTp - verifyOTP

// https://api.tawk.com/auth/register

// Register New User
exports.register = async (req, res, next) => {
    const { firstName, lastName, email, password, verified } = req.body;

    const filteredBody = filterObj(req.body, "firstName", "lastName", "password", "email");

    //check if verified user with given email exists

    const existsting_user = await User.findOne({ email: email });

    if (existsting_user && existsting_user.verified) {
        res.status(400).json({
            status: "error",
            message: "Email is already in use, Please login."
        })
    }
    else if (existsting_user) {
        const updated_user = await User.findOneAndUpdate({ email: email }, filteredBody, { new: true, validateModifiedOnly: true },);

        req.userId = existsting_user._id;
        next();
    } else {
        //if user record is not available in DB
        const new_user = await User.create(filteredBody);

        //gererate OTP and send email to user

        req.userId = new_user._id;
        next();
    }

}

exports.sendOtp = async (req, res, next) => {
    const { userId } = req;
    const new_otp = otpGenerator.generate(6, {
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false
    });

    const otp_expiry_time = Date.now() + 10 * 60 * 1000;

    await User.findByIdAndUpdate(userId, {
        otp: new_otp,
        otp_expiry_time,
    })

    res.status(200).json({
        status: "success",
        message: "OTP Sent Successfully!"
    })
}

exports.verifyOTP = async (req, res, next) => {
    //verify OTP and update user record accordingly

    const { email, otp } = req.body;

    const user = await User.findOne({
        email,
        otp_expiry_time: { $gt: Date.now() }
    })

    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Email is Invalid or OTP is expired"
        })
    }

    if (!await user.correctOTP(otp, user.otp)) {
        res.status(400).json({
            status: "error",
            message: "OTP is incorrect"
        })
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

    if (!User || !(await userDoc.correctPassword(password, userDoc.password))) {
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
    const user = User.findOne({ email: req.body.email });

    if (!user) {
        res.status(400).json({
            status: "error",
            message: "There is no user with given email address"
        })

        return;
    }

    // 2. Generate the random reset token
    const resetToken = user.createPasswordResetToken()

    const URL = `http://tawk.com/auth/reset-password/?code=${resetToken}`;

    try {
        //TODO => Send Email With Reset URL
        res.status(200).json({
            status: "success",
            message: "Reset Password link sent to Email"
        })
    } catch (error) {
        user.passwordResetToken = undefined
        user.passwordResetExpires = undefined

        await user.save({ validateBeforeSave: false });

        res.status(500).json({
            status: "error",
            message: "There was an error sending email, Please try again later."
        })
    }
}

exports.resetPassword = async (req, res, next) => {
    // 1. Get user based on token
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex")

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
    user.password = req.body.password
    user.passwordConfirm = req.body.passwordConfirm
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined

    user.save()

    // 4. Log in the user and Send new JWT

    // TODO => send an email to user informing about password reset

    const token = signToken(user._id);

    res.status(200).json({
        status: "success",
        message: "Password Reseted Successfully",
        token,
    })

}