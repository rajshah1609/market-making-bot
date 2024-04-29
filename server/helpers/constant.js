/**
 * @constant exchanges list of exchanges which the CrypBot is connected to
 */
const exchanges = ["bitrue", "bitmart"];

exports.Exchanges = exchanges;

exports.StartOfTime = new Date(0);

let ExchangePairInfo = {
  bitrue: {
    "XDC-USDT": {
      decimalsAmount: 0,
      decimalsPrice: 5,
      minAmount: 500,
      maxAmount: 10000,
    },
    "XDC-USDC": {
      decimalsAmount: 0,
      decimalsPrice: 5,
      minAmount: 500,
      maxAmount: 10000,
    },
    "XDC-XRP": {
      decimalsAmount: 0,
      decimalsPrice: 5,
      minAmount: 500,
      maxAmount: 10000,
    },
    "XDC-ETH": {
      decimalsAmount: 0,
      decimalsPrice: 8,
      minAmount: 500,
      maxAmount: 10000,
    },
    "CGO-USDT": {
      decimalsAmount: 2,
      decimalsPrice: 2,
      minAmount: 0.05,
      maxAmount: 5000,
    },
  },
  bitmart: {
    "CGO-USDT": {
      decimalsAmount: 2,
      decimalsPrice: 2,
      minAmount: 0.05,
      maxAmount: 5000,
    },
  },
};

exports.setExchangePairInfo = (data) => {
  ExchangePairInfo = data;
};

exports.ExchangePairInfo = ExchangePairInfo;

const UsdtPairs = ["XDC-USDT", "XDC-USD", "XDC-USDC"];

exports.UsdtPairs = UsdtPairs;

const converterPairs = ["ETH-USDT", "XRP-USDT", "BTC-USDT", "XDC-USDT"];

exports.converterPairs = converterPairs;

exports.primaryCurrencies = ["XDC"];

const ExchangeCurrencyInfo = {
  bitrue: {
    XDC: {
      exchangeSymbol: "XDC",
      name: "XDC Network",
      currencyId: "",
    },
    USDT: { exchangeSymbol: "USDT", name: "USD Tether", currencyId: "" },
    USDC: { exchangeSymbol: "USDC", name: "USD Coin", currencyId: "" },
    XRP: { exchangeSymbol: "XRP", name: "Ripple", currencyId: "" },
    ETH: { exchangeSymbol: "ETH", name: "Ethereum", currencyId: "" },
    CGO: { exchangeSymbol: "CGO", name: "Comtech Gold", currencyId: "" },
  },
  bitmart: {
    USDT: { exchangeSymbol: "USDT", name: "USD Tether", currencyId: "" },
    CGO: { exchangeSymbol: "CGO", name: "Comtech Gold", currencyId: "" },
  },
};

exports.ExchangeCurrencyInfo = ExchangeCurrencyInfo;

exports.ounceConversion = 31.1034768;

exports.stonexPairs = {
  "CGO-USDT": "XAU-USD",
};
