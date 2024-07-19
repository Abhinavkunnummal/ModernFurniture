const express = require("express");
const userRoute = express();
const passport = require("passport");
const bodyParser = require("body-parser");
const session = require("express-session");

userRoute.use(bodyParser.urlencoded({ extended: true }));
userRoute.use(bodyParser.json());

userRoute.set("view engine", "ejs");
userRoute.set("views", "./views/users");


const userController = require("../controller/userController1");
const cartController=require('../controller/cartController')
const paymentController=require('../controller/paymentController')
const { isLogin, isLogout } = require("../auth/userAuth");

userRoute.use(
  session({
    secret: "3f5f6fde-5cbc-4cb9-bbd9-6a76b6040e6a",
    resave: false,
    saveUninitialized: true,
  })
);

userRoute.get("/", userController.loadHome);


userRoute.get("/login", isLogout, userController.renderLogin);

userRoute.post("/loginUser", isLogout, userController.verifyLogin);

userRoute.get("/loginUser", isLogout, userController.renderLogin);

userRoute.get("/renderSignUp", isLogout, userController.renderSignUp);

userRoute.get("/loadSignIn", isLogout, userController.loadSignIn);

userRoute.post("/login", isLogout, userController.insertUser);

userRoute.post("/verifyOtp", isLogout, userController.verifyOTPAndSaveUser);

userRoute.get("/shop", userController.loadShop);

userRoute.get("/productFull", userController.loadFullPage);

userRoute.get('/coupons',cartController.showCoupons)

userRoute.post('/resendOtp',userController.resendOtp)



//Google authentication

userRoute.get("/home",(req,res)=> {
  req.session.user_id = req.user._id;
  res.render("home",{user:req.user})
})


userRoute.get("/logout", userController.logoutUser);


// Google OAuth routes
userRoute.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

userRoute.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login",successRedirect:"/home" }))
    
//user profile

userRoute.get('/userProfile',isLogin,userController.renderUserProfile)
userRoute.get('/editProfile',isLogin,userController.editProfile)
userRoute.post('/editedProfile',isLogin,userController.postProfile)
userRoute.get('/manageAddress',isLogin,userController.renderAddress)
userRoute.get('/addAddress',isLogin,userController.addAddress)
userRoute.post('/postAddress',isLogin,userController.postAddress)
userRoute.post('/saveAddress',isLogin,userController.postSaveAddress)
userRoute.get('/addressEdit',isLogin,userController.renderEditAddress)
userRoute.get('/addressDelete',isLogin,userController.deleteAddress)
userRoute.post('/addressEdited',isLogin,userController.editedAddressPost)
userRoute.post('/checkoutPostAddress',isLogin,userController.checkoutAddress)
userRoute.post('/apply-coupon', isLogin,cartController.applyCoupon);
userRoute.post('/remove-coupon', isLogin,cartController.removeCoupon);
//Cart

userRoute.get('/cart',isLogin,cartController.renderCart)
userRoute.get('/addToCart',isLogin,cartController.addToCart)
// userRoute.post('/updateCartQuantity', cartController.updateCartItemQuantity);



userRoute.get('/checkout',isLogin,cartController.checkoutPage)
// userRoute.post('/placeOrder',cartController.placeOrder)
userRoute.post('/checkoutAddress',isLogin,paymentController.renderPlaceOrder)
userRoute.post('/verify-payment',isLogin,paymentController.verifyPayment)
userRoute.get('/coupon',isLogin,userController.renderCouponPage)
userRoute.post('/returnOrder',isLogin,cartController.returnOrder)



userRoute.post('/removeCart',isLogin,cartController.removeFromCart)
userRoute.get('/admin/removeCart',isLogin,cartController.removeFromCart)
// userRoute.delete('/cart/:productId',cartController.removeFromCart)
userRoute.post('/updateCartItem',isLogin,cartController.updateCartItem)

userRoute.get('/sortProducts',isLogin, userController.sortProducts);
userRoute.get('/forgetPassword',userController.renderForgetPassword)
userRoute.post('/forgetPassword',userController.passwordChange)
userRoute.post('/changedPass',userController.changedPass)
userRoute.post('/forget',userController.forgetPassword)
userRoute.get('/checkoutAddAddress',isLogin,userController.loadCheckoutAddAddress)
userRoute.get('/thankyou',isLogin,cartController.renderThankyou)
userRoute.get('/orders',isLogin,cartController.renderOrders)


userRoute.get('/coupons',isLogin,cartController.showAllCoupons)

userRoute.get('/orderDetails',isLogin,cartController.renderFullDetails)

userRoute.post('/cancelOrders',isLogin,cartController.cancelOrder)



userRoute.get('/wishlist',isLogin, cartController.renderWishlist);


userRoute.post('/wishlist/add/:productId',isLogin, cartController.addToWishList);


userRoute.post('/wishlist/remove',isLogin, cartController.removeFromWishList);

userRoute.get('/wallet',isLogin,cartController.renderWallet)
userRoute.post('/addfunds',isLogin,cartController.addFunds)
userRoute.post('/fundVerification',isLogin,cartController.fundVerification)
userRoute.post('/addwallet',isLogin,cartController.addToWallet)
userRoute.post('/placeorderwallet',isLogin,cartController.placeOrderWallet)

// userRoute.get('/downloadInvoice',cartController.downloadInvoice)
userRoute.get('/invoice',isLogin,cartController.loadInvoice)
userRoute.post('/handle-failed-razorpay',isLogin,paymentController.handleFailedRazorpayPayment)

userRoute.post('/retry-payment',isLogin,paymentController.razorPayRetryPayment)
userRoute.post('/verifyretry-payment',isLogin,paymentController.verifyRetryPayment)

module.exports = userRoute;
