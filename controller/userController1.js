const mongoose = require('mongoose');
const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const UserOTPVerification = require("../model/otpModel");
const Address=require('../model/address')
const Product = require("../model/product");

const { ObjectId } = require("mongodb");

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: true,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const securePassword = async (password) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return passwordHash;
};

const renderLogin = async (req, res) => {
  res.render("login");
};

const renderSignUp = async (req, res) => {
  res.render("signup");
};

const loadSignIn = async (req, res) => {
  res.render("login");
};

const insertUser = async (req, res) => {
  try {
    const exist = await User.findOne({ email: req.body.email });
    if (exist) {
      return res.render("signup", { message: "Email already exists" });
    }

    // Hash password
    const spassword = await securePassword(req.body.password);
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      mobile: req.body.mobile,
      password: spassword,
      confirmPassword: spassword,
      is_admin: 0,
      is_verified: 0,
    });

    await newUser.save();

    const otp = generateOTP();
    req.session.otp = otp;
    console.log(`Generated OTP: ${otp}`);
    await saveOTP(newUser.email, otp);
    await sendOTPVerifyMail(newUser.email, otp);
    return res.render("otp", { email: newUser.email });
  } catch (error) {
    console.error("Error inserting user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const sendOTPVerifyMail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: "Verify Your Email",
    html: `Your OTP is: ${otp}`,
  };

  await transporter.sendMail(mailOptions);
};

const saveOTP = async (email, otp) => {
  const otpDocument = new UserOTPVerification({
    email: email,
    otp: otp,
  });
  await otpDocument.save();
};

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000);
};

