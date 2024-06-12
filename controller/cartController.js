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

// controllers/walletController.js
const Wallet=require('../model/wallet')


const Razorpay = require("razorpay");


const renderCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    const cartItems = await CartItem.find({ userId: userId }).populate("product.productId");
    res.render("cart", {
      cartItems: cartItems,
      userData: userData,
      user: userData,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId } = req.query;
    const product = await Product.findById(productId);
    const price = product.price;

    let cartItem = await CartItem.findOne({
      userId: userId,
      "product.productId": productId,
    });
    if (!cartItem) {
      cartItem = new CartItem({
        userId: userId,
        product: [
          {
            productId: productId,
            quantity: 1,
            offerDiscount: 0,
            totalPrice: price,
            price: price,
          },
        ],
      });
    } else {
      return res.redirect("/cart");
    }
    await cartItem.save();
    return res.redirect("/cart");
  } catch (error) {
    console.log(error.message);
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId } = req.query;

    await CartItem.deleteOne({
      userId: userId,
      "product.productId": productId,
    });
    res.redirect("/cart");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId, quantityChange } = req.body;

    // Retrieve the cart items with product information including stock
    const cartItems = await CartItem.find({ userId }).populate("product.productId");

    if (!cartItems || cartItems.length === 0) {
      return res.status(404).json({ error: "No cart items found for the user" });
    }

    const cartItemToUpdate = cartItems.find((item) => item.product[0].productId.toString() === productId);

    if (!cartItemToUpdate) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const product = cartItemToUpdate.product[0];
    const newQuantity = product.quantity + parseInt(quantityChange);

    // Check if the requested quantity exceeds the product stock
    if (newQuantity > product.productId.stock) {
      return res.status(400).json({ error: "Insufficient product stock" });
    }else{
      if (newQuantity < 1) {
        return res.status(400).json({ error: "Quantity cannot be less than 1" });
      }
  
      const newPrice = product.price * newQuantity;
  
      const updatedCartItem = await CartItem.findOneAndUpdate(
        { _id: cartItemToUpdate._id, "product.productId": product.productId },
        {
          $inc: { "product.$.quantity": quantityChange },
          $set: { "product.$.totalPrice": newPrice },
        },
        { new: true }
      );
  
      const updatedCartItems = await CartItem.find({ userId }).populate("product.productId");
  
      res.status(200).json({
        message: "Cart items updated successfully",
        cartItems: updatedCartItems,
      });
    }

    
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    const updateCartItems = await CartItem.find({ userId }).populate(
      "product.productId"
    );
    const availableAddress = await Address.find({
      userId: req.session.user_id,
    });
    let errmsg = req.flash("errmsg");
    res.render("checkout", {
      user: userData,
      address: availableAddress,
      cartItems: updateCartItems,
      errmsg,
    });
  } catch (error) {
    console.log(error.message);
  }
};

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

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
      if (coupon) {
        const discountAmount = coupon.discountAmount;
        finalOrderAmount = orderAmount - discountAmount;
      }
    }

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
        cartId: cartItems.map((item) => item._id),
        orderedItem: cartItems.map((item) => ({
          productId: item.product[0].productId,
          quantity: item.product[0].quantity,
          totalProductAmount: item.product[0].totalPrice,
        })),
        orderAmount: finalOrderAmount,
        deliveryAddress: selectedAddress,
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

      return res.json({ success: true });
    } else {
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
        orderStatus: "pending",
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? false : true,
      });

      await newOrder.save();

      for (const item of cartItems) {
        const product = item.product[0].productId;
        const quantity = item.product[0].quantity;
        await Product.updateOne({ _id: product }, { $inc: { stock: -quantity } });
      }

      await CartItem.deleteMany({ userId });

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
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const shippingDate = `${year}-${month.toString().padStart(2, "0")}`;

      const newOrder = new Order({
        userId,
        cartId: cartItems.map((item) => item._id),
        orderedItem: cartItems.map((item) => ({
          productId: item.product[0].productId,
          quantity: item.product[0].quantity,
          totalProductAmount: item.product[0].totalPrice,
        })),
        orderAmount,
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

      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Error in verifyPayment:', error.message);
    return res.status(500).send('Server Error');
  }
};


