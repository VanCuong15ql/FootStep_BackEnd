const router = require("express").Router(); 

const authController = require("../controllers/authController");

router.post("/login", authController.login);

router.post("/register", authController.register, authController.sendOTP);  

router.post("/send-otp", authController.sendOTP);

router.post("/verify", authController.verifyOTP);

router.post("/forgot-password", authController.forgotPassword);

router.post("/reset-password", authController.resetPassword);

router.get("", (req, res) => {res.status(200).send("auth is running")});

module.exports = router;