// Debug script to check authentication and test messaging
// Run this in your browser console on the chat page

console.log('🔍 Chat Debug - Checking Authentication & Messaging');

// Step 1: Check authentication
async function checkAuth() {
  try {
    if (window.supabase) {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      if (session) {
        console.log('✅ User authenticated:', session.user.email);
        return session;
      } else {
        console.log('❌ User not authenticated');
        return null;
      }
    } else {
      console.log('❌ Supabase not found');
      return null;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

// Step 2: Test API connectivity
async function testAPI() {
  try {
    const response = await fetch('/api/chat/sessions');
    console.log('📡 API Test Response:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('📦 API Data:', data);
      return true;
    } else {
      console.log('❌ API not responding properly');
      return false;
    }
  } catch (error) {
    console.error('❌ API test failed:', error);
    return false;
  }
}

// Step 3: Test authentication + API
async function testAuthenticatedAPI() {
  const session = await checkAuth();
  if (!session) {
    console.log('⚠️ Cannot test authenticated API - user not logged in');
    return false;
  }

  try {
    const response = await fetch('/api/chat/sessions', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔐 Authenticated API Response:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Sessions found:', data?.data?.length || 0);
      return data;
    } else {
      const text = await response.text();
      console.log('❌ Authenticated API failed:', text);
      return false;
    }
  } catch (error) {
    console.error('❌ Authenticated API test failed:', error);
    return false;
  }
}

// Step 4: Test session creation
async function testSessionCreation() {
  const session = await checkAuth();
  if (!session) {
    console.log('⚠️ Cannot test session creation - user not logged in');
    return false;
  }

  try {
    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Debug Test Session' })
    });
    
    console.log('📝 Session Creation Response:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Session created:', data);
      return data;
    } else {
      const text = await response.text();
      console.log('❌ Session creation failed:', text);
      return false;
    }
  } catch (error) {
    console.error('❌ Session creation test failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Starting Full Chat Debug ===');
  
  const auth = await checkAuth();
  const apiBasic = await testAPI();
  const apiAuth = await testAuthenticatedAPI();
  
  if (auth && apiAuth) {
    console.log('🧪 Testing session creation...');
    await testSessionCreation();
  }
  
  console.log('=== Debug Complete ===');
  console.log(`Results:
  Authentication: ${auth ? '✅' : '❌'}
  Basic API: ${apiBasic ? '✅' : '❌'}
  Authenticated API: ${apiAuth ? '✅' : '❌'}
  
  ${!auth ? '🔧 Fix: Please log in to Supabase' : ''}
  ${!apiBasic ? '🔧 Fix: Backend server not running' : ''}
  ${auth && !apiAuth ? '🔧 Fix: Authentication token issue' : ''}
  `);
}

// Auto-run the tests
runAllTests();
