// Quick authentication diagnostic script
// Copy this into browser console on your chat page

console.log('🔍 ResearchAI Authentication Diagnostic');

// Step 1: Check if Supabase is available
try {
  if (typeof window !== 'undefined' && window.supabase) {
    console.log('✅ Supabase client found');
    
    // Step 2: Check current session
    window.supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Session check error:', error);
        return;
      }
      
      if (session) {
        console.log('✅ User is authenticated');
        console.log('📧 Email:', session.user.email);
        console.log('🆔 User ID:', session.user.id);
        console.log('⏰ Token expires:', new Date(session.expires_at * 1000));
        console.log('🔑 Token preview:', session.access_token.substring(0, 30) + '...');
        
        // Step 3: Test API call with authentication
        console.log('🧪 Testing authenticated API call...');
        fetch('/api/chat/sessions', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }).then(response => {
          console.log('📡 API Response Status:', response.status);
          if (response.ok) {
            return response.json();
          } else {
            console.error('❌ API call failed with status:', response.status);
            return response.text().then(text => {
              console.error('❌ Response text:', text);
              throw new Error(`API call failed: ${response.status} ${text}`);
            });
          }
        }).then(data => {
          console.log('✅ API call successful:', data);
          console.log('💬 Sessions found:', data?.data?.length || data?.length || 0);
        }).catch(error => {
          console.error('❌ API call failed:', error);
        });
        
      } else {
        console.log('❌ User is NOT authenticated');
        console.log('🔄 Redirect to login required');
      }
    });
  } else {
    console.error('❌ Supabase client not found');
    console.log('🔍 Looking for alternative auth methods...');
    
    // Check localStorage for any auth tokens
    const keys = Object.keys(localStorage);
    const authKeys = keys.filter(key => 
      key.includes('auth') || 
      key.includes('token') || 
      key.includes('session') ||
      key.includes('supabase')
    );
    
    if (authKeys.length > 0) {
      console.log('🔍 Found potential auth data in localStorage:', authKeys);
      authKeys.forEach(key => {
        const value = localStorage.getItem(key);
        console.log(`📦 ${key}:`, value ? value.substring(0, 100) + '...' : 'null');
      });
    } else {
      console.log('❌ No auth data found in localStorage');
    }
  }
} catch (error) {
  console.error('❌ Diagnostic script error:', error);
}

// Step 4: Test basic API connectivity
console.log('🌐 Testing basic API connectivity...');
fetch('/api/chat/sessions', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
}).then(response => {
  console.log('📡 Basic API Response Status:', response.status);
  return response.text();
}).then(text => {
  console.log('📄 Basic API Response:', text);
}).catch(error => {
  console.error('❌ Basic API test failed:', error);
});
