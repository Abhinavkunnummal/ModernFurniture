const User = require("../model/userModel");
const Order = require("../model/order");
const Product = require("../model/product");
const CartItem = require("../model/cart");
const userController = require("../controller/userController1");
const Address = require("../model/address");
const Wishlist = require("../model/wishlist");

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "RAZORPAY_KEY_ID",
  key_secret: "RAZORPAY_KEY_SECRET",
});

const renderCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    const cartItems = await CartItem.find({ userId: userId }).populate(
      "product.productId"
    ); // Corrected typo here
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
    console.log(productId);
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

    // Assuming your CartItem schema contains userId and productId fields
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
    console.log(`userId is ${userId}`);
    const { productId, quantityChange } = req.body;
    console.log(
      `product id is ${productId}     quantity chane is ${quantityChange}`
    );
    const cartItems = await CartItem.find({ userId }).populate(
      "product.productId"
    );

    if (!cartItems || cartItems.length === 0) {
      return res
        .status(404)
        .json({ error: "No cart items found for the user" });
    }

    const cartItemToUpdate = cartItems.find(
      (item) => item.product[0].productId.toString() === productId
    );

    if (!cartItemToUpdate) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const product = cartItemToUpdate.product[0];
    const newQuantity = product.quantity + parseInt(quantityChange);

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

    const updatedCartItems = await CartItem.find({ userId }).populate(
      "product.productId"
    );
    res
      .status(200)
      .json({
        message: "Cart items updated successfully",
        cartItems: updatedCartItems,
      });
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
    const cartItems = await CartItem.find({ userId }).populate(
      "product.productId"
    );

    if (!selectedAddress) {
      req.flash("errmsg", "Please choose a delivery address");
      return res.redirect("/checkout");
    } else if (!paymentMethod) {
      req.flash("errmsg", "Please choose a payment option");
      return res.redirect("/checkout");
    }

    let orderAmount = 0;
    cartItems.forEach((item) => {
      orderAmount += item.product[0].totalPrice;
    });

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const shippingDate = `${year}-${month.toString().padStart(2, "0")}`;

    const newOrder = new Order({
      userId: userId,
      cartId: cartItems.map((item) => item._id),
      orderedItem: cartItems.map((item) => ({
        productId: item.product[0].productId,
        quantity: item.product[0].quantity,
        totalProductAmount: item.product[0].totalPrice,
      })),
      orderAmount: orderAmount,
      deliveryAddress: selectedAddress,
      shippingDate: shippingDate,
      orderStatus: "pending",
      paymentMethod: paymentMethod,
      paymentStatus: false,
    });

    await newOrder.save();

    // Decrease quantity from the inventory
    for (const item of cartItems) {
      const product = item.product[0].productId;
      const quantity = item.product[0].quantity;

      const updatedProduct = await Product.updateOne(
        { _id: product },
        { $inc: { stock: -quantity } }
      );

      // Log the result of the quantity update
      console.log(
        `Product ID: ${product}, Decreased by: ${quantity}, Update Result:`,
        updatedProduct
      );
    }

    await CartItem.deleteMany({ userId });

    res.render("thankyou");
  } catch (error) {
    console.error("Error in renderPlaceOrder:", error.message);
    res.status(500).send("Server Error");
  }
};

//***************************************************ORDER DETAILS***************************************************************/
const renderOrders = async (req, res) => {
  try {
    const userId = req.session.user_id;
    await User.findById(userId);
    const orders = await Order.find({ userId: userId }).populate(
      "orderedItem.productId"
    );
    res.render("orders", { user: userId, userId: userId, orders: orders });
  } catch (error) {
    console.log(error.message);
  }
};

const renderFullDetails = async (req, res) => {
  try {
    // console.log(req.params);
    const userId = req.session.user_id;
    const orderId = req.query.id;
    console.log(orderId);
    const orders = await Order.findOne({
      userId: userId,
      _id: orderId,
    }).populate("orderedItem.productId");
    console.log(orders);
    res.render("orderFullDetails", { user: userId, orders: orders });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

//*******************************************- Razor Pay -************************************************************************/

const razorpayPayment = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.session.user }); // Adjust according to your session management
    const amount = req.body.amount * 100; // Convert amount to paise

    const options = {
      amount: amount,
      currency: "INR",
      receipt: "receipt_" + Math.floor(Math.random() * 1000000), // Unique receipt ID
    };

    instance.orders.create(options, (err, order) => {
      if (!err) {
        res.json({
          success: true,
          orderId: order.id,
          amount: amount,
          keyId: process.env.RAZORPAY_KEY_ID,
          name: user.fullName,
          email: user.email,
        });
      } else {
        console.error("Error creating order:", err);
        res
          .status(500)
          .json({ success: false, message: "Failed to create order" });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const renderWishlist = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const user = await User.findById(userId); // Assuming you have a User model

    // Fetch wishlist items for the user
    const wishlist = await Wishlist.findOne({ userId }).populate(
      "product.productId"
    );

    if (!wishlist) {
      // If the wishlist is not found, render the wishlist template with an empty array
      res.render("wishlist", { user: user, wishlistItems: [] });
      return;
    }

    res.render("wishlist", { user: user, wishlistItems: wishlist.product });
  } catch (error) {
    console.log(error.message);
    // Handle the error appropriately
  }
};

const addToWishList = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.productId;
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      // If no wishlist exists, create a new one
      wishlist = new Wishlist({ userId, product: [{ productId }] });
    } else {
      // If wishlist exists, check if the product is already in the wishlist
      const productIndex = wishlist.product.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (productIndex === -1) {
        // If the product is not in the wishlist, add it
        wishlist.product.push({ productId });
      } else {
        // If the product is already in the wishlist, you may want to handle this case appropriately
        console.log("Product already exists in the wishlist");
      }
    }

    await wishlist.save();
    res.redirect("/wishlist");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
};

const removeFromWishList = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.body.productId;
    console.log(userId + productId);

    let a = await Wishlist.findOneAndUpdate(
      { userId: userId, "product.productId": productId },
      { $pull: { product: { productId: productId } } }
    );
    console.log(a + "dmfijhfdihifdjjdfdfi");
    if (a) {
      res.json({ success: true });
    }
    
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
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

  razorpayPayment,

  renderWishlist,
  addToWishList,
  removeFromWishList,
};
