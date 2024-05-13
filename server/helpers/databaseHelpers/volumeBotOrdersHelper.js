const volumeBotOrders = require("../../models/volumeBotOrders");
const commonHelper = require("../commonHelper");

module.exports = {
  getBotOpenOrders: async (exchange, pair) => {
    try {
      const botOrders = await volumeBotOrders
        .find({
          exchange: exchange,
          pair: pair,
          status: { $in: ["active", "partially"] },
        })
        .sort({ updatedAt: -1 });
      return botOrders;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getBotOpenOrders_error : `, error);
      return "error";
    }
  },

  saveBotOrders: async (reqData) => {
    try {
      const saveData = new volumeBotOrders({
        uniqueId: reqData.uniqueId,
        exchange: reqData.exchange,
        pair: reqData.pair,
        type: reqData.type,
        price: reqData.price,
        usdtPrice: reqData.usdtPrice,
        originalQty: reqData.originalQty,
        filledQty: reqData.filledQty,
        total: reqData.total,
        updatedTotal: reqData.updatedTotal,
        exchangeId: reqData.exchangeId,
        status: reqData.status,
        fees: reqData.fees,
        feeCurrency: reqData.feeCurrency,
        mappingId: reqData.mappingId,
        tentativeLoss: 0,
      });
      saveData.save();
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_saveBotOrders_error : `, error);
      return "error";
    }
  },

  updateBotOrders: async (
    exchangeId,
    filledQty,
    status,
    exchange,
    pair,
    fees,
    feeCurrency,
    feesUSDT,
    mappingId,
    updatedTotal
  ) => {
    try {
      await volumeBotOrders.findOneAndUpdate(
        {
          exchangeId: exchangeId,
          exchange: exchange,
          pair: pair,
          mappingId: mappingId,
        },
        {
          filledQty: filledQty,
          status: status,
          fees: fees,
          feeCurrency: feeCurrency,
          feesUSDT: feesUSDT,
          updatedTotal,
        }
      );
      // logger.info(`volumeBotOrdersHelper_updateBotOrders_update : `, exchange, exchangeId, status, data);
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_updateBotOrders_error : `, error);
      return "error";
    }
  },

  getLastOrder: async (exchange, pair) => {
    try {
      const botOrder = await volumeBotOrders
        .findOne({
          exchange: exchange,
          pair: pair,
          status: { $ne: "error" },
        })
        .sort({ createdAt: -1 });
      return botOrder;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getLastTrade_error : `, error);
      return "error";
    }
  },

  forceStart: async (exchange, pair) => {
    try {
      await volumeBotOrders.updateMany(
        {
          exchange: exchange,
          pair: pair,
          status: { $in: ["active", "partially"] },
        },
        {
          status: "completed",
        },
        {
          multi: true,
        }
      );
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_forceStart_error : `, error);
      return "error";
    }
  },

  getOrders: async (exchange, pair, startTime, endTime) => {
    try {
      const botOrders = await volumeBotOrders
        .find({
          exchange: exchange,
          pair: pair,
          status: { $ne: "cancelled" },
          updatedAt: { $gte: startTime, $lte: endTime },
        })
        .sort({ updatedAt: -1 });
      return botOrders;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getOrders_error : `, error);
      return "error";
    }
  },

  getVolumeDone: async (exchange, pair, startTime, endTime) => {
    try {
      const volumeDone = await volumeBotOrders.aggregate([
        {
          $match: {
            $and: [
              { exchange: exchange },
              { pair: pair },
              { exchangeId: { $ne: "error" } },
              { updatedAt: { $gte: startTime, $lte: endTime } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            volume: { $sum: "$updatedTotal" },
          },
        },
      ]);
      if (volumeDone[0]) {
        return volumeDone[0].volume;
      } else {
        return 0;
      }
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_volumeDone_error : `, error);
      return "error";
    }
  },

  updateUpdatedOrder: async (id, newId) => {
    try {
      await volumeBotOrders.findOneAndUpdate(
        {
          id: id,
        },
        {
          exchangeId: newId,
          status: "completed",
        }
      );
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_updateUpdatedOrder_error : `, error);
      return "error";
    }
  },

  getOrderById: async (uniqueId) => {
    try {
      const botOrders = await volumeBotOrders
        .findOne({
          uniqueId,
        })
        .sort({ updatedAt: -1 });
      return botOrders;
    } catch (error) {
      logger.error(`volumeBotOrdersHelper_getOrderById_error : `, error);
      return "error";
    }
  },
};
