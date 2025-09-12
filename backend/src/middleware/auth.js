const { supabaseAuth, optionalSupabaseAuth } = require('./supabaseAuth');

// Export the Supabase auth functions with the expected names
const requireAuth = supabaseAuth;
const optionalAuth = optionalSupabaseAuth;

// Sync user middleware - ensures user exists in our system
const syncUser = async (req, res, next) => {
  // If we have a user from auth, we can sync them here if needed
  if (req.user) {
    // User is already set by the auth middleware
    // Add any additional user sync logic here if needed
  }
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  syncUser
};
