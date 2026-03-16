const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  
  // Handle specific error types
  if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'File not found';
  }
  
  if (err.code === 'EACCES') {
    statusCode = 403;
    message = 'Permission denied';
  }
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = errorHandler;