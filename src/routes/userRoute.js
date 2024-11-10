const router = require("express").Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

router.get("/get-me", authController.protect, userController.getMe);
router.patch("/update-me", authController.protect, userController.updateMe);

router.get("/get-all-verified-users", authController.protect, userController.getAllVerifiedUsers);
router.get("/get-users", authController.protect, userController.getUsers);

router.get("/get-requests", authController.protect, userController.getRequests);
router.get("/get-friends", authController.protect, userController.getFriends);

router.post("/generate-zego-token", authController.protect, userController.generateZegoToken);

router.post("/start-audio-call", authController.protect, userController.startAudioCall);
router.post("/start-video-call", authController.protect, userController.startVideoCall);

router.get("/get-call-logs", authController.protect, userController.getCallLogs);

module.exports = router;    