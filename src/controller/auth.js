const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator")

const User = require("../models/user");

const { JWT_SECRET } = require("../config/secrets");
const filterObj = require("../utils/filterObj");

const signToken = (userId) => jwt.sign({ userId }, JWT_SECRET);

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

exports.forgotPassword = async (req, res, next) => {

}

exports.resetPassword = async (req, res, next) => {

}