//***************************************************ORDER DETAILS***************************************************************/
const renderOrders = async (req, res) => {
  try {
    const userId = req.session.user_id;


    const user = await User.findById(userId);

    const orders = await Order.find({ userId: userId })
      .populate("orderedItem.productId");

    res.render("orders", {
      user: user,
      userId: userId,
      orders: orders
    });
  } catch (error) {
    console.log(error.message);
    res.render("orders", {
      user: null,
      userId: null,
      orders: [],
      messages: { error: "Error fetching orders." }
    });
  }
};

const returnOrder=async (req, res) => {
  try {
      const { itemId, returnReason } = req.body;
    console.log(itemId+"itemId",returnReason+"return Reason");

      const order = await Order.findOne({ 'orderedItem._id': itemId });

      if (!order) {
          return res.status(404).json({ message: 'Order not found' });
      }

      const item = order.orderedItem.id(itemId);
      console.log(item);

      if (!item) {
          return res.status(404).json({ message: 'Ordered item not found' });
      }
      item.orderStatus = 'Returned';
      item.returnReason = returnReason;

      await order.save();

      res.status(200).json({ message: 'Return request submitted successfully' });
  } catch (error) {
      console.error('Error processing return request:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
}

const renderFullDetails = async (req, res) => {
  try {
    // console.log(req.params);
    const userId = req.session.user_id;
    const orderId = req.query.id;
    // console.log(orderId);
    const orders = await Order.findOne({
      userId: userId,
      _id: orderId,
    }).populate("orderedItem.productId")
    .populate('deliveryAddress')
    // console.log(orders);
    res.render("orderFullDetails", { user: userId, orders: orders });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};




const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const itemId = req.query.id;

    const order = await Order.findOne({
      userId: userId,
      'orderedItem._id': itemId
    });

    if (!order) {
      req.flash('error', 'Order not found');
      return res.status(404).json({ error: 'Order not found' });
    }

    const item = order.orderedItem.id(itemId);
    item.orderStatus = 'cancelled';

    const product = await Product.findById(item.productId);
    if (product) {
      product.stock += item.quantity; // Increase the product stock
      await product.save();
    }

    const wallet = await Wallet.findOne({ userId: userId });
    const refundAmount = +item.totalProductAmount;

    if (wallet) {
      const refundTransaction = {
        amount: refundAmount,
        transactionMethod: "Refund",
        formattedDate: new Date().toISOString()
      };
      wallet.balance += refundAmount;
      wallet.transaction.push(refundTransaction);
      await wallet.save();
      console.log('Updated wallet:', await Wallet.findOne({ userId: userId }));
    } else {
      req.flash('error', 'Wallet not found');
      return res.status(404).json({ error: 'Wallet not found' });
    }

    await order.save();

    req.flash('success', 'Order item cancelled successfully');
    return res.redirect('/orders');
  } catch (error) {
    console.error('Error cancelling order item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};




//*******************************************- Razor Pay -************************************************************************/


const renderWishlist = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId);

   
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "product.productId"
    );

    if (!wishlist) {
      res.render("wishlist", { user: user, wishlistItems: [] });
      return;
    }

    res.render("wishlist", { user: user, wishlistItems: wishlist.product });
  } catch (error) {
    console.log(error.message);
  }
};

const addToWishList = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.productId;
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, product: [{ productId }] });
    } else {
      const productIndex = wishlist.product.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (productIndex === -1) {
        wishlist.product.push({ productId });
      } else {
        return res.json({ success: false, message: 'Product already in wishlist' });
      }
    }

    await wishlist.save();
    res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


