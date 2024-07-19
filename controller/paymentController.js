//Main
const User = require("../model/userModel");
const Order = require("../model/order");
const Product = require("../model/product");
const CartItem = require("../model/cart");
const userController = require("../controller/userController1");
const Address = require("../model/address");
const Wishlist = require("../model/wishlist");
const flash = require('connect-flash');
const crypto=require('crypto')
const Payment=require('../model/payment')
const Coupon=require('../model/coupon')
const ProductOffer=require('../model/productOffer')
const CategoryOffer=require('../model/categoryOffer')
const Wallet=require('../model/wallet')
const Razorpay = require("razorpay");






//--------------------------------------------------- PLACE ORDER ---------------------------------------------------------------//

const renderPlaceOrder = async (req, res) => {
    try {
      const { selectedAddress, paymentMethod } = req.body;
      const userId = req.session.user_id;
  
      if (!userId) {
        return res.redirect("/login");
      }
  
      const availableAddress = await Address.findOne({ userId });
      const cartItems = await CartItem.find({ userId }).populate("product.productId");
  
      if (!selectedAddress) {
        req.flash("errmsg", "Please choose a delivery address");
        return res.redirect("/checkout");
      } else if (!paymentMethod) {
        req.flash("errmsg", "Please choose a payment option");
        return res.redirect("/checkout");
      }
  
      const orderAmount = calculateOrderAmount(cartItems);
      let finalOrderAmount = orderAmount;
      let couponDiscount = 0;
  
      if (req.session.coupon) {
        const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
        if (coupon) {
          couponDiscount = coupon.discountAmount;
          finalOrderAmount = orderAmount - couponDiscount;
        }
      }
  
      const handlePostOrder = async (newOrder) => {
        await newOrder.save();
  
        for (const item of cartItems) {
          const product = item.product[0].productId;
          const quantity = item.product[0].quantity;
          await Product.updateOne({ _id: product }, { $inc: { stock: -quantity } });
        }
  
        await CartItem.deleteMany({ userId });
  
        if (req.session.coupon) {
          try {
            await Coupon.deleteOne({ couponCode: req.session.coupon });
            req.session.coupon = null;
            req.session.couponApplied = false;
          } catch (error) {
            console.error('Error deleting coupon:', error.message);
          }
        }
      };
  
      const proportionalDiscount = (itemTotal, orderTotal, discount) => {
        return itemTotal - ((itemTotal / orderTotal) * discount);
      };
  
      if (paymentMethod === 'razorPay') {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
  
        const options = {
          amount: finalOrderAmount * 100,
          currency: 'INR',
          receipt: `receipt_${new Date().getTime()}`,
        };
  
        const razorpayOrder = await razorpay.orders.create(options);
  
        return res.json({
          orderId: razorpayOrder.id,
          amount: finalOrderAmount,
          currency: 'INR',
        });
      } else if (paymentMethod === 'Wallet') {
        const wallet = await Wallet.findOne({ userId });
  
        if (wallet.balance < finalOrderAmount) {
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
  
        wallet.balance -= finalOrderAmount;
        wallet.transaction.push({
          amount: -finalOrderAmount,
          transactionMethod: "Debit",
          formattedDate: new Date().toISOString()
        });
  
        await wallet.save();
  
        const newOrder = new Order({
          userId,
          coupon: req.session.coupon || null,
          couponDiscount,
          cartId: cartItems.map((item) => item._id),
          orderedItem: cartItems.map((item) => {
            const totalProductAmount = item.product[0].totalPrice;
            const discountedPrice = Math.round(proportionalDiscount(totalProductAmount, orderAmount, couponDiscount));
            return {
              productId: item.product[0].productId,
              quantity: item.product[0].quantity,
              totalProductAmount: totalProductAmount,
              discountedPrice: discountedPrice,
            };
          }),
          orderAmount: finalOrderAmount,
          deliveryAddress: selectedAddress,
          orderStatus: "pending",
          paymentMethod,
          paymentStatus: true,
        });
  
        await handlePostOrder(newOrder);
        return res.json({ success: true });
      } else {
        const newOrder = new Order({
          userId,
          coupon: req.session.coupon || null,
          couponDiscount,
          cartId: cartItems.map((item) => item._id),
          orderedItem: cartItems.map((item) => {
            const totalProductAmount = item.product[0].totalPrice;
            const discountedPrice = proportionalDiscount(totalProductAmount, orderAmount, couponDiscount);
            return {
              productId: item.product[0].productId,
              quantity: item.product[0].quantity,
              totalProductAmount: totalProductAmount,
              discountedPrice: discountedPrice,
            };
          }),
          orderAmount: finalOrderAmount,
          deliveryAddress: selectedAddress,
          orderStatus: "pending",
          paymentMethod,
          paymentStatus: paymentMethod === 'cod' ? false : true,
        });
  
        await handlePostOrder(newOrder);
        return res.json({ success: true });
      }
    } catch (error) {
      console.error('Error in renderPlaceOrder:', error.message);
      return res.status(500).send('Server Error');
    }
  };
  
  
  
  function calculateOrderAmount(cartItems) {
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += item.product[0].totalPrice;
    });
    return totalAmount;
  }
  
  //------------------------------------------------------- VERIFY PAYMENT --------------------------------------------------------//
  const verifyPayment = async (req, res) => {
    try {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature, selectedAddress, paymentMethod } = req.body;
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
      const generatedSignature = hmac.digest('hex');
  
      if (generatedSignature === razorpaySignature) {
        const userId = req.session.user_id;
  
        const cartItems = await CartItem.find({ userId }).populate("product.productId");
        const orderAmount = calculateOrderAmount(cartItems);
        let finalOrderAmount = orderAmount;
        let couponDiscount = 0;
  
        // Apply coupon discount if available
        if (req.session.coupon) {
          const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
          if (coupon) {
            couponDiscount = coupon.discountAmount;
            finalOrderAmount = Math.max(orderAmount - couponDiscount, 0); // Ensure the final amount is not negative
          }
        }
  
        const proportionalDiscount = (itemTotal, orderTotal, discount) => {
          return itemTotal - ((itemTotal / orderTotal) * discount);
        };
  
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const shippingDate = `${year}-${month.toString().padStart(2, "0")}`;
  
        const newOrder = new Order({
          userId,
          coupon: req.session.coupon || null,
          couponDiscount,
          cartId: cartItems.map((item) => item._id),
          orderedItem: cartItems.map((item) => {
            const totalProductAmount = item.product[0].totalPrice;
            const discountedPrice = Math.round(proportionalDiscount(totalProductAmount, orderAmount, couponDiscount));
            return {
              productId: item.product[0].productId,
              quantity: item.product[0].quantity,
              totalProductAmount: totalProductAmount,
              discountedPrice: discountedPrice,
            };
          }),
          orderAmount: finalOrderAmount,
          deliveryAddress: selectedAddress,
          shippingDate,
          orderStatus: "pending",
          paymentMethod,
          paymentStatus: true,
        });
  
        await newOrder.save();
  
        for (const item of cartItems) {
          const product = item.product[0].productId;
          const quantity = item.product[0].quantity;
          await Product.updateOne({ _id: product }, { $inc: { stock: -quantity } });
        }
  
        await CartItem.deleteMany({ userId });
  
        if (req.session.coupon) {
          try {
            await Coupon.deleteOne({ couponCode: req.session.coupon });
            req.session.coupon = null;
            req.session.couponApplied = false;
          } catch (error) {
            console.error('Error deleting coupon:', error.message);
          }
        }
  
        return res.json({ success: true });
      } else {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    } catch (error) {
      console.error('Error in verifyPayment:', error.message);
      return res.status(500).send('Server Error');
    }
  };
  
  function calculateOrderAmount(cartItems) {
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += item.product[0].totalPrice;
    });
    return totalAmount;
  }
  
  
  
  //------------------------------------------------------- FAILED PAYMENT --------------------------------------------------------//
  
  const handleFailedRazorpayPayment = async (req, res) => {
    try {
      const { selectedAddress, paymentMethod } = req.body;
      const userId = req.session.user_id;
  
      const cartItems = await CartItem.find({ userId }).populate("product.productId");
      const orderAmount = calculateOrderAmount(cartItems);
      let finalOrderAmount = orderAmount;
  
      if (req.session.coupon) {
        const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
        if (coupon) {
          const discountAmount = coupon.discountAmount;
          finalOrderAmount = orderAmount - discountAmount;
        }
      }
  
      const newOrder = new Order({
        userId,
        coupon: req.session.coupon || null,
        cartId: cartItems.map((item) => item._id),
        orderedItem: cartItems.map((item) => ({
          productId: item.product[0].productId,
          quantity: item.product[0].quantity,
          totalProductAmount: item.product[0].totalPrice,
        })),
        orderAmount: finalOrderAmount,
        deliveryAddress: selectedAddress,
        orderStatus: "payment pending",
        paymentMethod,
        paymentStatus: false,
      });
  
      await newOrder.save();
  
      return res.json({ success: true });
    } catch (error) {
      console.error('Error in handleFailedRazorpayPayment:', error.message);
      return res.status(500).send('Server Error');
    }
  };
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  const razorPayRetryPayment = async (req, res) => {
    try {
      const { orderId, amount } = req.body;
  
    const order=await Order.findById(orderId)
      res.json({ success: true, orderId: order.id, amount: order.orderAmount });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Failed to create Razorpay order' });
    }
  };
  
  //------------------------------------------------------- VERIFY RETRY PAYMENT --------------------------------------------------------//
  
  const verifyRetryPayment = async (req, res) => {  
    try{
      const {orderId} = req.body;
      // console.log(orderId+'    abhiis the order id');
      const order=await Order.findOneAndUpdate({_id:orderId},{$set:{paymentStatus:true}})
      if(order){
        res.json({ success: true, order: order });
      }else{
        res.json({ success: false, error: 'Failed to verify payment' });
      }
      
    }catch(error){
      console.log(error.message);
    }
  }

  









  module.exports={
    verifyPayment,
    renderPlaceOrder,
    handleFailedRazorpayPayment,
    razorPayRetryPayment,
    verifyRetryPayment,
  }