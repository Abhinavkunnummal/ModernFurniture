const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  is_Listed: {
    type: Boolean,
    default: false,
  },
  categoryOfferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
  }
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
