const router = require("express").Router(); 

const authController = require("../controllers/auth");
const { route } = require("./user");

router.post("/login", authController.login);

router.post("/register", authController.register);  

router.post("/send-otp", authController.sendOtp);

router.post("/verify-otp", authController.verifyOtp);

router.post("/forgot-password", authController.forgotPassword);

router.post("/reset-password", authController.resetPassword);

module.exports = router;