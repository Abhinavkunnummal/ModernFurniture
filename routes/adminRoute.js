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
adminRoute.post('/approveCancellation',adminController.approveCancelOrder)

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

// adminRoute.get('/best-selling-products',adminController.getBestSellingProducts);
// adminRoute.get('/best-selling-categories',adminController.getBestSellingCategories);

//offer Dummy

adminRoute.get('/offerPage', adminController.OfferPage);
adminRoute.get('/DummyAddOffer', adminController.DummyAddOfferPage);
adminRoute.post('/DummyOffer', adminController.DummyOffer);
adminRoute.get('/DummyOfferList', adminController.DummyOfferList);
adminRoute.get('/DummyEditOffer/:id', adminController.editOfferPage);
adminRoute.post('/updateOffer/:id', adminController.updateOffer);
adminRoute.get('/deleteOffer/:id', adminController.deleteDummyOffer);

adminRoute.get('/CategoryofferPage', adminController.DummyCategoryOfferPage);
adminRoute.get('/DummyCategoryOffer', adminController.DummyCategoryOfferPage);
adminRoute.get('/DummyCategoryAddOffer', adminController.DummyAddCategoryOfferPage);
adminRoute.post('/CategoryAddPost', adminController.DummyCategoryAddOfferPost);
adminRoute.get('/DummyEditCategoryOffer/:id', adminController.DummyEditCategoryOfferPage);
adminRoute.post('/DummyCategoryUpdateOffer/:id', adminController.DummyCategoryupdateOffer);
adminRoute.get('/deleteCategoryOffer/:id', adminController.deleteCategoryOffer);


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

module.exports = adminRoute;

