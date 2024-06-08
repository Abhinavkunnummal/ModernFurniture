const express = require("express");
const adminRoute = express();
const bodyParser = require("body-parser");

const upload=require('../middleware/multer')

adminRoute.use(bodyParser.urlencoded({ extended: true }));
adminRoute.use(bodyParser.json());

adminRoute.set("view engine", "ejs");
adminRoute.set("views","./views/admin");

const { isLogin, isLogout } = require('../auth/adminAuth');
const adminController = require('../controller/adminController');

const Products = require('../model/product');

const proUpload = require('../utils/multer')

// Authentication Routes
adminRoute.get('/', isLogout, adminController.renderLogin);
adminRoute.post('/', isLogout, adminController.verifyLogin);

// Dashboard Routes
adminRoute.get('/dashboard', isLogin, adminController.loadDashboard);

// Customer Routes
adminRoute.get('/customerDetails', isLogin, adminController.customerDetails);
adminRoute.post('/block',adminController.blockUser)
adminRoute.post('/unblock',adminController.unblockUser)

// User Routes
adminRoute.get('/new_user', isLogin, adminController.newUserLoadHome);

// Category Routes
adminRoute.get('/addCategory', isLogin, adminController.addCategory);
adminRoute.get('/categoryDetails', isLogin, adminController.renderCategoryDetails);
adminRoute.post('/categoryitem', isLogin,upload.single('categoryImg') ,adminController.categoryCreation);
adminRoute.get('/editCategory', isLogin, adminController.getEditCategory);

adminRoute.post('/categoryDetails', isLogin, adminController.updateCategory);
adminRoute.get('/blockcategory', isLogin, adminController.blockCategory);
adminRoute.get('/unblockCategory', isLogin, adminController.unblockCategory);

// Product Routes
adminRoute.get('/addProduct', isLogin, adminController.addProduct); 
adminRoute.post('/products', proUpload, adminController.addingNewProduct);
adminRoute.get('/productList', isLogin, adminController.renderProduct);
adminRoute.get('/editProduct', isLogin, adminController.editproductsLoad);
adminRoute.post('/editProduct', proUpload, adminController.updateProduct);
adminRoute.get('/blockproduct', isLogin, adminController.blockProduct);

// Image Deleting Route
adminRoute.post('/admin/deleteImage/:productId/:imageIndex', adminController.deleteImage);

adminRoute.get('/orderDetails',adminController.renderOrders)
adminRoute.get('/viewsingle',adminController.renderSingleView)
adminRoute.post('/updatestatus',adminController.updateStatus)
adminRoute.post('/approveReturn',adminController.approveReturn)
adminRoute.post('/rejectReturn',adminController.rejectReturn)


adminRoute.get('/coupon',adminController.renderCoupon)
adminRoute.get('/addCoupon',adminController.addCoupon)
adminRoute.post('/addCoupon',adminController.submitAddCoupon)
adminRoute.get('/editcoupon',adminController.renderEditCoupon)
adminRoute.post('/deletecoupon',adminController.deleteCoupon)


adminRoute.get('/offer',adminController.renderOffer)
adminRoute.get('/addOffer',adminController.loadAddOffer)
adminRoute.post('/addoffer',adminController.addOffer)
adminRoute.get('/editOffer',adminController.loadEditOffer)
adminRoute.post('/editOffer',adminController.editOffer)
adminRoute.post('/deleteoffer',adminController.deleteOffer)


adminRoute.get('/salesreport',adminController.loadSalesReport)
adminRoute.get('/salesDaily',adminController.dailySalesReport)
adminRoute.get('/salesWeekly',adminController.generateWeeklyReport)
adminRoute.get('/salesMonthly',adminController.generateMonthlyReport)
adminRoute.get('/salesYearly',adminController.generateYearlyReport)
adminRoute.get('/customDateReport',adminController.generateCustomDateReport)

module.exports = adminRoute;

