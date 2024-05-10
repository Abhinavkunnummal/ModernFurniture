// const multer = require('multer');

// const localStorage = multer.diskStorage({
//     destination:function(req,file,callback){
//         callback(null,'./public/multerimages')
//     },
//     filename:function(req,file,callback){
//         let unique=Date.now()+'-'+Math.round(Math.random()*1E9)//UUID
//         callback(null,file.filename+'-'+unique)
//     }
// })

// const upload=multer({storage:localStorage})



// module.exports=upload


const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const localStorage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './public/multerimages');
    },
    filename: function(req, file, callback) {
        const unique = uuidv4(); 
        const extension = file.originalname.split('.').pop(); 
        const filename = `${unique}.${extension}`;
        callback(null, filename);
    }
});

const upload = multer({ storage: localStorage });

module.exports = upload;
