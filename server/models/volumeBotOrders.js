const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let volumeBotOrders = new Schema(
  {
    uniqueId: { type: String, unique: true, required: true },
    exchange: { type: String, required: true },
    mappingId: { type: String, required: true },
    pair: { type: String, required: true },
    type: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    usdtPrice: { type: Number, required: true, default: 0 },
    originalQty: { type: Number, required: true, default: 0 },
    filledQty: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    updatedTotal: { type: Number, required: true, default: 0 },
    exchangeId: { type: String, required: true },
    fees: { type: Number, default: 0 },
    feeCurrency: { type: String, default: "USD" },
    feesUSDT: { type: Number, default: 0 },
    status: { type: String, required: true },
    tentativeLoss: { type: Number, default: 0 },
    // createdAt: { type: String, required: true },
    // updatedAt: { type: String, required: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  }
);

volumeBotOrders.index({ exchange: 1, pair: 1, status: 1, type: 1, updatedAt: -1 });
volumeBotOrders.index({ exchange: 1, pair: 1, status: 1 });
volumeBotOrders.index({ exchangeId: 1, exchange: 1 });
volumeBotOrders.index({ mappingId: 1 });

//export the model
module.exports = mongoose.model("volumeBotOrders", volumeBotOrders);
