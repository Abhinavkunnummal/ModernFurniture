const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({

    // destination:function(req,file,cb){
    //     cb(null,path.join(__dirname,'../public/productimage'))
    // },
    filename:function(req,file,cb){
        const name = Date.now()+'-'+file.originalname;
        cb(null,name)
    }

})



const upload = multer({storage:storage}).array('images',4)

module.exports = upload