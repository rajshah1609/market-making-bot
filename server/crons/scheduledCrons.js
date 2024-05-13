const CronJob = require("cron").CronJob;
const cronController = require("../controllers/cronController");
const spreadBotController = require("../controllers/spreadBotController");
const volumeBotController = require("../controllers/volumeBotController");

// new CronJob(
//   "56 * * * *",
//   async () => {
//     cronController.checkBalances();
//   },
//   null,
//   true,
//   "Asia/Kolkata"
// );

new CronJob(
  "14 * * * * *",
  async () => {
    volumeBotController.placeErrorOrders();
    await spreadBotController.resetFlags();
    await spreadBotController.autoCancelOrders();
    await spreadBotController.generateOrders();
    await spreadBotController.placeOrders();
    await spreadBotController.updateCancellingOrders();
    await spreadBotController.updateOrdersMin();
    await spreadBotController.cancelExtraOrders();
    await spreadBotController.placeExternalOrders();
    await spreadBotController.updateExternalExchangeOrders();
    // await spreadBotController.placeFailedOrders();
    // await spreadBotController.checkOrderNumbers();
  },
  null,
  true,
  "Asia/Kolkata"
);

new CronJob(
  "*/10 * * * *",
  async () => {
    cronController.updatedCompletedOrdersStatus();
    // spreadBotController.updateMaintainOrderStatus();
    await spreadBotController.updateOrders10Min();
  },
  null,
  true,
  "Asia/Kolkata"
);

new CronJob(
  "*/5 * * * *",
  async () => {
    await volumeBotController.checkAndUpdateVolumeBot();
    volumeBotController.updateLoss();
  },
  null,
  true,
  "Asia/Kolkata"
);

// new CronJob(
//   "0 */3 * * *",
//   async () => {
//     await spreadBotController.maintainBalance();
//   },
//   null,
//   true,
//   "Asia/Kolkata"
// );

// new CronJob(
//   "16 2 * * * *",
//   async () => {
//     await spreadBotController.differenceMail();
//     // await spreadBotController.maintainBalance();
//   },
//   null,
//   true,
//   "Asia/Kolkata"
// );

new CronJob(
  "0 8 * * *",
  async () => {
    await cronController.updateBalance("daily");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await cronController.sendStatsMail();
  },
  null,
  true,
  "Asia/Kolkata"
);

new CronJob(
  "5 * * * *",
  async () => {
    await cronController.updateBalance("hourly");
  },
  null,
  true,
  "Asia/Kolkata"
);
