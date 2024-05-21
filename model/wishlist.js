const mongoose = require('mongoose');

const wishlistSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  product: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      }
    }
  ]
});

module.exports = mongoose.model('Wishlist', wishlistSchema);
