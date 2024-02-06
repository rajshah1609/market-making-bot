const uatURL = "https://uat.fxinside.net";
const baseURL = uatURL;
const qs = require("qs");
const axiosHelper = require("../axiosHelper");

module.exports = {
  generateToken: async () => {
    try {
      const data = {
        user: process.env.stonexUser,
        pass: process.env.stonexPass,
        org: process.env.stonexOrg,
      };
      const loginURL = `${baseURL}/v2/sso/login`;
      const config = {
        url: loginURL,
        contentType: "application/json",
        data: data,
      };
      const loginData = await axiosHelper.makePOSTRequest(config);
      stonexToken = loginData.headers["sso_token"];
      stonexExpiry = loginData.data.expiryTime;
      return loginData.headers["sso_token"];
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_generateToken_error : `, error.response.data);
      } else {
        logger.error(`stonex_generateToken_error : `, error);
      }
      return "error";
    }
  },

  renewToken: async () => {
    try {
      const loginURL = `${baseURL}/v2/sso/token/renew`;
      const headers = {
        SSO_TOKEN: stonexToken,
        "Content-Type": "application/json",
      };
      const config = {
        url: loginURL,
        headers,
      };
      const loginData = await axiosHelper.makeGETHeaderRequest(config);
      stonexToken = loginData.headers["sso_token"];
      stonexExpiry = loginData.data.expiryTime;
      return loginData.headers["sso_token"];
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_renewToken_error : `, error.response.data);
      } else {
        logger.error(`stonex_renewToken_error : `, error);
      }
      return "error";
    }
  },

  getToken: async () => {
    try {
      const currentTime = Date.now();
      if (
        stonexToken != "" &&
        stonexToken != "error" &&
        stonexToken != null &&
        stonexExpiry != "" &&
        stonexExpiry > currentTime
      )
        stonexToken = stonexToken;
      // else if (
      //   stonexToken != "" &&
      //   stonexToken != "error" &&
      //   stonexToken != null &&
      //   stonexExpiry != "" &&
      //   stonexExpiry < currentTime
      // )
      //   await module.exports.renewToken();
      else await module.exports.generateToken();
      return stonexToken;
    } catch (error) {
      logger.error(`stonex_getToken_error`, error);
      return "error";
    }
  },

  fetchPrice: async (pair) => {
    try {
      pair = convertPairForExchange(pair);
      const ratesURL = `${baseURL}/v2/rates/spot/FULL/${
        process.env.stonexOrg
      }?${qs.stringify({
        symbol: pair,
      })}`;
      const token = await module.exports.getToken();
      const headers = {
        SSO_TOKEN: token,
        "Content-Type": "application/json",
      };
      const config = {
        url: ratesURL,
        headers,
      };
      const ratesData = await axiosHelper.makeGETHeaderRequest(config);
      return ratesData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_fetchPrice_error : `, error.response.data);
      } else {
        logger.error(`stonex_fetchPrice_error : `, error);
      }
      return {};
    }
  },

  placeOrder: async (reqData) => {
    try {
      let pair = reqData.pair;
      const currency = pair.split("-")[0];
      pair = convertPairForExchange(pair);
      const amount = reqData.amount;
      const price = reqData.price;
      const clientId = reqData.clientId;
      const type =
        reqData.type.charAt(0).toUpperCase() +
        reqData.type.slice(1).toLowerCase();
      const orderURL = `${baseURL}/v2/orders`;
      const token = await module.exports.getToken();
      const data = {
        coId: clientId,
        type: "Limit",
        side: type,
        symbol: pair,
        currency,
        size: amount,
        price,
        timeInForce: "GTC",
      };
      const headers = {
        SSO_TOKEN: token,
        "Content-Type": "application/json",
      };
      const config = {
        url: orderURL,
        headers,
        data: JSON.stringify(data),
      };
      const orderData = await axiosHelper.makePOSTHeaderRequest(config);
      return orderData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_placeOrder_error : `, error.response.data);
      } else {
        logger.error(`stonex_placeOrder_error : `, error);
      }
      return "error";
    }
  },

  orderStatus: async (reqData) => {
    try {
      const orderId = reqData.orderId;
      const statusURL = `${baseURL}/v2/orders/${orderId}`;
      const token = await module.exports.getToken();
      const headers = {
        SSO_TOKEN: token,
        "Content-Type": "application/json",
      };
      const config = {
        url: statusURL,
        headers,
      };
      const statusData = await axiosHelper.makeGETHeaderRequest(config);
      return statusData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_orderStatus_error : `, error.response.data);
      } else {
        logger.error(`stonex_orderStatus_error : `, error);
      }
      return "error";
    }
  },

  cancelOrder: async (reqData) => {
    try {
      const orderId = reqData.orderId;
      const cancelURL = `${baseURL}/v2/orders/${orderId}`;
      const token = await module.exports.getToken();
      const headers = {
        SSO_TOKEN: token,
        "Content-Type": "application/json",
      };
      const config = {
        url: cancelURL,
        headers,
        data: "",
      };
      const cancelData = await axiosHelper.makeDELETEHeaderRequest(config);
      return cancelData.data;
    } catch (error) {
      if (await isset(error.response)) {
        logger.error(`stonex_cancelOrder_error : `, error.response.data);
      } else {
        logger.error(`stonex_cancelOrder_error : `, error);
      }
      return "error";
    }
  },
};

function convertPairForExchange(pair) {
  return pair.replace("-", "/").toUpperCase();
}
