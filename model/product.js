const mongoose = require('mongoose');
const Category = require('./category');
const { Timestamp } = require('mongodb');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    image: {
        type: [String],
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    stock: {
        type: Number,
        required: true,
    },
    is_Listed: {
        type: Boolean,
        default: false,
    },
    
},{Timestamp:true});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

