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

//------------------------------------------------- CART --------------------------------------------------------------------------//

const renderCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    const cartItems = await CartItem.find({ userId: userId }).populate("product.productId");
    
    const isEmptyCart = cartItems.length === 0;

    res.render("cart", {
      cartItems: cartItems,
      userData: userData,
      user: userData,
      isEmptyCart: isEmptyCart
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};


const calculateDiscountedPrice = async (product) => {
  let discount = 0;

  const productOffer = await ProductOffer.findOne({ productId: product._id, is_active: true, startDate: { $lte: new Date() }, endDate: { $gte: new Date() } });
  if (productOffer) {
    discount = productOffer.discount;
  } else {
    const categoryOffer = await CategoryOffer.findOne({ categoryId: product.category, is_active: true, startDate: { $lte: new Date() }, endDate: { $gte: new Date() } });
    if (categoryOffer) {
      discount = categoryOffer.discount;
    }
  }

  return product.price - (product.price * (discount / 100));
};

//--------------------------------------------------- ADD TO CART ---------------------------------------------------------------//

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId } = req.query;
    const product = await Product.findById(productId);
    const discountedPrice = await calculateDiscountedPrice(product);

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
            offerDiscount: discountedPrice < product.price ? product.price - discountedPrice : 0,
            totalPrice: discountedPrice,
            price: discountedPrice,
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
    res.status(500).send("Internal Server Error");
  }
};

//--------------------------------------------------- UPDATE CART ---------------------------------------------------------------//

