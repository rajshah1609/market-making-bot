const axiosHelper = require("../axiosHelper");
const baseURL = "https://api.biconomy.com";
const httpBuildQuery = require("http-build-query");
const crypto = require("crypto");

module.exports = {
  orderBook: async (pair) => {
    try {
      const orderBookURL = `${baseURL}/api/v1/depth?symbol=${convertPairForExchange(
        pair
      )}&size=20`;
      const config = {
        url: orderBookURL,
        contentType: "application/json",
      };
      const orderBookData = await axiosHelper.makeGETRequest(config);
      const resp = {
        bids: orderBookData.data.bids,
        asks: orderBookData.data.asks,
      };
      return resp;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`biconomy_orderBook_error : `, error.response.data);
      } else {
        logger.error(`biconomy_orderBook_error : `, error);
      }
      return { asks: [], bids: [] };
    }
  },

  placeOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const pair = convertPairForExchange(reqData.pair); // Ensure correct pair formatting
      const type = reqData.type.toLowerCase() === "buy" ? 2 : 1; // Determine order type (1: ASK, 2: BID)
      const price = reqData.price;
      const amount = reqData.amount;

      // Prepare request body
      const body = {
        amount,
        api_key: apiKey,
        market: pair,
        price,
        side: type,
      };

      // Create parameter string (alphabetically sorted keys)
      const paramString = Object.entries(body)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort parameters by key
        .map(([key, val]) => `${key}=${val}`) // Convert to key=value format
        .join("&");

      // Append secretKey to parameter string
      const finalString = `${paramString}&secret_key=${apiSecret}`;

      // Generate HMAC SHA256 signature
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(finalString)
        .digest("hex")
        .toUpperCase(); // Convert signature to uppercase

      // Add signature to body
      body.sign = signature;

      // Set request headers
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-SITE-ID": "127",
      };

      // Build request configuration
      const config = {
        url: `${baseURL}/api/v2/private/trade/limit`,
        headers,
        data: new URLSearchParams(body).toString(), // Convert body to URL-encoded string
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_placeOrder_error:`, error.response.data);
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
        orderData != "error" &&
        orderData != null &&
        orderData != "" &&
        orderData.result != null
      ) {
        orderData.result.finalStatus = "active";
        return orderData;
      } else {
        orderData = await module.exports.completedOrder(reqData);
        if (
          orderData != "error" &&
          orderData != null &&
          orderData != "" &&
          orderData.result != null
        ) {
          if (
            parseFloat(orderData.result.amount) -
              parseFloat(orderData.result.deal_stock) ==
            0
          )
            orderData.result.finalStatus = "completed";
          else orderData.result.finalStatus = "cancelled";
          return orderData;
        } else {
          orderData = "error";
          return orderData;
        }
      }
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`biconomy_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`biconomy_orderStatus_error : `, error);
      }
      return "error";
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = reqData.orderId;
      const pair = convertPairForExchange(reqData.pair);

      // Prepare request body
      const body = {
        api_key: apiKey,
        market: pair,
        order_id: orderId,
      };

      // Create parameter string (alphabetically sorted keys)
      const paramString = Object.entries(body)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort parameters by key
        .map(([key, val]) => `${key}=${val}`) // Convert to key=value format
        .join("&");

      // Append secretKey to parameter string
      const finalString = `${paramString}&secret_key=${apiSecret}`;

      // Generate HMAC SHA256 signature
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(finalString)
        .digest("hex")
        .toUpperCase(); // Convert signature to uppercase

      // Add signature to body
      body.sign = signature;

      // Set request headers
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-SITE-ID": "127",
      };

      // Build request configuration
      const config = {
        url: `${baseURL}/api/v2/private/trade/cancel`,
        headers,
        data: new URLSearchParams(body).toString(), // Convert body to URL-encoded string
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_orderStatus_error:`, error.response.data);
      } else {
        logger.error(`biconomy_orderStatus_error:`, error.message || error);
      }
      return "error";
    }
  },

  walletBalance: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const body = {
        api_key: apiKey,
      };
      const paramString = Object.entries(body)
        .map(([key, val]) => `${key}=${val}`)
        .join("&");

      // Append the secretKey to the parameter string
      const finalString = `${paramString}&secret_key=${apiSecret}`;

      // Generate the HMAC SHA256 signature
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(finalString)
        .digest("hex")
        .toUpperCase();
      body.sign = signature;
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-SITE-ID": "127",
      };
      const config = {
        url: `${baseURL}/api/v2/private/user`,
        headers,
        data: new URLSearchParams(body).toString(), // Convert body to URL-encoded string
      };
      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`biconomy_walletBalance_error : `, error.response.data);
      } else {
        logger.error(`biconomy_walletBalance_error : `, error);
      }
      return "error";
    }
  },

  completedOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = reqData.orderId;
      const pair = convertPairForExchange(reqData.pair);

      // Prepare request body
      const body = {
        api_key: apiKey,
        // limit: 100,
        // market: pair,
        // offset: 0,
        order_id: orderId,
      };

      // Create parameter string (alphabetically sorted keys)
      const paramString = Object.entries(body)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort parameters by key
        .map(([key, val]) => `${key}=${val}`) // Convert to key=value format
        .join("&");

      // Append secretKey to parameter string
      const finalString = `${paramString}&secret_key=${apiSecret}`;

      // Generate HMAC SHA256 signature
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(finalString)
        .digest("hex")
        .toUpperCase(); // Convert signature to uppercase

      // Add signature to body
      body.sign = signature;

      // Set request headers
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-SITE-ID": "127",
      };

      // Build request configuration
      const config = {
        url: `${baseURL}/api/v2/private/order/finished/detail`,
        headers,
        data: new URLSearchParams(body).toString(), // Convert body to URL-encoded string
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_orderStatus_error:`, error.response.data);
      } else {
        logger.error(`biconomy_orderStatus_error:`, error.message || error);
      }
      return "error";
    }
  },

  openOrder: async (reqData) => {
    try {
      const apiKey = reqData.apiKey;
      const apiSecret = reqData.apiSecret;
      const orderId = reqData.orderId;
      const pair = convertPairForExchange(reqData.pair);

      // Prepare request body
      const body = {
        api_key: apiKey,
        market: pair,
        order_id: orderId,
      };

      // Create parameter string (alphabetically sorted keys)
      const paramString = Object.entries(body)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort parameters by key
        .map(([key, val]) => `${key}=${val}`) // Convert to key=value format
        .join("&");

      // Append secretKey to parameter string
      const finalString = `${paramString}&secret_key=${apiSecret}`;

      // Generate HMAC SHA256 signature
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(finalString)
        .digest("hex")
        .toUpperCase(); // Convert signature to uppercase

      // Add signature to body
      body.sign = signature;

      // Set request headers
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-SITE-ID": "127",
      };

      // Build request configuration
      const config = {
        url: `${baseURL}/api/v2/private/order/pending/detail`,
        headers,
        data: new URLSearchParams(body).toString(), // Convert body to URL-encoded string
      };

      const orderResponse = await axiosHelper.makePOSTHeaderRequest(config);
      return orderResponse.data;
    } catch (error) {
      if (error.response) {
        logger.error(`biconomy_orderStatus_error:`, error.response.data);
      } else {
        logger.error(`biconomy_orderStatus_error:`, error.message || error);
      }
      return "error";
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "_").toUpperCase();
}
