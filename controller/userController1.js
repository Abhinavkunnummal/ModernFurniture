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

  // resendOtp: async (req, res) => {
  //     try {
  //         const tempUser = req.session.tempUser;

  //         if (!tempUser ||!tempUser.userId ||!tempUser.email) {
  //             req.flash("error", "User session data missing");
  //             return res.redirect("/otp");
  //         }

  //         const userId = tempUser.userId;
  //         const user = await User.findById(userId);

  //         if (!user) {
  //             req.flash("error", "User not found");
  //             return res.redirect("/otp");
  //         }

  //         const newOtp = generateOTP(); 
  //         await sendVerifyMail(user.name, tempUser.email, user._id, newOtp);

  //         req.session.tempUser.otp = newOtp;
  //         const otpDoc = new Otp({
  //             user_id: user._id,
  //             otp: newOtp,
  //         });
  //         await otpDoc.save();

  //         req.flash("success", "New OTP has been sent to your email");
  //         res.redirect("/otp");
  //     } catch (error) {
  //         console.error(error.message);
  //         res.status(500).send({ error: "Internal server error" });
  //     }
  // },

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
//******************************************************************************************************************************** */

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

      const spassword = await securePassword(req.body.password);
      
      // Generate a unique referral code for the new user
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
      req.session.timer = 20; // Set timer to 20 seconds
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
              req.session.timerStart = currentTime; // Reset the timer start time
              return res.render("otp", {
                  message: "Invalid OTP. Please try again.",
                  email: req.body.email,
                  timer: Math.max(0, req.session.timer) // Ensure timer does not go negative
              });
          }
      } else {
          return res.render("otp", {
              message: "OTP expired or has not been generated. Please request a new OTP.",
              email: req.body.email,
              timer: 0 // Timer expired
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
    const newOTP = generateOTP(); // Generate a new OTP
    req.session.otp = newOTP; // Update session with new OTP
    req.session.timer = 20; // Reset the timer to 20 seconds
    req.session.timerStart = Date.now(); // Reset the timer start time
    await sendOtpToEmail(email, newOTP); // Send the new OTP to the email
    console.log(`Generated Resended OTP : ${newOTP}`);
    res.json({ message: 'OTP resent successfully' }); // Send response indicating success
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ error: 'Internal Server Error' }); // Send response indicating failure
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
    const categories = await Category.find({ is_Listed: false }).populate('categoryOfferId');
    
    let products = await Product.find({ is_Listed: false })
                                .populate('productOfferId')
                                .populate({
                                  path: 'category',
                                  populate: { path: 'categoryOfferId' }
                                })
                                .select('name price image stock isNew productOfferId category');

    // Apply offers to products
    products = products.map(product => {
      let discount = 0;

      // Check for product-specific offer
      if (product.productOfferId) {
        discount = product.productOfferId.discount;
      }

      // Check for category-specific offer and apply the greater discount
      if (product.category && product.category.categoryOfferId) {
        discount = Math.max(discount, product.category.categoryOfferId.discount);
      }

      // Calculate the discounted price
      const discountedPrice = product.price * ((100 - discount) / 100);

      return {
        ...product._doc,
        discountedPrice: discountedPrice > 0 ? discountedPrice : 0,
        discount
      };
    });

    // Process categories to include offer information
    const processedCategories = categories.map(category => {
      return {
        ...category._doc,
        offerDiscount: category.categoryOfferId ? category.categoryOfferId.discount : 0
      };
    });

    res.render("shop", { 
      products, 
      user: userData, 
      categories: processedCategories 
    });
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
    console.log(products)
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

// const resendOtp = async (req, res) => {
//   try {
//     const email = req.body.email;
//     const otp = generateOTP();
//     req.session.otp = otp;
//     await saveOTP(email, otp);
//     await sendOTPVerifyMail(email, otp);
//     res.json({ message: "OTP resent successfully" });
//   } catch (error) {
//     console.error("Error resending OTP:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

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


const postProfile = async (req, res) => {
  try {
      const userId = req.session.user_id;
      const { name, email, phoneNumber } = req.body;

      // Trim the inputs to remove leading and trailing spaces
      const trimmedName = name.trim();
      const trimmedPhoneNumber = phoneNumber.trim();

      // Regex for validation
      const nameRegex = /^[a-zA-Z\s]+$/; // Only allows letters and spaces
      const phoneNumberRegex = /^\d{10}$/; // Only allows 10 digit numbers

      // Validate name
      if (!nameRegex.test(trimmedName)) {
          req.flash('error', 'Invalid name format. Only letters and spaces are allowed.');
          return res.redirect('/userProfile');
      }

      // Validate phoneNumber
      if (!phoneNumberRegex.test(trimmedPhoneNumber)) {
          req.flash('error', 'Invalid phone number format. It should be a 10-digit number.');
          return res.redirect('/userProfile');
      }

      // Update the user profile
      await User.findByIdAndUpdate(userId, { name: trimmedName, mobile: trimmedPhoneNumber }, { new: true });

      req.flash('success', 'Profile updated successfully.');
      res.redirect('/userProfile');
  } catch (error) {
      console.log(error.message);
      req.flash('error', 'Internal Server Error');
      res.redirect('/userProfile');
  }
};



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

const sortProducts = async (req, res) => {
  try {
    const { sort, category } = req.query;
    let filter = { is_Listed: false };

    if (category) {
      filter.category = category;
    }

    let products = await Product.find(filter)
                                .populate('productOfferId')
                                .populate({
                                  path: 'category',
                                  populate: { path: 'categoryOfferId' }
                                })
                                .select('name price image stock isNew productOfferId category');

    // Apply offers to products
    products = products.map(product => {
      let discount = 0;

      if (product.productOfferId) {
        discount = product.productOfferId.discount;
      }

      if (product.category && product.category.categoryOfferId) {
        discount = Math.max(discount, product.category.categoryOfferId.discount);
      }

      const discountedPrice = product.price - (product.price * (discount / 100));
      return {
        ...product._doc,
        discountedPrice: discountedPrice > 0 ? discountedPrice : 0,
        discount
      };
    });

    // Sort products
    if (sort === 'nameAZ') {
      products = products.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'nameZA') {
      products = products.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'newArrivals') {
      products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'priceLowToHigh') {
      products = products.sort((a, b) => a.discountedPrice - b.discountedPrice);
    } else if (sort === 'priceHighToLow') {
      products = products.sort((a, b) => b.discountedPrice - a.discountedPrice);
    }

    res.json({ products });
  } catch (error) {
    console.error('Error fetching and sorting products:', error);
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

const renderCouponPage = async (req, res) => {
  try {
    const coupons = await Coupon.find().lean();
    coupons.forEach(coupon => {
      coupon.formattedDate = moment(coupon.expiryDate).format('YYYY-MM-DD');
    });
    res.render('coupon', { coupons });
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
