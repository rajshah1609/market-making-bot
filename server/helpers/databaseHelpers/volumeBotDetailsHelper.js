const volumeBotDetails = require("../../models/volumeBotDetails");

module.exports = {
  getBotDetails: async (exchange, pair) => {
    try {
      const botData = await volumeBotDetails.findOne({
        exchange: exchange,
        "details.pair": pair,
      });
      return botData;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getBotDetails_error : `, error);
      return "error";
    }
  },

  stopBot: async (exchange, pair) => {
    try {
      await volumeBotDetails.updateOne(
        {
          exchange: exchange,
          "details.pair": pair,
        },
        {
          $set: {
            "details.status": "stop",
          },
        }
      );
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_stopBot_error : `, error);
      return "error";
    }
  },

  startBot: async (reqData) => {
    try {
      await volumeBotDetails.updateOne(
        {
          exchange: reqData.exchange,
          "details.pair": reqData.pair,
        },
        {
          $set: {
            "details.minVolume": reqData.minVolume,
            "details.maxVolume": reqData.maxVolume,
            "details.minSeconds": reqData.minSeconds,
            "details.maxSeconds": reqData.maxSeconds,
            "details.status": "start",
          },
        }
      );
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_stopBot_error : `, error);
      return "error";
    }
  },

  getAllBotDetails: async () => {
    try {
      const botData = await volumeBotDetails.find({}).sort({ createdAt: -1 });
      return botData;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getAllBotDetails_error : `, error);
      return "error";
    }
  },

  saveDetails: async (exchange, pair) => {
    try {
      const saveData = new volumeBotDetails({
        exchange,
        "details.pair": pair,
      });
      saveData.save();
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_saveDetails_error : `, error);
      return "error";
    }
  },

  updateMessage: async (exchange, pair, message, lastAmount = 0) => {
    try {
      if (message == "Placed") {
        await volumeBotDetails.updateOne(
          {
            exchange: exchange,
            "details.pair": pair,
          },
          [
            {
              $set: {
                "details.message": message,
                "details.sellFirst": { $eq: [false, "$details.sellFirst"] },
                "details.placeLast": { $eq: [false, "$details.placeLast"] },
                "details.lastAmount": lastAmount,
              },
            },
          ]
        );
      } else {
        await volumeBotDetails.updateOne(
          {
            exchange: exchange,
            "details.pair": pair,
          },
          [
            {
              $set: {
                "details.message": message,
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_updateMessage_error : `, error);
      return "error";
    }
  },
};
