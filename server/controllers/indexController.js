const responseHelper = require("../helpers/RESPONSE");
const { ounceConversion } = require("../helpers/constant");
const huobi = require("../helpers/exchangeHelpers/huobi");
const lbank = require("../helpers/exchangeHelpers/lbank");
const stonex = require("../helpers/exchangeHelpers/stonex");
const {
  GetAccount,
  CancelOrder,
  WalletBalance,
  PlaceOrder,
  GetOrderStatus,
  LastTradedPrice,
  last24HrVolume,
  GetMaxMinPrice,
} = require("../helpers/orderPlacement");
const externalExchangeOrders = require("../models/externalExchangeOrders");
const { RedisClient } = require("../services/redis");
const cronController = require("./cronController");
const uuid = require("uuid").v4;

module.exports = {
  getUSDRates: async (req, res) => {
    const converterPrice = JSON.parse(await RedisClient.get("converterPrice"));
    return responseHelper.successWithData(res, "Done", { converterPrice });
  },

  test: async (req, res) => {
    let reqData = {
      price: "80",
      type: "sell",
      amount: "0.1",
      pair: "CGO-USDT",
      exchange: "kucoin",
      orderId: "8dea4035-7348-4c60-b4c0-ee303bb985cb",
      total: 23000000,
      orderType: "LIMIT",
      accountId: "54973543",
      apiKey: "323a8d18-de8d-43ca-9073-fe85fc83f2c0", //hitbtc
      apiSecret: "9ED2BA1B455710567A6F2DD0424A421C", //hitbtc
      // passPhrase: "TradingbotX",
      // memo: "Raj",
    };
    // let account = await GetAccount(reqData.exchange, "AB");
    // reqData = { ...reqData, ...account };
    const returnData = await GetMaxMinPrice("lbank", "CGO-USDT");
    // await cronController.updateBalance("hourly");
    return responseHelper.successWithData(res, "Done", {
      returnData,
    });
  },

  placeStonexOrder: async (req, res) => {
    try {
      const test = req.body.test;
      if (test == process.env.test) {
        const price = req.body.price;
        const type = req.body.type;
        const amount = req.body.amount;
        const amountOz =  parseFloat(
          parseFloat(amount / ounceConversion).toFixed(3)
        );
        const priceOz = parseFloat(
          parseFloat(price * ounceConversion).toFixed(2)
        );
        const stonexTotal = parseFloat(
          parseFloat(amountOz * priceOz).toFixed(4)
        );
        const stonexUsdtTotal = parseFloat(
          parseFloat(amount * price).toFixed(4)
        );

        const uniqueId = uuid();
        const orderData = {
          clientId: uniqueId,
          pair: "XAU-USD",
          type,
          amount: amountOz,
          price: priceOz,
        };
        const orderReturn = await stonex.placeOrder(orderData);
        let orderId;
        if (orderReturn != "error") orderId = orderReturn.orderId;
        else orderId = "error";
        if (orderId != "error") {
          const newOrder = new externalExchangeOrders({
            uniqueId,
            exchange: "stonex",
            pair: "CGO-USDT",
            exchangePair: "XAU-USD",
            type: type,
            price: priceOz,
            usdtPrice: price,
            calculatedPrice: priceOz,
            calculatedUsdtPrice: price,
            originalQtyGm: amount,
            originalQty: amountOz,
            total: stonexTotal,
            usdtTotal: stonexUsdtTotal,
            orderId,
            mappedOrders: [],
            status: "active",
          });
          await newOrder.save();
        }
        return responseHelper.successWithData(res, "Processed", { orderId });
      } else {
        return responseHelper.error(res, "Processed");
      }
    } catch (error) {
      logger.error(`indexController_placeStonexOrder_error`, error);
      return responseHelper.serverError(res, error);
    }
  },
};
