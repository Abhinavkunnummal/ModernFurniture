const mongoose = require('mongoose');
const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const UserOTPVerification = require("../model/otpModel");
const Address=require('../model/address')
const Product = require("../model/product");
const Coupon=require('../model/coupon')
const moment = require('moment');
const Wallet = require('../model/wallet');
const CategoryOffer=require('../model/categoryOffer')
const ProductOffer=require('../model/productOffer')

const { ObjectId } = require("mongodb");
const Category = require('../model/category');

dotenv.config();

//*****************************************************NodeMailer******************************************************************/
const userController = {
  renderOtp: async (req, res) => {
      try {
          res.render('otp');
      } catch (error) {
          console.error(error.message);
      }
  },

  verifyOtp: async (req, res) => {
      try {
          const { otp } = req.body;
          const tempUser = req.session.tempUser;
          const storedOtp = tempUser.otp;

          if (otp!== storedOtp) {
              req.flash("error", "Invalid OTP");
              return res.redirect("/otp");
          }

          const userId = tempUser.userId;
          const user = await User.findById(userId);

          if (!user) {
              req.flash("error", "User not found");
              return res.redirect("/otp");
          }

          const updatedUser = await User.findByIdAndUpdate(userId, { $set: { is_verified: true } }, { new: true });
          delete req.session.tempUser.otp;

          req.flash("success", "Email verified successfully Login to enjoy shopping");
          res.redirect("/login");
      } catch (error) {
          console.error(error.message);
          res.status(500).send({ error: "Internal server error" });
      }
  },

  verifyResetOtp: async (req, res) => {
      try {
          const { otp } = req.body;
          const tempReset = req.session.tempReset;
          const storedOtp = tempReset.otp;

          if (otp!== storedOtp) {
              req.flash("error", "Invalid OTP");
              return res.redirect("/resetotp");
          }

          const userId = tempReset.userId;
          const user = await User.findById(userId);

          if (!user) {
              req.flash("error", "User not found");
              return res.redirect("/resetotp");
          } else {
              res.redirect('/changePassword');
          }
      } catch (error) {
          console.error(error.message);
          res.status(500).send({ error: "Internal server error" });
      }
  },

  sendOtp: async (req, res) => {
      try {
          const email = req.session.resetMail;
          const userData = await User.findOne({ email: email });

          if (!userData) {
              console.log('User not found for the provided email');
              return;
          }

          const name = userData.name;
          const otp = generateOTP(); 
          await sendPassResetMail(name, email, otp);

          const resetOtp = new Otp({
              user_id: userData._id,
              otp
          });
          req.session.tempReset = {
              userId: userData._id,
              email: userData.email,
              otp: otp
          };
          await resetOtp.save();
          res.redirect('/resetotp');
      } catch (error) {
          console.error(error.message);
          res.status(500).send({ error: "Internal server error" });
      }
  },

  loadResetotp: async (req, res) => {
      try {
          res.render('resetotp');
      } catch (error) {
          console.error(error.message);
      }
  }
};

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

//--------------------------------------------------------INSERT USER IN DATABASE------------------------------------------------------//

