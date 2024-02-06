const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let externalExchangeOrders = new Schema(
  {
    uniqueId: { type: String, required: true, unique: true },
    exchange: { type: String, required: true },
    pair: { type: String, required: true },
    exchangePair: { type: String, required: true },
    type: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    usdtPrice: { type: Number, required: true, default: 0 },
    originalQty: { type: Number, required: true, default: 0 },
    filledQty: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    updatedTotal: { type: Number, required: true, default: 0 },
    orderId: { type: String, required: true },
    mappedOrders: [],
    status: { type: String, required: true, default: "active" },
    fees: { type: Number, default: 0 },
    feeCurrency: { type: String, default: "USD" },
    feesUSDT: { type: Number, default: 0 },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  }
);

//export the model
module.exports = mongoose.model(
  "externalExchangeOrders",
  externalExchangeOrders
);
