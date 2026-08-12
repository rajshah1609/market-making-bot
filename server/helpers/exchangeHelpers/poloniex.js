const axiosHelper = require("../axiosHelper");
const baseURL = "https://api.poloniex.com";
const crypto = require("crypto-js");

module.exports = {
  orderBook: async (pair) => {
    try {
      const orderBookURL = `${baseURL}/markets/${convertPairForExchange(
        pair
      )}/orderBook`;
      const config = {
        url: orderBookURL,
        contentType: "application/json",
      };
      const orderBookData = await axiosHelper.makeGETRequest(config);
      let i,
        asks = [],
        bids = [];
      for (i = 0; i < orderBookData.data.bids.length; ) {
        bids.push({
          price: orderBookData.data.bids[i],
          amount: orderBookData.data.bids[i + 1],
        });
        i += 2;
      }
      for (i = 0; i < orderBookData.data.asks.length; ) {
        asks.push({
          price: orderBookData.data.asks[i],
          amount: orderBookData.data.asks[i + 1],
        });
        i += 2;
      }
      const resp = {
        bids,
        asks,
      };
      return resp;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`poloniex_orderBook_error : `, error.response.data);
      } else {
        logger.error(`poloniex_orderBook_error : `, error);
      }
      return { asks: [], bids: [] };
    }
  },

  walletBalance: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const timestamp = new Date().getTime();
      const path = "/accounts/balances";
      const url = `${baseURL}${path}`;
      const method = "GET";
      const signatureMethod = "HmacSHA256";
      const params = { signTimestamp: timestamp };
      const query = Object.keys(params)
        .sort((a, b) => (a > b ? 1 : -1))
        .reduce(function (a, k) {
          a.push(k + "=" + encodeURIComponent(params[k]));
          return a;
        }, [])
        .join("&")
        .toString();
      const preparedStr = method + "\n" + path + "\n" + query;
      const hmacData = crypto.HmacSHA256(preparedStr, apiSecret);
      const signature = crypto.enc.Base64.stringify(hmacData);
      const headers = {
        "Content-Type": "application/json",
        key: apiKey,
        signTimestamp: timestamp,
        signatureMethod,
        signatureVersion: 2,
        signature,
      };
      const config = {
        url: `${url}?${query}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makeGETHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`poloniex_walletBalance_error : `, error.response.data);
      } else {
        logger.error(`poloniex_walletBalance_error : `, error);
      }
    }
  },

  placeOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const pair = convertPairForExchange(reqData.pair);
      const price = reqData.price;
      const amount = reqData.amount;
      const type = reqData.type.toUpperCase();
      const timestamp = new Date().getTime();
      const path = "/orders";
      const url = `${baseURL}${path}`;
      const method = "POST";
      const signatureMethod = "HmacSHA256";
      const body = {
        symbol: pair,
        type: "LIMIT",
        side: type,
        timeInForce: "GTC",
        price: price,
        quantity: amount,
      };
      const stringifiedBody =
        "requestBody=" + JSON.stringify(body) + "&signTimestamp=" + timestamp;
      const preparedStr = method + "\n" + path + "\n" + stringifiedBody;
      const hmacData = crypto.HmacSHA256(preparedStr, apiSecret);
      const signature = crypto.enc.Base64.stringify(hmacData);
      const headers = {
        "Content-Type": "application/json",
        key: apiKey,
        signTimestamp: timestamp,
        signatureMethod,
        signatureVersion: 2,
        signature,
      };
      const config = {
        url: `${url}`,
        headers,
        data: body,
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`poloniex_placeOrder_error : `, error.response.data);
      } else {
        logger.error(`poloniex_placeOrder_error : `, error);
      }
    }
  },

  orderStatus: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = reqData.orderId;
      const timestamp = new Date().getTime();
      const path = `/orders/${orderId}`;
      const url = `${baseURL}${path}`;
      const method = "GET";
      const signatureMethod = "HmacSHA256";
      const params = { signTimestamp: timestamp };
      const query = Object.keys(params)
        .sort((a, b) => (a > b ? 1 : -1))
        .reduce(function (a, k) {
          a.push(k + "=" + encodeURIComponent(params[k]));
          return a;
        }, [])
        .join("&")
        .toString();
      const preparedStr = method + "\n" + path + "\n" + query;
      const hmacData = crypto.HmacSHA256(preparedStr, apiSecret);
      const signature = crypto.enc.Base64.stringify(hmacData);
      const headers = {
        "Content-Type": "application/json",
        key: apiKey,
        signTimestamp: timestamp,
        signatureMethod,
        signatureVersion: 2,
        signature,
      };
      const config = {
        url: `${url}?${query}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makeGETHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`poloniex_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`poloniex_orderStatus_error : `, error);
      }
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = reqData.orderId;
      const timestamp = new Date().getTime();
      const path = `/orders/${orderId}`;
      const url = `${baseURL}${path}`;
      const method = "DELETE";
      const signatureMethod = "HmacSHA256";
      const body = {};
      const stringifiedBody = "signTimestamp=" + timestamp;
      const preparedStr = method + "\n" + path + "\n" + stringifiedBody;
      const hmacData = crypto.HmacSHA256(preparedStr, apiSecret);
      const signature = crypto.enc.Base64.stringify(hmacData);
      const headers = {
        "Content-Type": "application/json",
        key: apiKey,
        signTimestamp: timestamp,
        signatureMethod,
        signatureVersion: 2,
        signature,
      };
      const config = {
        url: `${url}`,
        headers,
        data: body,
      };
      const responseData = await axiosHelper.makeDELETEHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`poloniex_cancelOrder_error : `, error.response.data);
      } else {
        logger.error(`poloniex_cancelOrder_error : `, error);
      }
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "_").toUpperCase();
}
