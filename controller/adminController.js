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
    console.error("Error rendering login:", error);
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
    console.log("Error loading dashboard:", error);
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
    const category = await Category.findByIdAndUpdate(categoryId, { is_Listed: true });
    if (!category) {
      return res.status(404).send("Category not found");
    }
    res.redirect("/admin/categoryDetails");
  } catch (error) {
    console.error("Error occurred while blocking category:", error);
    res.status(500).send("Internal Server Error");
  }
};

//-------------------------------------------------------- UNBLOCK CATEGORY -------------------------------------------------------//

const unblockCategory = async (req, res) => {
  try {
    const categoryId = req.query.id;
    const category = await Category.findByIdAndUpdate(categoryId, { is_Listed: false });
    if (!category) {
      return res.status(404).send("Category not found");
    }
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
    console.log(stock);
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
    product.is_Listed = !product.is_Listed;
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
      const orderData = await Order.find()
          .populate('orderedItem.productId')
          .populate('userId')
          .populate('deliveryAddress');
      res.render('orderDetails', { orderData });
  } catch (error) {
      console.log(error.message);
  }
};

//------------------------------------------------------ SINGLE VIEW ---------------------------------------------------------//

const renderSingleView=async(req,res)=>{
  try{
    res.render('singleOrder')
  }catch(error){
    console.log(error.message);
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

//------------------------------------------------------ SUBMIT ADD COUPON -------------------------------------------------------------//

const submitAddCoupon = async (req, res) => {
  try {
    const { couponCode, discountAmount, minimumAmount, description, expiryDate } = req.body;
    
    let errors = [];

    if (!couponCode || /^\d/.test(couponCode)) {
      errors.push("Coupon code must not be empty and must not start with a number.");
    }

    if (new Date(expiryDate) <= new Date()) {
      errors.push("Expiry date cannot be  a past date.");
    }

    if (parseFloat(minimumAmount) <= 0) {
      errors.push("Minimum amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) <= 0) {
      errors.push("Discount amount must be greater than 0.");
    }

    if (parseFloat(discountAmount) > parseFloat(minimumAmount)) {
      errors.push("Discount amount cannot be more than the minimum amount.");
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
      console.log('entering load add offer page');

      const products = await Product.find({})

      const categories = await Category.find({})


      res.render('addOffer', { products: products, categories: categories })
  } catch (error) {
      console.log('error in loading the add offer page');
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
      console.log("id", id);

      const products = await Product.find({})

      const categories = await Category.find({})

      const offer = await Offer.findOne({ _id: id })

      console.log('offer', offer);

      res.render('editOffer', { products: products, offer: offer, categories: categories })

  } catch (error) {
      console.log('error loading edit offer page', error)
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
      const orders = await Order.find({})
          .populate('userId')
          .populate('deliveryAddress')
          .populate({ path: 'orderedItem.productId', model: 'Product' }) 
          .sort({ _id: -1 });
      // console.log('orders', orders);

      const formattedOrders = orders.map(order => {
          const date = new Date(order.createdAt)
          const formattedDate = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
          return {
              ...order.toObject(),
              formattedCreatedAt: formattedDate,
          }
      })
      res.render('salesReport', { orderDetails: formattedOrders })
  } catch (error) {
      console.log('error loading sales report page', error);
  }
}

//---------------------------------------------------- DAILY SALES REPORT ----------------------------------------------------------//

const dailySalesReport = async (req, res) => {
  try {
      const startDate = moment().startOf('day');
      const endDate = moment().endOf('day');

      const dailyReport = await Order.aggregate([
          {
              $match: {
                  createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
              }
          },
          {
              $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: "$orderAmount" },
                  totalCouponAmount: { $sum: "$coupon" }
              }
          }
      ]);


      const totalOrders = dailyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
      const totalAmount = dailyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
      const totalCouponAmount = dailyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

      // console.log('dailyReport', dailyReport);

      res.render('reports', { report: dailyReport, totalOrders, totalAmount, totalCouponAmount });

  } catch (error) {
      console.log('error loading daily sales report', error);
      throw error;
  }
}

//---------------------------------------------------- WEEKLY SALES REPORT ----------------------------------------------------------//

const generateWeeklyReport = async (req, res) => {
  try {
      const startDate = moment().startOf('week');
      const endDate = moment().endOf('week');

      const weeklyReport = await Order.aggregate([
          {
              $match: {
                  createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
              }
          },
          {
              $group: {
                  _id: { $week: "$createdAt" },
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: "$orderAmount" },
                  totalCouponAmount: { $sum: "$coupon" }
              }
          }
      ]);

     
      const totalOrders = weeklyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
      const totalAmount = weeklyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
      const totalCouponAmount = weeklyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

      // console.log('weeklyReport', weeklyReport);

      res.render('reports', { report: weeklyReport, totalOrders, totalAmount, totalCouponAmount });
  } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
  }
};

//---------------------------------------------------- MONTHLY SALES REPORT ----------------------------------------------------------//