const insertUser = async (req, res) => {
  try {
      const exist = await User.findOne({ email: req.body.email });
      if (exist) {
          return res.render("signup", { message: "Email already exists" });
      }

      const spassword = await securePassword(req.body.password);
      // Refferal Code create chyyunnu
      function generateReferralCode(length) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let code = '';
          for (let i = 0; i < length; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
      }

      let newReferralCode;
      let isUnique = false;
      while (!isUnique) {
          newReferralCode = generateReferralCode(8);
          const existingUser = await User.findOne({ referralCode: newReferralCode });
          if (!existingUser) {
              isUnique = true;
          }
      }

      const newUser = new User({
          name: req.body.name,
          email: req.body.email,
          mobile: req.body.mobile,
          password: spassword,
          confirmPassword: spassword,
          is_admin: 0,
          is_verified: 0,
          referralCode: newReferralCode,
          referredCode: req.body.referredCode || null
      });

      await newUser.save();

      const newUserWallet = new Wallet({
          userId: newUser._id,
          balance: 0,
          transaction: []
      });

      await newUserWallet.save();

      if (req.body.referredCode) {
          const referrer = await User.findOne({ referralCode: req.body.referredCode });
          if (referrer) {
              const referrerWallet = await Wallet.findOne({ userId: referrer._id });
              if (referrerWallet) {
                  referrerWallet.balance += 100;
                  referrerWallet.transaction.push({
                      amount: 100,
                      transactionMethod: "Refferal",
                      formattedDate: new Date().toLocaleDateString()
                  });
                  await referrerWallet.save();
              }

              newUserWallet.balance += 50;
              newUserWallet.transaction.push({
                  amount: 50,
                  transactionMethod: "Refferal",
                  formattedDate: new Date().toLocaleDateString()
              });
              await newUserWallet.save();
          }
      }

      const otp = generateOTP();
      req.session.otp = otp;
      req.session.timer = 60; // Set timer to 20 seconds
      req.session.timerStart = Date.now();
      console.log(`Generated OTP: ${otp}`);
      await saveOTP(newUser.email, otp);
      await sendOTPVerifyMail(newUser.email, otp);

      return res.render("otp", { email: newUser.email, timer: req.session.timer });
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
              await User.findOneAndUpdate(
                  { email: req.body.email },
                  { $set: { is_verified: 1 } }
              );
              await UserOTPVerification.findOneAndDelete({ email: req.body.email });
              req.session.destroy();
              return res.redirect("/login");
          } else {
              const currentTime = Date.now();
              req.session.timer -= Math.floor((currentTime - req.session.timerStart) / 1000);
              req.session.timerStart = currentTime;
              return res.render("otp", {
                  message: "Invalid OTP. Please try again.",
                  email: req.body.email,
                  timer: Math.max(0, req.session.timer) 
              });
          }
      } else {
          return res.render("otp", {
              message: "OTP expired or has not been generated. Please request a new OTP.",
              email: req.body.email,
              timer: 0 
          });
      }
  } catch (error) {
      console.error("Error verifying OTP and saving user:", error);
      res.status(500).send("Internal Server Error");
  }
};



const resendOtp = async (req, res) => {
  try {
    const email = req.body.email;
    const newOTP = generateOTP(); 
    req.session.otp = newOTP; 
    req.session.timer = 60; 
    req.session.timerStart = Date.now(); 
    await sendOtpToEmail(email, newOTP); 
    console.log(`Generated Resended OTP : ${newOTP}`);
    res.json({ message: 'OTP resent successfully' }); 
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
};



const sendOtpToEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: "Your OTP Code",
    html: `<p>Your OTP code is: ${otp}</p>`,
  };

  await transporter.sendMail(mailOptions);
};

//---------------------------------------------------- LOAD HOME PAGE -----------------------------------------------------------//

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

//---------------------------------------------------- LOAD SHOP PAGE -----------------------------------------------------------//

const loadShop = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id);

    // Check if the user is blocked
    if (userData.is_blocked) {
      req.session.destroy(err => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).send("Internal Server Error");
        }
        res.redirect("/login"); // Redirect to login page or an appropriate error page
      });
      return;
    }

    const categories = await Category.find({ is_Listed: false }).populate('categoryOfferId');
    const currentPage = parseInt(req.query.page) || 1;
    const limit = 10;
    const currentDate = new Date();

    const categoryOffers = await CategoryOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    const productOffers = await ProductOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    // Find categories that are not listed
    const categoryIds = await Category.find({ is_Listed: false }).select('_id');
    
    // Extract the category IDs
    const categoryIdsArray = categoryIds.map(category => category._id);

    const products = await Product.find({
      $or: [
        { is_Listed: false },
        { category: { $in: categoryIdsArray } }
      ]
    })
      .populate('category')
      .populate('productOfferId')
      .skip((currentPage - 1) * limit)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      $or: [
        { is_Listed: false },
        { category: { $in: categoryIdsArray } }
      ]
    });

    const totalPages = Math.ceil(totalProducts / limit);

    const processedProducts = products.map(product => {
      let bestDiscount = 0;
      let discountedPrice = product.price;

      const productOffer = productOffers.find(offer => offer.productId.equals(product._id));
      if (productOffer) {
        bestDiscount = productOffer.discount;
        discountedPrice = product.price - (product.price * (productOffer.discount / 100));
      }

      const categoryOffer = categoryOffers.find(offer => offer.categoryId.equals(product.category._id));
      if (categoryOffer && categoryOffer.discount > bestDiscount) {
        bestDiscount = categoryOffer.discount;
        discountedPrice = product.price - (product.price * (categoryOffer.discount / 100));
      }

      return {
        ...product._doc,
        discount: bestDiscount,
        discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      };
    });

    res.render("shop", {
      products: processedProducts,
      user: userData,
      categories,
      currentPage,
      totalPages
    });
  } catch (error) {
    console.error("Error loading shop page:", error);
    res.status(500).send("Internal Server Error");
  }
};



