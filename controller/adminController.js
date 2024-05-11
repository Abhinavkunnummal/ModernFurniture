const User = require("../model/userModel");
const Category = require("../model/category");
const Product = require("../model/product");
const multer = require("multer");
const bcrypt = require("bcrypt");
const sharp = require("sharp"); //CROPPER JS
const Order=require('../model/order')

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

const loadDashboard = async (req, res) => {
  try {
    res.render("dashboard");
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
};

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

const renderCategoryDetails = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render("categoryDetails", { categories });
  } catch (error) {
    console.error("Error rendering category details:", error);
    res.status(500).send("Internal Server Error");
  }
};

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

const updateCategory = async (req, res) => {
  try {
    // console.log('req.body:', req.body); 

    const { id, name, description } = req.body;

    
    const existingCategory = await Category.findOne({ _id: { $ne: id }, name: { $regex: new RegExp("^" + name + "$", "i") } });

    if (existingCategory) {
      return res.status(400).json({ message: "Category name already exists." }); 
    }

    
    const updatedCategory = await Category.findByIdAndUpdate(id, { name, description }, { new: true });

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found." }); 
    }

    console.log("Updated category:", updatedCategory); 

    res.json({ message: "Category updated successfully!" });

  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).send("Internal Server Error");
  }
};


const renderProduct = async (req, res) => {
  try {
    const products = await Product.find().populate("category");
    res.render("productDetails", { products });
  } catch (error) {
    console.error("Error rendering product details:", error);
    res.status(500).send("Internal Server Error");
  }
};

const addProduct = async (req, res) => {
  try {
    const categoryData = await Category.find({ is_Listed: false });
    res.render("addProduct", { categoryData });
  } catch (error) {
    console.error("Error rendering add product page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const addingNewProduct = async (req, res) => {
  try {
    const { name, description, price, stock, dateCreated, category } = req.body;
    const categoryId = await Category.findOne({ _id: category, is_Listed: false });
    const categoryData = await Category.find({ is_Listed: false });
    if (!categoryId) {
      return res.render("addProduct", { message: "Category not found or is not listed.", categoryData});
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

const renderOrders=async(req,res)=>{
  try{
    const orderData=await Order.find().populate('orderedItem.productId').populate('userId')
    res.render('orderDetails',{orderData})
  }catch(error){
    console.log(error.message)
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
};