const generateMonthlyReport = async (req, res) => {
  try {
      const monthlyReport = await Order.aggregate([
          {
              $group: {
                  _id: { $month: "$createdAt" },
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: "$orderAmount" },
                  totalCouponAmount: { $sum: "$coupon" }
              }
          }
      ]);

      const formattedReport = monthlyReport.map(report => ({
          _id: moment().month(report._id - 1).format('MMMM'),
          totalOrders: report.totalOrders,
          totalAmount: report.totalAmount
      }));

      // console.log('monthlyReport', formattedReport);

      const totalOrders = formattedReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
      const totalAmount = formattedReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
      const totalCouponAmount = monthlyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);
      res.render('reports', { report: formattedReport, totalOrders, totalAmount, totalCouponAmount });
  } catch (error) {
      console.error('Error generating monthly report:', error);
      throw error;
  }
};

//---------------------------------------------------- YEARLY SALES REPORT ----------------------------------------------------------//

const generateYearlyReport = async (req, res) => {
  try {
      const yearlyReport = await Order.aggregate([
          {
              $group: {
                  _id: { $year: "$createdAt" },
                  totalOrders: { $sum: 1 },
                  totalAmount: { $sum: "$orderAmount" },
                  totalCouponAmount: { $sum: "$coupon" }
              }
          }
      ]);


      const totalOrders = yearlyReport.reduce((acc, curr) => acc + curr.totalOrders, 0);
      const totalAmount = yearlyReport.reduce((acc, curr) => acc + curr.totalAmount, 0);
      const totalCouponAmount = yearlyReport.reduce((acc, curr) => acc + curr.totalCouponAmount, 0);

      // console.log('yearlyReport', yearlyReport);

      res.render('reports', { report: yearlyReport, totalOrders, totalAmount, totalCouponAmount });
  } catch (error) {
      console.error('Error generating yearly report:', error);
      throw error;
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

      const customDateReport = await Order.find({
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
      });

      let totalAmount = 0;
      let totalOrders = customDateReport.length;

      if (totalOrders > 0) {
          customDateReport.forEach(order => {
              if (order.orderAmount && !isNaN(order.orderAmount)) {
                  totalAmount += parseFloat(order.orderAmount);
              } else {
                  console.warn('Invalid or missing orderAmount in order:', order);
              }
          });
      } else {
          console.warn('No orders found within the specified date range.');
      }

      // console.log('Total Amount:', totalAmount);
      // console.log('Total Orders:', totalOrders);

      res.render('customReport', {
          report: customDateReport,
          startDate: startDate.format('YYYY-MM-DD'),
          endDate: endDate.format('YYYY-MM-DD'),
          totalAmount: totalAmount.toFixed(2),
          totalOrders: totalOrders
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
    res.render('addProductOffer', { products, errorMessage: req.flash('error') });
  } catch (error) {
    console.error('Error in addProductOfferPage:', error.message);
  }
};

const addProductOfferPost = async (req, res) => {
  try {
    const { offerName, discount, startDate, endDate, productId } = req.body;
    console.log(req.body);

    if (!offerName || !discount || !startDate || !endDate || !productId) {
      req.flash('error', 'Missing required fields');
      return res.redirect('/admin/addProductOffer');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date');
      return res.redirect('/admin/addProductOffer');
    }

    const newOffer = new ProductOffer({
      offerName,
      discount,
      startDate,
      endDate,
      productId,
      is_active: true
    });

    await newOffer.save();
    res.redirect('/admin/productOffer');
  } catch (error) {
    console.error('Error in the offer page:', error);
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
  }
};


const updateProductOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { offerName, discount, startDate, endDate, productId } = req.body;

    if (!offerName || !discount || !startDate || !endDate || !productId) {
      req.flash('error', 'Missing required fields');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date');
      return res.redirect(`/admin/editProductOffer/${offerId}`);
    }

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
  }
};

const addCategoryOfferPost = async (req, res) => {
  try {
    const { offerName, discount, startDate, endDate, categoryId } = req.body;
    console.log(req.body);

    if (!offerName || !discount || !startDate || !endDate || !categoryId) {
      req.flash('error', 'Missing required fields');
      return res.redirect('/admin/addCategoryOffer');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date');
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
    res.redirect('/admin/categoryOffer');
  } catch (error) {
    console.error('Error in the offer page:', error);
  }
}

const editCategoryOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await CategoryOffer.findById(offerId).populate('categoryId');
    const categories = await Category.find({});
    res.render('editCategoryOffer', { offer, categories, errorMessage: req.flash('error') });
  } catch (error) {
    console.error('Error in edit offer page:', error);
  }
};

const updateCategoryOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { offerName, discount, startDate, endDate, categoryId } = req.body;

    if (!offerName || !discount || !startDate || !endDate || !categoryId) {
      req.flash('error', 'Missing required fields');
      return res.redirect(`/admin/editCategoryOffer/${offerId}`);
    }

    if (new Date(startDate) >= new Date(endDate)) {
      req.flash('error', 'Start date must be before end date');
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
  // daily,
  // weekly,
  // monthly,
  // yearly

  productOfferPage,
  addProductOfferPage,
  addProductOfferPost,
  // DummyOfferList,
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