// backend/utils/multer.js
const multer = require('multer');
const path = require('path');

// Storage settings
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, path.join(__dirname, '../public/img/properties'));
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `property-${Date.now()}${ext}`);
//   },
// });

// // Filter for image files
// const fileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith('image')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Not an image! Please upload only images.'), false);
//   }
// };

// const upload = multer({ storage, fileFilter });

// module.exports = upload;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/img/properties'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `property-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// Export middleware
module.exports = upload;