const removeFromWishList = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.body.productId;
    // console.log(userId + productId);

    let a = await Wishlist.findOneAndUpdate(
      { userId: userId, "product.productId": productId },
      { $pull: { product: { productId: productId } } }
    );
    // console.log(a + "dmfijhfdihifdjjdfdfi");
    if (a) {
      res.json({ success: true });
    }
    
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
};


//******************************************************Wallet********************************************************************/

const renderWallet = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userdata = await User.findOne({ _id: userId });
    const WalletDetails = await Wallet.findOne({ userId: userId });

    if (WalletDetails) {
      const formattedTransactions = WalletDetails.transaction.map(transaction => {
        const formattedDate = moment(transaction.formattedDate).format('YYYY-MM-DD'); 
        return {
         ...transaction.toObject(),
          formattedDate,
        };
      }).sort((a, b) => b._id - a._id);

      const formattedWallet = {
       ...WalletDetails.toObject(),
        transaction: formattedTransactions,
      };

     
      formattedWallet.currentBalance = WalletDetails.balance;

      res.render('wallet', { WalletDetails: formattedWallet, user: userdata });
    } else {
      res.render('wallet', { WalletDetails: null, user: userdata });
    }
  } catch (error) {
    console.error('Error rendering wallet:', error);
    res.status(500).json({ message: error.message });
  }
};


  const addFunds = async (req, res) => {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    try {
        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret:process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: req.body.amount * 100, 
            currency: 'INR',
        };

        instance.orders.create(options, (error, order) => {
            if (error) {
                console.error('Error creating order:', error);
                return res.status(500).json({ message: 'Something went wrong' });
            } else {
                res.status(200).json({
                    success: true,
                    msg: 'Order created successfully',
                    orderId: order.id,
                    amount: req.body.amount * 100, 
                    product_name: 'Add funds',
                    description: 'Test Transaction'
                });
            }
        });
    } catch (error) {
        console.error('Error adding amount to wallet:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const moment = require('moment');
const fundVerification = async (req, res) => {
  try {
    // console.log('Verification process started');
    // console.log('Session:', req.session); 
    // console.log('User ID:', req.session.user_id);

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body.response;
    // console.log('Razorpay Order ID:', razorpay_order_id);
    // console.log('Razorpay Payment ID:', razorpay_payment_id);
    // console.log('Razorpay Signature:', razorpay_signature);

    const isValid = true; 

    if (isValid) {
      const userId = req.session.user_id; 
      // console.log('User ID:', userId);


      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: req.body.amount,
          transaction: [] 
        });
      } else {
        wallet.balance += parseFloat(req.body.amount);
      }

      wallet.transaction.push({
        amount: parseFloat(req.body.amount), 
        transactionMethod: 'Razorpay',
        formattedDate: moment().format()
      });

      await wallet.save();

      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};





const addToWallet = async (req, res) => {
  try {
    const { Amount } = req.body;
    const userId = req.session.user_id;

    let WalletDetail = await Wallet.findOne({ userId: userId });

    if (!WalletDetail) {
      const newWallet = new Wallet({
        userId: userId,
        balance: Amount,
        transaction: [{
          amount: Amount,
          transactionsMethod: 'Credit',
        }],
      });

      await newWallet.save();

    } else {
      await Wallet.updateOne({ userId: userId }, {
        $inc: { balance: Amount },
        $push: { transaction: { amount: Amount, transactionsMethod: 'Credit' } },
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding to wallet:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const placeOrderWallet = async (req, res) => {
  try {
    const { selectedAddressValue, paymentOptionValue } = req.body;

    if (!selectedAddressValue) {
      return res.json({ success: false, message: 'Please select an address' });
    }

    const userId = req.session.user_id;
    const cartItems = await Cart.find({ userId: userId });

    const orderedItems = cartItems.map(item => ({
      productId: item.product.productId,
      quantity: item.product.quantity,
      totalPrice: item.product.price * item.product.quantity,
    }));

    const Amount = cartItems.reduce((total, item) => total + (item.product.price * item.product.quantity), 0);
    const coupon = req.session.couponAmount || 0;

    const walletUpdate = await Wallet.updateOne({ userId: userId }, {
      $inc: { balance: -Amount },
      $push: { transaction: { amount: Amount, transactionsMethod: 'Wallet' } },
    });

    for (let item of orderedItems) {
      const { productId, quantity } = item;
      await Product.updateOne({ _id: productId }, { $inc: { quantity: -quantity } });
    }

    const order = new Order({
      userId: userId,
      cartId: cartItems.map(item => item._id),
      orderedItem: orderedItems,
      orderAmount: Amount,
      deliveryAddress: selectedAddressValue,
      paymentMethod: paymentOptionValue,
      orderStatus: 'pending',
      coupon: coupon,
    });

    await order.save();
    await Cart.deleteMany({ userId: userId });

    if (paymentOptionValue === 'Wallet') {
      const payment = new Payment({
        UserId: userId,
        orderId: order._id,
        amount: Amount,
        status: 'pending',
        paymentMethod: paymentOptionValue,
      });
      await payment.save();
    }

    res.status(200).json({ success: true, orderId: order._id });
  } catch (error) {
    console.error('Error adding order details:', error);
    res.status(500).json({ success: false, message: 'Error adding order details' });
  }
};

const retry = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { orderId } = req.body;

    const order = await Order.findOne({ _id: orderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: order.orderAmount * 100,
      currency: 'INR',
    };

    instance.orders.create(options, (error, order) => {
      if (error) {
        console.error('Error creating order in retry:', error);
        return res.status(500).json({ message: 'Error in retrying order' });
      } else {
        res.status(200).json({
          success: true,
          msg: 'Retry success',
          orderId: order.id,
          amount: options.amount,
          key_id: process.env.RAZORPAY_KEY_ID,
          product_name: req.body.name,
          description: 'Test Transaction',
        });
      }
    });
  } catch (error) {
    console.error('Error in retry:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const retryPayment = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { orderId } = req.body;

    const order = await Order.findByIdAndUpdate(
      { _id: orderId, userId: userId },
      { $set: { paymentStatus: true } },
      { new: true }
    );

    if (order) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: 'Order not found or not updated' });
    }
  } catch (error) {
    console.error('Error in retry:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// User Dashboard
const renderUserDashboard = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    const WalletDetails = await Wallet.findOne({ userId: userId });

    const formattedTransactions = WalletDetails?.transaction.map(transaction => {
      return {
        ...transaction.toObject(),
        formattedDate: moment(transaction.date).format('YYYY-MM-DD'),
      };
    }).sort((a, b) => b._id - a._id);

    res.render('userDashboard', { userData, WalletDetails, transactions: formattedTransactions });
  } catch (error) {
    console.error('Error rendering user dashboard:', error);
    res.status(500).json({ message: error.message });
  }
};

const renderThankyou=async(req,res)=>{
  try{
    const userData = await User.findById(req.session.user_id)
    res.render('thankyou',{user:userData})
  }catch(error){
    console.log(error.message);
  }
}
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const loadInvoice = async (req, res) => {
  try {
    const { orderId } = req.query; // Retrieve order ID from the query parameters
    const userId = req.session.user_id;
    // Assuming you fetch order details from the database using the order ID
    const order = await Order.findById(orderId).populate('deliveryAddress').populate('orderedItem.productId').populate('userId');
    console.log('orderdata' + order);

    if (!order) {
      return res.status(400).send('Invalid order ID');
    }

    // Iterate over each item in the orderedItem array and generate an invoice for each item
    for (const item of order.orderedItem) {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `invoice_${item._id}.pdf`; // Use item._id as the file name
      const filePath = path.join(__dirname, '../invoice', fileName); // Update the file path here

      // Create a stream to write the file
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Invoice header
      doc
        .fontSize(20)
        .text('Modern Furniture', { align: 'center' })
        .moveDown()
        .fontSize(12)
        .text(`Invoice Number: ${item._id}`, { align: 'right' }) // Use item._id as the invoice number
        .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' })
        .moveDown();

      // Delivery address
      doc
        .fontSize(12)
        .text('Delivery Address:', { bold: true })
        .text(`Name: ${order.userId.name}`)
        .text(`Mobile: ${order.userId.mobile}`)
        .text(`Street Address: ${order.deliveryAddress.address}`)
        .text(`City: ${order.deliveryAddress.city}`)
        .text(`State: ${order.deliveryAddress.state}`)
        .text(`Pincode: ${order.deliveryAddress.zipcode}`)
        .moveDown();

      // Table headers
      doc
        .fontSize(12)
        .text('Items', 50, doc.y, { bold: true })
        .text('Product ID', 200, doc.y, { bold: true })
        .text('Quantity', 300, doc.y, { bold: true })
        .text('Sub Total', 400, doc.y, { bold: true })
        .moveDown();

      // Table row for the current item
      doc
        .fontSize(12)
        .text(item.productId.name, 50, doc.y)
        .text(item.productId._id, 200, doc.y)
        .text(item.quantity, 300, doc.y)
        .text(`$${item.totalProductAmount.toFixed(2)}`, 400, doc.y)
        .moveDown();

      // Subtotal and grand total (assuming only one item in this invoice)
      const subtotal = item.totalProductAmount;
      doc
        .fontSize(12)
        .text('Subtotal', 300, doc.y, { bold: true })
        .text(`$${subtotal.toFixed(2)}`, 400, doc.y)
        .moveDown()
        .fontSize(12)
        .text('Grand Total', 300, doc.y, { bold: true })
        .text(`$${subtotal.toFixed(2)}`, 400, doc.y)
        .moveDown(2);

      // Footer
      doc
        .fontSize(10)
        .text('Thank you for your business.', { align: 'center' })
        .moveDown();

      doc.end();

      // Send the file to the client
      writeStream.on('finish', () => {
        res.download(filePath, fileName, (err) => {
          if (err) {
            console.error('Error downloading the file', err);
            res.status(500).send('Error downloading the file');
          }
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('Error deleting the file', err);
            }
          });
        });
      });
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};




const applyCoupon = async (req, res) => {
  try {
      const { couponCode, originalTotal } = req.body;
      req.session.coupon= couponCode;
      console.log(`Received coupon code: ${couponCode}`);
      console.log(`Original total: ${originalTotal}`);

      // Find the coupon in the database
      const coupon = await Coupon.findOne({ couponCode });
      console.log(`Coupon found: ${coupon}`);

      if (!coupon) {
          return res.json({ success: false, message: 'Invalid coupon code.' });
      }

      // Calculate new total after applying the coupon
      const discountAmount = coupon.discountAmount;
      const newTotal = originalTotal - discountAmount;

      console.log(`Discount amount: ${discountAmount}`);
      console.log(`New total after applying coupon: ${newTotal}`);

      res.json({ success: true, discountAmount, newTotal });
  } catch (error) {
      console.error('Error applying coupon:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



module.exports = {
  renderCart,
  addToCart,
  // updateCartItemQuantity,
  removeFromCart,
  updateCartItem,

  checkoutPage,
  renderPlaceOrder,
  // placeOrder,
  renderOrders,
  renderFullDetails,
  renderThankyou,


  renderWishlist,
  addToWishList,
  removeFromWishList,

  renderWallet,
  addToWallet,
    addFunds,
    fundVerification,
    placeOrderWallet,
    retry,
    retryPayment,
    cancelOrder,
    renderUserDashboard,
    verifyPayment,
    returnOrder,
    // downloadInvoice
    loadInvoice,
    applyCoupon
};
