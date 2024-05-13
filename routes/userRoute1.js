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

userRoute.get('/userProfile',userController.renderUserProfile)
userRoute.get('/editProfile',userController.editProfile)
userRoute.post('/editedProfile',userController.postProfile)
userRoute.get('/manageAddress',userController.renderAddress)
userRoute.get('/addAddress',userController.addAddress)
userRoute.post('/postAddress',userController.postAddress)
userRoute.post('/saveAddress',userController.postSaveAddress)
userRoute.get('/addressEdit',userController.renderEditAddress)
userRoute.get('/addressDelete',userController.deleteAddress)
userRoute.post('/addressEdited',userController.editedAddressPost)
userRoute.post('/checkoutPostAddress',userController.checkoutAddress)

//Cart

userRoute.get('/cart',cartController.renderCart)
userRoute.get('/addToCart',cartController.addToCart)
// userRoute.post('/updateCartQuantity', cartController.updateCartItemQuantity);



userRoute.get('/checkout',cartController.checkoutPage)
// userRoute.post('/placeOrder',cartController.placeOrder)
userRoute.post('/checkoutAddress',cartController.renderPlaceOrder)


userRoute.post('/removeCart',cartController.removeFromCart)
userRoute.get('/admin/removeCart',cartController.removeFromCart)
// userRoute.delete('/cart/:productId',cartController.removeFromCart)
userRoute.post('/updateCartItem',cartController.updateCartItem)

// Implement sorting route
userRoute.get('/sortProducts', userController.sortProducts);
userRoute.get('/forgetPassword',userController.renderForgetPassword)
userRoute.post('/forgetPassword',userController.passwordChange)
userRoute.post('/changedPass',userController.changedPass)
userRoute.post('/forget',userController.forgetPassword)
userRoute.get('/checkoutAddAddress',userController.loadCheckoutAddAddress)
// userRoute.post('/checkoutAddress',cartController.postCheckoutAddress)

//***************************************************ORDER DETAILS*****************************************************************/
userRoute.get('/orders',cartController.renderOrders)
userRoute.get('/orderDetails',cartController.renderFullDetails)

  

module.exports = userRoute;
