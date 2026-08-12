const mongoose = require("mongoose");

const dailyWalletBalancesArchive = new mongoose.Schema(
  {
    exchange: String,
    account: String,
    currency: [
      {
        currency: String,
        balance: Number,
        inTrade: Number,
        total: Number,
      },
    ],
    time: String,
  },
  {
    timestamps: true,
  }
);

dailyWalletBalancesArchive.index({ exchange: 1, account: 1, time: 1 });

module.exports = mongoose.model("dailyWalletBalancesArchives", dailyWalletBalancesArchive);