const verifyOTPAndSaveUser = async (req, res) => {
  try {
    const enteredOTP = req.body.otp;
    const sessionOTP = req.session.otp;

    if (sessionOTP) {
      if (sessionOTP == enteredOTP) {
        delete req.session.otp;
        const userVerification = await UserOTPVerification.findOne({
          email: req.body.email,
        });
        await User.findOneAndUpdate(
          { email: userVerification.email },
          { $set: { is_verified: 1 } }
        );
        await UserOTPVerification.findOneAndDelete({ email: req.body.email });

        const newOTP = generateOTP();
        req.session.otp = newOTP;

        return res.render("login", {
          message: "Email verified successfully , Login to continue",
        });
      } else {
        console.log(`Entered OTP: ${enteredOTP}`);
        console.log("Invalid OTP. Generated and entered OTP do not match.");
        return res.render("otp", {
          message: "Invalid OTP. Please try again.",
          email: req.body.email,
        });
      }
    } else {
      console.log("OTP expired or has not been generated.");
      return res.render("otp", {
        message:
          "OTP expired or has not been generated. Please request a new OTP.",
        email: req.body.email,
      });
    }
  } catch (error) {
    console.error("Error verifying OTP and saving user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadHome = async (req, res) => {
  try {
    if (req.session.user_id) {
      const userData = await User.findById(req.session.user_id);

      if (userData.is_blocked) {
        req.session.destroy();
        return res.render("login", {
          message: "You are blocked by the admin. You cannot login anymore.",
        });
      } else {
        return res.render("home", { user: userData });
      }
    } else {
      res.render("home");
      
    }
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Internal Server Error");
    
  }
};


const loadLogin = async (req, res) => {
  res.render("login");
};

const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({ email });

    if (!userData) {
      return res.render("login", {
        message: "Email or Password is incorrect...!!!",
      });
    } else if (!userData.is_verified) {
      const otp = generateOTP();
      await saveOTP(userData.email, otp);
      await sendOTPVerifyMail(userData.email, otp);
      req.session.otp = otp;
      console.log(`Generated OTP: ${otp}`);
      return res.render("otp", {
        message: "Email is not verified, please verify your email",
        email: userData.email,
      });
    }

    const passwordMatch = await bcrypt.compare(password, userData.password);
    if (passwordMatch) {
      if (!userData.is_blocked) {
        req.session.user_id = userData._id;
        const userId = req.session.user_id
        // console.log(`userId stored ${userId}`);
        return res.redirect("/");
      } else {
        return res.render("login", { message: "Admin Blocked You" });
      }
    }

    if (userData.is_admin === 0) {
      return res.render("login", {
        message: "You are not authorized to access this page.",
      });
    }
  } catch (error) {
    console.error("Error verifying login credentials:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadShop = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id);
    const products = await Product.find({ is_Listed: false });
    res.render("shop", { products, user: userData });
  } catch (error) {
    console.error("Error loading shop page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadFullPage = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id);
    const id = req.query.id;
    const products = await Product.findOne({ _id: id });
    res.render("productFullpage", { products, user: userData });
  } catch (error) {
    console.error("Error loading full page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const logoutUser = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/login");
  } catch (error) {
    console.error("Error logging out user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.body.email;
    const otp = generateOTP();
    req.session.otp = otp;
    await saveOTP(email, otp);
    await sendOTPVerifyMail(email, otp);
    res.json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//User profile -9th

const renderUserProfile = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id).populate('address');
  
    if (userData) {
      res.render("userProfile", { user: userData });
    } else {
      
      res.redirect('/login')
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const editProfile = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id);
    if (userData) {
      res.render("editProfile", { user: userData });
    } else {
      
     
      res.redirect('/login')
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const renderAddress = async (req, res) => {
  try {
   const userId = req.session.user_id
    const userData = await User.findById(userId)
    let availableAddress = await Address.find({ userId: req.session.user_id })
  
    res.render("addressPage", { user:userData , address: availableAddress });
  } catch (error) {
    console.log(error.message);
  }
};

const addAddress = async (req, res) => {
  try {
    const address = await Address.find({});
    res.render("addNewAddress", { address });
  } catch (error) {
    console.log(error.message);
  }
};

const postAddress = async (req, res) => {
  try {
    const { address, state, city, zipcode, country, language, gender } = req.body;
    const userId = req.session.user_id;
    const currentUrl = req.query.currentUrl; // Get the current URL from the query parameter

    const newAddress = new Address({
      userId,
      address,
      state,
      city,
      zipcode,
      country,
      language,
      gender,
    });

    await newAddress.save();

    // Determine the redirection URL based on the currentUrl
    let redirectUrl;
    if (currentUrl && currentUrl.includes('/checkout')) {
      redirectUrl = '/checkout'; // Redirect to the checkout page
    } else {
      redirectUrl = '/manageAddress'; // Redirect to the manage address page
    }

    return res.redirect(redirectUrl);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: error.message });
  }
};

const postSaveAddress = async (req, res) => {
  try {
    const selectedAddressId = req.body.selectedAddress;
    await User.findByIdAndUpdate(req.session.user_id, {
      address: selectedAddressId
    });

    // console.log('selected Address id', selectedAddressId);
    res.redirect('/userProfile');
  } catch (error) {
    console.log(error.message);
   
  }
};

const renderEditAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.query.id; 
    const userData= await User.findById(userId)
    const address = await Address.findOne({ userId, _id: addressId });
    if (!address) {
      return res.status(404).send('Address not found');
    }

    res.render('addressEdit', { address:address,user:userData});
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};


const postProfile=async(req,res)=>{
  try{
    const userId=req.session.user_id;
    const {name,email,mobile}=req.body
     await User.findByIdAndUpdate(userId,{name,email,mobile},{new:true})
     console.log(name);
    res.redirect('/userProfile')
  }catch(error){
    console.log(error.message);
  }
}

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const addressId = req.query.id;
    await Address.findOneAndDelete({ userId, _id: addressId });

    res.redirect('/manageAddress');
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

const editedAddressPost = async (req, res) => {
  try {
    console.log(`goood morning`);
    const userId = req.session.user_id;
    console.log('userId:', userId);
    
    const userData=await User.findById(userId)

    const addressId = req.query.id;
    // console.log('addressId:', addressId);

    if (!addressId) {
      return res.status(400).send('Address ID is required');
    }

    const { address, state, city, zipcode, country, language, gender } = req.body;
    // console.log('Received data:', { address, state, city, zipcode, country, language, gender });

    // Find the address document by userId and addressId
    const addressDoc = await Address.findOne({ userId, _id: addressId });

    if (!addressDoc) {
      // Handle the case where the address document is not found
      return res.status(404).send('Address not found');
    }

    // Update the address document with the new data
    addressDoc.address = address;
    addressDoc.state = state;
    addressDoc.city = city;
    addressDoc.zipcode = zipcode;
    addressDoc.country = country;
    addressDoc.language = language;
    addressDoc.gender = gender;

    await addressDoc.save();
    res.redirect('/manageAddress')
    // res.render('addressPage',{user:userData});
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

const sortProducts = async (req, res) => {
  try {
      const sortingCriteria = req.query.sort;
      let sortedProducts;

      
      switch (sortingCriteria) {
          case 'priceLowToHigh':
              sortedProducts = await Product.find().sort({ price: 1 });
              break;
          case 'priceHighToLow':
              sortedProducts = await Product.find().sort({ price: -1 });
              break;
            
          
          default:
              sortedProducts = await Product.find(); 
      }

      res.json({ products: sortedProducts });
  } catch (error) {
      console.error('Error fetching and sorting products:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ***********************************************************FORGET PASSWORD******************************************************\\

const renderForgetPassword = async (req, res) => {
  try {
    res.render('forgetPassword');
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

const passwordChange = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the email exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('forgetPassword', { message: 'No such email is registered here' });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Create a transporter for sending email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Define the email options
    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}`,
    };

    // Send the email with the OTP
    await transporter.sendMail(mailOptions);

    // Store the OTP and user ID in the session
    console.log(otp);
    req.session.otp = otp;
    req.session.userId = user._id;

    // Render the OTP verification page
    return res.render('forgetOtp', { email });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userId = req.session.userId;
    console.log(userId);
    const sessionOTP = req.session.otp;

    // Check if the session OTP exists
    if (!sessionOTP) {
      return res.redirect('/forgetPassword');
    }

    // Check if the OTP matches
    if (sessionOTP !== parseInt(otp)) {
      return res.render('forgetOtp', { email, message: 'Invalid OTP. Please try again.' });
    }

    // Find the user by ID and email
    const user = await User.findOne({ _id: userId, email });
    if (!user) {
      return res.render('forgetPassword', { message: 'No such email is registered here' });
    }

    // Render the password change page
    return res.render('passwordChange', { userId: user._id });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};


const changedPass = async (req, res) => {
  try {
    const { newPassword, confirmNewPassword } = req.body;
    const userId = req.session.userId;

    // Check if the new password and confirm password match
    if (newPassword !== confirmNewPassword) {
      return res.render('passwordChange', { userId, message: 'Passwords do not match' });
    }

    // Convert the userId string to a valid MongoDB ObjectId
    const objectUserId = new mongoose.Types.ObjectId(userId);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Find the user by ID and update the password
    const user = await User.findByIdAndUpdate(
      objectUserId,
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.render('passwordChange', { userId, message: 'User not found' });
    }

    // Clear the session data
    req.session.destroy();

    // Redirect to the login page
    return res.redirect('/login');
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};


const checkoutAddress=async(req,res)=>{
  try{
    const { address, state, city, zipcode, country, language, gender } = req.body;
    const userId = req.session.user_id;

    const newAddress = new Address({
      userId,
      address,
      state,
      city,
      zipcode,
      country,
      language,
      gender,
    });

    await newAddress.save();
    res.redirect('/checkout')
  }catch(error){
    console.log(error.message);
  }
}

const loadCheckoutAddAddress=async(req,res)=>{
  try {
    res.render('checkoutAddAddress')
  } catch (error) {
    console.log(error.message);
  }
}

//***************************************************ORDER DETAILS***************************************************************/
const renderOrders=async(req,res)=>{
  try{
    res.render('order')
  }catch(error){
    console.log(error.message);
  }
}



module.exports = {
  loadHome,
  renderLogin,
  renderSignUp,
  loadSignIn,
  insertUser,
  verifyOTPAndSaveUser,
  loadLogin,
  verifyLogin,
  loadShop,
  logoutUser,
  loadFullPage,
  resendOtp,


  renderUserProfile,
  editProfile,
  renderAddress,
  addAddress,
  postAddress,
  postSaveAddress,
  renderEditAddress,
  postProfile,
  deleteAddress,
  editedAddressPost,
  sortProducts,
  renderForgetPassword,
  passwordChange,
  changedPass,
  forgetPassword,
  checkoutAddress,
  loadCheckoutAddAddress,
  renderOrders,
};
