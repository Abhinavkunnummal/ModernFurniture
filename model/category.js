
const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  is_Listed: {
     type: Boolean,
      default: false
    },
},{Timestamp:true});

module.exports = mongoose.model("Category", categorySchema);
