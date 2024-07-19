const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cartId: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Cart_Items',
        required: true
    },
    orderedItem: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        totalProductAmount: {
            type: Number,
            required: true
        },
        orderStatus: {
            type: String,
            required: true,
            default: "pending"
        },
        discountedPrice:{
            type:Number,
        }
    }],
    orderAmount: {
        type: Number,
        required: true
    },
    deliveryAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    deliveryDate: {
        type: Date
    },
    shippingDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        required: true
    },
    coupon: {
        type: String
    },
    couponDiscount: { // Adding the couponDiscount field
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
