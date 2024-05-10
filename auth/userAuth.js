const session = require("express-session");
const Users = require("../model/userModel");

const isLogin = (req, res, next) => {
  if (req.session.user_id) {
    next();
  } else {
    res.redirect("/");
  }
};
const isLogout = (req, res, next) => {
  if (req.session.user_id) {
    console.log('Ivde Ethn nd')
    res.redirect("/");
  } else {
    next();
  }
};

const isBlock = async (req, res, next) => {
  const check = await Users.findOne({ Email: req.session.email });

  if (req.session.user && check.Status == "blocked") {
    (req.session.user = null), (req.session.Email = null);
    req.session.user_id = null;
    res.redirect("/");
  } else {
    next();
  }
};

module.exports = {
  isLogin,
  isLogout,
  isBlock,
};
