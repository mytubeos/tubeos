// src/utils/response.utils.js
// Standardized API response format
// FIX: paginatedResponse mein meta param add kiya

const successResponse = (res, statusCode = 200, message = 'Success', data = {}, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
};

const errorResponse = (res, statusCode = 500, message = 'Something went wrong', errors = null) => {
  const response = {
    success: false,
    message,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

// FIX: 6th argument 'meta' added — ai.controller.js mein { stats } pass hota tha
const paginatedResponse = (res, statusCode = 200, message = 'Success', data = [], pagination = {}, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        page:         pagination.page       || 1,
        limit:        pagination.limit      || 10,
        total:        pagination.total      || 0,
        totalPages:   Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNextPage:  pagination.page < Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasPrevPage:  pagination.page > 1,
      },
      ...meta,
    },
  });
};

module.exports = { successResponse, errorResponse, paginatedResponse };
