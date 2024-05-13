const responseHelper = require("../helpers/RESPONSE");
const { Exchanges, ExchangePairInfo } = require("../helpers/constant");
const volumeBotOrdersHelper = require("../helpers/databaseHelpers/volumeBotOrdersHelper");
const volumeBotDetailsHelper = require("../helpers/databaseHelpers/volumeBotDetailsHelper");
const orderPlacement = require("../helpers/orderPlacement");
const ExchangePair = require("../models/exchangePair");
const {
  ExchangeDoesNotExistError,
  ExchangePairDoesNotExistError,
  BotExistError,
} = require("../helpers/errors");
const commonHelper = require("../helpers/commonHelper");
const volumeBotOrders = require("../models/volumeBotOrders");
const volumeBotDetails = require("../models/volumeBotDetails");
const getSecondaryPair = require("../services/redis").getSecondaryPair;
const RedisClient = require("../services/redis").RedisClient;
const uuid = require("uuid").v4;

module.exports = {
  runBot: async (exchange, pair) => {
    try {
      if (Exchanges.includes(exchange)) {
        const botData = await volumeBotDetailsHelper.getBotDetails(
          exchange,
          pair
        );
        if (botData != "" && botData != null && botData != "error") {
          const status = botData.details.status;
          if (status == "start") {
            const botOrdersBuy = await volumeBotOrders
              .find({
                exchange: exchange,
                pair: pair,
                type: "buy",
                status: { $in: ["active", "partially"] },
              })
              .sort({ updatedAt: -1 });
            const botOrdersSell = await volumeBotOrders
              .find({
                exchange: exchange,
                pair: pair,
                type: "sell",
                status: { $in: ["active", "partially"] },
              })
              .sort({ updatedAt: -1 });
            if (
              pair == "CGO-USDT" ||
              botOrdersBuy == "" ||
              botOrdersSell == "" ||
              botOrdersBuy == null ||
              botOrdersSell == null ||
              (botOrdersBuy.length <= 2 && botOrdersSell.length <= 2)
            ) {
              flags[`${exchange}_${pair}_VB`] = true;
              const minVolume = botData.details.minVolume;
              const maxVolume = botData.details.maxVolume;
              let maxPriceB,
                maxPriceC,
                maxPrice,
                minPrice,
                price,
                sellData,
                buyData,
                sellHash,
                buyHash,
                sellStatus,
                buyStatus,
                sellResponse,
                buyResponse,
                placeLast = botData.details.placeLast;
              let decimals = ExchangePairInfo[exchange][pair].decimalsPrice;
              let amountDecimals =
                ExchangePairInfo[exchange][pair].decimalsAmount;
              let respObj = "";
              if (exchange == "bitfinex") {
                respObj = await orderPlacement.GetMaxMinPrice(
                  `${exchange}VB`,
                  pair
                );
              } else {
                respObj = await orderPlacement.GetMaxMinPrice(exchange, pair);
              }
              maxPriceB = respObj.maxPrice;
              minPrice = respObj.minPrice;

              if (isNaN(minPrice)) {
                maxPriceC = maxPriceB;
              } else {
                maxPriceC = parseFloat(
                  parseFloat(minPrice * 1.005).toFixed(decimals)
                );
              }
              if (maxPriceB < maxPriceC) maxPrice = maxPriceB;
              else maxPrice = maxPriceC;
              if (isNaN(minPrice)) {
                minPrice = parseFloat(
                  parseFloat(maxPrice * 0.995).toFixed(decimals)
                );
              }

              let amount = parseFloat(
                parseFloat(
                  Math.random() * (maxVolume - minVolume) + minVolume
                ).toFixed(amountDecimals)
              );
              price = parseFloat(
                parseFloat(
                  Math.random() * (maxPrice - minPrice) + minPrice
                ).toFixed(decimals)
              );
              if (price >= maxPrice || price <= minPrice) {
                price = parseFloat(
                  parseFloat(minPrice + 1 / 10 ** decimals).toFixed(decimals)
                );
              }
              if (maxPrice > price && price > minPrice) {
                if (exchange == "bitfinex") {
                  respObj = await orderPlacement.GetMaxMinPrice(
                    `${exchange}VB`,
                    pair
                  );
                } else {
                  respObj = await orderPlacement.GetMaxMinPrice(exchange, pair);
                }
                maxPrice = respObj.maxPrice;
                minPrice = respObj.minPrice;

                if (maxPrice < price || price < minPrice) {
                  minPrice = parseFloat(
                    parseFloat(maxPrice * 0.995).toFixed(decimals)
                  );
                  price = parseFloat(
                    parseFloat(
                      Math.random() * (maxPrice - minPrice) + minPrice
                    ).toFixed(decimals)
                  );
                  if (price >= maxPrice || price <= minPrice) {
                    price = parseFloat(
                      parseFloat(minPrice + 1 / 10 ** decimals).toFixed(
                        decimals
                      )
                    );
                  }
                }

                if (exchange == "bitfinex") {
                  respObj = await orderPlacement.GetMaxMinPrice(
                    `${exchange}VB`,
                    pair
                  );
                } else {
                  respObj = await orderPlacement.GetMaxMinPrice(exchange, pair);
                }
                maxPrice = respObj.maxPrice;
                minPrice = respObj.minPrice;
                const converter = JSON.parse(
                  await RedisClient.get("converterPrice")
                );
                const usdtPrice = parseFloat(
                  parseFloat(
                    price * converter[getSecondaryPair(pair)].bid[0]
                  ).toFixed(6)
                );

                const total = parseFloat(
                  parseFloat(amount * price).toFixed(decimals)
                );

                sellData = {
                  price,
                  amount,
                  type: "sell",
                  pair,
                  total: price * amount,
                };
                buyData = {
                  price,
                  amount,
                  type: "buy",
                  pair,
                  total: price * amount,
                };

                if (maxPrice > price && price > minPrice) {
                  let account = await orderPlacement.GetAccount(exchange);

                  sellData = { ...sellData, ...account };
                  buyData = { ...buyData, ...account };

                  if (exchange == "bitfinex" || exchange == "xswap") {
                    sellResponse = await orderPlacement.PlaceOrder(
                      exchange,
                      sellData
                    );
                    buyResponse = await orderPlacement.PlaceOrder(
                      exchange,
                      buyData
                    );
                  } else {
                    [sellResponse, buyResponse] = await Promise.all([
                      orderPlacement.PlaceOrder(exchange, sellData),
                      orderPlacement.PlaceOrder(exchange, buyData),
                    ]);
                  }
                  sellHash = sellResponse;
                  buyHash = buyResponse;

                  if (sellHash == "error" || sellHash == "") {
                    sellStatus = "cancelled";
                    const emails = await commonHelper.getEmailsForMail(2);
                    await mail.send(
                      emails,
                      "Volume bot returned error for sell order",
                      JSON.stringify({
                        exchange,
                        price,
                        amount,
                        type: "sell",
                        pair,
                        total: price * amount,
                      })
                    );
                  } else {
                    sellStatus = "active";
                  }
                  if (buyHash == "error" || buyHash == "") {
                    buyStatus = "cancelled";
                    const emails = await commonHelper.getEmailsForMail(2);
                    await mail.send(
                      emails,
                      "Volume bot returned error for buy order",
                      JSON.stringify({
                        exchange,
                        price,
                        amount,
                        type: "buy",
                        pair,
                        total: price * amount,
                      })
                    );
                  } else {
                    buyStatus = "active";
                  }
                  const mappingId = uuid();
                  const sellOrderData = {
                    uniqueId: uuid(),
                    price: price,
                    originalQty: amount,
                    filledQty: 0,
                    total: total,
                    updatedTotal: 0,
                    exchange: exchange,
                    exchangeId: sellHash,
                    usdtPrice: usdtPrice,
                    status: sellStatus,
                    type: "sell",
                    pair: pair,
                    fees: 0,
                    feeCurrency: "USD",
                    mappingId,
                  };
                  const buyOrderData = {
                    uniqueId: uuid(),
                    price: price,
                    originalQty: amount,
                    filledQty: 0,
                    total: total,
                    updatedTotal: 0,
                    exchange: exchange,
                    exchangeId: buyHash,
                    usdtPrice: usdtPrice,
                    status: buyStatus,
                    type: "buy",
                    pair: pair,
                    fees: 0,
                    feeCurrency: "USD",
                    mappingId,
                  };
                  if (
                    !(buyStatus == "cancelled" && sellStatus == "cancelled")
                  ) {
                    await volumeBotOrdersHelper.saveBotOrders(sellOrderData);
                    volumeBotOrdersHelper.saveBotOrders(buyOrderData);
                    if (!placeLast) {
                      lastAmount = amount;
                    }
                    await volumeBotDetailsHelper.updateMessage(
                      exchange,
                      pair,
                      "Placed",
                      amount
                    );
                  } else {
                    await volumeBotDetailsHelper.updateMessage(
                      exchange,
                      pair,
                      "Error in placing orders"
                    );
                  }
                  const responseData = {
                    buyHash,
                    sellHash,
                    price,
                    amount,
                    total,
                    maxPrice,
                    minPrice,
                  };
                  flags[`${exchange}_${pair}_VB`] = false;
                  return { message: "Bot Orders Placed", responseData };
                } else {
                  flags[`${exchange}_${pair}_VB`] = false;
                  await volumeBotDetailsHelper.updateMessage(
                    exchange,
                    pair,
                    "No Gap"
                  );
                  return {
                    message: `No gap to place order 2`,
                    price,
                    maxPrice,
                    minPrice,
                  };
                }
              } else {
                flags[`${exchange}_${pair}_VB`] = false;
                await volumeBotDetailsHelper.updateMessage(
                  exchange,
                  pair,
                  "No Gap"
                );
                return {
                  message: `No gap to place order 1`,
                  price,
                  maxPrice,
                  minPrice,
                };
              }
            } else {
              flags[`${exchange}_${pair}_VB`] = false;
              await volumeBotDetailsHelper.updateMessage(
                exchange,
                pair,
                "Open Orders"
              );
              return {
                message: `There are open volume bot orders in ${pair} in ${exchange}`,
              };
            }
          } else {
            flags[`${exchange}_${pair}_VB`] = false;
            await volumeBotDetailsHelper.updateMessage(
              exchange,
              pair,
              "Other placing orders"
            );
            return {
              message: `Bot is stopped in ${pair} in ${exchange}, please start to run the bot`,
            };
          }
        } else {
          flags[`${exchange}_${pair}_VB`] = false;
          return { message: `No data found for ${pair} in ${exchange}` };
        }
      } else {
        flags[`${exchange}_${pair}_VB`] = false;
        return { message: `Invalid Exchange ${exchange}` };
      }
    } catch (error) {
      flags[`${exchange}_${pair}_VB`] = false;
      await volumeBotDetailsHelper.updateMessage(
        exchange,
        pair,
        "Server Error"
      );
      logger.error(`volumeBotController_runBot_error : `, error);
      return { message: "Server Error" };
    }
  },

  /**
   *
   * exchange
   * pair
   * status
   * minVolume
   * maxVolume
   * minSeconds
   * maxSeconds
   *
   */
  updateBot: async (req, res) => {
    try {
      const exchange = req.body.exchange;
      if (Exchanges.includes(exchange)) {
        const pair = req.body.pair;
        const status = req.body.status;
        if (status == "start" || status == "stop") {
          const botData = await volumeBotDetailsHelper.getBotDetails(
            exchange,
            pair
          );
          if (botData != "" && botData != null) {
            if (botData.details.status == "start" && status == "stop") {
              await volumeBotDetailsHelper.updateMessage(
                exchange,
                pair,
                `Stopped by ${req.user.email}`
              );
              await volumeBotDetailsHelper.stopBot(exchange, pair);
              clearTimeout(timeouts[`${exchange}_${pair}_VB`]);
              return responseHelper.error(
                res,
                `Bot stoped in ${pair} in ${exchange}`
              );
            } else if (botData.details.status == "start" && status == "start") {
              return responseHelper.error(
                res,
                `Bot is already started in ${pair} in ${exchange}`
              );
            } else if (botData.details.status == "stop" && status == "start") {
              const minVolume = req.body.minVolume;
              const maxVolume = req.body.maxVolume;
              const minSeconds = req.body.minSeconds;
              const maxSeconds = req.body.maxSeconds;
              const reqData = {
                exchange,
                pair,
                minVolume,
                maxVolume,
                minSeconds,
                maxSeconds,
              };
              await volumeBotDetailsHelper.updateMessage(
                exchange,
                pair,
                `Started by ${req.user.email}`
              );
              await volumeBotDetailsHelper.startBot(reqData);
              volumeBot(exchange, pair);
              return responseHelper.successWithMessage(
                res,
                `Bot started in ${pair} in ${exchange}`
              );
            } else {
              return responseHelper.error(
                res,
                `Bot is already stopped in ${pair} in ${exchange}`
              );
            }
          } else {
            return responseHelper.error(
              res,
              "No data found for provided pair and exchange"
            );
          }
        } else {
          return responseHelper.error(res, "Invalid Status");
        }
      } else {
        return responseHelper.error(res, "Invalid Exchange");
      }
    } catch (error) {
      logger.error(`volumeBotController_updateBot_error : `, error);
      return responseHelper.serverError(res, error);
    }
  },

  getBot: async (req, res) => {
    try {
      let volumeBotData = await volumeBotDetailsHelper.getAllBotDetails();
      let i,
        exchange,
        pair,
        status,
        orderData,
        lastOrderTime,
        minuteDifference,
        details,
        newData = [],
        array = {},
        difference,
        maxSeconds;
      let currentTime = new Date();

      for (i = 0; i < volumeBotData.length; i++) {
        exchange = volumeBotData[i].exchange;
        pair = volumeBotData[i].details.pair;
        status = volumeBotData[i].details.status;
        lastOrderTime = "";
        difference = 0;
        maxSeconds = (volumeBotData[i].details.maxSeconds + 1) * 2;
        orderData = await volumeBotOrdersHelper.getLastOrder(exchange, pair);
        if (orderData != "" && orderData != null && orderData != "error") {
          lastOrderTime = new Date(orderData.createdAt);
          minuteDifference = parseInt(
            (currentTime - lastOrderTime) / 1000 / 60
          );
          difference = parseInt((currentTime - lastOrderTime) / 1000);
          if (difference > maxSeconds && status == "start") {
            status = "idle";
          }
        }
        details = {
          ...volumeBotData[i].details,
          ...lastOrderTime,
          ...minuteDifference,
        };
        array = {
          exchange,
          pair,
          details,
        };
        array.details.lastOrderTime = lastOrderTime;
        array.details.minuteDifference = minuteDifference;
        array.details.status = status;
        newData.push(array);
      }
      return responseHelper.successWithData(
        res,
        "Got Volume Bot Details",
        newData
      );
    } catch (error) {
      logger.error(`volumeBotController_getBot_error : `, error);
      return responseHelper.serverError(res, error);
    }
  },

  updateBotOrders: async (exchange, pair) => {
    try {
      if (Exchanges.includes(exchange)) {
        const botOrders = await volumeBotOrdersHelper.getBotOpenOrders(
          exchange,
          pair
        );
        if (botOrders != "" && botOrders != null && botOrders != "error") {
          let i,
            status,
            orderId,
            reqData,
            responseData,
            fees,
            feeCurrency,
            feesUSDT,
            filledQty,
            account,
            updatedTotal;
          for (i = 0; i < botOrders.length; i++) {
            account = await orderPlacement.GetAccount(exchange);
            orderId = botOrders[i].exchangeId;
            reqData = {
              orderId,
              pair,
              exchange,
              botType: "volume",
              type: botOrders[i].type,
              price: botOrders[i].price,
              usdtPrice: botOrders[i].usdtPrice,
            };
            reqData = { ...reqData, ...account };
            responseData = await orderPlacement.GetOrderStatus(
              exchange,
              reqData
            );
            filledQty = responseData.filledQty;
            status = responseData.status;
            fees = responseData.fees;
            feeCurrency = responseData.feeCurrency;
            feesUSDT = responseData.feesUSDT;
            updatedTotal = parseFloat(
              parseFloat(responseData.updatedTotal).toFixed(6)
            );
            if (status == "completed" && exchange == "xswap") {
              filledQty = botOrders[i].originalQty;
              updatedTotal = botOrders[i].total;
            }
            await volumeBotOrdersHelper.updateBotOrders(
              orderId,
              filledQty,
              status,
              exchange,
              pair,
              fees,
              feeCurrency,
              feesUSDT,
              botOrders[i].mappingId,
              updatedTotal
            );
          }
        } else {
          logger.info(`No Orders to update`);
        }
      } else {
        logger.info(`Invalid Exchange`, exchange);
      }
    } catch (error) {
      logger.error(`volumeBotController_updateBotOrders_error : `, error);
    }
  },

  checkBots: async () => {
    try {
      const volumeBotData = await volumeBotDetailsHelper.getAllBotDetails();
      let i, exchange, pair, status;
      for (i = 0; i < volumeBotData.length; i++) {
        exchange = volumeBotData[i].exchange;
        pair = volumeBotData[i].details.pair;
        status = volumeBotData[i].details.status;
        if (
          status == "start" &&
          (timeouts[`${exchange}_${pair}_VB`] == "" ||
            timeouts[`${exchange}_${pair}_VB`] == null)
        ) {
          volumeBot(exchange, pair);
          logger.info(`Volume Bot Started in ${pair} in ${exchange}`);
        }
      }
      logger.info(`Checked volume bots at ${new Date()}`);
    } catch (error) {
      logger.error(`volumeBotController_checkBots_error : `, error);
    }
  },

  forceStart: async (req, res) => {
    try {
      const exchange = req.body.exchange;
      const pair = req.body.pair;
      await volumeBotOrdersHelper.forceStart(exchange, pair);
      let reqData = {
        exchange,
        pair,
      };
      const forceStartData = await cancelBook(reqData);
      return responseHelper.successWithData(
        res,
        `Force started volume bot in ${pair} in ${exchange}`,
        forceStartData
      );
    } catch (error) {
      logger.error(`volumeBotController_forceStart_error : `, error);
      return responseHelper.serverError(res, error);
    }
  },

  addExchange: async (req, res) => {
    const { exchange, pair } = req.body;
    const exchangeExists = await ExchangePair.findOne({ exchange });
    if (!exchangeExists) throw new ExchangeDoesNotExistError(exchange);
    const pairExist = await ExchangePair.findOne({
      exchange,
      "pair.name": pair,
    });
    if (!pairExist) throw new ExchangePairDoesNotExistError(exchange, pair);
    const volumeBot = await volumeBotDetailsHelper.getBotDetails(
      exchange,
      pair
    );
    if (volumeBot && volumeBot != "error")
      throw new BotExistError(exchange, pair, "Volume");
    await volumeBotDetailsHelper.saveDetails(exchange, pair);
    return responseHelper.successWithMessage(
      res,
      `Successfully added the exchange`
    );
  },

  openOrder: async (req, res) => {
    try {
      const { exchange, pair } = req.body;
      let account = await orderPlacement.GetAccount(exchange);
      let reqData = {
        ...account,
        pair,
      };
      let orderDetails = await orderPlacement.OpenOrder(exchange, reqData);
      return responseHelper.successWithData(res, "Successful", orderDetails);
    } catch (error) {
      logger.error(`volumeBotController_OpenBook_error : `, error);
      return responseHelper.serverError(res, error);
    }
  },

  cancelOrder: async (req, res) => {
    try {
      const { exchange, orderId, pair } = req.body;
      let account = await orderPlacement.GetAccount(exchange);
      let orderDetail = {
        orderId,
      };
      let orderData = {
        ...account,
        exchange,
        pair,
      };
      let cancelOrderData = await orderPlacement.CancelBook(
        orderDetail,
        orderData
      );
      return responseHelper.successWithData(
        res,
        "Order Cancel",
        cancelOrderData
      );
    } catch (error) {
      logger.error(`volumeBotController_cancelOrder_error : `, error);
      return responseHelper.serverError(res, error);
    }
  },

  checkAndUpdateVolumeBotOld: async () => {
    try {
      logger.info(`running check and update volumebot`);
      const currentTime = new Date();
      let beforeTime = new Date(currentTime);
      beforeTime.setMinutes(beforeTime.getMinutes() - 20);
      beforeTime = beforeTime.toISOString();
      let hourBefore = new Date(currentTime);
      hourBefore.setHours(hourBefore.getHours() - 1);
      hourBefore = hourBefore.toISOString();
      const volumeBotData = await volumeBotOrders
        .find({
          status: "active",
          createdAt: { $lte: beforeTime },
        })
        .sort({ createdAt: 1 });
      let i,
        exchange,
        pair,
        account,
        price,
        amount,
        type,
        newId,
        usdtPrice,
        converter,
        respObj,
        tentativeLoss,
        cancelledOrders,
        openOrders;
      for (i = 0; i < volumeBotData.length; i++) {
        exchange = volumeBotData[i].exchange;
        pair = volumeBotData[i].pair;
        type = volumeBotData[i].type;
        account = await orderPlacement.GetAccount(exchange);
        cancelledOrders = await volumeBotOrders.find({
          exchange,
          pair,
          createdAt: { $gt: hourBefore },
          mappingId: /.*_1*./,
        });
        if (cancelledOrders.length < 3) {
          await orderPlacement.CancelOrder(exchange, {
            ...account,
            orderId: volumeBotData[i].exchangeId,
            pair,
            type: type,
          });
          await module.exports.updateBotOrders(exchange, pair);
          const orderDetails = await volumeBotOrdersHelper.getOrderById(
            volumeBotData[i].uniqueId
          );
          if (
            orderDetails != "" &&
            orderDetails != null &&
            orderDetails != "error" &&
            orderDetails.status == "cancelled"
          ) {
            amount =
              parseFloat(volumeBotData[i].originalQty) -
              parseFloat(volumeBotData[i].filledQty);
            if (
              parseFloat(amount) >=
              parseFloat(ExchangePairInfo[exchange][pair].minAmount)
            ) {
              respObj = await orderPlacement.GetMaxMinPrice(exchange, pair);
              if (type == "buy")
                price = parseFloat(
                  parseFloat(respObj.maxPrice).toFixed(
                    ExchangePairInfo[exchange][pair].decimalsPrice
                  )
                );
              else
                price = parseFloat(
                  parseFloat(respObj.minPrice).toFixed(
                    ExchangePairInfo[exchange][pair].decimalsPrice
                  )
                );
              converter = JSON.parse(await RedisClient.get("converterPrice"));
              usdtPrice = parseFloat(
                parseFloat(
                  price * converter[getSecondaryPair(pair)].bid[0]
                ).toFixed(6)
              );
              tentativeLoss = parseFloat(
                parseFloat(
                  Math.abs(usdtPrice - volumeBotData[i].usdtPrice) * amount
                ).toFixed(4)
              );
              if (tentativeLoss <= 2) {
                newId = await orderPlacement.PlaceOrder(exchange, {
                  price,
                  amount,
                  pair,
                  type,
                  ...account,
                  total: price * amount,
                  orderType: "MARKET",
                });
                if (newId && newId != "" && newId != "error") {
                  let newOrder = new volumeBotOrders({
                    uniqueId: uuid(),
                    exchange: exchange,
                    pair: pair,
                    type: type,
                    price: price,
                    usdtPrice: usdtPrice,
                    originalQty: amount,
                    filledQty: 0,
                    total: price * amount,
                    updatedTotal: 0,
                    exchangeId: newId,
                    status: "active",
                    fees: 0,
                    feeCurrency: "USD",
                    mappingId: `${volumeBotData[i].mappingId}_1`,
                    tentativeLoss,
                  });
                  await newOrder.save();

                  await volumeBotOrders.findOneAndUpdate(
                    {
                      uniqueId: volumeBotData[i].uniqueId,
                    },
                    {
                      status: "completed",
                      filledQty: volumeBotData[i].originalQty,
                    }
                  );

                  const emails = await commonHelper.getEmailsForMail(1);
                  await mail.send(
                    emails,
                    "Volume Bot Loss Order",
                    `Exchange : ${exchange},<br> Pair : ${pair},<br> Type : ${type},<br>
                  Pending Amount : ${amount},<br> 
                  Open At : ${volumeBotData[i].price}(${volumeBotData[i].usdtPrice} USDT),<br> 
                  Closed At : ${price}(${usdtPrice} USDT),<br> Tentative Loss : ${tentativeLoss}`
                  );
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(
        `volumeBotController_checkAndUpdateVolumeBot_error : `,
        error
      );
      return "error";
    }
  },

  checkAndUpdateVolumeBot: async () => {
    try {
      logger.info(`checking and updating volume bot`);
      const activeOrders = await volumeBotDetails.find({
        "details.status": "start",
        "details.pair": { $ne: "CGO-USDT" },
      });
      const types = ["buy", "sell"];
      let i,
        j,
        k,
        activeOrder,
        exchange,
        pair,
        account,
        price,
        amount,
        type,
        newId,
        usdtPrice,
        converter,
        respObj,
        tentativeLoss,
        openOrders,
        openOrder;
      for (i = 0; i < activeOrders.length; i++) {
        activeOrder = activeOrders[i];
        exchange = activeOrder.exchange;
        pair = activeOrder.details.pair;
        for (j = 0; j < types.length; j++) {
          type = types[j];
          openOrders = await volumeBotOrders
            .find({ status: "active", type, exchange, pair })
            .sort({ createdAt: -1 });
          if (openOrders.length >= 2) {
            for (k = 2; k < openOrders.length; k++) {
              openOrder = openOrders[k];
              type = openOrder.type;
              account = await orderPlacement.GetAccount(exchange);

              await orderPlacement.CancelOrder(exchange, {
                ...account,
                orderId: openOrder.exchangeId,
                pair,
                type: type,
              });
              await module.exports.updateBotOrders(exchange, pair);
              const orderDetails = await volumeBotOrdersHelper.getOrderById(
                openOrder.uniqueId
              );
              if (
                orderDetails != "" &&
                orderDetails != null &&
                orderDetails != "error" &&
                orderDetails.status == "cancelled"
              ) {
                amount =
                  parseFloat(openOrder.originalQty) -
                  parseFloat(openOrder.filledQty);
                if (
                  parseFloat(amount) >=
                  parseFloat(ExchangePairInfo[exchange][pair].minAmount)
                ) {
                  respObj = await orderPlacement.GetMaxMinPrice(exchange, pair);
                  if (type == "buy")
                    price = parseFloat(
                      parseFloat(respObj.maxPrice).toFixed(
                        ExchangePairInfo[exchange][pair].decimalsPrice
                      )
                    );
                  else
                    price = parseFloat(
                      parseFloat(respObj.minPrice).toFixed(
                        ExchangePairInfo[exchange][pair].decimalsPrice
                      )
                    );
                  converter = JSON.parse(
                    await RedisClient.get("converterPrice")
                  );
                  usdtPrice = parseFloat(
                    parseFloat(
                      price * converter[getSecondaryPair(pair)].bid[0]
                    ).toFixed(6)
                  );
                  tentativeLoss = parseFloat(
                    parseFloat(
                      Math.abs(usdtPrice - openOrder.usdtPrice) * amount
                    ).toFixed(4)
                  );
                  if (tentativeLoss <= 2) {
                    newId = await orderPlacement.PlaceOrder(exchange, {
                      price,
                      amount,
                      pair,
                      type,
                      ...account,
                      total: price * amount,
                      orderType: "MARKET",
                    });
                    if (newId && newId != "" && newId != "error") {
                      let newArbiOrder = new volumeBotOrders({
                        uniqueId: uuid(),
                        exchange: exchange,
                        pair: pair,
                        type: type,
                        price: price,
                        usdtPrice: usdtPrice,
                        originalQty: amount,
                        filledQty: 0,
                        total: price * amount,
                        updatedTotal: 0,
                        exchangeId: newId,
                        status: "active",
                        fees: 0,
                        feeCurrency: "USD",
                        mappingId: `${openOrder.mappingId}_1`,
                        tentativeLoss,
                      });
                      await newArbiOrder.save();

                      await volumeBotOrders.findOneAndUpdate(
                        {
                          uniqueId: openOrder.uniqueId,
                        },
                        {
                          status: "completed",
                          filledQty: openOrder.originalQty,
                        }
                      );

                      const emails = await commonHelper.getEmailsForMail(1);
                      await mail.send(
                        emails,
                        "Volume Bot Loss Order",
                        `Exchange : ${exchange},<br> Pair : ${pair},<br> Type : ${type},<br>
                          Pending Amount : ${amount},<br> 
                          Open At : ${openOrder.price}(${openOrder.usdtPrice} USDT),<br> 
                          Closed At : ${price}(${usdtPrice} USDT),<br> Tentative Loss : ${tentativeLoss}`
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(`volumeBotController_checkAndUpdateVolumeBot_error`, error);
    }
  },

  updateLoss: async () => {
    try {
      const currentTime = new Date();
      currentTime.setUTCMinutes(currentTime.getUTCMinutes(), 0, 0);
      const yesterday = new Date(currentTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const activeOrders = await volumeBotDetails.find({
        "details.status": "start",
      });
      let i, exchange, pair, loss, lossData, volumeDone, volumeDoneUSDT;
      for (i = 0; i < activeOrders.length; i++) {
        exchange = activeOrders[i].exchange;
        pair = activeOrders[i].details.pair;
        lossData = await volumeBotOrders.aggregate([
          {
            $match: {
              exchange,
              pair,
              tentativeLoss: { $gt: 0 },
              createdAt: { $gte: new Date(yesterday) },
            },
          },
          { $group: { _id: null, loss: { $sum: "$tentativeLoss" } } },
        ]);
        if (lossData[0]) {
          loss = parseFloat(parseFloat(lossData[0].loss).toFixed(4));
        } else {
          loss = 0;
        }
        volumeDone = await volumeBotOrdersHelper.getVolumeDone(
          exchange,
          pair,
          yesterday,
          currentTime
        );
        const converter = JSON.parse(await RedisClient.get("converterPrice"));
        volumeDone = volumeDone / 2;
        volumeDoneUSDT = parseFloat(
          volumeDone * converter[getSecondaryPair(pair)].bid[0]
        ).toFixed(4);
        activeOrders[i].details.totalLoss = loss;
        activeOrders[i].details.volumeDone = volumeDone;
        activeOrders[i].details.volumeDoneUSDT = volumeDoneUSDT;
        activeOrders[i].markModified("details.totalLoss");
        activeOrders[i].markModified("details.volumeDone");
        activeOrders[i].markModified("details.volumeDoneUSDT");
        activeOrders[i].save();
      }
    } catch (error) {
      logger.error(`volumeBotController_updateLoss_error`, error);
    }
  },

  placeErrorOrders: async () => {
    try {
      const pair = "CGO-USDT";
      const errorOrders = await volumeBotOrders.find({
        pair,
        exchangeId: "error",
      });
      let i,
        order,
        exchange,
        type,
        price,
        amount,
        orderId,
        accountData,
        orderData,
        uniqueId;
      for (i = 0; i < errorOrders.length; i++) {
        order = errorOrders[i];
        uniqueId = order.uniqueId;
        exchange = order.exchange;
        type = order.type;
        price = order.price;
        amount = order.originalQty;
        accountData = await orderPlacement.GetAccount(exchange);
        orderData = {
          ...accountData,
          type,
          exchange,
          pair,
          price,
          amount,
        };
        orderId = await orderPlacement.PlaceOrder(exchange, orderData);
        if (orderId != "error" && orderId != "null") {
          await volumeBotOrders.findOneAndUpdate(
            { uniqueId },
            { exchangeId: orderId, status: "active" }
          );
        }
      }
    } catch (error) {
      logger.error(`volumeBotController_placeErrorOrders_error`, error);
    }
  },
};

async function cancelBook(data) {
  try {
    let { exchange, pair } = data;
    let account = await orderPlacement.GetAccount(exchange);
    let reqData = {
      ...account,
      pair,
    };
    let orderDetails = await orderPlacement.OpenOrder(exchange, reqData);
    let orderData = {
      ...account,
      exchange,
      pair,
    };
    let cancelOrderData = await orderPlacement.CancelBook(
      orderDetails,
      orderData
    );
    return cancelOrderData;
  } catch (error) {
    logger.error(`volumeBotController_CancelOrder_error : `, error);
    return "error";
  }
}

async function volumeBot(exchange, pair) {
  try {
    const botData = await volumeBotDetailsHelper.getBotDetails(exchange, pair);
    if (botData != "" && botData != null && botData != "error") {
      const status = botData.details.status;
      if (status == "start") {
        const minSeconds = botData.details.minSeconds;
        const maxSeconds = botData.details.maxSeconds;
        const rand = Math.floor(
          Math.random() * (maxSeconds - minSeconds + 1) + minSeconds
        );
        timeouts[`${exchange}_${pair}_VB`] = setTimeout(
          () => volumeBot(exchange, pair),
          rand * 1000
        );
        logger.info(
          `Running Volume Bot in ${pair} in ${exchange} ${new Date()}`
        );
        await module.exports.updateBotOrders(exchange, pair);
        const res = await module.exports.runBot(exchange, pair);
        await module.exports.updateBotOrders(exchange, pair);
        logger.info(`Volume Bot in ${pair} in ${exchange}, ${rand},`, res);
      } else {
        clearTimeout(timeouts[`${exchange}_${pair}_VB`]);
      }
    }
  } catch (error) {
    logger.error(`volumeBotController_volumeBot_error : `, error);
    timeouts[`${exchange}_${pair}_VB`] = setTimeout(
      () => volumeBot(exchange, pair),
      120 * 1000
    );
    return "error";
  }
}
