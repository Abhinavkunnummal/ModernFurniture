const mongoose = require('mongoose');

const productOfferSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  offerName: {
    type: String,
    required: true
  },
  discount: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
});

productOfferSchema.index({ endDate: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProductOffer', productOfferSchema);
