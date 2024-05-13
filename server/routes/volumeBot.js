var express = require("express");
var router = express.Router();

const RequireAdmin = require("../middlewares/requireAdmin");

const volumeBotController = require("../controllers/volumeBotController");

/* GET home page. */
// router.get("/runbot", volumeBotController.runBot);
router.post("/updatebot", RequireAdmin, volumeBotController.updateBot);
router.get("/getbot", RequireAdmin, volumeBotController.getBot);
// router.get("/updatebotorders", volumeBotController.updateBotOrders);
// router.get("/checkbots", volumeBotController.checkBots);
router.post("/forcestart", RequireAdmin, volumeBotController.forceStart);
router.get(
  "/forcestartnoauth",
  function (req, res, next) {
    req.body = req.query;
    next();
  },
  volumeBotController.forceStart
);
router.post("/addexchange", RequireAdmin, volumeBotController.addExchange);
router.post("/openorder", volumeBotController.openOrder);
router.post("/cancelorder", RequireAdmin, volumeBotController.cancelOrder);

module.exports = router;
