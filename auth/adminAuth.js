const isLogin=async(req,res,next)=>{
  try{
    console.log(req.session.admin);
    if(req.session.admin){
      next()
    }
    else{
      res.redirect('/admin');
    }
  }catch(error){
    console.log(error.message);
  }
}

const isLogout=async(req,res,next)=>{
  try{
    console.log(req.session.admin,'logout');
    if(req.session.admin){
      res.redirect('/admin/dashboard');
    }else{
      next()
    }
  }catch(error){
    console.log(error.message);
  }
}

module.exports={
  isLogin,
  isLogout
}