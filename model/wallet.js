const mongoose = require('mongoose');
const walletSchema = new mongoose.Schema({
   userId: {
     type: mongoose.Schema.Types.ObjectId,
     required: true
   },
   balance: {
     type: Number,
     required: true
   },
   transaction: [{
     amount: {
       type: Number,
       required: true
     },
     transactionMethod: {
       type: String,
       required: true,
       enum: ["Debit", "Razorpay", "Refferal", "Refund", "Payment", "Credit"]
     },
     formattedDate: {
       type: String,
       required: true
     }
   }]
 }, {
   timestamps: true
 });
 
 module.exports = mongoose.model('Wallet', walletSchema);
 