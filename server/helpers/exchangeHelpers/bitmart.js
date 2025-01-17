const axiosHelper = require("../axiosHelper");
const crypto = require("crypto");
const qs = require("querystring");

module.exports = {
  orderBook: async (pair) => {
    try {
      const orderBookURL = `https://api-cloud.bitmart.com/spot/quotation/v3/books?symbol=${convertPairForExchange(
        pair
      )}&limit=20`;
      const config = {
        url: orderBookURL,
        contentType: "application/json",
      };
      const orderBookData = await axiosHelper.makeGETRequest(config);
      const resp = {
        bids: orderBookData.data.data.bids,
        asks: orderBookData.data.data.asks,
      };
      return resp;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_orderBook_error : `, error.response.data);
      } else {
        logger.error(`bitmart_orderBook_error : `, error);
      }
      return { asks: [], bids: [] };
    }
  },

  placeOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const memo = reqData.memo;
      const pair = convertPairForExchange(reqData.pair);
      const type = reqData.type.toLowerCase();
      const amount = reqData.amount;
      const price = reqData.price;
      // const timestamp = new Date().getTime().toString();
      const url = "https://api-cloud.bitmart.com/spot/v2/submit_order";
      const body = {
        symbol: pair,
        side: type,
        type: "limit",
        size: amount,
        price: price,
        recvWindow: 15000,
      };
      const ordered = {};
      Object.keys(body)
        .sort()
        .forEach((key) => {
          ordered[key] = body[key];
        });
      const queryString = JSON.stringify(ordered);
      const timestamp = await getTimeStamp();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(`${timestamp}#${memo}#${queryString}`)
        .digest("hex");
      const headers = {
        "Content-Type": "application/json",
        "X-BM-KEY": apiKey,
        "X-BM-TIMESTAMP": timestamp,
        "X-BM-SIGN": signature,
      };
      const config = {
        url: url,
        headers,
        data: queryString,
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_placeOrder_error : `, error.response.data);
      } else {
        logger.error(`bitmart_placeOrder_error : `, error);
      }
      return "error";
    }
  },

  walletBalance: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const memo = reqData.memo;
      // const timestamp = new Date().getTime().toString();
      const url = "https://api-cloud.bitmart.com/spot/v1/wallet";
      const queryString = "";
      const timestamp = await getTimeStamp();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(`${timestamp}#${memo}#${queryString}`)
        .digest("hex");
      const headers = {
        contentType: "application/json",
        "X-BM-KEY": apiKey,
        "X-BM-TIMESTAMP": timestamp,
        "X-BM-SIGN": signature,
      };
      const config = {
        url: url,
        headers,
      };
      const responseData = await axiosHelper.makeGETHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_walletBalance_error : `, error.response.data);
      } else {
        logger.error(`bitmart_walletBalance_error : `, error);
      }
      return "error";
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const memo = reqData.memo;
      const pair = convertPairForExchange(reqData.pair);
      const orderId = reqData.orderId;
      // const timestamp = new Date().getTime().toString();
      const url = "https://api-cloud.bitmart.com/spot/v3/cancel_order";
      const body = {
        symbol: pair,
        order_id: orderId,
        recvWindow: 15000,
      };
      const ordered = {};
      Object.keys(body)
        .sort()
        .forEach((key) => {
          ordered[key] = body[key];
        });
      const queryString = JSON.stringify(ordered);
      const timestamp = await getTimeStamp();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(`${timestamp}#${memo}#${queryString}`)
        .digest("hex");
      const headers = {
        "Content-Type": "application/json",
        "X-BM-KEY": apiKey,
        "X-BM-TIMESTAMP": timestamp,
        "X-BM-SIGN": signature,
      };
      const config = {
        url: url,
        headers,
        data: queryString,
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_cancelOrder_error : `, error.response.data);
      } else {
        logger.error(`bitmart_cancelOrder_error : `, error);
      }
      return "error";
    }
  },

  orderStatusOld: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const memo = reqData.memo;
      const orderId = reqData.orderId;
      // const timestamp = new Date().getTime().toString();
      const payload = {
        order_id: orderId,
        recvWindow: 15000,
      };
      const queryString = qs.stringify(payload);
      const url = `https://api-cloud.bitmart.com/spot/v2/order_detail?${queryString}`;
      const timestamp = await getTimeStamp();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(`${timestamp}#${memo}#${queryString}`)
        .digest("hex");
      const headers = {
        contentType: "application/json",
        "X-BM-KEY": apiKey,
        "X-BM-TIMESTAMP": timestamp,
        "X-BM-SIGN": signature,
      };
      const config = {
        url: url,
        headers,
      };
      const responseData = await axiosHelper.makeGETHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        if (error.response.data.message.includes("order not exist")) {
          return { data: { filled_size: 0, status: 8 } };
        } else {
          logger.error(`bitmart_orderStatus_error : `, error.response.data);
        }
      } else {
        logger.error(`bitmart_orderStatus_error : `, error);
      }
      return "error";
    }
  },

  orderStatus: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const memo = reqData.memo;
      const orderId = reqData.orderId;
      // const timestamp = new Date().getTime().toString();
      const body = {
        orderId,
        recvWindow: 15000,
      };
      const ordered = {};
      Object.keys(body)
        .sort()
        .forEach((key) => {
          ordered[key] = body[key];
        });
      const queryString = JSON.stringify(ordered);
      const url = `https://api-cloud.bitmart.com/spot/v4/query/order`;
      const timestamp = await getTimeStamp();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(`${timestamp}#${memo}#${queryString}`)
        .digest("hex");
      const headers = {
        "Content-Type": "application/json",
        "X-BM-KEY": apiKey,
        "X-BM-TIMESTAMP": timestamp,
        "X-BM-SIGN": signature,
      };
      const config = {
        url: url,
        headers,
        data: queryString,
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`bitmart_orderStatus_error : `, error);
      }
      return "error";
    }
  },

  ticker24Hr: async (pair) => {
    try {
      const tickerURL = `https://api-cloud.bitmart.com/spot/v1/ticker_detail?symbol=${convertPairForExchange(
        pair
      )}`;
      const config = {
        url: tickerURL,
        contentType: "application/json",
      };
      const tickerData = await axiosHelper.makeGETRequest(config);
      return tickerData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`bitmart_ticker24Hr_error : `, error.response.data);
      } else {
        logger.error(`bitmart_ticker24Hr_error : `, error);
      }
      return "error";
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "_").toUpperCase();
}

async function getTimeStamp() {
  try {
    const config = {
      url: `https://api-cloud.bitmart.com/system/time`,
      contentType: "application/json",
    };
    const orderResponse = await axiosHelper.makeGETRequest(config);
    return orderResponse.data.data.server_time;
  } catch (error) {
    console.log("bitmart_getTimeStamp_error", error);
    return Date.now();
  }
}
