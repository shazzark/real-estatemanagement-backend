const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Property = require('../../model/propertyModel');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);
mongoose
  .connect(DB, {
    // useNewUrlParser: true,
    // no longer supported in mongoose 6+
    // useCreateIndex: true,
    // useFindAndModify: false,
  })
  .then(() => {
    console.log('Db connection succesful');
    // process.exit(1);
  })
  .catch((err) => {
    console.log(`DB connection failed`, err);
    // process.exit(1);
  });

// READ JSON FILE
const properties = JSON.parse(
  fs.readFileSync(`${__dirname}/properties.json`, 'utf-8'),
);

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    await Property.create(properties);
    console.log(`data successfully loaded`);
  } catch (err) {
    console.log(err);
  }
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Property.deleteMany();
    console.log('data successfully deleted');
    process.exit(1);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
console.log(process.argv);
