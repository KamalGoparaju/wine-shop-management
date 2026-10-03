const errorHandler = (err, req, res, next) => {
  console.error('API Gateway Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'API Gateway Error / Service Unavailable';
  const errorCode = err.errorCode || 'SERVICE_UNAVAILABLE';

  res.status(statusCode).json({
    success: false,
    message,
    error: errorCode
  });
};

module.exports = errorHandler;
