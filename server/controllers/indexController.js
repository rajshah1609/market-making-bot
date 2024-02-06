const responseHelper = require("../helpers/RESPONSE");
const huobi = require("../helpers/exchangeHelpers/huobi");
const {
  GetAccount,
  CancelOrder,
  WalletBalance,
  PlaceOrder,
  GetOrderStatus,
} = require("../helpers/orderPlacement");
const { RedisClient } = require("../services/redis");
const cronController = require("./cronController");

module.exports = {
  getUSDRates: async (req, res) => {
    const converterPrice = JSON.parse(await RedisClient.get("converterPrice"));
    return responseHelper.successWithData(res, "Done", { converterPrice });
  },

  test: async (req, res) => {
    // let reqData = {
    //   price: "0.07",
    //   type: "sell",
    //   amount: "500",
    //   pair: "XDC-USDT",
    //   exchange: "kucoin",
    //   orderId: "64f72c08835fc20007aa3dd3",
    //   total: 23000000,
    //   orderType: "LIMIT",
    //   accountId: "54973543",
    //   // apiKey: "64f71c461f48430001231992", //hitbtc
    //   // apiSecret: "0d470f3f-0e04-4ada-88ff-82e13bf33ebc", //hitbtc
    //   // passPhrase: "TradingbotX",
    //   memo: "Raj",
    // };
    // let account = await GetAccount(reqData.exchange, "AB");
    // reqData = { ...reqData, ...account };
    // const returnData = await WalletBalance(reqData.exchange, reqData);
    await cronController.updateBalance("hourly");
    return responseHelper.successWithData(res, "Done", {
      data: "",
    });
  },
};
