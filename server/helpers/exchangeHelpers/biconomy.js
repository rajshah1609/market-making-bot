const axiosHelper = require("../axiosHelper");
const baseURL = "https://api.biconomy.com";
const crypto = require("crypto");

const logger = global.logger || console;

function makeV3GET(path, params, apiKey, apiSecret) {
  const entries = Object.entries(params || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const queryString = entries.map(([k, v]) => `${k}=${v}`).join("&");

  const timestamp = Date.now().toString();
  const recvWindow = "5000";

  const signPayload = queryString
    ? `${queryString}&timestamp=${timestamp}`
    : `timestamp=${timestamp}`;

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signPayload)
    .digest("hex")
    .toLowerCase();

  const headers = {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
    "X-API-TIMESTAMP": timestamp,
    "X-API-SIGN": signature,
    "X-API-RECV-WINDOW": recvWindow,
  };

  const url = queryString
    ? `${baseURL}${path}?${queryString}`
    : `${baseURL}${path}`;

  return { url, headers };
}

function makeV3POST(path, bodyObj, apiKey, apiSecret) {
  const rawJsonBody = JSON.stringify(bodyObj || {});
  const timestamp = Date.now().toString();
  const recvWindow = "5000";

  const signPayload = `${rawJsonBody}&timestamp=${timestamp}`;

  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signPayload)
    .digest("hex")
    .toLowerCase();

  const headers = {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
    "X-API-TIMESTAMP": timestamp,
    "X-API-SIGN": signature,
    "X-API-RECV-WINDOW": recvWindow,
  };

  const url = `${baseURL}${path}`;

  return { url, headers, rawJsonBody };
}

module.exports = {
  orderBook: async (pair) => {
    try {
      const orderBookURL = `${baseURL}/api/v3/depth?symbol=${convertPairForExchange(
        pair
      )}&limit=20`;
      const config = {
        url: orderBookURL,
        headers: {
          "Content-Type": "application/json",
        },
      };
      const orderBookData = await axiosHelper.makeGETHeaderRequest(config);
      const data =
        (orderBookData.data && orderBookData.data.data) ||
        orderBookData.data ||
        {};
      const resp = {
        bids: data.bids || [],
        asks: data.asks || [],
      };
      return resp;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_orderBook_error : `, error.response.data);
      } else {
        logger.error(`biconomy_orderBook_error : `, error.message || error);
      }
      return { asks: [], bids: [] };
    }
  },

  placeOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const pair = convertPairForExchange(reqData.pair);
      const side = reqData.type.toLowerCase() === "buy" ? "BUY" : "SELL";
      const price = reqData.price.toString();
      const amount = reqData.amount.toString();

      const body = {
        amount,
        price,
        side,
        symbol: pair,
        type: "LIMIT",
      };

      const { url, headers, rawJsonBody } = makeV3POST(
        "/api/v3/trade/order",
        body,
        apiKey,
        apiSecret
      );
      const config = {
        url,
        headers,
        data: rawJsonBody,
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(
          `biconomy_placeOrder_error:`,
          JSON.stringify(error.response.data)
        );
      } else {
        logger.error(`biconomy_placeOrder_error:`, error.message || error);
      }
      return "error";
    }
  },

  orderStatus: async (reqData) => {
    try {
      let orderData = await module.exports.openOrder(reqData);
      if (
        orderData !== "error" &&
        orderData &&
        orderData.code == 0 &&
        orderData.data
      ) {
        return orderData;
      } else {
        orderData = await module.exports.completedOrder(reqData);
        if (
          orderData !== "error" &&
          orderData &&
          orderData.code == 0 &&
          orderData.data
        ) {
          return orderData;
        } else {
          return "error";
        }
      }
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`biconomy_orderStatus_error : `, error.message || error);
      }
      return "error";
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = Number(reqData.orderId) || reqData.orderId;
      const pair = convertPairForExchange(reqData.pair);

      const body = {
        orderId,
        symbol: pair,
      };

      const { url, headers, rawJsonBody } = makeV3POST(
        "/api/v3/trade/cancelOrder",
        body,
        apiKey,
        apiSecret
      );
      const config = {
        url,
        headers,
        data: rawJsonBody,
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_cancelOrder_error:`, error.response.data);
      } else {
        logger.error(`biconomy_cancelOrder_error:`, error.message || error);
      }
      return "error";
    }
  },

  walletBalance: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const { url, headers } = makeV3GET(
        "/api/v3/account/assets",
        null,
        apiKey,
        apiSecret
      );
      const config = {
        url,
        headers,
      };

      const orderResponse = await axiosHelper.makeGETHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_walletBalance_error : `, error.response.data);
      } else {
        logger.error(
          `biconomy_walletBalance_error : `,
          error.message || error
        );
      }
      return "error";
    }
  },

  completedOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = Number(reqData.orderId) || reqData.orderId;

      const { url, headers } = makeV3GET(
        "/api/v3/trade/historyOrder/detail",
        { orderId },
        apiKey,
        apiSecret
      );

      const orderResponse = await axiosHelper.makeGETHeaderRequest({
        url,
        headers,
      });
      const resData = orderResponse.data;

      if (
        resData &&
        resData.code == 0 &&
        resData.data &&
        (resData.data.id || resData.data.orderId)
      ) {
        return resData;
      }
      return "error";
    } catch (error) {
      if (error.response) {
        logger.error(
          `biconomy_completedOrder_error:`,
          JSON.stringify(error.response.data)
        );
      } else {
        logger.error(`biconomy_completedOrder_error:`, error.message || error);
      }
      return "error";
    }
  },

  openOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = Number(reqData.orderId) || reqData.orderId;
      const pair = convertPairForExchange(reqData.pair);

      const { url, headers } = makeV3GET(
        "/api/v3/trade/openOrder/detail",
        { orderId, symbol: pair },
        apiKey,
        apiSecret
      );

      const orderResponse = await axiosHelper.makeGETHeaderRequest({
        url,
        headers,
      });
      const resData = orderResponse.data;

      if (
        resData &&
        resData.code == 0 &&
        resData.data &&
        (resData.data.id || resData.data.orderId)
      ) {
        return resData;
      }
      return "error";
    } catch (error) {
      if (error.response) {
        logger.error(
          `biconomy_openOrder_error:`,
          JSON.stringify(error.response.data)
        );
      } else {
        logger.error(`biconomy_openOrder_error:`, error.message || error);
      }
      return "error";
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "_").toUpperCase();
}
