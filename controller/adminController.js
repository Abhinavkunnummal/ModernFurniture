const User = require("../model/userModel");
const Category = require("../model/category");
const Product = require("../model/product");
const multer = require("multer");
const bcrypt = require("bcrypt");
const sharp = require("sharp"); 
const Order=require('../model/order')
const Coupon=require('../model/coupon')
const moment = require('moment');
const Offer = require('../model/offerModel'); 
const CategoryOffer=require('../model/categoryOffer')
const ProductOffer=require('../model/productOffer')


//-------------------------------------------------------- RENDER ADMIN LOGIN PAGE ------------------------------------------------//
const renderLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    // console.error("Error rendering login:", error);
    res.status(500).send("Internal Server Error");
  }
};

const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({ email });
    if (!userData) {
      return res.render("login", {
        message: "Email or Password is incorrect...!!!",
      });
    }
    const passwordMatch = await bcrypt.compare(password, userData.password);
    if (!passwordMatch) {
      return res.render("login", {
        message: "Email or Password is incorrect...!!!",
      });
    }
    if (userData.is_admin === 0) {
      return res.render("login", {
        message: "You are not authorized to access this page.",
      });
    }
    req.session.admin = userData._id;
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error verifying login:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- RENDER ADMIN DASHBOARD ------------------------------------------------//

const loadDashboard = async (req, res) => {
  try {
    const deliveredOrders = await Order.find({
      'orderedItem.orderStatus': 'delivered'
    });
    console.log("Delivered Orders:", deliveredOrders);
    if (!deliveredOrders || deliveredOrders.length === 0) {
      console.log("No delivered orders found.");
    }

    const categories = await Category.find({});
    const products = await Product.find({});

    const totalRevenue = deliveredOrders.reduce((acc, order) => acc + order.orderAmount, 0);

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const currentMonthEarnings = deliveredOrders.reduce((acc, order) => {
      const orderDate = new Date(order.createdAt);
      if (orderDate.getMonth() === thisMonth && orderDate.getFullYear() === thisYear) {
        acc += order.orderAmount;
      }
      return acc;
    }, 0);

    res.render('dashboard', {
      orders: deliveredOrders,
      categories,
      products,
      totalRevenue,
      monthlyEarning: currentMonthEarnings
    });
  } catch (error) {
    // console.log("Error loading dashboard:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

//-------------------------------------------------------- CUSTOMER DETAILS -----------------------------------------------------//

const customerDetails = async (req, res) => {
  try {
    const users = await User.find({ is_admin: 0 });
    res.render("customer", { users });
  } catch (error) {
    console.error("Error fetching customer details:", error);
    res.status(500).send("Internal Server Error");
  }
};

const newUserLoadHome = async (req, res) => {
  try {
    res.render("new_user");
  } catch (error) {
    console.error("Error rendering new user page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- BLOCK USERS ----------------------------------------------------------//

const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: { is_blocked: true } }, { new: true });
    return res.status(200).send({ message: "User blocked successfully", redirect: "/admin/customers" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ message: "Internal server error" });
  }
};

//-------------------------------------------------------- UNBLOCK USERS ----------------------------------------------------------//

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: { is_blocked: false } }, { new: true });
    return res.status(200).send({ message: "User unblocked successfully", redirect: "/admin/customers" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({ message: "Internal server error" });
  }
};

//-------------------------------------------------------- CATEGORY DETAILS -----------------------------------------------------//

const renderCategoryDetails = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("categoryDetails", { categories });
  } catch (error) {
    console.error("Error rendering category details:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- ADD CATEGORY ---------------------------------------------------------//

const categoryCreation = async (req, res) => {
  try {
    const { name, description } = req.body;
    const input = name.toLowerCase().replace(/\s/g, '');
    const existingCategories = await Category.find({}, 'name');

    if (!name || !description) {
      return res.status(400).send("Name and description are required");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)) {
      return res.render("addCategory", { message: "Invalid category name. Please enter a valid name." });
  }

    const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + input + "$", "i") } });

    if (existingCategory) {
      return res.render("addCategory", { message: "Category already exists." });
    }

    const uploadImageName=req.file?req.file.filename:''

    const newCategory = new Category({ name, description,categoryImg:uploadImageName });
    await newCategory.save();
    res.redirect("/admin/categoryDetails");
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).send("Internal Server Error");
  }
};


