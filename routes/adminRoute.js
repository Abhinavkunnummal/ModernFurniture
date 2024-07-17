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
adminRoute.post('/block',isLogin,adminController.blockUser)
adminRoute.post('/unblock',isLogin,adminController.unblockUser)

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

adminRoute.get('/orderDetails',isLogin,adminController.renderOrders)
adminRoute.get('/viewsingle',isLogin,adminController.renderSingleView)
adminRoute.post('/updatestatus',isLogin,adminController.updateStatus)
adminRoute.post('/approveReturn',isLogin,adminController.approveReturn)
adminRoute.post('/rejectReturn',isLogin,adminController.rejectReturn)
adminRoute.post('/approveCancellation',isLogin,adminController.approveCancelOrder)

adminRoute.get('/coupon',isLogin,adminController.renderCoupon)
adminRoute.get('/addCoupon',isLogin,adminController.addCoupon)
adminRoute.post('/addCoupon',isLogin,adminController.submitAddCoupon)
adminRoute.get('/editcoupon',isLogin,adminController.renderEditCoupon)
adminRoute.post('/editcoupon',isLogin,adminController.submitEditCoupon)
adminRoute.post('/deletecoupon',isLogin,adminController.deleteCoupon)


adminRoute.get('/offer',isLogin,adminController.renderOffer)
adminRoute.get('/addOffer',isLogin,adminController.loadAddOffer)
adminRoute.post('/addoffer',isLogin,adminController.addOffer)
adminRoute.get('/editOffer',isLogin,adminController.loadEditOffer)
adminRoute.post('/editOffer',isLogin,adminController.editOffer)
adminRoute.post('/deleteoffer',isLogin,adminController.deleteOffer)


adminRoute.get('/salesreport',isLogin,adminController.loadSalesReport)
adminRoute.get('/salesDaily',isLogin,adminController.dailySalesReport)
adminRoute.get('/salesWeekly',isLogin,adminController.generateWeeklyReport)
adminRoute.get('/salesMonthly',isLogin,adminController.generateMonthlyReport)
adminRoute.get('/salesYearly',isLogin,adminController.generateYearlyReport)
adminRoute.get('/customDateReport',isLogin,adminController.generateCustomDateReport)

adminRoute.get('/best-selling-products',isLogin,adminController.getBestSellingProducts);
adminRoute.get('/best-selling-categories',isLogin,adminController.getBestSellingCategories);

//offer Dummy

adminRoute.get('/productOffer', isLogin,adminController.productOfferPage);
adminRoute.get('/addProductOffer', isLogin,adminController.addProductOfferPage);
adminRoute.post('/productOffer', isLogin,adminController.addProductOfferPost);

adminRoute.get('/editProductOffer/:id', isLogin,adminController.editProductOffer);
adminRoute.post('/editProductOfferPost/:id', isLogin, adminController.updateProductOffer);
adminRoute.get('/deleteProductOffer/:id', isLogin,adminController.deleteProductOffer);

//category
adminRoute.get('/categoryOffer', isLogin,adminController.categoryOfferPage);
adminRoute.get('/addCategoryOffer', isLogin,adminController.addCategoryOfferPage);
adminRoute.post('/addCategoryOfferPost', isLogin,adminController.addCategoryOfferPost);
adminRoute.get('/editCategoryOffer/:id', isLogin,adminController.editCategoryOffer);
adminRoute.post('/editCategoryOffer/:id', isLogin, adminController.updateCategoryOffer);
adminRoute.get('/deleteCategoryOffer/:id', isLogin,adminController.deleteCategoryOffer);

const Order=require('../model/order')

const moment = require('moment');
adminRoute.get('/reports/:type', async (req, res) => {
    const reportType = req.params.type;
    let reportData = {};

    try {
        switch (reportType) {
            case 'daily':
                reportData = await getDailyReport();
                break;
            case 'weekly':
                reportData = await getWeeklyReport();
                break;
            case 'monthly':
                reportData = await getMonthlyReport();
                break;
            case 'yearly':
                reportData = await getYearlyReport();
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json(reportData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});


async function getDailyReport() {
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
                totalAmount: { $sum: "$orderAmount" }
            }
        }
    ]);

    return {
        sales: {
            labels: dailyReport.map(report => report._id),
            datasets: [
                {
                    label: 'Sales',
                    data: dailyReport.map(report => report.totalAmount),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        orders: {
            labels: dailyReport.map(report => report._id),
            datasets: [
                {
                    label: 'Orders',
                    data: dailyReport.map(report => report.totalOrders),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        }
    };
}

async function getWeeklyReport() {
    console.log('ethissfkfjfodj');
    
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

    return {
        sales: {
            labels: weeklyReport.map(report => `Week ${report._id}`),
            datasets: [
                {
                    label: 'Sales',
                    data: weeklyReport.map(report => report.totalAmount),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        orders: {
            labels: weeklyReport.map(report => `Week ${report._id}`),
            datasets: [
                {
                    label: 'Orders',
                    data: weeklyReport.map(report => report.totalOrders),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        }
    };
}

async function getMonthlyReport() {
  
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

    return {
        sales: {
            labels: monthlyReport.map(report => moment().month(report._id - 1).format('MMMM')),
            datasets: [
                {
                    label: 'Sales',
                    data: monthlyReport.map(report => report.totalAmount),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        orders: {
            labels: monthlyReport.map(report => moment().month(report._id - 1).format('MMMM')),
            datasets: [
                {
                    label: 'Orders',
                    data: monthlyReport.map(report => report.totalOrders),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        }
    };
}

async function getYearlyReport() {

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

    return {
        sales: {
            labels: yearlyReport.map(report => report._id),
            datasets: [
                {
                    label: 'Sales',
                    data: yearlyReport.map(report => report.totalAmount),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        },
        orders: {
            labels: yearlyReport.map(report => report._id),
            datasets: [
                {
                    label: 'Orders',
                    data: yearlyReport.map(report => report.totalOrders),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        }
    };
}

adminRoute.get('/err',adminController.rendererror)


module.exports = adminRoute;

