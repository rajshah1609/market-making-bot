const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let volumeBotDetails = new Schema(
  {
    exchange: { type: String, required: true },
    details: {
      pair: { type: String, required: true },
      minVolume: { type: Number, required: true, default: 0 },
      maxVolume: { type: Number, required: true, default: 0 },
      minSeconds: { type: Number, required: true, default: 0 },
      maxSeconds: { type: Number, required: true, default: 0 },
      status: { type: String, required: true, default: "stop" },
      message: { type: String },
      sellFirst: { type: Boolean, default: true },
      lastAmount: { type: Number, default: 0 },
      placeLast: { type: Boolean, default: false },
      lossUsdt: { type: Number, default: 10 },
      totalLoss: { type: Number, default: 0 },
      volumeDone: { type: Number, default: 0 },
      volumeDoneUSDT: { type: Number, default: 0 },
    },
    // createdAt: { type: String, required: true },
    // updatedAt: { type: String, required: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  }
);

//export the model
module.exports = mongoose.model("volumeBotDetails", volumeBotDetails);
