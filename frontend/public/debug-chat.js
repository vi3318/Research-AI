// Test frontend authentication and messaging flow
// Run this in the browser console on the chat page

console.log('=== ResearchAI Chat Debug ===');

// Check if user is authenticated
console.log('1. Checking authentication...');
import('../../lib/supabase.js').then(({ supabase }) => {
  return supabase.auth.getSession();
}).then(({ data: { session }, error }) => {
  if (error) {
    console.error('❌ Auth error:', error);
    return;
  }
  
  if (session) {
    console.log('✅ User authenticated:', session.user.email);
    console.log('🔑 Access token:', session.access_token.substring(0, 20) + '...');
    
    // Test API client
    console.log('2. Testing API client...');
    import('../../lib/apiClient.js').then(({ apiClient }) => {
      console.log('3. Fetching sessions...');
      return apiClient.getChatSessions();
    }).then(response => {
      console.log('✅ Sessions fetch successful:', response);
      
      if (response.data && response.data.length > 0) {
        const session = response.data[0];
        console.log('4. Testing message send to session:', session.id);
        
        return import('../../lib/apiClient.js').then(({ apiClient }) => {
          return apiClient.sendChatMessage(session.id, 'Test message from debug script');
        });
      } else {
        console.log('📝 No sessions found, creating one...');
        return import('../../lib/apiClient.js').then(({ apiClient }) => {
          return apiClient.createChatSession('Debug Test Session');
        }).then(newSession => {
          console.log('✅ Session created:', newSession);
          console.log('4. Testing message send to new session...');
          return import('../../lib/apiClient.js').then(({ apiClient }) => {
            return apiClient.sendChatMessage(newSession.data.id, 'Test message from debug script');
          });
        });
      }
    }).then(response => {
      console.log('✅ Message send successful:', response);
    }).catch(error => {
      console.error('❌ API test failed:', error);
      console.log('🔍 Error details:', {
        message: error.message,
        status: error.status,
        response: error.response
      });
    });
  } else {
    console.log('❌ User not authenticated - need to log in');
  }
}).catch(error => {
  console.error('❌ Failed to check auth:', error);
});
