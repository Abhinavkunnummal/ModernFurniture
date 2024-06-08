const mongoose=require('mongoose')

const paymentSchema= new mongoose.Schema({

    UserId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    orderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Order',
        required:true
    },
    amount:{
        type:Number,
        required:true
    },
    status:{
        type:String,
        required:true,
        enum:['pending','completed','failed']
    },
    
    paymentMethod:{
        type:String,
        required:true,
        enum: ['COD',"Razorpay",'credit','Wallet']
    },
    transactionId:{
        type:String,
     
    }
},
{
    timestamps:true
})


module.exports=mongoose.model('Payment',paymentSchema)