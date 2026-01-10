const User = require('../model/userModel');
const Property = require('../model/propertyModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ======================
// GET ALL AGENTS
// ======================

exports.getAllAgents = catchAsync(async (req, res, next) => {
  // Build filter
  const filter = {
    role: 'agent',
    active: { $ne: false },
  };

  // Add filters from query
  if (req.query.specialization) {
    filter.specialization = req.query.specialization;
  }
  if (req.query.agency) {
    filter.agency = new RegExp(req.query.agency, 'i'); // Case-insensitive search
  }
  if (req.query.verified === 'true') {
    filter.isVerifiedAgent = true;
  }

  // Build query
  let query = User.find(filter).select(
    'name email phone photo agency specialization bio isVerifiedAgent createdAt',
  );

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt'); // Default: newest first
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  // Execute query
  const agents = await query;

  // Count total for pagination info
  const total = await User.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: agents.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      agents,
    },
  });
});

// ======================
// GET SINGLE AGENT
// ======================

exports.getAgent = catchAsync(async (req, res, next) => {
  const agent = await User.findOne({
    _id: req.params.id,
    role: 'agent',
    active: { $ne: false },
  }).select(
    'name email phone photo agency specialization bio isVerifiedAgent createdAt',
  );

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  // Get agent's properties count
  const propertiesCount = await Property.countDocuments({
    agent: agent._id,
    isActive: { $ne: false },
  });

  // Get agent's available properties count
  const availablePropertiesCount = await Property.countDocuments({
    agent: agent._id,
    status: 'available',
    isActive: { $ne: false },
  });

  // Add counts to response
  const agentWithStats = agent.toObject();
  agentWithStats.propertiesCount = propertiesCount;
  agentWithStats.availablePropertiesCount = availablePropertiesCount;

  res.status(200).json({
    status: 'success',
    data: {
      agent: agentWithStats,
    },
  });
});

// ======================
// UPDATE AGENT
// ======================

exports.updateAgent = catchAsync(async (req, res, next) => {
  // Find agent
  const agent = await User.findOne({
    _id: req.params.id,
    role: 'agent',
  });

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  // Check permissions
  if (req.user.role === 'user') {
    return next(new AppError('Users cannot update agent profiles', 403));
  }

  // Agent can only update their own profile
  if (req.user.role === 'agent' && agent._id.toString() !== req.user.id) {
    return next(new AppError('You can only update your own profile', 403));
  }

  // Filter allowed fields
  const allowedFields = [];

  if (req.user.role === 'agent') {
    // Agents can update: agency, specialization, bio, phone, photo
    allowedFields.push('agency', 'specialization', 'bio', 'phone', 'photo');
  } else if (req.user.role === 'admin') {
    // Admins can update everything except password
    allowedFields.push(
      'name',
      'email',
      'phone',
      'photo',
      'role',
      'agency',
      'specialization',
      'bio',
      'active',
      'isVerifiedAgent',
    );
  }

  // Filter request body
  const filteredBody = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });

  // Update agent
  const updatedAgent = await User.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true,
    },
  ).select('-__v -password -passwordChangedAt');

  res.status(200).json({
    status: 'success',
    data: {
      agent: updatedAgent,
    },
  });
});

// ======================
// ADMIN: VERIFY AGENT
// ======================

exports.verifyAgent = catchAsync(async (req, res, next) => {
  const agent = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      role: 'agent',
    },
    {
      isVerifiedAgent: true,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select('-__v -password -passwordChangedAt');

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      agent,
    },
  });
});

// ======================
// ADMIN: DEACTIVATE AGENT
// ======================

exports.deactivateAgent = catchAsync(async (req, res, next) => {
  const agent = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      role: 'agent',
    },
    {
      active: false,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select('-__v -password -passwordChangedAt');

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      agent,
    },
  });
});

// ======================
// GET AGENT'S PROPERTIES
// ======================

exports.getAgentProperties = catchAsync(async (req, res, next) => {
  // Check if agent exists
  const agent = await User.findOne({
    _id: req.params.id,
    role: 'agent',
    active: { $ne: false },
  });

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  // Get agent's properties
  const properties = await Property.find({
    agent: agent._id,
    isActive: { $ne: false },
  }).sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: properties.length,
    data: {
      properties,
    },
  });
});

// ======================
// SEARCH AGENTS
// ======================

exports.searchAgents = catchAsync(async (req, res, next) => {
  const { name, agency, specialization, city } = req.query;

  const filter = {
    role: 'agent',
    active: { $ne: false },
  };

  if (name) {
    filter.name = new RegExp(name, 'i');
  }

  if (agency) {
    filter.agency = new RegExp(agency, 'i');
  }

  if (specialization) {
    filter.specialization = specialization;
  }

  if (city) {
    // If you add officeAddress.city to your User model
    // filter['officeAddress.city'] = new RegExp(city, 'i');
  }

  const agents = await User.find(filter)
    .select('name email phone photo agency specialization bio isVerifiedAgent')
    .limit(20);

  res.status(200).json({
    status: 'success',
    results: agents.length,
    data: {
      agents,
    },
  });
});

// ======================
// GET TOP AGENTS
// ======================

exports.getTopAgents = catchAsync(async (req, res, next) => {
  // Get agents with most properties
  const agents = await User.aggregate([
    {
      $match: {
        role: 'agent',
        active: { $ne: false },
      },
    },
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: 'agent',
        as: 'properties',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        photo: 1,
        agency: 1,
        specialization: 1,
        bio: 1,
        isVerifiedAgent: 1,
        propertiesCount: { $size: '$properties' },
        availablePropertiesCount: {
          $size: {
            $filter: {
              input: '$properties',
              as: 'property',
              cond: { $eq: ['$$property.status', 'available'] },
            },
          },
        },
      },
    },
    {
      $sort: { propertiesCount: -1, isVerifiedAgent: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: agents.length,
    data: {
      agents,
    },
  });
});