const addCategory = async (req, res) => {
  try {
    res.render("addCategory");
  } catch (error) {
    console.error("Error rendering add category page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- EDIT CATEGORY ---------------------------------------------------------//

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id; 
    const {name ,description}=req.body
    if (!id) {
      return res.status(400).send("Missing category ID"); 
    }

    const existingCategories = await Category.find({}, 'name');
    const categoryData = await Category.findOne({ _id: id });

    if (!categoryData) {
      return res.status(404).send("Category not found"); 
    }

   
    const isAlphabetic = /^[a-zA-Z_]+$/.test(req.body.name);
    const isNumeric = /^\d+$/.test(req.body.name);

    if (!isAlphabetic && isNumeric) {
      return res.status(400).send("Invalid category name. Please enter letters or underscores only.");
    }

    res.render("updateCategory", { categoryData });
  } catch (error) {
    console.error("Error rendering edit category page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- BLOCK CATEGORY ---------------------------------------------------------//

const blockCategory = async (req, res) => {
  try {
    const categoryId = req.query.id;
    const category = await Category.findByIdAndUpdate(categoryId, { is_Listed: true }, { new: true });
    
    if (!category) {
      return res.status(404).send("Category not found");
    }
    // Block all products under this category
    await Product.updateMany(
      { category: categoryId },
      { $set: { is_Listed: true } }
    );
    res.redirect("/admin/categoryDetails");
  } catch (error) {
    console.error("Error occurred while blocking category and products:", error);
    res.status(500).send("Internal Server Error");
  }
};


//-------------------------------------------------------- UNBLOCK CATEGORY -------------------------------------------------------//


const unblockCategory = async (req, res) => {
  try {
    const categoryId = req.query.id;
    const category = await Category.findByIdAndUpdate(categoryId, { is_Listed: false }, { new: true });
    if (!category) {
      return res.status(404).send("Category not found");
    }
    // Optionally unblock all products under this category
    // Uncomment the following lines if you want to unblock products when unblocking a category
    await Product.updateMany(
      { category: categoryId },
      { $set: { is_Listed: false } }
    );
    res.redirect("/admin/categoryDetails");
  } catch (error) {
    console.error("Error occurred while unblocking category:", error);
    res.status(500).send("Internal Server Error");
  }
};


//-------------------------------------------------------- UPDATE CATEGORY -------------------------------------------------------//

const updateCategory = async (req, res) => {
  try {
    const { id, name, description } = req.body;
    const existingCategory = await Category.findOne({ _id: { $ne: id }, name: { $regex: new RegExp("^" + name + "$", "i") } });

    if (existingCategory) {
      return res.status(400).json({ message: "Category name already exists." }); 
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, { name, description }, { new: true });

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found." }); 
    }

    res.json({ message: "Category updated successfully!" });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- PRODUCT DETAILS -------------------------------------------------------//

const renderProduct = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find()
                                  .populate("category")
                                  .skip(skip)
                                  .limit(limit)
                                  .select('name price category stock image is_Listed');

    res.render("productDetails", {
      products,
      currentPage: page,
      totalPages,
      totalProducts,
      limit
    });
  } catch (error) {
    console.error("Error rendering product details:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- ADD PRODUCT ---------------------------------------------------------//

const addProduct = async (req, res) => {
  try {
    const categoryData = await Category.find({ is_Listed: false });
    res.render("addProduct", { categoryData });
  } catch (error) {
    console.error("Error rendering add product page:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- ADDING NEW PRODUCT ---------------------------------------------------------//

const addingNewProduct = async (req, res) => {
  try {
    const { name, description, price, stock, dateCreated, category } = req.body;
    // console.log(stock);
    const categoryId = await Category.findOne({ _id: category, is_Listed: false });
    const categoryData = await Category.find({ is_Listed: false });
    if (!categoryId) {
      return res.render("addProduct", { message: "Category not found or is not listed.", categoryData});
    }
    if(stock < 0){
      return res.render("addProduct", { message: "Stock cannot be negative.", categoryData});
    }
    const normalizedProductName = name.trim().toLowerCase();
    const existingProduct = await Product.findOne({ name: normalizedProductName });
    if (existingProduct) {
      return res.render("addProduct", { message: "Product name already exists",categoryData});
    }
    const croppedimages = [];
    for (const file of req.files) {
      const croppedBuffer = await sharp(file.path).resize({ width: 350, height: 450, fit: sharp.fit.cover }).toBuffer();
      const filename = `cropped_${file.originalname}`;
      croppedimages.push(filename);
      await sharp(croppedBuffer).toFile(`public/productimage/${filename}`);
    }
    const product = new Product({ name, description, price, category: categoryId._id, stock, image: croppedimages, dateCreated });
    await product.save();
    res.redirect("/admin/productlist");
  } catch (error) {
    console.error("Error adding new product:", error);
    res.status(500).render('error');
  }
};

//-------------------------------------------------------- DELETE IMAGE ---------------------------------------------------------//

const deleteImage = async (req, res) => {
  try {
    const { productId, imageIndex } = req.params;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    if (product.image.length <= imageIndex) {
      return res.status(400).send("Invalid image index");
    }
    const deletedImage = product.image.splice(imageIndex, 1)[0];
    await product.save();
    res.status(200).send(`Image '${deletedImage}' deleted successfully`);
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- EDIT PRODUCT LOAD---------------------------------------------------------//

const editproductsLoad = async (req, res) => {
  try {
    const id = req.query.id;
    const categorydata = await Category.find({});
    const productsData = await Product.findOne({ _id: id });
    res.render("editProduct", { productsData, categorydata });
  } catch (error) {
    console.error("Error loading edit product page:", error);
    res.status(500).send("Internal Server Error");
  }
};

   
const updateProduct = async (req, res) => {
  try {
    const { id, name, description, price, category, stock, dateCreated } = req.body;

    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const existingProductName = await Product.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp("^" + name + "$", "i") }
    });

    if (existingProductName) {
      return res.status(400).json({ success: false, message: "Product name already exists" });
    }

    let updatedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const croppedBuffer = await sharp(file.path)
          .resize({ width: 350, height: 450, fit: sharp.fit.cover })
          .toBuffer();

        const filename = `cropped_${file.originalname}`;
        updatedImages.push(filename); 
        await sharp(croppedBuffer).toFile(`public/productimage/${filename}`);
      }
    }

    if (req.body.existing_images && req.body.existing_images.length > 0) {
      const existingImages = req.body.existing_images;
      updatedImages = [...updatedImages, ...existingImages];
    }

    existingProduct.name = name;
    existingProduct.description = description;
    existingProduct.price = price;
    existingProduct.category = category;
    existingProduct.stock = stock;
    existingProduct.image = updatedImages; 
    existingProduct.dateCreated = dateCreated;

    await existingProduct.save();

    res.status(200).json({ success: true, message: 'Product updated successfully' });

  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

//-------------------------------------------------------- BLOCK PRODUCT ---------------------------------------------------------//

const blockProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).send("Product not found");
    }
    
    // Toggle the is_Listed field
    product.is_Listed = !product.is_Listed;
    
    // Save the updated product
    await product.save();
    
    res.redirect("/admin/Productlist");
  } catch (error) {
    console.error("Error occurred while blocking/unblocking product:", error);
    res.status(500).send("Internal Server Error");
  }
};


//************************************************** ORDER DETAILS ****************************************************************/
const renderOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    const orderData = await Order.find()
      .populate('orderedItem.productId')
      .populate('userId')
      .populate('deliveryAddress')
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit);

    res.render('orderDetails', { 
      orderData,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: totalPages
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

//------------------------------------------------------ SINGLE VIEW ---------------------------------------------------------//

const renderSingleView=async(req,res)=>{
  try{
    res.render('singleOrder')
  }catch(error){
    console.log(error.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

//------------------------------------------------------ UPDATE STATUS ---------------------------------------------------------//

const updateStatus = async (req, res) => {
  const { orderId, itemId, status } = req.body;
  try {
      const order = await Order.findById(orderId);
      if (order) {
          const item = order.orderedItem.id(itemId);
          if (item) {
              item.orderStatus = status;
              await order.save();
              return res.json({ success: true, order });
          }
      }
      return res.json({ success: false, message: 'Order or item not found' });
  } catch (error) {
      return res.json({ success: false, message: error.message });
  }
};

//------------------------------------------------------ APPROVE RETURN ---------------------------------------------------------//

const approveReturn= async (req, res) => {
  const { itemId } = req.body;
  try {
      const order = await Order.findOne({ 'orderedItem._id': itemId });
      if (order) {
          const item = order.orderedItem.id(itemId);
          if (item) {
              item.orderStatus = 'approved';
              await order.save();
              return res.json({ success: true, order });
          }
      }
      return res.json({ success: false, message: 'Order or item not found' });
  } catch (error) {
      return res.json({ success: false, message: error.message });
  }
};

//------------------------------------------------------ REJECT RETURN ---------------------------------------------------------//

const rejectReturn= async (req, res) => {
  const { itemId } = req.body;
  try {
      const order = await Order.findOne({ 'orderedItem._id': itemId });
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

      const item = order.orderedItem.id(itemId);
      if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

      item.orderStatus = 'Rejected';
      await order.save();
      res.json({ success: true, message: 'Return rejected successfully' });
  } catch (error) {
      console.error('Error rejecting return:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

//------------------------------------------------------ COUPON -----------------------------------------------------------------//

const renderCoupon = async (req, res) => {
  try {
    const coupons = await Coupon.find().lean();
    coupons.forEach(coupon => {
      coupon.formattedDate = moment(coupon.expiryDate).format('YYYY-MM-DD');
    });
    res.render('coupon', { coupons });
  } catch (error) {
    console.error(error.message);
  }
};

//------------------------------------------------------ ADD COUPON -------------------------------------------------------------//

const addCoupon = async (req, res) => {
  try {
    res.render('addCoupon');
  } catch (error) {
    console.error(error.message);
  }
};

const submitAddCoupon = async (req, res) => {
  try {
    const { couponCode, discountAmount, minimumAmount, description, expiryDate } = req.body;
    
    let errors = [];

    if (!couponCode || /^\d/.test(couponCode)) {
      errors.push("Coupon code must not be empty and must not start with a number.");
    }

    // Check for special characters in coupon code
    if (/[^a-zA-Z0-9]/.test(couponCode)) {
      errors.push("Coupon code must not contain special characters.");
    }

    // Check if coupon code is unique
    const existingCoupon = await Coupon.findOne({ couponCode });
    if (existingCoupon) {
      errors.push("Coupon code already exists. Please choose a different code.");
    }

    const expiryDateObj = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight for accurate date comparison

    if (expiryDateObj < today) {
      errors.push("Expiry date cannot be a past date.");
    }

    if (parseFloat(minimumAmount) <= 0) {
      errors.push("Minimum amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) <= 0) {
      errors.push("Discount amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) >= parseFloat(minimumAmount)) {
      errors.push("Discount amount must be less than the minimum amount.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const newCoupon = new Coupon({
      couponCode,
      discountAmount,
      minimumAmount,
      description,
      expiryDate
    });
    await newCoupon.save();
    res.redirect('/admin/coupon');
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Server error" });
  }
};


//------------------------------------------------------ EDIT COUPON -------------------------------------------------------------//

const renderEditCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const couponData = await Coupon.findOne({ _id: id }).lean();
    if (couponData && couponData.expiryDate) {
      couponData.formattedExpiryDate = moment(couponData.expiryDate).format('YYYY-MM-DD');
    }
    res.render('editCoupon', { couponData });
  } catch (error) {
    console.error(error.message);
  }
};

const submitEditCoupon = async (req, res) => {
  try {
    const { id, couponCode, discountAmount, minimumAmount, description, expiryDate } = req.body;
    
    let errors = [];

    if (!couponCode || /^\d/.test(couponCode)) {
      errors.push("Coupon code must not be empty and must not start with a number.");
    }

    // Check for special characters in coupon code
    if (/[^a-zA-Z0-9]/.test(couponCode)) {
      errors.push("Coupon code must not contain special characters.");
    }

    // Check if coupon code is unique (excluding the current coupon being edited)
    const existingCoupon = await Coupon.findOne({ couponCode, _id: { $ne: id } });
    if (existingCoupon) {
      errors.push("Coupon code already exists. Please choose a different code.");
    }

    const expiryDateObj = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Set time to midnight for accurate date comparison

    if (expiryDateObj < today) {
      errors.push("Expiry date cannot be a past date.");
    }

    if (parseFloat(minimumAmount) <= 0) {
      errors.push("Minimum amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) <= 0) {
      errors.push("Discount amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) >= parseFloat(minimumAmount)) {
      errors.push("Discount amount must be less than the minimum amount.");
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    await Coupon.updateOne(
      { _id: id },
      {
        couponCode,
        discountAmount,
        minimumAmount,
        description,
        expiryDate,
      }
    );

    res.redirect('/admin/coupon');
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Server error" });
  }
};

//------------------------------------------------------ DELETE COUPON -------------------------------------------------------------//

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.body.couponId; 
    await Coupon.deleteOne({ _id: couponId });
    res.json({ success: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

//---------------------------------------------------- RENDER OFFERS ----------------------------------------------------------//

const renderOffer = async (req, res) => {
  try {
      // console.log('entered offer page');
      const offers = await Offer.find(); 
      res.render('offer', { offers }); 
  } catch (error) {
      console.log('Error in loading offer page:', error);
      res.status(500).send('Internal Server Error');
  }
};

//---------------------------------------------------- ADD OFFER ----------------------------------------------------------//

const loadAddOffer = async (req, res) => {
  try {
      // console.log('entering load add offer page');

      const products = await Product.find({})

      const categories = await Category.find({})


      res.render('addOffer', { products: products, categories: categories })
  } catch (error) {
      console.log('error in loading the add offer page');
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

//---------------------------------------------------- SUBMIT ADD OFFER ----------------------------------------------------------//

const addOffer = async (req, res) => {
  try {
    // console.log('adding offer started');
    // console.log(req.body);

    const details = req.body;
    const { offerName, discount, startDate, endDate, offerType, productId, categoryId } = details;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ success: false, errorMessage: 'Start date must be before end date' });
    }

    const newOffer = new Offer({
      offerName,
      discount,
      startDate,
      endDate,
      offerType,
    });

    if (offerType === 'Product') {
      // console.log('going with product offer');
      newOffer.productId = productId;
      const proData = await Product.findOne({ _id: productId });
      await Product.findByIdAndUpdate(
        { _id: productId },
        {
          $set: {
            productOfferId: newOffer._id,
            productDiscount: discount,
            discountedPrice: proData.price - discount,
          },
        }
      );
    } else if (offerType === 'Category') {
      // console.log('going with category offer');
      newOffer.categoryId = categoryId;
      const catProducts = await Product.find({ category: categoryId });
      // console.log('catProducts', catProducts);
      for (const product of catProducts) {
        await Product.findByIdAndUpdate(
          { _id: product._id },
          {
            $set: {
              categoryOfferId: newOffer._id,
              categoryDiscount: discount,
              discountedPrice: product.price - discount,
            },
          }
        );
      }
    }

    await newOffer.save();
    res.redirect('/admin/offer');
  } catch (error) {
    console.log('error in adding offer', error);
    res.status(500).send('Error adding offer: ' + error.message);
  }
};

//---------------------------------------------------- EDIT OFFER ----------------------------------------------------------//

const loadEditOffer = async (req, res) => {
  try {
      // console.log('starting to laod the edit offer page');

      const id = req.query.id
      // console.log("id", id);

      const products = await Product.find({})

      const categories = await Category.find({})

      const offer = await Offer.findOne({ _id: id })

      console.log('offer', offer);

      res.render('editOffer', { products: products, offer: offer, categories: categories })

  } catch (error) {
      console.log('error loading edit offer page', error)
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

//---------------------------------------------------- SUBMIT EDIT OFFER ----------------------------------------------------------//

const editOffer = async (req, res) => {
  try {

      // console.log('starting to edit coupon');

      const details = req.body;
      // console.log('details', details);

      const id = details.id;
      // console.log('id', id);

      const startDate = new Date(details.startDate)
      // console.log('startDate', startDate);
      const endDate = new Date(details.endDate);
      // console.log('endDate', endDate);
      if (startDate >= endDate) {
          return res.status(400).json({ error: 'Start date must be less than end date' });
      }
      const updateOffer = await Offer.findByIdAndUpdate(
          { _id: id },
          { $set: details },
          { new: true }
      )
      // console.log('updateOffer', updateOffer)

      if (updateOffer) {
          res.redirect('/admin/offer');
      } else {
          console.log(' editing issue in offer');
      }

  } catch (error) {
      console.log('error in editing the offer', error)
      res.status(500).send("Internal server error");
  }
}

//---------------------------------------------------- DELETE OFFER ----------------------------------------------------------//

const deleteOffer = async (req, res) => {
  try {
      // console.log('Started deleting offer');

      const { offerId } = req.body;

      const offer = await Offer.findById(offerId);

      if (!offer) {
          // console.log(`Offer with ID ${offerId} not found`);
          return res.status(404).json({ success: false, message: "Offer not found" });
      }

      if (offer.offerType === 'Product') {

          await Product.findOneAndUpdate(
              { _id: offer.productId },
              {
                  $unset: {
                      productOfferId: 1, 
                      productDiscount: 1, 
                  },
                  $inc: { price: offer.discount } 
              }
          );
          // console.log(`Updated product with ID ${offer.productId}`);
      } else if (offer.offerType === 'Category') {
          
          const catProducts = await Product.find({ categoryId: offer.categoryId });
          for (const product of catProducts) {
              await Product.findOneAndUpdate(
                  { _id: product._id },
                  {
                      $unset: {
                          categoryOfferId: 1, 
                          categoryDiscount: 1, 
                      },
                      $inc: { price: offer.discount } 
                  }
              );
              // console.log(`Updated product with ID ${product._id} in category ${offer.categoryId}`);
          }
      }

   
      await Offer.deleteOne({ _id: offerId });
      // console.log(`Deleted offer with ID ${offerId}`);

      res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
      console.error('Error in deleting the offer', error);
      res.status(500).json({ success: false, message: "Error deleting offer: " + error.message });
  }
}

//---------------------------------------------------- SALES REPORT ----------------------------------------------------------//

const loadSalesReport = async (req, res) => {
  try {
      // Pagination setup
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      // Filter and populate orders
      const orders = await Order.find({ 'orderedItem.orderStatus': 'delivered' })
          .populate('userId')
          .populate('deliveryAddress')
          .populate({ path: 'orderedItem.productId', model: 'Product' })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

      // Get total count for pagination
      const totalOrders = await Order.countDocuments({ 'orderedItem.orderStatus': 'delivered' });

      // Format orders
      const formattedOrders = orders.map(order => ({
          ...order.toObject(),
          formattedCreatedAt: moment(order.createdAt).format('YYYY-MM-DD'),
          userName: order.userId.name
      }));

      res.render('salesReport', {
          orderDetails: formattedOrders,
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit)
      });
  } catch (error) {
      console.error('Error loading sales report page:', error);
      res.status(500).send('Error loading sales report');
  }
};


const generateReport = async (startDate, endDate) => {
  const report = await Order.aggregate([
      {
          $match: {
              createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
              'orderedItem.orderStatus': 'delivered'
          }
      },
      {
          $unwind: '$orderedItem'
      },
      {
          $group: {
              _id: {
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  productId: '$orderedItem.productId'
              },
              totalOrders: { $sum: 1 },
              totalQuantity: { $sum: '$orderedItem.quantity' },
              totalAmount: { $sum: '$orderedItem.totalProductAmount' },
              totalCouponAmount: { $sum: { $ifNull: ['$coupon', 0] } }
          }
      },
      {
          $lookup: {
              from: 'products',
              localField: '_id.productId',
              foreignField: '_id',
              as: 'productDetails'
          }
      },
      {
          $unwind: '$productDetails'
      },
      {
          $project: {
              date: '$_id.date',
              productName: '$productDetails.name',
              productPrice: '$productDetails.price',
              totalOrders: 1,
              totalQuantity: 1,
              totalAmount: 1,
              totalCouponAmount: 1
          }
      },
      {
          $sort: { date: 1, productName: 1 }
      }
  ]);

  const totals = report.reduce((acc, curr) => ({
      totalOrders: acc.totalOrders + curr.totalOrders,
      totalQuantity: acc.totalQuantity + curr.totalQuantity,
      totalAmount: acc.totalAmount + curr.totalAmount,
      totalCouponAmount: acc.totalCouponAmount + curr.totalCouponAmount
  }), { totalOrders: 0, totalQuantity: 0, totalAmount: 0, totalCouponAmount: 0 });

  return { report, totals };
};

//---------------------------------------------------- DAILY SALES REPORT ----------------------------------------------------------//

const dailySalesReport = async (req, res) => {
  try {
      const startDate = moment().startOf('day');
      const endDate = moment().endOf('day');
      const { report, totals } = await generateReport(startDate, endDate);
      res.render('reports', { report, totals, reportType: 'Daily' });
  } catch (error) {
      console.error('Error generating daily sales report:', error);
      res.status(500).send('Error generating daily sales report');
  }
};

//---------------------------------------------------- WEEKLY SALES REPORT ----------------------------------------------------------//

const generateWeeklyReport = async (req, res) => {
  try {
      const startDate = moment().startOf('isoWeek');
      const endDate = moment().endOf('isoWeek');
      const { report, totals } = await generateReport(startDate, endDate);
      res.render('reports', { report, totals, reportType: 'Weekly' });
  } catch (error) {
      console.error('Error generating weekly sales report:', error);
      res.status(500).send('Error generating weekly sales report');
  }
};

//---------------------------------------------------- MONTHLY SALES REPORT ----------------------------------------------------------//

const generateMonthlyReport = async (req, res) => {
  try {
      const startDate = moment().startOf('month');
      const endDate = moment().endOf('month');
      const { report, totals } = await generateReport(startDate, endDate);
      res.render('reports', { report, totals, reportType: 'Monthly' });
  } catch (error) {
      console.error('Error generating monthly sales report:', error);
      res.status(500).send('Error generating monthly sales report');
  }
};

//---------------------------------------------------- YEARLY SALES REPORT ----------------------------------------------------------//

const generateYearlyReport = async (req, res) => {
  try {
      const startDate = moment().startOf('year');
      const endDate = moment().endOf('year');
      const { report, totals } = await generateReport(startDate, endDate);
      res.render('reports', { report, totals, reportType: 'Yearly' });
  } catch (error) {
      console.error('Error generating yearly sales report:', error);
      res.status(500).send('Error generating yearly sales report');
  }
};

//---------------------------------------------------- CUSTOM DATE SALES REPORT ----------------------------------------------------------//

const generateCustomDateReport = async (req, res) => {
  try {
      const startDate = moment(req.query.startDate).startOf('day');
      const endDate = moment(req.query.endDate).endOf('day');

      if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate)) {
          return res.status(400).send('Invalid date range');
      }

      const { report, totals } = await generateReport(startDate, endDate);
      res.render('customReport', {
          report,
          totals,
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD'),
          reportType: 'Custom'
      });
  } catch (error) {
      console.error('Error generating custom date report:', error);
      res.status(500).send('Error generating custom date report');
  }
};


//---------------------------------------------------- CANCEL ORDER ----------------------------------------------------------//

const approveCancelOrder=async(req,res)=>{
  try {
    const { itemId } = req.body;
    
    const order = await Order.findOne({
      'orderedItem._id': itemId
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const item = order.orderedItem.id(itemId);

    if (item.orderStatus !== 'Cancellation Request Sent') {
      return res.status(400).json({ error: 'Order status is not eligible for cancellation' });
    }

    item.orderStatus = 'cancelled';

    await order.save();

    return res.status(200).json({ success: true, message: 'Cancellation request approved successfully' });
  } catch (error) {
    console.error('Error approving cancellation request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

//---------------------------------------- OFFERS -------------------------------------------------------------------------------//
const productOfferPage = async (req, res) => {
  try {
    const offers = await ProductOffer.find({ is_active: true }).populate('productId');
    res.render('productOffer', { offers });
  } catch (error) {
    console.error('Error in the offer page:', error);
  }
};

const addProductOfferPage = async (req, res) => {
  try {
    const products = await Product.find({});
    res.render('addProductOffer', { 
      products, 
      errorMessage: req.flash('error'), 
      successMessage: req.flash('success') 
    });
  } catch (error) {
    console.error('Error in addProductOfferPage:', error.message);
    req.flash('error', 'Unable to load the page. Please try again later.');
    res.redirect('/admin/productOffer');
  }
};

const addProductOfferPost = async (req, res) => {
  try {
    const { offerName, discount, startDate, endDate, productId } = req.body;

    // Check for existing product offer for the same product
    const existingOffer = await ProductOffer.findOne({ productId });
if (existingOffer) {
  req.flash('error', 'A product offer already exists for this product.');
  return res.redirect('/admin/addProductOffer');
}


    // Check for special characters in offerName
    if (!/^[a-zA-Z0-9\s]+$/.test(offerName)) {
      req.flash('error', 'Offer name cannot contain special characters.');
      return res.redirect('/admin/addProductOffer');
    }

    // Check for empty fields
    if (!offerName || !discount || !startDate || !endDate || !productId) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/admin/addProductOffer');
    }

    // Check discount value
    if (discount <= 0 || discount >= 100) {
      req.flash('error', 'Discount must be between 1 and 100.');
      return res.redirect('/admin/addProductOffer');
    }
    

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set the time to 00:00:00 for today

    // Check start and end dates
    if (new Date(startDate) < today) {
      req.flash('error', 'Start date must be today or after today.');
      return res.redirect('/admin/addProductOffer');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect('/admin/addProductOffer');
    }

    // Create and save the new product offer
    const newOffer = new ProductOffer({
      offerName,
      discount,
      startDate,
      endDate,
      productId,
    });

    await newOffer.save();
    req.flash('success', 'Product offer added successfully.');
    res.redirect('/admin/productOffer');
  } catch (error) {
    console.error('Error in addProductOfferPost:', error);
    req.flash('error', 'An error occurred while adding the offer. Please try again.');
    res.redirect('/admin/addProductOffer');
  }
};



const editProductOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await ProductOffer.findById(offerId).populate('productId');
    const products = await Product.find({});
    res.render('editProductOffer', { offer, products, errorMessage: req.flash('error') });
  } catch (error) {
    console.error('Error in edit offer page:', error);
    req.flash('error', 'Failed to load the edit offer page');
    res.redirect('/admin/productOffer');
  }
};

const updateProductOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { offerName, discount, startDate, endDate, productId } = req.body;

    // Regular expression to check for numbers, spaces, or special characters
    const invalidOfferNameRegex = /[^a-zA-Z]/;

    // Find the current offer details
    const currentOffer = await ProductOffer.findById(offerId);

    // Check if any required field is missing
    if (!offerName || !discount || !startDate || !endDate || !productId) {
      req.flash('error', 'All fields are required.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    // Validate offer name
    if (invalidOfferNameRegex.test(offerName)) {
      req.flash('error', 'Offer name cannot contain numbers, spaces, or special characters.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    // Validate discount value
    if (discount <= 0) {
      req.flash('error', 'Discount cannot be less than or equal to 0.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    if (discount >= 100) {
      req.flash('error', 'Discount cannot be greater than or equal to 100.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set the time to 00:00:00 for today
    
    // Validate if the start date is today or after today
    if (new Date(startDate) < today) {
      req.flash('error', 'Start date must be today or after today.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }
    
    // Validate if the start date is before the end date
    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    // Check if there is already an offer for the same product
    const existingOffer = await ProductOffer.findOne({ productId, _id: { $ne: offerId } });
    if (existingOffer) {
      req.flash('error', 'A product offer already exists for this product.');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    // Update the offer
    await ProductOffer.findByIdAndUpdate(offerId, {
      offerName,
      discount,
      startDate,
      endDate,
      productId,
    });

    res.redirect('/admin/productOffer');
  } catch (error) {
    console.error('Error in updating offer:', error);
    req.flash('error', 'Failed to update the offer');
    res.redirect(`/admin/editProductOffer/${offerId}`);
  }
};


const deleteProductOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await ProductOffer.findByIdAndDelete(offerId);
    res.redirect('/admin/productOffer');
  } catch (error) {
    console.error('Error in deleting offer:', error);
  }
};

//---------------------------------------------------- CATEGORY OFFER ---------------------------------------------------------------//
const categoryOfferPage = async (req, res) => {
  try {
    const categoryOffers = await CategoryOffer.find({ is_active: true }).populate('categoryId');
    res.render('categoryOffer', { categoryOffers });
  } catch (error) {
    console.error('Error in the offer page:', error);
  }
};

const addCategoryOfferPage = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.render('addCategoryOffer', { categories, errorMessage: req.flash('error') });
  } catch (error) {
    console.error('Error in addCategoryOfferPage:', error.message);
    req.flash('error', 'Failed to load the add category offer page');
    res.redirect('/admin/categoryOffer');
  }
};

const addCategoryOfferPost = async (req, res) => {
  try {
    const { offerName, discount, startDate, endDate, categoryId } = req.body;
    const invalidOfferNameRegex = /[^a-zA-Z]/;
    if (!offerName || !discount || !startDate || !endDate || !categoryId) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/admin/addCategoryOffer');
    }

    if (invalidOfferNameRegex.test(offerName)) {
      req.flash('error', 'Offer name cannot contain numbers, spaces, or special characters.');
      return res.redirect('/admin/addCategoryOffer');
    }

    if (discount >= 100) {
      req.flash('error', 'Discount cannot be greater than or equal to 100.');
      return res.redirect('/admin/addCategoryOffer');
    }
    if (discount <= 0) {
      req.flash('error', 'Discount cannot be less than or equal to 0.');
      return res.redirect('/admin/addCategoryOffer');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    if (new Date(startDate) < today) {
      req.flash('error', 'Start date must be today or after today.');
      return res.redirect('/admin/addCategoryOffer');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect('/admin/addCategoryOffer');
    }

    const existingOffer = await CategoryOffer.findOne({ categoryId });
    if (existingOffer) {
      req.flash('error', 'A category offer already exists for this category.');
      return res.redirect('/admin/addCategoryOffer');
    }

    const newOffer = new CategoryOffer({
      offerName,
      discount,
      startDate,
      endDate,
      categoryId,
      is_active: true
    });

    await newOffer.save();
    req.flash('success', 'Category offer added successfully.');
    res.redirect('/admin/categoryOffer');
  } catch (error) {
    console.error('Error in addCategoryOfferPost:', error);
    req.flash('error', 'Failed to add the category offer');
    res.redirect('/admin/addCategoryOffer');
  }
};



const editCategoryOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await CategoryOffer.findById(offerId).populate('categoryId');
    const categories = await Category.find({});
    res.render('editCategoryOffer', { offer, categories, errorMessage: req.flash('error') });
  } catch (error) {
    console.error('Error in edit offer page:', error);
    req.flash('error', 'Failed to load the edit category offer page');
    res.redirect('/admin/categoryOffer');
  }
};

const updateCategoryOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { offerName, discount, startDate, endDate, categoryId } = req.body;
    const invalidOfferNameRegex = /[^a-zA-Z]/;
    if (!offerName || !discount || !startDate || !endDate || !categoryId) {
      req.flash('error', 'All fields are required.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    if (invalidOfferNameRegex.test(offerName)) {
      req.flash('error', 'Offer name cannot contain numbers, spaces, or special characters.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    if (discount <= 0) {
      req.flash('error', 'Discount cannot be less than or equal to 0.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    if (new Date(startDate) < today) {
      req.flash('error', 'Start date must be today or after today.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    const existingOfferName = await CategoryOffer.findOne({ offerName, _id: { $ne: offerId } });
    if (existingOfferName) {
      req.flash('error', 'An offer with this name already exists.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    const existingOfferCategory = await CategoryOffer.findOne({ categoryId, _id: { $ne: offerId } });
    if (existingOfferCategory) {
      req.flash('error', 'A category offer already exists for this category.');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    await CategoryOffer.findByIdAndUpdate(offerId, {
      offerName,
      discount,
      startDate,
      endDate,
      categoryId,
    });

    res.redirect('/admin/categoryOffer');
  } catch (error) {
    console.error('Error in updating offer:', error);
    req.flash('error', 'Failed to update the category offer');
    res.redirect(`/admin/editCategoryOffer/${offerId}`);
  }
};


const deleteCategoryOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await CategoryOffer.findByIdAndDelete(offerId);
    res.redirect('/admin/categoryOffer');
  } catch (error) {
    console.error('Error in deleting offer:', error);
  }
};

//---------------------------------------------------- BEST SELLING PRODUCTS ---------------------------------------------------------------//

const getBestSellingProducts = async (req, res) => {
  try {
    const bestSellingProducts = await Order.aggregate([
      { $unwind: "$orderedItem" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItem.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$orderedItem.productId",
          productName: { $first: "$product.name" },
          productImage: { $first: { $arrayElemAt: ["$product.image", 0] } },
          totalQuantity: { $sum: "$orderedItem.quantity" }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    bestSellingProducts.forEach(product => {
      product.productImage = `/productimage/${product.productImage}`;
    });

    res.json(bestSellingProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//---------------------------------------------------- BEST SELLING CATEGORIES ---------------------------------------------------------------//

const getBestSellingCategories = async (req, res) => {
  try {
    const bestSellingCategories = await Order.aggregate([
      { $unwind: "$orderedItem" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItem.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          totalQuantity: { $sum: "$orderedItem.quantity" }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: 1,
          totalQuantity: 1,
          categoryName: "$category.name"
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]);

    res.json(bestSellingCategories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const rendererror=async(req,res)=>{
  try{
    res.render('error')
  }catch(error){
    console.log(error.message);
  }
}


module.exports = {
  renderLogin,
  verifyLogin,
  customerDetails,
  loadDashboard,
  newUserLoadHome,
  blockUser,
  unblockUser,
  categoryCreation,
  renderCategoryDetails,
  addCategory,
  getEditCategory,
  blockCategory,
  unblockCategory,
  updateCategory,
  renderProduct,
  addProduct,
  addingNewProduct,
  deleteImage,
  editproductsLoad,
  updateProduct,
  blockProduct,
  renderOrders,
  renderSingleView,
  updateStatus,
  rejectReturn,
  approveReturn,
  approveCancelOrder,
  renderCoupon,
  addCoupon,
  submitAddCoupon,
  renderEditCoupon,
  submitEditCoupon,
  deleteCoupon,
  deleteOffer,
  loadEditOffer,
  editOffer,
  loadEditOffer,
  addOffer,
  loadAddOffer,
  renderOffer,
  loadSalesReport,
  dailySalesReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateYearlyReport,
  generateCustomDateReport,
  getBestSellingProducts,
  getBestSellingCategories,
  productOfferPage,
  addProductOfferPage,
  addProductOfferPost,
  editProductOffer,
  updateProductOffer,
  deleteProductOffer,
  categoryOfferPage,
  addCategoryOfferPage,
  addCategoryOfferPost,
  editCategoryOffer,
  updateCategoryOffer,
  deleteCategoryOffer,
  rendererror
};