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
const dailyStats = require("../models/dailyStats");
const externalExchangeOrders = require("../models/externalExchangeOrders");
const { RedisClient } = require("../services/redis");
const cronController = require("./cronController");
const uuid = require("uuid").v4;
const excel = require("exceljs");
const tempfile = require("tempfile");

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
        const amountOz = parseFloat(
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

  sendStatsSummary: async () => {
    try {
      const statsData = await dailyStats.find({
        time: new Date(new Date().setUTCHours(2, 30, 0, 0)),
        exchange: { $ne: "total" },
      });

      const workbook = new excel.Workbook();
      const worksheet = workbook.addWorksheet("Sheet 1");

      // Dynamically get unique exchanges
      const exchanges = [...new Set(statsData.map((data) => data.exchange))];

      // Add merged headers dynamically with exchange names
      let colIndex = 2; // Start from column B
      exchanges.forEach((exchange) => {
        worksheet.mergeCells(
          `${String.fromCharCode(64 + colIndex)}1:${String.fromCharCode(
            64 + colIndex + 2
          )}1`
        );
        worksheet.getCell(`${String.fromCharCode(64 + colIndex)}1`).value =
          exchange;
        worksheet.getCell(`${String.fromCharCode(64 + colIndex)}1`).alignment =
          { horizontal: "center", vertical: "middle" };
        colIndex += 3; // Move 3 columns (USDT, CGO, extra space)
      });

      // Add the second row (subheaders)
      const subheaders = ["Date"];
      exchanges.forEach(() => {
        subheaders.push("USDT", "CGO", ""); // Add a blank column for extra space
      });
      worksheet.getRow(2).values = subheaders;
      worksheet.getRow(2).alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      // Define columns dynamically for better readability
      const columns = [{ header: "Date", key: "date", width: 15 }];
      exchanges.forEach((exchange) => {
        columns.push(
          {
            header: `${exchange} USDT`,
            key: `${exchange.toLowerCase()}USDT`,
            width: 15,
          },
          {
            header: `${exchange} CGO`,
            key: `${exchange.toLowerCase()}CGO`,
            width: 15,
          },
          { header: " ", key: `${exchange.toLowerCase()}Spacer`, width: 5 } // Extra space column
        );
      });
      worksheet.columns = columns;

      // Populate data dynamically
      statsData.forEach((data) => {
        const rowData = { date: new Date().toLocaleDateString() }; // Add current date
        exchanges.forEach((exchange) => {
          const exchangeStats = statsData.filter(
            (stat) => stat.exchange === exchange
          );

          exchangeStats.forEach((stat) => {
            if (stat.currency === "USDT") {
              rowData[`${exchange.toLowerCase()}USDT`] =
                stat.stats[0]?.todayBalance || "";
            }
            if (stat.currency === "CGO") {
              rowData[`${exchange.toLowerCase()}CGO`] =
                stat.stats[1]?.todayBalance || "";
            }
          });
        });
        worksheet.addRow(rowData);
      });

      // Apply borders and alignment for styling
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
      });

      const filename =
        time.getDate() +
        "/" +
        (time.getMonth() + 1) +
        "/" +
        time.getFullYear() +
        "_balance_report.xlsx";
      let tempfilePath = tempfile(".xlsx");
      workbook.xlsx.writeFile(tempfilePath).then(async function () {
        let attachments = [
          {
            filename: filename,
            path: tempfilePath,
          },
        ];
        // const emails = await commonHelper.getEmailsForMail(1);
        const emails = ["raj@xinfin.org"];
        await mail.send(
          emails,
          "Crypbot Daily Balance Summary Mail",
          "Hello, \n Please find the attached excel sheet for the daily balance summary calculated at : " +
            time,
          attachments
        );
      });
    } catch (error) {
      logger.error(`cronController_sendStatsMail_error : `, error);
      return "error";
    }
  },
};
