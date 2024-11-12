const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator")
const crypto = require("crypto");

const mailService = require("../services/mailer");

const User = require("../models/user");

const { JWT_SECRET, MAILER } = require("../config/secrets");
const filterObj = require("../utils/filterObj");
const { promisify } = require("util");
const resetPassword = require("../Templates/Mail/resetPassword");
const catchAsync = require("../utils/catchAsync");

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
        text: `Your OTP is ${new_otp}. This is valid for 10 minutes`,
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

    console.log(new_otp)
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

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return res.status(404).json({
            status: "error",
            message: "There is no user with email address.",
        });
    }

    // 2) Generate the random reset token
    const resetToken = await user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    try {
        const resetURL = `http://localhost:3000/auth/new-password?token=${resetToken}`;
        // TODO => Send Email with this Reset URL to user's email address

        console.log(resetURL);

        const resetPasswordHtml = resetPassword(user.firstName, resetURL);

        // mailService.sendEmail({
        //     from: MAILER,
        //     to: user.email,
        //     subject: "Reset Password",
        //     html: resetPasswordHtml,
        //     attachments: [],
        // });

        res.status(200).json({
            status: "success",
            message: "Token sent to email!",
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return res.status(500).json({
            message: "There was an error sending the email. Try again later!",
        });
    }
});

// exports.forgotPassword = async (req, res, next) => {
//     // 1. Get users email
//     const { email } = req.body;
//     const userDoc = await User.findOne({ email: email })

//     if (!userDoc) {
//         res.status(400).json({
//             status: "error",
//             message: "There is no user with given email address"
//         });
//         return;
//     }

//     // 2. Generate the random reset token
//     const resetToken = await userDoc.createPasswordResetToken();

//     console.log(resetToken);

//     await userDoc.save({ validateBeforeSave: false });

//     try {
//         const URL = `http://localhost:3000/auth/new-password?token=${resetToken}`;
//         //TODO => Send Email With Reset URL

//         mailService.sendEmail({
//             from: MAILER,
//             to: userDoc.email,
//             subject: "Reset Password",
//             html: resetPassword(userDoc.firstName, URL),
//             attachments: [],
//         })
//             .then(() => { })
//             .catch((err) => {
//                 console.log("Error sending Email");
//                 console.log(err);
//             });


//         res.status(200).json({
//             status: "success",
//             message: "Reset Password link sent to Email"
//         })
//     } catch (error) {
//         userDoc.passwordResetToken = undefined
//         userDoc.passwordResetExpires = undefined

//         await userDoc.save({ validateBeforeSave: false });

//         res.status(500).json({
//             status: "error",
//             message: "There was an error sending email, Please try again later."
//         })
//     }
// }

exports.resetPassword = async (req, res, next) => {
    const { token } = req.query;
    const { password, passwordConfirm } = req.body;
    console.log(token, password, passwordConfirm);


    // 1. Get user based on token
    const hashedToken = crypto.createHash("sha256").update(req.body.token).digest("hex")

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
        tokenSign,
    })

}