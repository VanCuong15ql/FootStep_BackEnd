const jwt = require("jsonwebtoken");

const User = require("../models/user");

const { JWT_SECRET } = require("../config/secrets");

const signToken = (userId) => jwt.sign({ userId }, JWT_SECRET);

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

    const token = signToken();

    res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        token,
    })
}