const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId, quantityChange } = req.body;

    // console.log("Received update request", { userId, productId, quantityChange });

    if (!userId || !productId || quantityChange === undefined) {
      // console.log("Missing required fields", { userId, productId, quantityChange });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const cartItems = await CartItem.find({ userId }).populate("product.productId");

    if (!cartItems || cartItems.length === 0) {
      // console.log("No cart items found for the user", { userId });
      return res.status(404).json({ error: "No cart items found for the user" });
    }

    const cartItemToUpdate = cartItems.find((item) => item.product[0].productId.toString() === productId);

    if (!cartItemToUpdate) {
      // console.log("Cart item not found", { userId, productId });
      return res.status(404).json({ error: "Cart item not found" });
    }

    const product = cartItemToUpdate.product[0];
    const newQuantity = product.quantity + parseInt(quantityChange);

    if (newQuantity > product.productId.stock) {
      // console.log("Insufficient product stock", { newQuantity, stock: product.productId.stock });
      return res.status(400).json({ error: "Insufficient product stock" });
    } else if (newQuantity < 1) {
      // console.log("Quantity cannot be less than 1", { newQuantity });
      return res.status(400).json({ error: "Quantity cannot be less than 1" });
    }

    const discountedPrice = await calculateDiscountedPrice(product.productId);
    const newPrice = discountedPrice * newQuantity;

    const updatedCartItem = await CartItem.findOneAndUpdate(
      { _id: cartItemToUpdate._id, "product.productId": product.productId },
      {
        $inc: { "product.$.quantity": quantityChange },
        $set: { "product.$.totalPrice": newPrice },
      },
      { new: true }
    );

    if (!updatedCartItem) {
      // console.log("Failed to update cart item", { userId, productId });
      return res.status(500).json({ error: "Failed to update cart item" });
    }

    const updatedCartItems = await CartItem.find({ userId }).populate("product.productId");

    // console.log("Cart items updated successfully", { userId, updatedCartItems });

    res.status(200).json({
      message: "Cart items updated successfully",
      cartItems: updatedCartItems,
    });
  } catch (error) {
    console.error("Error updating cart item:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//--------------------------------------------------- REMOVE FROM CART ---------------------------------------------------------------//

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

//--------------------------------------------------- CHECKOUT PAGE ---------------------------------------------------------------//

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
    let discountPercentage = 0;

    if (req.session.coupon) {
      const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
      if (coupon) {
        couponDiscount = coupon.discountAmount;
        finalOrderAmount = orderAmount - couponDiscount;
        if (finalOrderAmount > 0) {
          discountPercentage = Math.round((couponDiscount / orderAmount) * 100);
        }
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
          const discountedPrice = totalProductAmount - ((discountPercentage / 100) * totalProductAmount);
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
          const discountedPrice = totalProductAmount - ((discountPercentage / 100) * totalProductAmount);
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

      if (req.session.coupon) {
        const coupon = await Coupon.findOne({ couponCode: req.session.coupon });
        if (coupon) {
          couponDiscount = coupon.discountAmount;
          finalOrderAmount = orderAmount - couponDiscount;
        }
      }

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const shippingDate = `${year}-${month.toString().padStart(2, "0")}`;

      const newOrder = new Order({
        userId,
        coupon: req.session.coupon || null,
        couponDiscount,
        cartId: cartItems.map((item) => item._id),
        orderedItem: cartItems.map((item) => ({
          productId: item.product[0].productId,
          quantity: item.product[0].quantity,
          totalProductAmount: item.product[0].totalPrice,
        })),
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

//-------------------------------------------------------RETURN ORDER --------------------------------------------------------//

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { orderId, returnReason } = req.body;

    const order = await Order.findOne({
      userId: userId,
      'orderedItem._id': orderId
    });

    if (order) {
      const orderedItem = order.orderedItem.find(item => item._id.toString() === orderId);

      if (orderedItem) {
        if (orderedItem.orderStatus === 'delivered') {
          orderedItem.orderStatus = 'returned';
          order.returnReason = returnReason;

          // Calculate refund amount based on order total amount
          const refundAmount = order.orderAmount;

          // Increase product stock
          const product = await Product.findById(orderedItem.productId);
          if (product) {
            product.stock += orderedItem.quantity; 
            await product.save();
          }

          // Refund wallet balance
          const wallet = await Wallet.findOne({ userId: userId });
          if (wallet) {
            const refundTransaction = {
              amount: refundAmount,
              transactionMethod: "Refund",
              formattedDate: new Date().toISOString()
            };
            wallet.balance += refundAmount;
            wallet.transaction.push(refundTransaction);
            await wallet.save();
          } else {
            req.flash('error', 'Wallet not found');
            return res.status(404).json({ error: 'Wallet not found' });
          }

          await order.save();

          res.status(200).json({ success: true, message: 'Return request processed successfully', refundAmount });
        } else {
          res.status(400).json({ success: false, message: 'Order status is not eligible for return' });
        }
      } else {
        res.status(404).json({ success: false, message: 'Ordered item not found' });
      }
    } else {
      res.status(404).json({ success: false, message: 'Order not found' });
    }
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

//-------------------------------------------------------ORDER FULL DETAILS --------------------------------------------------------//

const renderFullDetails = async (req, res) => {
  try {
    // console.log(req.params);
    const userId = req.session.user_id;
    const userData = await User.findById(userId);
    const orderId = req.query.id;
    // console.log(orderId);
    const orders = await Order.findOne({
      userId: userId,
      _id: orderId,
    }).populate("orderedItem.productId")
    .populate('deliveryAddress')
    // console.log(orders);
    res.render("orderFullDetails", { user: userId, orders: orders ,user:userData});
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------CANCEL ORDER --------------------------------------------------------//

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { itemId, cancelReason } = req.body;

    // console.log(`Cancel order request received for userId: ${userId}, itemId: ${itemId}, cancelReason: ${cancelReason}`);

    const order = await Order.findOne({
      userId: userId,
      'orderedItem._id': itemId
    });

    if (!order) {
      req.flash('error', 'Order not found');
      // console.error('Order not found for userId:', userId, 'itemId:', itemId);
      return res.status(404).json({ error: 'Order not found' });
    }

    const item = order.orderedItem.id(itemId);

    if (item.orderStatus !== 'pending' && item.orderStatus !== 'approved') {
      // console.error('Order status not eligible for cancellation for itemId:', itemId);
      return res.status(400).json({ error: 'Order status is not eligible for cancellation' });
    }

    item.orderStatus = 'Cancellation Request Sent';
    item.cancelReason = cancelReason;

    const product = await Product.findById(item.productId);
    if (product) {
      product.stock += item.quantity;
      await product.save();
      console.log('Product stock updated for productId:', item.productId);
    }

    const wallet = await Wallet.findOne({ userId: userId });
    if (!wallet) {
      console.error('Wallet not found for userId:', userId);
      req.flash('error', 'Wallet not found');
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const refundAmount = +item.totalProductAmount;

    // Log the current wallet balance and refund amount
    // console.log('Current wallet balance:', wallet.balance, 'Refund amount:', refundAmount);

    // Ensure wallet balance update handles zero balance correctly
    wallet.balance = (wallet.balance || 0) + refundAmount;

    const refundTransaction = {
      amount: refundAmount,
      transactionMethod: "Refund",
      formattedDate: new Date().toISOString()
    };

    wallet.transaction.push(refundTransaction);
    await wallet.save();
    // console.log('Wallet updated successfully for userId:', userId, 'New balance:', wallet.balance);

    await order.save();
    // console.log('Order updated successfully for orderId:', order._id);

    req.flash('success', 'Cancellation request sent successfully');
    return res.status(200).json({ success: true, message: 'Cancellation request sent successfully' });
  } catch (error) {
    console.error('Error cancelling order item:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


//-------------------------------------------------------WISHLIST --------------------------------------------------------//

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

//-------------------------------------------------------ADD TO WISHLIST --------------------------------------------------------//

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

//-------------------------------------------------------REMOVE FROM WISHLIST --------------------------------------------------------//

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

//-------------------------------------------------------Add MONEY TO WALLET --------------------------------------------------------//

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
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body.response;
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

//-------------------------------------------------------PLACE ORDER TO WALLET --------------------------------------------------------//

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

//-------------------------------------------------------RETRY ORDER --------------------------------------------------------//

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

//-------------------------------------------------------USER DASHBOARD --------------------------------------------------------//

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

//-------------------------------------------------------THANKYOU --------------------------------------------------------//

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
    const { orderId, itemId } = req.query;
    const userId = req.session.user_id;

    // Find the order
    const order = await Order.findById(orderId)
      .populate('deliveryAddress')
      .populate('orderedItem.productId')
      .populate('userId');

    if (!order) {
      return res.status(400).send('Invalid order ID');
    }

    // Find the specific item in the order
    const orderedItem = order.orderedItem.find(item => item._id.toString() === itemId);
    if (!orderedItem) {
      return res.status(400).send('Invalid item ID');
    }

    // Retrieve the coupon discount
    const couponDiscount = order.couponDiscount || 0;

    const generateInvoiceNumber = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `invoice_${generateInvoiceNumber()}.pdf`;
    const filePath = path.join(__dirname, '../invoice', fileName);

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc
      .fontSize(20)
      .text('Modern Furniture', { align: 'center' })
      .moveDown()
      .fontSize(12)
      .text(`Invoice Number: ${generateInvoiceNumber()}`, { align: 'right' })
      .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' })
      .moveDown();

    doc
      .fontSize(12)
      .text('Delivery Address:', { underline: true })
      .moveDown(0.5)
      .text(`Name: ${order.userId.name}`)
      .text(`Mobile: ${order.userId.mobile}`)
      .text(`Street Address: ${order.deliveryAddress.address}`)
      .text(`City: ${order.deliveryAddress.city}`)
      .text(`State: ${order.deliveryAddress.state}`)
      .text(`Pincode: ${order.deliveryAddress.zipcode}`)
      .moveDown();

    const tableTop = doc.y;
    doc
      .text('Product Name', 50, tableTop)
      .text('Quantity', 200, tableTop)
      .text('Unit Price', 300, tableTop)
      .text('Total Price', 400, tableTop)
      .text('Offer', 500, tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke()
      .moveDown();

    const totalAmount = order.orderedItem.reduce((acc, item) => acc + item.productId.price * item.quantity, 0);

    const yPosition = doc.y;
    const actualUnitPrice = orderedItem.productId.price;
    const totalProductAmount = actualUnitPrice * orderedItem.quantity;
    const offerAmount = totalProductAmount - orderedItem.totalProductAmount;

    const discountShare = (totalProductAmount / totalAmount) * couponDiscount;
    const discountedPrice = totalProductAmount - discountShare;

    doc
      .text(orderedItem.productId.name, 50, yPosition, { width: 150 })
      .text(orderedItem.quantity.toString(), 200, yPosition)
      .text(`Rs ${actualUnitPrice.toFixed(2)}`, 300, yPosition)
      .text(`Rs ${totalProductAmount.toFixed(2)}`, 400, yPosition)
      .text(`Rs ${offerAmount.toFixed(2)}`, 500, yPosition)
      .moveDown();

    const summaryTop = doc.y + 20;
    doc
      .moveTo(50, summaryTop)
      .lineTo(550, summaryTop)
      .stroke()
      .moveDown();

    const subtotal = totalProductAmount;
    const discount = discountShare;
    const finalAmount = subtotal - discount - offerAmount;

    doc
      .text('Subtotal', 350, summaryTop + 15)
      .text(`Rs ${subtotal.toFixed(2)}`, 450, summaryTop + 15)
      .text('Coupon Discount', 350, summaryTop + 35)
      .text(`Rs ${discount.toFixed(2)}`, 450, summaryTop + 35)
      .text('Offer Amount', 350, summaryTop + 55)
      .text(`Rs ${offerAmount.toFixed(2)}`, 450, summaryTop + 55)
      .text('Grand Total', 350, summaryTop + 75)
      .text(`Rs ${finalAmount.toFixed(2)}`, 450, summaryTop + 75)
      .moveDown(2);

    doc
      .fontSize(10)
      .text('Thank you for your business.', { align: 'center' })
      .moveDown();

    doc.end();

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

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};


//---------------------------------------------------------- APPLY COUPON -----------------------------------------------------------//

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, originalTotal } = req.body;
    // console.log(`Received coupon code: ${couponCode}`);
    // console.log(`Original total: ${originalTotal}`);
    const coupon = await Coupon.findOne({ couponCode });
    // console.log(`Coupon found: ${coupon}`);

    if (!coupon) {
      return res.json({ success: false, message: 'Invalid coupon code.' });
    }

  
    if (originalTotal < coupon.minimumAmount) {
      return res.json({ success: false, message: `Coupon requires a minimum purchase of ₹${coupon.minimumAmount}.` });
    }

   
    req.session.coupon = couponCode;
    const discountAmount = coupon.discountAmount;
    const newTotal = originalTotal - discountAmount;
    res.json({ success: true, discountAmount, newTotal });

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

//---------------------------------------------------------- REMOVE COUPON -----------------------------------------------------------//

const removeCoupon = (req, res) => {
  try {
    req.session.coupon = null;

    const { originalTotal } = req.body;

    res.json({ success: true, discountAmount: 0, newTotal: originalTotal });
  } catch (error) {
    console.error('Error removing coupon:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

//---------------------------------------------------------- SHOW COUPONS -----------------------------------------------------------//

const showCoupons = async (req, res) => {
  // console.log('Fetching coupons from database...');
  try {
    const coupons = await Coupon.find({});
    // console.log('Coupons found:', coupons);
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

const showAllCoupons= async (req, res) => {
  try {
    const coupons = await Coupon.find({});
    res.json({ success: true, coupons });
  } catch (error) {
    res.json({ success: false, message: 'Failed to fetch coupons' });
  }
};


module.exports = {
  renderCart,
  addToCart,
  removeFromCart,
  updateCartItem,

  checkoutPage,
  renderPlaceOrder,
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
    loadInvoice,
    applyCoupon,
    handleFailedRazorpayPayment,
    removeCoupon,
    showCoupons,
    razorPayRetryPayment,
    verifyRetryPayment,
    showAllCoupons
};
