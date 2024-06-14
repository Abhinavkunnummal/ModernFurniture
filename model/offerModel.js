const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const offerSchema = new Schema({
  offerName: {
    type: String,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  offerType: {
    type: String,
    enum: ['Category', 'Product', 'Referral'],
    required: true,
  },
  productId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  categoryId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  }],
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
