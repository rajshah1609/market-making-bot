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
      let i,
        j,
        k,
        l,
        stats,
        exchange,
        account,
        rowData,
        totalUSDTDifference = 0,
        startData,
        currentData,
        txData,
        adjustment = [],
        opening,
        closing,
        accountsArray = [],
        buySell,
        totalUSDTOpen = 0,
        totalUSDTCloseAct = 0,
        totalUSDTCloseCal = 0,
        totalUSDTBS = 0,
        totalUSDTDW = 0,
        pendingTotal = 0,
        pendingTotalArray = [],
        currency,
        totalAmount,
        usdtTotal,
        ordersData,
        type,
        usdtPrice;
      const converter = JSON.parse(await RedisClient.get("converterPrice"));

      let time = new Date();
      time.setUTCHours(2, 30, 0, 0); // Set specific time
      let yesterday = new Date(time);
      yesterday.setDate(yesterday.getDate() - 1);

      const statsData = await dailyStats.find({
        time,
        exchange: { $ne: "total" },
      });

      let workbook = new excel.Workbook();
      let worksheet = workbook.addWorksheet("Sheet 1");

      // Add merged headers
      worksheet.mergeCells("B1:C1");
      worksheet.getCell("B1").value = "CGO";
      worksheet.getCell("B1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.mergeCells("D1:E1");
      worksheet.getCell("D1").value = "CGO";
      worksheet.getCell("D1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.mergeCells("F1:G1");
      worksheet.getCell("F1").value = "CGO";
      worksheet.getCell("F1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      // Add the second row (subheaders)
      worksheet.getRow(2).values = [
        "Date",
        "USDT",
        "CGO",
        "USDT",
        "CGO",
        "USDT",
        "CGO",
      ];
      worksheet.getRow(2).alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      // Initialize columns for dynamic data
      worksheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "USDT", key: "cgoUSDT1", width: 15 },
        { header: "CGO", key: "cgoCGO1", width: 15 },
        { header: "USDT", key: "cgoUSDT2", width: 15 },
        { header: "CGO", key: "cgoCGO2", width: 15 },
        { header: "USDT", key: "cgoUSDT3", width: 15 },
        { header: "CGO", key: "cgoCGO3", width: 15 },
      ];

      // Process and add rows dynamically
      statsData.forEach((data) => {
        const row = {
          date: data.time.toLocaleDateString(), // Format date as MM/DD/YYYY
          cgoUSDT1: data.stats[0]?.todayBalance || "", // Replace with actual logic for USDT
          cgoCGO1: data.stats[1]?.todayBalance || "", // Replace with actual logic for CGO
          cgoUSDT2: data.stats[2]?.todayBalance || "",
          cgoCGO2: data.stats[3]?.todayBalance || "",
          cgoUSDT3: data.stats[4]?.todayBalance || "",
          cgoCGO3: data.stats[5]?.todayBalance || "",
        };

        worksheet.addRow(row);
      });

      // Apply borders and alignment for better formatting
      worksheet.eachRow((row, rowNumber) => {
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

      // Save the workbook
      await workbook.xlsx.writeFile("daily_stats.xlsx");
      console.log("Excel file created successfully!");

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
