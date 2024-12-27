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
      let i, j, rowData;
      let time = new Date();
      time.setUTCHours(2, 30, 0, 0); // Set specific time

      const statsData = await dailyStats.find({
        time,
        exchange: { $ne: "total" },
      });

      let workbook = new excel.Workbook();
      workbook.views = [
        {
          x: 0,
          y: 0,
          width: 10000,
          height: 20000,
          firstSheet: 0,
          activeTab: 1,
          visibility: "visible",
        },
      ];

      let worksheet = workbook.addWorksheet("Sheet 1");

      // Fix the 1st row headers dynamically
      worksheet.mergeCells("B1:C1");
      worksheet.getCell("B1").value = "Bitrue";
      worksheet.getCell("B1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.mergeCells("E1:F1");
      worksheet.getCell("E1").value = "Bitmart";
      worksheet.getCell("E1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      worksheet.mergeCells("H1:I1");
      worksheet.getCell("H1").value = "LBank";
      worksheet.getCell("H1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.addRow();
      // Add the second row (subheaders)
      // worksheet.getRow(2).values = [
      //   "Date",
      //   "USDT",
      //   "CGO",
      //   "",
      //   "USDT",
      //   "CGO",
      //   "",
      //   "USDT",
      //   "CGO",
      // ];
      // worksheet.getRow(2).alignment = {
      //   horizontal: "center",
      //   vertical: "middle",
      // };

      // Define column properties
      worksheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "USDT", key: "bitrueUSDT", width: 15 },
        { header: "CGO", key: "bitrueCGO", width: 15 },
        { header: "", key: "space1", width: 5 },
        { header: "USDT", key: "bitmartUSDT", width: 15 },
        { header: "CGO", key: "bitmartCGO", width: 15 },
        { header: "", key: "space2", width: 5 },
        { header: "USDT", key: "lbankUSDT", width: 15 },
        { header: "CGO", key: "lbankCGO", width: 15 },
      ];
      worksheet.addRow();
      // Populate row data dynamically
      rowData = {
        date: new Date().toLocaleDateString(), // Add current date
        bitrueUSDT: "",
        bitrueCGO: "",
        bitmartUSDT: "",
        bitmartCGO: "",
        lbankUSDT: "",
        lbankCGO: "",
      };

      // Initialize rowData and populate dynamically
      for (i = 0; i < statsData.length; i++) {
        const exchange = statsData[i].exchange; // Current exchange
        const stats = statsData[i].stats; // Stats array

        for (j = 0; j < stats.length; j++) {
          const currency = stats[j].currency; // Assuming `currency` is in the stats array
          const todayBalance = stats[j].todayBalance; // Balance for today

          if (currency === "USDT") {
            if (exchange === "bitrue") rowData.bitrueUSDT = todayBalance;
            else if (exchange === "bitmart") rowData.bitmartUSDT = todayBalance;
            else if (exchange === "lbank") rowData.lbankUSDT = todayBalance;
          } else if (currency === "CGO") {
            if (exchange === "bitrue") rowData.bitrueCGO = todayBalance;
            else if (exchange === "bitmart") rowData.bitmartCGO = todayBalance;
            else if (exchange === "lbank") rowData.lbankCGO = todayBalance;
          }
        }
      }
      // Add the populated rowData to the worksheet
      worksheet.addRow(rowData);

      // Save the workbook to a file
      // await workbook.xlsx.writeFile("daily_stats.xlsx");
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
