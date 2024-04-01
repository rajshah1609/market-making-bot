const responseHelper = require("../helpers/RESPONSE");
const {
  stonexPairs,
  ExchangePairInfo,
  ounceConversion,
} = require("../helpers/constant");
const stonex = require("../helpers/exchangeHelpers/stonex");
const {
  LastTradedPrice,
  GetAccount,
  WalletBalance,
  GetOrderStatus,
  PlaceOrder,
  CancelOrder,
} = require("../helpers/orderPlacement");
const arbitrageOperations = require("../models/arbitrageOperations");
const externalExchangeOrders = require("../models/externalExchangeOrders");
const spreadBotDetails = require("../models/spreadBotDetails");
const spreadBotGeneratedOrders = require("../models/spreadBotGeneratedOrders");
const spreadBotOrders = require("../models/spreadBotOrders");
const { RedisClient, getSecondaryPair } = require("../services/redis");
const uuid = require("uuid").v4;
const multiplyerArray = [
  0, 0.005, 0.01, 0.02, 0.05, 0.07, 0.1, 0.12, 0.15, 0.2, 0.3,
];

module.exports = {
  addOrder: async (req, res) => {
    try {
      const { exchange, pair, maxOrders, amountBuy, amountSell, percentGap } =
        req.body;
      const price = await LastTradedPrice(exchange, pair);
      const converter = JSON.parse(await RedisClient.get("converterPrice"));
      const usdtPrice = parseFloat(
        parseFloat(price * converter[getSecondaryPair(pair)].bid[0]).toFixed(6)
      );
      const accountData = await GetAccount(exchange);
      const walletBalance = await WalletBalance(exchange, accountData);
      const data1 = walletBalance.filter(
        (e) => e.currency == pair.split("-")[0]
      )[0];
      const data2 = walletBalance.filter(
        (e) => e.currency == pair.split("-")[1]
      )[0];
      const uniqueId = uuid();
      const newOrder = new spreadBotDetails({
        uniqueId,
        exchange,
        pair,
        price,
        usdtPrice,
        amountBuy,
        amountSell,
        status: "active",
        mappedOrders: [],
        maxOrders,
        started: false,
        percentGap: parseFloat(parseFloat(percentGap / 1000).toFixed(4)),
        balanceToBeMaintanedC1: parseFloat(data1.total),
        balanceToBeMaintanedC2: parseFloat(data2.total),
        lastSettledAtC1: usdtPrice,
        lastSettledAtC2: parseFloat(
          parseFloat(converter[getSecondaryPair(pair)].bid[0]).toFixed(6)
        ),
      });
      await newOrder.save();
      return responseHelper.successWithMessage(res, "New Order Addedd.");
    } catch (error) {
      logger.error(`spreadBotController_addOrder_error`, error);
      return responseHelper.serverError(res, error);
    }
  },

  generateOrders: async () => {
    try {
      if (!flags["generateOrders-SBC"]) {
        flags["generateOrders-SBC"] = true;
        const orders = await spreadBotDetails.findOne({
          pair: { $regex: `CGO` },
          status: "active",
        });
        const arbitrageData = await arbitrageOperations.findOne({});
        if (orders != null) {
          let generateOrder = true,
            i,
            openOrders = [],
            uniqueId,
            usdtPrice,
            newOrder;
          const isMarketOpen = await module.exports.checkMarket();
          if (isMarketOpen) {
            if (arbitrageData) {
              const cgoData = arbitrageData.cgoData;
              const converter = JSON.parse(
                await RedisClient.get("converterPrice")
              );
              const bidPrice = converter["CGO-USDT"].bid[0];
              const askPrice = converter["CGO-USDT"].ask[0];
              const baseUsdtPrice = parseFloat(
                parseFloat((bidPrice + askPrice) / 2).toFixed(6)
              );
              if (Object.entries(cgoData).length != 0) {
                const lastPrice = cgoData.lastPrice;
                const upperLimit = parseFloat(
                  parseFloat(lastPrice * 1.001).toFixed(6)
                );
                const lowerLimit = parseFloat(
                  parseFloat(lastPrice * 0.999).toFixed(6)
                );
                console.log(
                  "prices",
                  upperLimit,
                  lastPrice,
                  lowerLimit,
                  baseUsdtPrice
                );
                if (upperLimit > baseUsdtPrice && baseUsdtPrice > lowerLimit)
                  generateOrder = false;
                if (cgoData.generatedMarketClosedOrders) generateOrder = true;
              }
              if (generateOrder) {
                for (i = 1; i <= 10; i++) {
                  usdtPrice = parseFloat(
                    parseFloat(askPrice * (1 + 0.002 * i)).toFixed(6)
                  );
                  uniqueId = uuid();
                  newOrder = new spreadBotGeneratedOrders({
                    uniqueId,
                    usdtPrice,
                    currency: "CGO",
                    type: "sell",
                    status: "active",
                    revOrderId: "",
                    oppOrderId: "",
                    cancelling: false,
                    mappedOrders: [],
                    multiplyer: multiplyerArray[i],
                  });
                  newOrder.save();
                  openOrders.push(uniqueId);
                  usdtPrice = parseFloat(
                    parseFloat(bidPrice * (1 - 0.002 * i)).toFixed(6)
                  );
                  uniqueId = uuid();
                  newOrder = new spreadBotGeneratedOrders({
                    uniqueId,
                    usdtPrice,
                    currency: "CGO",
                    type: "buy",
                    status: "active",
                    revOrderId: "",
                    oppOrderId: "",
                    cancelling: false,
                    mappedOrders: [],
                    multiplyer: multiplyerArray[i],
                  });
                  newOrder.save();
                  openOrders.push(uniqueId);
                }
                arbitrageData.cgoData.lastPrice = baseUsdtPrice;
                arbitrageData.cgoData.generatedMarketClosedOrders = false;
                arbitrageData.cgoData.bidPrice = bidPrice;
                arbitrageData.cgoData.askPrice = askPrice;
                arbitrageData.markModified("cgoData");
              }
            }
          } else {
            if (arbitrageData) {
              const cgoData = arbitrageData.cgoData;
              const generatedMarketClosedOrders =
                cgoData.generatedMarketClosedOrders;
              if (!generatedMarketClosedOrders) {
                const lastPrice = cgoData.lastPrice;
                const baseSellPrice = parseFloat(
                  parseFloat(lastPrice * 1.003).toFixed(6)
                );
                const baseBuyPrice = parseFloat(
                  parseFloat(lastPrice * 0.997).toFixed(6)
                );
                for (i = 1; i <= 10; i++) {
                  usdtPrice = parseFloat(
                    parseFloat(baseSellPrice * (1 + 0.002 * i)).toFixed(6)
                  );
                  uniqueId = uuid();
                  newOrder = new spreadBotGeneratedOrders({
                    uniqueId,
                    usdtPrice,
                    currency: "CGO",
                    type: "sell",
                    status: "active",
                    revOrderId: "",
                    oppOrderId: "",
                    cancelling: false,
                    mappedOrders: [],
                    multiplyer: multiplyerArray[i],
                  });
                  newOrder.save();
                  openOrders.push(uniqueId);
                  usdtPrice = parseFloat(
                    parseFloat(baseBuyPrice * (1 - 0.002 * i)).toFixed(6)
                  );
                  uniqueId = uuid();
                  newOrder = new spreadBotGeneratedOrders({
                    uniqueId,
                    usdtPrice,
                    currency: "CGO",
                    type: "buy",
                    status: "active",
                    revOrderId: "",
                    oppOrderId: "",
                    cancelling: false,
                    mappedOrders: [],
                    multiplyer: multiplyerArray[i],
                  });
                  newOrder.save();
                  openOrders.push(uniqueId);
                }
                arbitrageData.cgoData.generatedMarketClosedOrders = true;
                arbitrageData.cgoData.lastPrice = cgoData.lastPrice;
                arbitrageData.cgoData.bidPrice = cgoData.bidPrice;
                arbitrageData.cgoData.askPrice = cgoData.askPrice;
                arbitrageData.markModified("cgoData");
              }
            }
          }
          await arbitrageData.save();
          if (openOrders.length > 0)
            await spreadBotGeneratedOrders.updateMany(
              {
                status: "active",
                uniqueId: { $nin: openOrders },
              },
              { status: "cancelled" },
              { multi: true }
            );
        } else {
          await spreadBotGeneratedOrders.updateMany(
            { currency: "CGO", status: "active" },
            { status: "cancelled" },
            { multi: true }
          );
          arbitrageData.cgoData.lastPrice = 0;
          arbitrageData.cgoData.generatedMarketClosedOrders = false;
          arbitrageData.markModified("cgoData");
          await arbitrageData.save();
        }
        flags["generateOrders-SBC"] = false;
      }
    } catch (error) {
      logger.error(`spreadBotController_generateOrders_error`, error);
      flags["generateOrders-SBC"] = false;
    }
  },

  placeOrders: async () => {
    try {
      if (!flags["placeOrders-SBC"]) {
        flags["placeOrders-SBC"] = true;
        flags["placeOrders-SBC-time"] = new Date();
        const orders = await spreadBotDetails.find({ status: "active" });
        let i,
          j,
          k,
          exchange,
          pair,
          generatedOrders,
          order,
          currency,
          converter,
          price,
          usdtPrice,
          amount,
          generatedOrder,
          type,
          total,
          usdtTotal,
          orderData,
          orderId,
          mappingId,
          refId,
          mappedOrders,
          accountData,
          refOrders,
          uniqueId,
          newOrder,
          placedAmountBuy,
          placedAmountSell,
          totalAmountBuy,
          totalAmountSell,
          checkOrder,
          maxAmount,
          minAmount,
          checkPrice;
        const types = ["buy", "sell"];
        for (i = 0; i < orders.length; i++) {
          order = orders[i];
          mappingId = order.uniqueId;
          mappedOrders = order.mappedOrders;
          exchange = order.exchange;
          pair = order.pair;
          currency = pair.split("-")[0];
          accountData = await GetAccount(exchange, "AB");
          placedAmountBuy = order.placedAmountBuy;
          placedAmountSell = order.placedAmountSell;
          totalAmountBuy = order.placedTotalBuy;
          totalAmountSell = order.placedTotalSell;
          for (k = 0; k < types.length; k++) {
            if (types[k] == "sell")
              generatedOrders = await spreadBotGeneratedOrders
                .find({ currency, status: "active", type: "sell" })
                .sort({ usdtPrice: 1 });
            else
              generatedOrders = await spreadBotGeneratedOrders
                .find({ currency, status: "active", type: "buy" })
                .sort({ usdtPrice: -1 });
            for (j = 0; j < generatedOrders.length; j++) {
              generatedOrder = generatedOrders[j];
              refOrders = generatedOrder.mappedOrders;
              refId = generatedOrder.uniqueId;
              checkOrder = await spreadBotOrders.findOne({
                exchange,
                pair,
                refId,
                status: "active",
              });
              if (!checkOrder) {
                usdtPrice = generatedOrder.usdtPrice;
                converter = JSON.parse(await RedisClient.get("converterPrice"));
                usdtPrice = parseFloat(
                  parseFloat(
                    usdtPrice * (1 - (Math.random() * (1 - 0) + 0) / 1000)
                  ).toFixed(6)
                );
                price = parseFloat(
                  parseFloat(
                    usdtPrice / converter[getSecondaryPair(pair)].bid[0]
                  ).toFixed(ExchangePairInfo[exchange][pair].decimalsPrice)
                );
                checkPrice = await spreadBotOrders.findOne({
                  exchange,
                  pair,
                  price,
                  status: "active",
                });
                while (checkPrice) {
                  usdtPrice = parseFloat(
                    parseFloat(
                      usdtPrice * (1 - (Math.random() * (1 - 0) + 0) / 1000)
                    ).toFixed(6)
                  );
                  price = parseFloat(
                    parseFloat(
                      usdtPrice / converter[getSecondaryPair(pair)].bid[0]
                    ).toFixed(ExchangePairInfo[exchange][pair].decimalsPrice)
                  );
                  checkPrice = await spreadBotOrders.findOne({
                    exchange,
                    pair,
                    price,
                    status: "active",
                  });
                }
                type = generatedOrder.type;
                if (generatedOrder.type == "buy") {
                  // if ([8, 9, 10].includes(j)) {
                  //   maxAmount = parseFloat(order.amountBuy) * 5 * 1.05;
                  //   minAmount = parseFloat(order.amountBuy) * 5 * 0.95;
                  // } else {
                  maxAmount =
                    parseFloat(order.amountBuy) *
                    1.05 *
                    parseFloat(generatedOrder.multiplyer);
                  minAmount =
                    parseFloat(order.amountBuy) *
                    0.95 *
                    parseFloat(generatedOrder.multiplyer);
                  // }
                  amount = parseFloat(
                    parseFloat(
                      Math.random() * (maxAmount - minAmount) + minAmount
                    ).toFixed(ExchangePairInfo[exchange][pair].decimalsAmount)
                  );
                } else {
                  // if ([8, 9, 10].includes(j)) {
                  //   maxAmount = parseFloat(order.amountSell) * 5 * 1.05;
                  //   minAmount = parseFloat(order.amountSell) * 5 * 0.95;
                  // } else {
                  maxAmount =
                    parseFloat(order.amountSell) *
                    1.05 *
                    parseFloat(generatedOrder.multiplyer);
                  minAmount =
                    parseFloat(order.amountSell) *
                    0.95 *
                    parseFloat(generatedOrder.multiplyer);
                  // }
                  amount = parseFloat(
                    parseFloat(
                      Math.random() * (maxAmount - minAmount) + minAmount
                    ).toFixed(ExchangePairInfo[exchange][pair].decimalsAmount)
                  );
                }
                // usdtTotal = parseFloat(
                //   parseFloat(
                //     Math.random() * (maxAmount - minAmount) + minAmount
                //   ).toFixed(4)
                // );
                // amount = parseFloat(
                //   parseFloat(usdtTotal / usdtPrice).toFixed(
                //     ExchangePairInfo[exchange][pair].decimalsAmount
                //   )
                // );
                total = parseFloat(parseFloat(amount * price).toFixed(4));
                usdtTotal = parseFloat(
                  parseFloat(amount * usdtPrice).toFixed(4)
                );
                if (amount > 0) {
                  orderData = {
                    type,
                    amount,
                    price,
                    usdtPrice,
                    exchange,
                    pair,
                    total,
                    usdtTotal,
                    ...accountData,
                  };
                  orderId = await PlaceOrder(exchange, orderData);
                  if (orderId != "error" && orderId != "" && orderId != null) {
                    uniqueId = uuid();
                    newOrder = new spreadBotOrders({
                      uniqueId,
                      originalQty: amount,
                      type,
                      price,
                      usdtPrice,
                      exchange,
                      pair,
                      total,
                      usdtTotal,
                      status: "active",
                      mappingId,
                      orderId,
                      refId,
                      externalExchangeId: "pending",
                    });
                    await newOrder.save();
                    if (type == "buy") {
                      placedAmountBuy = placedAmountBuy + amount;
                      totalAmountBuy = totalAmountBuy + usdtTotal;
                    } else {
                      placedAmountSell = placedAmountSell + amount;
                      totalAmountSell = totalAmountSell + usdtTotal;
                    }
                    mappedOrders.push(uniqueId);
                    refOrders.push(uniqueId);
                    generatedOrder.mappedOrders = refOrders;
                    generatedOrder.markModified("mappedOrders");
                    generatedOrder.save();
                  }
                }
              }
            }
          }
          order.mappedOrders = mappedOrders;
          order.placedAmountBuy = placedAmountBuy;
          order.placedTotalBuy = totalAmountBuy;
          order.placedAmountSell = placedAmountSell;
          order.placedTotalSell = totalAmountSell;
          order.markModified("placedAmountBuy");
          order.markModified("placedTotalBuy");
          order.markModified("placedAmountSell");
          order.markModified("placedTotalSell");
          order.markModified("mappedOrders");
          order.save();
        }
        flags["placeOrders-SBC"] = false;
        flags["placeOrders-SBC-time"] = new Date();
      }
    } catch (error) {
      logger.error(`spreadBotController_placeOrders_error`, error);
      flags["placeOrders-SBC"] = false;
      flags["placeOrders-SBC-time"] = new Date();
    }
  },

  updateOrders: async (orders, min) => {
    try {
      if (!flags[`updateOrders-SBC-${min}`]) {
        flags[`updateOrders-SBC-${min}`] = true;
        flags[`updateOrders-SBC-${min}-time`] = new Date();
        logger.info(`updateOrdersMin-SBC-${min}_in 1 start`);
        // const orders = await spreadBotOrders
        //   .find({ status: "active" })
        //   .sort({ usdtPrice: -1 });
        let i,
          order,
          exchange,
          pair,
          type,
          accountData,
          price,
          usdtPrice,
          status,
          originalQty,
          filledQty,
          orderId,
          orderData,
          statusData,
          prevFilledQty,
          fees,
          feeCurrency,
          feesUSDT,
          updatedTotal,
          updatedUsdtTotal,
          orderDetails,
          mappingId,
          updatedFilledQty,
          refId,
          generatedOrder;
        for (i = 0; i < orders.length; i++) {
          order = orders[i];
          exchange = order.exchange;
          pair = order.pair;
          orderId = order.orderId;
          type = order.type;
          price = order.price;
          usdtPrice = order.usdtPrice;
          prevFilledQty = order.filledQty;
          originalQty = order.originalQty;
          refId = order.refId;
          logger.info(`updateOrdersMin-SBC-${min}_in 2 order ${i}`, orderId);
          accountData = await GetAccount(exchange, "AB");
          orderData = {
            orderId,
            exchange,
            pair,
            botType: "spread",
            account: "AB",
            type: type,
            price: price,
            usdtPrice: usdtPrice,
            ...accountData,
          };
          statusData = await GetOrderStatus(exchange, orderData);
          status = statusData.status;
          filledQty = parseFloat(statusData.filledQty);
          logger.info(
            `updateOrdersMin-SBC-${min}_in 3 order ${i}`,
            orderId,
            status,
            filledQty
          );
          fees = statusData.fees;
          feeCurrency = statusData.feeCurrency;
          feesUSDT = statusData.feesUSDT;
          updatedTotal = parseFloat(
            parseFloat(statusData.updatedTotal).toFixed(6)
          );
          updatedUsdtTotal = parseFloat(
            parseFloat(filledQty * usdtPrice).toFixed(6)
          );
          //   order.status = status;
          //   order.filledQty = filledQty;
          //   order.fees = fees;
          //   order.feeCurrency = feeCurrency;
          //   order.feesUSDT = feesUSDT;
          //   order.updatedTotal = updatedTotal;
          //   order.updatedUsdtTotal = updatedUsdtTotal;
          //   order.markModified("status");
          //   order.markModified("filledQty");
          //   order.markModified("fees");
          //   order.markModified("feesUSDT");
          //   order.markModified("feeCurrency");
          //   order.markModified("updatedTotal");
          //   order.markModified("updatedUsdtTotal");
          await spreadBotOrders.findOneAndUpdate(
            {
              uniqueId: order.uniqueId,
            },
            {
              status: status,
              filledQty: filledQty,
              fees: fees,
              feeCurrency: feeCurrency,
              feesUSDT: feesUSDT,
              updatedTotal: updatedTotal,
              updatedUsdtTotal: updatedUsdtTotal,
            }
          );
          logger.info(
            `updateOrdersMin-SBC-${min}_in 4 order ${i} status updated`,
            orderId
          );
          if (filledQty > prevFilledQty) {
            logger.info(
              `updateOrdersMin-SBC-${min}_in 5 order ${i} filledQty greater`,
              orderId,
              prevFilledQty,
              filledQty
            );
            updatedFilledQty = filledQty - prevFilledQty;
            mappingId = order.mappingId;
            orderDetails = await spreadBotDetails.findOne({
              uniqueId: mappingId,
            });
            if (type == "buy") {
              orderDetails.filledAmountBuy =
                orderDetails.filledAmountBuy + updatedFilledQty;
              orderDetails.updatedTotalBuy =
                orderDetails.updatedTotalBuy + usdtPrice * updatedFilledQty;
              orderDetails.markModified("filledAmountBuy");
              orderDetails.markModified("updatedTotalBuy");
            } else {
              orderDetails.filledAmountSell =
                orderDetails.filledAmountSell + updatedFilledQty;
              orderDetails.updatedTotalSell =
                orderDetails.updatedTotalSell + usdtPrice * updatedFilledQty;
              orderDetails.markModified("filledAmountSell");
              orderDetails.markModified("updatedTotalSell");
            }
            orderDetails.save();
            // generatedOrder = await spreadBotGeneratedOrders.findOne({
            //   uniqueId: order.refId,
            // });
            // generatedOrder.totalFilled =
            //   generatedOrder.totalFilled + updatedFilledQty * usdtPrice;
            // generatedOrder.markModified("totalFilled");
            // generatedOrder.save();
            logger.info(
              `updateOrdersMin-SBC-${min}_in 6 order ${i} order details updated`,
              orderId
            );
          }
          //   order.save();
          if (exchange == "bitrue")
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        logger.info(`updateOrders-SBC-${min} for loop exit 11`);
        flags[`updateOrders-SBC-${min}`] = false;
        flags[`updateOrders-SBC-${min}-time`] = new Date();
        logger.info(
          `updateOrders-SBC-${min} flag set 12`,
          flags[`updateOrders-SBC-${min}`]
        );
      } else {
        logger.info(`updateOrders-SBC-${min}_flag_false`);
      }
    } catch (error) {
      logger.error(`spreadBotController_updateOrders_error`, error);
      flags[`updateOrders-SBC-${min}`] = false;
      flags[`updateOrders-SBC-${min}-time`] = new Date();
    }
  },

  updateCancellingOrders: async () => {
    try {
      if (!flags[`updateCancellingOrders-SBC`]) {
        flags[`updateCancellingOrders-SBC`] = true;
        flags[`updateCancellingOrders-SBC-time`] = new Date();
        const openOrders = await spreadBotDetails
          .find({ status: { $in: ["active", "stopped"] } })
          .sort({ createdAt: 1 });
        let i, orders, mappingId;
        for (i = 0; i < openOrders.length; i++) {
          mappingId = openOrders[i].uniqueId;
          orders = await spreadBotOrders
            .find({ mappingId, status: "active", cancelling: true })
            .sort({ createdAt: -1 });
          if (orders.length > 0) await module.exports.updateOrders(orders, 0);
        }
        flags[`updateCancellingOrders-SBC`] = false;
        flags[`updateCancellingOrders-SBC-time`] = new Date();
      }
    } catch (error) {
      logger.error(`spreadBotController_updateCancellingOrders_error`, error);
      flags[`updateCancellingOrders-SBC`] = false;
      flags[`updateCancellingOrders-SBC-time`] = new Date();
    }
  },

  updateOrdersMin: async () => {
    try {
      if (!flags[`updateOrdersMin-SBC`]) {
        logger.info(`updateOrdersMin-SBC_in 1`);
        flags[`updateOrdersMin-SBC`] = true;
        flags[`updateOrdersMin-SBC-time`] = new Date();
        const openOrders = await spreadBotDetails
          .find({ status: { $in: ["active", "stopped"] } })
          .sort({ createdAt: 1 });
        logger.info(`updateOrdersMin-SBC_in 2 orders`, openOrders.length);
        let i, orders, mappingId;
        for (i = 0; i < openOrders.length; i++) {
          mappingId = openOrders[i].uniqueId;
          logger.info(`updateOrdersMin-SBC_in 3 for loop`, i, mappingId);
          orders = await spreadBotOrders
            .find({ mappingId, type: "sell", status: "active" })
            .sort({ usdtPrice: 1 })
            .limit(3);
          logger.info(`updateOrdersMin-SBC_in 4 sell orders`, orders.length);
          if (orders.length > 0) await module.exports.updateOrders(orders, 1);
          logger.info(`updateOrdersMin-SBC_in 5 sell orders end`);
          orders = await spreadBotOrders
            .find({ mappingId, type: "buy", status: "active" })
            .sort({ usdtPrice: -1 })
            .limit(3);
          logger.info(`updateOrdersMin-SBC_in 6 buy orders`, orders.length);
          if (orders.length > 0) await module.exports.updateOrders(orders, 1);
          logger.info(`updateOrdersMin-SBC_in 7 buy orders end`);
          orders = await spreadBotOrders.find({ mappingId, status: "active" });
          if (orders.length == 0 && openOrders[i].status == "stopped") {
            await spreadBotDetails.findOneAndUpdate(
              { uniqueId: mappingId },
              { status: "cancelled" }
            );
          }
        }
        logger.info(`updateOrdersMin-SBC_in 8 for loop exit`);
        flags[`updateOrdersMin-SBC`] = false;
        flags[`updateOrdersMin-SBC-time`] = new Date();
        logger.info(
          `updateOrdersMin-SBC_in 9 set flag`,
          flags[`updateOrdersMin-SBC`]
        );
      } else {
        logger.info("updateOrdersMin-SBC_flag_false");
      }
    } catch (error) {
      logger.error(`spreadController_updateOrdersMin_error`, error);
      flags[`updateOrdersMin-SBC`] = false;
      flags[`updateOrdersMin-SBC-time`] = new Date();
    }
  },

  updateOrders10Min: async () => {
    try {
      if (!flags[`updateOrders10Min-SBC`]) {
        flags[`updateOrders10Min-SBC`] = true;
        flags[`updateOrders10Min-SBC-time`] = new Date();
        const openOrders = await spreadBotDetails
          .find({ status: { $in: ["active", "stopped"] } })
          .sort({ createdAt: 1 });
        let i, orders, mappingId;
        for (i = 0; i < openOrders.length; i++) {
          mappingId = openOrders[i].uniqueId;
          orders = await spreadBotOrders
            .find({ mappingId, type: "sell", status: "active" })
            .sort({ usdtPrice: 1 })
            .skip(3);
          if (orders.length > 0) await module.exports.updateOrders(orders, 10);
          orders = await spreadBotOrders
            .find({ mappingId, type: "buy", status: "active" })
            .sort({ usdtPrice: -1 })
            .skip(3);
          if (orders.length > 0) await module.exports.updateOrders(orders, 10);
        }
        flags[`updateOrders10Min-SBC`] = false;
        flags[`updateOrders10Min-SBC-time`] = new Date();
      }
    } catch (error) {
      logger.error(`spreadController_updateOrders10Min_error`, error);
      flags[`updateOrders10Min-SBC`] = false;
      flags[`updateOrders10Min-SBC-time`] = new Date();
    }
  },

  updateOrders20Min: async () => {
    try {
      if (!flags[`updateOrders15Min-SBC`]) {
        flags[`updateOrders15Min-SBC`] = true;
        const openOrders = await spreadBotDetails
          .find({ status: { $in: ["active", "stopped"] } })
          .sort({ createdAt: 1 });
        let i, orders, mappingId;
        for (i = 0; i < openOrders.length; i++) {
          mappingId = openOrders[i].uniqueId;
          orders = await spreadBotOrders
            .find({ mappingId, status: "active" })
            .sort({ usdtPrice: -1 });
          if (orders.length > 0) await module.exports.updateOrders(orders, 20);
        }
        flags[`updateOrders15Min-SBC`] = false;
      }
    } catch (error) {
      logger.error(`spreadController_updateOrders15Min_error`, error);
      flags[`updateOrders15Min-SBC`] = false;
    }
  },

  autoCancelOrders: async () => {
    try {
      if (!flags["autoCancel-SBC"]) {
        flags["autoCancel-SBC"] = true;
        flags["autoCancel-SBC-time"] = new Date();
        const orders = await spreadBotOrders
          .find({
            status: "active",
            cancelling: true,
          })
          .sort({ updatedAt: -1 });
        let i,
          order,
          type,
          orderId,
          price,
          usdtPrice,
          exchange,
          pair,
          cancelData,
          accountData;
        for (i = 0; i < orders.length; i++) {
          order = orders[i];
          exchange = order.exchange;
          pair = order.pair;
          orderId = order.orderId;
          price = order.price;
          usdtPrice = order.usdtPrice;
          type = order.type;
          accountData = await GetAccount(exchange, "AB");
          cancelData = {
            orderId,
            exchange,
            pair,
            type: type,
            price: price,
            usdtPrice: usdtPrice,
            ...accountData,
          };
          await CancelOrder(exchange, cancelData);
        }
        flags["autoCancel-SBC"] = false;
        flags["autoCancel-SBC-time"] = new Date();
      }
    } catch (error) {
      logger.error(`spreadBotController_autoCancelOrders_error`, error);
      flags["autoCancel-SBC"] = false;
      flags["autoCancel-SBC-time"] = new Date();
    }
  },

  cancelOrder: async (req, res) => {
    try {
      const orderId = req.body.orderId;
      const order = await spreadBotDetails.findOne({ uniqueId: orderId });
      if (order) {
        if (order.status == "active") {
          await spreadBotOrders.updateMany(
            { mappingId: orderId },
            { cancelling: true },
            { multi: true }
          );
          order.status = "stopped";
          order.markModified("status");
          order.save();
          // const data = await spreadBotDetails.aggregate([
          //   {
          //     $match: {
          //       status: "active",
          //       pair: { $regex: `${order.pair.split("-")[0]}-` },
          //     },
          //   },
          //   {
          //     $group: {
          //       _id: null,
          //       buyTotal: { $sum: "$amountBuy" },
          //       sellTotal: { $sum: "$amountSell" },
          //     },
          //   },
          // ]);
          // const buyTotal = data[0] ? data[0].buyTotal : 0;
          // const sellTotal = data[0] ? data[0].sellTotal : 0;
          // await spreadBotGeneratedOrders.updateMany(
          //   {
          //     status: "active",
          //     type: "buy",
          //     currency: `${order.pair.split("-")[0]}`,
          //   },
          //   { $set: { totalToBeFilled: buyTotal } }
          // );
          // await spreadBotGeneratedOrders.updateMany(
          //   {
          //     status: "active",
          //     type: "sell",
          //     currency: `${order.pair.split("-")[0]}`,
          //   },
          //   { $set: { totalToBeFilled: sellTotal } }
          // );
          return responseHelper.successWithMessage(res, "Order Cancelled");
        } else {
          return responseHelper.errorWithMessage(res, "Order is't active");
        }
      } else {
        return responseHelper.errorWithMessage(res, "Invalid order id.");
      }
    } catch (error) {
      logger.error(`spreadBotController_cancelOrder_error`, error);
      return responseHelper.serverError(res, error);
    }
  },

  getOrders: async (req, res) => {
    try {
      const openOrders = await spreadBotDetails
        .find({ status: "active" })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      let orders = [],
        i,
        order,
        data;
      for (i = 0; i < openOrders.length; i++) {
        order = openOrders[i];
        data = await spreadBotOrders.aggregate([
          {
            $match: {
              status: "active",
              type: "buy",
              mappingId: order.uniqueId,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$originalQty" },
              USDT: { $sum: "$usdtTotal" },
            },
          },
        ]);
        order.currentBuyTotal = data[0] ? data[0].total : 0;
        order.currentBuyUSDT = data[0] ? data[0].USDT : 0;
        data = await spreadBotOrders.aggregate([
          {
            $match: {
              status: "active",
              type: "sell",
              mappingId: order.uniqueId,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$originalQty" },
              USDT: { $sum: "$usdtTotal" },
            },
          },
        ]);
        order.currentSellTotal = data[0] ? data[0].total : 0;
        order.currentSellUSDT = data[0] ? data[0].USDT : 0;
        orders.push(order);
      }
      if (orders.length < 50) {
        const remainingOrders = await spreadBotDetails
          .find({ status: { $ne: "active" } })
          .sort({ createdAt: -1 })
          .limit(50 - `${orders.length}`)
          .lean();
        for (i = 0; i < remainingOrders.length; i++) {
          order = remainingOrders[i];
          order.currentBuyTotal = 0;
          order.currentBuyUSDT = 0;
          order.currentSellTotal = 0;
          order.currentSellUSDT = 0;
          orders.push(order);
        }
      }
      return responseHelper.successWithData(
        res,
        "Got data successfully",
        orders
      );
    } catch (error) {
      logger.error(`spreadBotController_getOrders_error`, error);
      return responseHelper.serverError(res, error);
    }
  },

  getOrderDetails: async (req, res) => {
    try {
      const uniqueId = req.body.uniqueId;
      const order = await spreadBotDetails.findOne({ uniqueId }).lean();
      if (order) {
        let orders = [],
          i,
          tempOrder,
          orderDetails = order,
          data;
        const openOrders = await spreadBotOrders
          .find({ status: "active", mappingId: uniqueId })
          .sort({ usdtPrice: -1 });
        for (i = 0; i < openOrders.length; i++) {
          tempOrder = openOrders[i];
          orders.push(tempOrder);
        }
        const completedOrders = await spreadBotOrders
          .find({
            status: { $ne: "active" },
            filledQty: { $gt: 0 },
            mappingId: uniqueId,
          })
          .sort({ createdAt: -1 })
          .lean();
        for (i = 0; i < completedOrders.length; i++) {
          tempOrder = completedOrders[i];
          orders.push(tempOrder);
        }
        data = await spreadBotOrders.aggregate([
          {
            $match: {
              status: "active",
              type: "buy",
              mappingId: uniqueId,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$originalQty" },
              USDT: { $sum: "$usdtTotal" },
            },
          },
        ]);
        orderDetails.currentBuyTotal = data[0] ? data[0].total : 0;
        orderDetails.currentBuyUSDT = data[0] ? data[0].USDT : 0;
        data = await spreadBotOrders.aggregate([
          {
            $match: {
              status: "active",
              type: "sell",
              mappingId: uniqueId,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$originalQty" },
              USDT: { $sum: "$usdtTotal" },
            },
          },
        ]);
        orderDetails.currentSellTotal = data[0] ? data[0].total : 0;
        orderDetails.currentSellUSDT = data[0] ? data[0].USDT : 0;
        return responseHelper.successWithData(res, "Got data sucessfully", {
          orderDetails,
          orders,
        });
      } else {
        return responseHelper.error(res, "Invalid Order");
      }
    } catch (error) {
      logger.error(`spreadBotController_getOrderDetails_error`, error);
      return responseHelper.serverError(res, error);
    }
  },

  resetFlags: async () => {
    try {
      const currentTime = new Date();
      let lastUpdateTime, difference;
      if (flags[`updateOrders-SBC-0`]) {
        lastUpdateTime = new Date(flags[`updateOrders-SBC-0-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateOrders-SBC-0`] = false;
      }
      if (flags[`updateOrders-SBC-1`]) {
        lastUpdateTime = new Date(flags[`updateOrders-SBC-1-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateOrders-SBC-1`] = false;
      }
      if (flags[`updateCancellingOrders-SBC`]) {
        lastUpdateTime = new Date(flags[`updateCancellingOrders-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateCancellingOrders-SBC`] = false;
      }
      if (flags[`updateOrdersMin-SBC`]) {
        lastUpdateTime = new Date(flags[`updateOrdersMin-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateOrdersMin-SBC`] = false;
      }
      if (flags[`updateOrders10Min-SBC`]) {
        lastUpdateTime = new Date(flags[`updateOrders10Min-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateOrders10Min-SBC`] = false;
      }
      if (flags[`placeOrders-SBC`]) {
        lastUpdateTime = new Date(flags[`placeOrders-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`placeOrders-SBC`] = false;
      }
      if (flags[`autoCancel-SBC`]) {
        lastUpdateTime = new Date(flags[`autoCancel-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`autoCancel-SBC`] = false;
      }
      if (flags[`cancelExtraOrders-SBC`]) {
        lastUpdateTime = new Date(flags[`cancelExtraOrders-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`cancelExtraOrders-SBC`] = false;
      }
      if (flags[`placeExternalOrders-SBC`]) {
        lastUpdateTime = new Date(flags[`placeExternalOrders-SBC-time`]);
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`placeExternalOrders-SBC`] = false;
      }
      if (flags[`updateExternalExchangeOrders-SBC`]) {
        lastUpdateTime = new Date(
          flags[`updateExternalExchangeOrders-SBC-time`]
        );
        difference = parseFloat(
          parseFloat((currentTime - lastUpdateTime) / 1000 / 60).toFixed(0)
        );
        if (difference > 3) flags[`updateExternalExchangeOrders-SBC`] = false;
      }
    } catch (error) {
      logger.error(`spreadBotController_resetFlags_error`, error);
    }
  },

  cancelExtraOrders: async () => {
    try {
      if (!flags[`cancelExtraOrders-SBC`]) {
        flags[`cancelExtraOrders-SBC`] = true;
        flags[`cancelExtraOrders-SBC-time`] = new Date();

        const orders = await spreadBotGeneratedOrders.find({
          status: "active",
        });
        let i,
          openOrders = [];
        for (i = 0; i < orders.length; i++) {
          openOrders.push(orders[i].uniqueId);
        }
        await spreadBotOrders.updateMany(
          { status: "active", cancelling: false, refId: { $nin: openOrders } },
          { cancelling: true },
          { multi: true }
        );

        flags[`cancelExtraOrders-SBC`] = false;
        flags[`cancelExtraOrders-SBC-time`] = new Date();
      }
    } catch (error) {
      logger.error(`spreadBotController_cancelExtraOrders_error`, error);
      flags[`cancelExtraOrders-SBC`] = false;
      flags[`cancelExtraOrders-SBC-time`] = new Date();
    }
  },

  placeExternalOrders: async () => {
    try {
      const isMarketOpen = await module.exports.checkMarket();
      if (isMarketOpen) {
        if (!flags["placeExternalOrders-SBC"]) {
          flags[`placeExternalOrders-SBC`] = true;
          flags[`placeExternalOrders-SBC-time`] = new Date();

          const orders = await spreadBotOrders.find({
            status: { $ne: "active" },
            externalExchangeId: "pending",
            filledQty: { $gt: 0 },
          });
          if (orders.length > 0) {
            let i,
              order,
              totalQty = 0,
              total = 0,
              placeType,
              price,
              usdtPrice,
              calculatedPrice,
              calculatedUsdtPrice,
              type,
              amount,
              usdtTotal,
              refOrders = [],
              amountOz,
              priceOz,
              pair = "CGO-USDT",
              orderId,
              stonexPair = stonexPairs[pair],
              marketPrice;
            for (i = 0; i < orders.length; i++) {
              order = orders[i];
              type = order.type;
              amount = order.filledQty;
              usdtTotal = order.updatedUsdtTotal;
              refOrders.push(order.uniqueId);
              if (type == "buy") {
                totalQty = totalQty + amount;
                total = total - usdtTotal;
              } else {
                totalQty = totalQty - amount;
                total = total + usdtTotal;
              }
            }
            placeType = totalQty > 0 ? "sell" : "buy";
            totalQty = Math.abs(totalQty);
            total = Math.abs(total);
            usdtPrice = parseFloat(parseFloat(total / totalQty).toFixed(6));
            const converter = JSON.parse(
              await RedisClient.get("converterPrice")
            );
            price = parseFloat(
              parseFloat(
                usdtPrice / converter[getSecondaryPair(pair)].bid[0]
              ).toFixed(6)
            );
            amountOz = parseFloat(
              parseFloat(totalQty / ounceConversion).toFixed(3)
            );
            priceOz = parseFloat(
              parseFloat(price * ounceConversion).toFixed(2)
            );
            // if (placeType == 'sell')
            //   priceOz = parseFloat(parseFloat(priceOz * 0.997).toFixed(2));
            // else
            //   priceOz = parseFloat(parseFloat(priceOz * 1.003).toFixed(2));
            const stonexTotal = parseFloat(
              parseFloat(amountOz * priceOz).toFixed(4)
            );
            const stonexUsdtTotal = parseFloat(
              parseFloat(totalQty * usdtPrice).toFixed(4)
            );
            calculatedPrice = priceOz;
            calculatedUsdtPrice = usdtPrice;
            if (placeType == "buy") {
              marketPrice = converter[`XAU-USD`].ask[0];
              priceOz =
                marketPrice <= calculatedPrice ? marketPrice : calculatedPrice;
              usdtPrice =
                parseFloat(priceOz / ounceConversion) *
                converter[getSecondaryPair(`XAU-USD`)].ask[0];
            } else {
              marketPrice = converter[`XAU-USD`].bid[0];
              priceOz =
                marketPrice >= calculatedPrice ? marketPrice : calculatedPrice;
              usdtPrice =
                parseFloat(priceOz / ounceConversion) *
                converter[getSecondaryPair(`XAU-USD`)].bid[0];
            }
            const uniqueId = uuid();
            const orderData = {
              clientId: uniqueId,
              pair: stonexPair,
              type: placeType,
              amount: amountOz,
              price: priceOz,
            };
            const orderReturn = await stonex.placeOrder(orderData);
            if (orderReturn != "error") orderId = orderReturn.orderId;
            else orderId = "error";
            if (orderId != "error") {
              const newOrder = new externalExchangeOrders({
                uniqueId,
                exchange: "stonex",
                pair,
                exchangePair: stonexPair,
                type: placeType,
                price: priceOz,
                usdtPrice,
                calculatedPrice,
                calculatedUsdtPrice,
                originalQtyGm: totalQty,
                originalQty: amountOz,
                total: stonexTotal,
                usdtTotal: stonexUsdtTotal,
                orderId,
                mappedOrders: refOrders,
                status: "active",
              });
              await newOrder.save();
              await spreadBotOrders.updateMany(
                { uniqueId: { $in: refOrders } },
                { externalExchangeId: uniqueId },
                { multi: true }
              );
            }
          }
          flags[`placeExternalOrders-SBC`] = false;
          flags[`placeExternalOrders-SBC-time`] = new Date();
        }
      }
    } catch (error) {
      logger.error(`spreadBotController_placeExternalOrders_error`, error);
      flags[`placeExternalOrders-SBC`] = false;
      flags[`placeExternalOrders-SBC-time`] = new Date();
    }
  },

  updateExternalExchangeOrders: async () => {
    try {
      const isMarketOpen = await module.exports.checkMarket();
      if (isMarketOpen) {
        if (!flags[`updateExternalExchangeOrders-SBC`]) {
          flags[`updateExternalExchangeOrders-SBC`] = true;
          flags[`updateExternalExchangeOrders-SBC-time`] = new Date();

          const orders = await externalExchangeOrders.find({ status: "active" });
          let i,
            order,
            orderId,
            orderData,
            status,
            avgPrice,
            avgPriceUsdt,
            filledQty;
          if (orders.length > 0) {
            for (i = 0; i < orders.length; i++) {
              order = orders[i];
              orderId = order.orderId;
              orderData = await stonex.orderStatus({ orderId });
              status = orderData[0].status;
              avgPrice = parseFloat(
                parseFloat(orderData[0].averagePrice).toFixed(2)
              );
              avgPriceUsdt = parseFloat(
                parseFloat(avgPrice / ounceConversion).toFixed(6)
              );
              filledQty = parseFloat(orderData[0].cumQty);
              if (status == "FILLED") status = "completed";
              else if (status == "CANCELED") status = "cancelled";
              else status = "active";
              order.status = status;
              order.completedPrice = avgPrice;
              order.completedUsdtPrice = avgPriceUsdt;
              order.filledQty = filledQty;
              order.markModified("status");
              order.markModified("completedPrice");
              order.markModified("completedUsdtPrice");
              order.markModified("filledQty");
              order.save();
            }
          }

          flags[`updateExternalExchangeOrders-SBC`] = false;
          flags[`updateExternalExchangeOrders-SBC-time`] = new Date();
        }
      }
    } catch (error) {
      logger.error(`updateExternalExchangeOrders_error`, error);
      flags[`updateExternalExchangeOrders-SBC`] = false;
      flags[`updateExternalExchangeOrders-SBC-time`] = new Date();
    }
  },

  checkMarket: async () => {
    try {
      const status = await RedisClient.get("priceUpdatedFromMarket");
      return status === "true" ? true : false;
    } catch (error) {
      logger.error(`spreadBotController_checkMarket_error`, error);
      return false;
    }
  },
};
