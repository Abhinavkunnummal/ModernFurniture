const mongoose = require('mongoose');

const categoryOfferSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
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

categoryOfferSchema.index({ endDate: 1 }, { expireAfterSeconds: 0 });

const CategoryOffer = mongoose.model('CategoryOffer', categoryOfferSchema);

module.exports = CategoryOffer;