//---------------------------------------------------- LOAD FULL PRODUCT DETAILS PAGE -----------------------------------------------------------//

const loadFullPage = async (req, res) => {
  try {
    const userData = await User.findById(req.session.user_id);
    const productId = req.query.id;
    const product = await Product.findOne({ _id: productId }).populate('category').populate('productOfferId');
    const currentDate = new Date();

    const categoryOffers = await CategoryOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    const productOffers = await ProductOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    let bestDiscount = 0;
    let discountedPrice = product.price;
    let discountType = '';

    const productOffer = productOffers.find(offer => offer.productId.equals(product._id));
    if (productOffer) {
      bestDiscount = productOffer.discount;
      discountedPrice = product.price - (product.price * (productOffer.discount / 100));
      discountType = 'product';
    }

    const categoryOffer = categoryOffers.find(offer => offer.categoryId.equals(product.category._id));
    if (categoryOffer && categoryOffer.discount > bestDiscount) {
      bestDiscount = categoryOffer.discount;
      discountedPrice = product.price - (product.price * (categoryOffer.discount / 100));
      discountType = 'category';
    }

    const processedProduct = {
      ...product._doc,
      discount: bestDiscount,
      discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      discountType: discountType
    };

    // Fetch related products
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id } // Exclude the current product
    }).limit(4); // Limit the number of related products

    res.render("productFullpage", {
      products: processedProduct,
      user: userData,
      relatedProducts: relatedProducts
    });
  } catch (error) {
    console.error("Error loading full page:", error);
    res.status(500).send("Internal Server Error");
  }
};


//---------------------------------------------------- LOGOUT USER -----------------------------------------------------------//

const logoutUser = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/login");
  } catch (error) {
    console.error("Error logging out user:", error);
    res.status(500).send("Internal Server Error");
  }
};

//---------------------------------------------------- USER PROFILE -----------------------------------------------------------//

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

//---------------------------------------------------- EDIT USER PROFILE -----------------------------------------------------------//

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

//---------------------------------------------------- USER ADDRESS -----------------------------------------------------------//

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

//---------------------------------------------------- ADD NEW ADDRESS -----------------------------------------------------------//

const addAddress = async (req, res) => {
  try {
    const address = await Address.find({});
    res.render("addNewAddress", { address, message: req.flash('message') });
  } catch (error) {
    console.log(error.message);
  }
};

//---------------------------------------------------- SAVE ADDRESS -----------------------------------------------------------//

const postAddress = async (req, res) => {
  try {
    const { address, state, city, zipcode, country, language, gender } = req.body;
    const userId = req.session.user_id;
    const currentUrl = req.query.currentUrl; 

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

    
    let redirectUrl;
    if (currentUrl && currentUrl.includes('/checkout')) {
      redirectUrl = '/checkout'; 
    } else {
      redirectUrl = '/manageAddress'; 
    }

    return res.redirect(redirectUrl);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: error.message });
  }
};

//---------------------------------------------------- EDIT ADDRESS -----------------------------------------------------------//

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

//---------------------------------------------------- EDIT FULL ADDRESS -----------------------------------------------------------//

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

//---------------------------------------------------- SAVE EDITED ADDRESS -----------------------------------------------------------//

const postProfile = async (req, res) => {
  try {
      const userId = req.session.user_id;
      const { name, email, phoneNumber } = req.body;

      
      const trimmedName = name.trim();
      const trimmedPhoneNumber = phoneNumber.trim();

     
      const nameRegex = /^[a-zA-Z\s]+$/; 
      const phoneNumberRegex = /^\d{10}$/; 


      if (!nameRegex.test(trimmedName)) {
          req.flash('error', 'Invalid name format. Only letters and spaces are allowed.');
          return res.redirect('/userProfile');
      }

     
      if (!phoneNumberRegex.test(trimmedPhoneNumber)) {
          req.flash('error', 'Invalid phone number format. It should be a 10-digit number.');
          return res.redirect('/userProfile');
      }

      
      await User.findByIdAndUpdate(userId, { name: trimmedName, mobile: trimmedPhoneNumber }, { new: true });

      req.flash('success', 'Profile updated successfully.');
      res.redirect('/userProfile');
  } catch (error) {
      console.log(error.message);
      req.flash('error', 'Internal Server Error');
      res.redirect('/userProfile');
  }
};

