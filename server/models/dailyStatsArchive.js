const mongoose = require("mongoose");

const dailyStatsArchive = new mongoose.Schema(
  {
    exchange: String,
    account: String,
    stats: [
      {
        currency: String,
        yesterdayBalance: Number,
        todayBalance: Number,
        balanceChange: Number,
        type: { type: String, enum: ["profit", "loss"] },
        diffUSDT: Number,
      },
    ],
    time: String,
  },
  {
    timestamps: true,
  }
);

dailyStatsArchive.index({ exchange: 1, account: 1, time: 1 });
dailyStatsArchive.index({ time: 1 });

module.exports = mongoose.model("dailyStatsArchives", dailyStatsArchive);
