const axiosHelper = require("../axiosHelper");
const httpBuildQuery = require("http-build-query");
const baseURL = "https://api.lbank.info";
const uuid = require("uuid").v4;
const crypto = require("crypto");

module.exports = {
  orderBook: async (pair) => {
    try {
      const orderBookURL = `${baseURL}/v2/depth.do?symbol=${convertPairForExchange(
        pair
      )}&size=20`;
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
        logger.error(`lbank_orderBook_error : `, error.response.data);
      } else {
        logger.error(`lbank_orderBook_error : `, error);
      }
      return { asks: [], bids: [] };
    }
  },

  placeOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const symbol = convertPairForExchange(reqData.pair);
      const type = reqData.type.toLowerCase();
      const price = reqData.price;
      const amount = reqData.amount;
      const timestamp = Date.now();
      const url = `${baseURL}/v2/supplement/create_order.do`;
      const uniqueId = uuid();
      const echostr = uniqueId.replace(/-/g, "");
      const signature_method = "HmacSHA256";
      const parameters = {
        api_key: apiKey,
        echostr,
        timestamp,
        signature_method,
        symbol,
        price,
        type,
        amount,
      };
      const queryString = httpBuildQuery(
        Object.keys(parameters)
          .sort()
          .reduce(
            (acc, key) => ({
              ...acc,
              [key]: parameters[key],
            }),
            {}
          )
      );
      const preparedStr = crypto
        .createHash("md5")
        .update(queryString)
        .digest("hex")
        .toUpperCase();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(preparedStr)
        .digest("hex");
      const headers = {
        contentType: "application/x-www-form-urlencoded",
        timestamp: timestamp,
        signature_method,
        echostr,
      };
      const config = {
        url: `${url}?sign=${signature}&api_key=${apiKey}&symbol=${symbol}&type=${type}&price=${price}&amount=${amount}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`lbank_placeOrder_error : `, error.response.data);
      } else {
        logger.error(`lbank_placeOrder_error : `, error);
      }
      return "error";
    }
  },

  orderStatus: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const symbol = convertPairForExchange(reqData.pair);
      const orderId = reqData.orderId;
      const timestamp = Date.now();
      const url = `${baseURL}/v2/supplement/orders_info.do`;
      const uniqueId = uuid();
      const echostr = uniqueId.replace(/-/g, "");
      const signature_method = "HmacSHA256";
      const parameters = {
        api_key: apiKey,
        echostr,
        timestamp,
        signature_method,
        symbol,
        orderId,
      };
      const queryString = httpBuildQuery(
        Object.keys(parameters)
          .sort()
          .reduce(
            (acc, key) => ({
              ...acc,
              [key]: parameters[key],
            }),
            {}
          )
      );
      const preparedStr = crypto
        .createHash("md5")
        .update(queryString)
        .digest("hex")
        .toUpperCase();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(preparedStr)
        .digest("hex");
      const headers = {
        contentType: "application/x-www-form-urlencoded",
        timestamp: timestamp,
        signature_method,
        echostr,
      };
      const config = {
        url: `${url}?sign=${signature}&api_key=${apiKey}&symbol=${symbol}&orderId=${orderId}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`lbank_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`lbank_orderStatus_error : `, error);
      }
      return "error";
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const symbol = convertPairForExchange(reqData.pair);
      const orderId = reqData.orderId;
      const timestamp = Date.now();
      const url = `${baseURL}/v2/supplement/cancel_order.do`;
      const uniqueId = uuid();
      const echostr = uniqueId.replace(/-/g, "");
      const signature_method = "HmacSHA256";
      const parameters = {
        api_key: apiKey,
        echostr,
        timestamp,
        signature_method,
        symbol,
        orderId,
      };
      const queryString = httpBuildQuery(
        Object.keys(parameters)
          .sort()
          .reduce(
            (acc, key) => ({
              ...acc,
              [key]: parameters[key],
            }),
            {}
          )
      );
      const preparedStr = crypto
        .createHash("md5")
        .update(queryString)
        .digest("hex")
        .toUpperCase();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(preparedStr)
        .digest("hex");
      const headers = {
        contentType: "application/x-www-form-urlencoded",
        timestamp: timestamp,
        signature_method,
        echostr,
      };
      const config = {
        url: `${url}?sign=${signature}&api_key=${apiKey}&symbol=${symbol}&orderId=${orderId}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`lbank_cancelOrder_error : `, error.response.data);
      } else {
        logger.error(`lbank_canncelOrder_error : `, error);
      }
      return "error";
    }
  },

  walletBalance: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const timestamp = Date.now();
      const url = `${baseURL}/v2/supplement/user_info_account.do`;
      const uniqueId = uuid();
      const echostr = uniqueId.replace(/-/g, "");
      const signature_method = "HmacSHA256";
      const parameters = {
        api_key: apiKey,
        echostr,
        timestamp,
        signature_method,
      };
      const queryString = httpBuildQuery(
        Object.keys(parameters)
          .sort()
          .reduce(
            (acc, key) => ({
              ...acc,
              [key]: parameters[key],
            }),
            {}
          )
      );
      const preparedStr = crypto
        .createHash("md5")
        .update(queryString)
        .digest("hex")
        .toUpperCase();
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(preparedStr)
        .digest("hex");
      const headers = {
        contentType: "application/x-www-form-urlencoded",
        timestamp: timestamp,
        signature_method,
        echostr,
      };
      const config = {
        url: `${url}?sign=${signature}&api_key=${apiKey}`,
        headers,
        data: "",
      };
      const responseData = await axiosHelper.makePOSTHeaderRequest(config);
      return responseData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`lbank_walletBalance_error : `, error.response.data);
      } else {
        logger.error(`lbank_walletBalance_error : `, error);
      }
      return "error";
    }
  },

  ticker24Hr: async (pair) => {
    try {
      const orderBookURL = `${baseURL}/v2/ticker/24hr.do?symbol=${convertPairForExchange(
        pair
      )}`;
      const config = {
        url: orderBookURL,
        contentType: "application/json",
      };
      const orderBookData = await axiosHelper.makeGETRequest(config);
      return orderBookData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`lbank_ticker24Hr_error : `, error.response.data);
      } else {
        logger.error(`lbank_ticker24Hr_error : `, error);
      }
      return { asks: [], bids: [] };
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "_").toLowerCase();
}
