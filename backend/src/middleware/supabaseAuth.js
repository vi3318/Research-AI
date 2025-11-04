const { supabase } = require('../config/supabase');

// Simple Supabase authentication middleware
const supabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Auth check:', {
      hasHeader: !!authHeader,
      headerValue: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      path: req.path,
      method: req.method
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid auth header');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Add user info to request
    req.user = user;
    req.auth = { userId: user.id };
    
    next();
  } catch (error) {
    console.error('Supabase auth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalSupabaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.auth = null;
      return next();
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      req.user = null;
      req.auth = null;
    } else {
      req.user = user;
      req.auth = { userId: user.id };
    }
    
    next();
  } catch (error) {
    console.error('Optional Supabase auth error:', error);
    req.user = null;
    req.auth = null;
    next();
  }
};

module.exports = {
  supabaseAuth,
  optionalSupabaseAuth
};
