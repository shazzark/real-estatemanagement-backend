// const Location = require("../model/locationModel");

exports.getAllLocations = (req, res) => {
  res.status(200).json({
    status: "success",
    requestedAt: req.requestTime,
    message: "loactions route working",
  });
};

exports.getLocation = (req, res) => {
  res.status(500).json({
    status: "error",
    message: "routes is not yet defined",
  });
};

exports.updateLocation = (req, res) => {
  res.status(404).json({
    status: "error",
    message: "routes is not yet defined",
  });
};

exports.createLocation = (req, res) => {
  res.status(404).json({
    status: "error",
    message: "routes is not yet defined",
  });
};

exports.deleteLocation = (req, res) => {
  res.status(404).json({
    status: "error",
    message: "routes is not yet defined",
  });
};