//---------------------------------------------------- DELETE ADDRESS -----------------------------------------------------------//

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

//---------------------------------------------------- EDIT ADDRESS POST -----------------------------------------------------------//

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

    const addressDoc = await Address.findOne({ userId, _id: addressId });

    if (!addressDoc) {
     
      return res.status(404).send('Address not found');
    }

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

//---------------------------------------------------- SORT PRODUCTS -----------------------------------------------------------//

const sortProducts = async (req, res) => {
  try {
    const { sort, category, search, page = 1, limit = 9 } = req.query;
    const currentDate = new Date();

    let productsQuery = Product.find().populate('category').populate('productOfferId');

    if (category) {
      productsQuery = productsQuery.where('category').equals(category);
    }

    if (search) {
      productsQuery = productsQuery.where('name', new RegExp(search, 'i'));
    }

    let products = await productsQuery.exec();

    const categoryOffers = await CategoryOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    const productOffers = await ProductOffer.find({
      is_active: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });

    const processedProducts = products.map(product => {
      let bestDiscount = 0;
      let discountedPrice = product.price;

      const productOffer = productOffers.find(offer => offer.productId.equals(product._id));
      if (productOffer) {
        bestDiscount = productOffer.discount;
        discountedPrice = product.price - (product.price * (productOffer.discount / 100));
      }

      const categoryOffer = categoryOffers.find(offer => offer.categoryId.equals(product.category._id));
      if (categoryOffer && categoryOffer.discount > bestDiscount) {
        bestDiscount = categoryOffer.discount;
        discountedPrice = product.price - (product.price * (categoryOffer.discount / 100));
      }

      return {
        ...product._doc,
        discount: bestDiscount,
        discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      };
    });

    switch (sort) {
      case 'nameAZ':
        processedProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nameZA':
        processedProducts.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newArrivals':
        processedProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'priceLowToHigh':
        processedProducts.sort((a, b) => a.discountedPrice - b.discountedPrice);
        break;
      case 'priceHighToLow':
        processedProducts.sort((a, b) => b.discountedPrice - a.discountedPrice);
        break;
      default:
        break;
    }

    const totalProducts = processedProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = processedProducts.slice((page - 1) * limit, page * limit);

    res.json({ 
      products: paginatedProducts, 
      currentPage: parseInt(page), 
      totalPages 
    });
  } catch (error) {
    console.error('Error fetching sorted products:', error);
    res.status(500).send('Internal Server Error');
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


    const user = await User.findOne({ email });
    if (!user) {
      return res.render('forgetPassword', { message: 'No such email is registered here' });
    }


    const otp = Math.floor(1000 + Math.random() * 9000);

 
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}`,
    };


    await transporter.sendMail(mailOptions);

    console.log(otp);
    req.session.otp = otp;
    req.session.userId = user._id;

  
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


    if (!sessionOTP) {
      return res.redirect('/forgetPassword');
    }

    if (sessionOTP !== parseInt(otp)) {
      return res.render('forgetOtp', { email, message: 'Invalid OTP. Please try again.' });
    }


    const user = await User.findOne({ _id: userId, email });
    if (!user) {
      return res.render('forgetPassword', { message: 'No such email is registered here' });
    }

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

    if (newPassword !== confirmNewPassword) {
      return res.render('passwordChange', { userId, message: 'Passwords do not match' });
    }


    const objectUserId = new mongoose.Types.ObjectId(userId);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findByIdAndUpdate(
      objectUserId,
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.render('passwordChange', { userId, message: 'User not found' });
    }

    req.session.destroy();

    return res.redirect('/login');
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};

//------------------------------------------------- CHKECKOUT ADDRESS DETAILS --------------------------------------------------//

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

//------------------------------------------------- RENDER CHKECKOUT ADDRESS DETAILS --------------------------------------------------//

const loadCheckoutAddAddress=async(req,res)=>{
  try {
    res.render('checkoutAddAddress')
  } catch (error) {
    console.log(error.message);
  }
}

//------------------------------------------------- RENDER COUPON PAGE ---------------------------------------------------------//

const renderCouponPage = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const userData= await User.findById(userId)
    const coupons = await Coupon.find().lean();
    coupons.forEach(coupon => {
      coupon.formattedDate = moment(coupon.expiryDate).format('YYYY-MM-DD');
    });
    res.render('coupon', { coupons ,user:userData});
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
};




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
  renderCouponPage,
};
