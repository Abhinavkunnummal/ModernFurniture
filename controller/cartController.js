const User=require('../model/userModel')
const Order=require('../model/order')
const Product=require('../model/product')
const CartItem=require('../model/cart')
const userController = require('../controller/userController1');
const Address = require('../model/address');

const renderCart = async (req, res) => {
  try {
      const userId = req.session.user_id;
      if (!userId) {
          return res.redirect('/login');
      }

      const userData = await User.findById(userId);
      const cartItems = await CartItem.find({ userId: userId }).populate('product.productId'); // Corrected typo here
      res.render('cart', { cartItems: cartItems, userData: userData, user: userData });
  } catch (error) {
      console.log(error.message);
      res.status(500).send('Internal Server Error');
  }
};



const addToCart=async(req,res)=>{
    try{
        
        const userId=req.session.user_id;
        const {productId}=req.query;
        console.log(productId);
        const product=await Product.findById(productId)
        const price=product.price;
        
        let cartItem=await CartItem.findOne({userId:userId,"product.productId":productId})
        if(!cartItem){
            cartItem=new CartItem({
                userId:userId,
                product:[
                  {
                    productId:productId,
                    quantity:1,
                    offerDiscount:0,
                    totalPrice:price,
                    price:price,
                  }
                ]
            });
            } 
            else{
              return res.redirect('/cart');
            }
            await cartItem.save()
            return res.redirect('/cart');

    }catch(error){
        console.log(error.message);
    }
}


const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { productId } = req.query;

    // Assuming your CartItem schema contains userId and productId fields
    await CartItem.deleteOne({ userId: userId, "product.productId": productId });
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
    console.log(`product id is ${productId}     quantity chane is ${quantityChange}`);
    const cartItems = await CartItem.find({ userId }).populate("product.productId");

    if (!cartItems || cartItems.length === 0) {
      return res.status(404).json({ error: "No cart items found for the user" });
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
      { $inc: { "product.$.quantity": quantityChange }, $set: { "product.$.totalPrice": newPrice } },
      { new: true }
    );

    const updatedCartItems = await CartItem.find({ userId }).populate("product.productId");
    res.status(200).json({ message: "Cart items updated successfully", cartItems: updatedCartItems });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const checkoutPage=async(req,res)=>{
  try{
    const userId=req.session.user_id;
    const userData=await User.findById(userId)
    const updateCartItems=await CartItem.find({userId}).populate('product.productId')
    const availableAddress=await Address.find({userId:req.session.user_id})
    let errmsg = req.flash("errmsg")
    res.render('checkout',{user:userData,address:availableAddress,cartItems:updateCartItems,errmsg})
  }catch(error){
    console.log(error.message);
  }
}


const renderPlaceOrder = async (req, res) => {
  try {
    const { selectedAddress, paymentMethod } = req.body;
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect('/login');
    }
    const availableAddress = await Address.findOne({ userId });

    const cartItems = await CartItem.find({ userId }).populate('product.productId');
    if (!selectedAddress) {
      req.flash('errmsg', 'Please choose a delivery address');
      return res.redirect('/checkout');
    } else if (!paymentMethod) {
      req.flash('errmsg', 'Please choose a payment option');
      return res.redirect('/checkout');
    }
    let orderAmount = 0;
    cartItems.forEach((item) => {
      orderAmount += item.product[0].totalPrice;
    });

    const currentDate = new Date(); // Get the current date
const year = currentDate.getFullYear(); // Get the current year
const month = currentDate.getMonth() + 1; // Get the current month (Month is zero-based, so add 1)

// Format the shipping date as year-month (e.g., "2024-05")
const shippingDate = `${year}-${month.toString().padStart(2, '0')}`;

    const newOrder = new Order({
      userId: userId,
      cartId: cartItems.map((item) => item._id),
      orderedItem: cartItems.map((item) => ({
        productId: item.product[0].productId,
        quantity: item.product[0].quantity,
        totalProductAmount: item.product[0].totalPrice
      })),
      orderAmount: orderAmount,
      deliveryAddress: selectedAddress,
      shippingDate: shippingDate, // Assign formatted shipping date
      orderStatus: 'pending',
      paymentMethod: paymentMethod,
      paymentStatus: false
    });

    await newOrder.save();
    await CartItem.deleteMany({ userId });

    res.render('thankyou'); // Redirecting to the thank you page
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};

//***************************************************ORDER DETAILS***************************************************************/
const renderOrders = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const orders = await Order.find({ userId: userId }).populate('orderedItem.productId');

    res.render('orders', {user:userId,userId: userId, orders: orders });
  } catch (error) {
    console.log(error.message);
  }
}

const renderFullDetails = async (req, res) => {
  try {
    // console.log(req.params);
    const userId = req.session.user_id;
    const orderId = req.query.id;
    console.log(orderId);
    const orders = await Order.findOne({ userId: userId,_id:orderId }).populate('orderedItem.productId');
    console.log(orders);
    res.render('orderFullDetails', { user: userId, orders: orders });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};








module.exports={
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

}



