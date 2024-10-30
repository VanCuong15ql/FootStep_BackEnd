const router = require("express").Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

router.post("/update-me", authController.protect, userController.updateMe);

module.exports = router;