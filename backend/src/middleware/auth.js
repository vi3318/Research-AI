const { requireAuth, getAuth } = require('@clerk/express');
const { supabase } = require('../config/supabase');

// Clerk authentication middleware
const authMiddleware = requireAuth({
  onError: (err, req, res) => {
    console.error('Authentication error:', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Middleware to sync user with Supabase
const syncUser = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return next();
    }

    const { userId, sessionClaims } = auth;
    const emailAddress = sessionClaims?.email;
    const firstName = sessionClaims?.firstName;
    const lastName = sessionClaims?.lastName;
    const imageUrl = sessionClaims?.imageUrl;
    
    // Try to upsert user in Supabase, but continue if it fails
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: emailAddress || `user-${userId}@clerk.local`,
          name: firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || emailAddress || 'Anonymous',
          avatar_url: imageUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error syncing user (continuing anyway):', error.message);
      }
    } catch (dbError) {
      console.error('Database not ready, skipping user sync:', dbError.message);
    }

    // Add auth info to request
    req.auth = auth;
    next();
  } catch (error) {
    console.error('Error in syncUser middleware:', error);
    req.auth = null;
    next(); // Continue even if sync fails
  }
};

// Optional auth middleware (for public endpoints that can work with or without auth)
const optionalAuth = (req, res, next) => {
  try {
    const auth = getAuth(req);
    req.auth = auth;
    next();
  } catch (error) {
    req.auth = null;
    next();
  }
};

module.exports = {
  requireAuth: authMiddleware,
  syncUser,
  optionalAuth
};