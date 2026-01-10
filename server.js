const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);
mongoose
  .connect(DB, {
    // useNewUrlParser: true,
    // no longer supported in mongoose 6+
    // useCreateIndex: true,
    // useFindAndModify: false,
  })
  .then(() => {
    console.log("Db connection succesful");
  });

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`app running at port ${port}...`);
});
