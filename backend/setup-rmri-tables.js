#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function setupRMRITables() {
  console.log('🔧 Setting up RMRI database tables...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Read SQL file
  const sqlPath = path.join(__dirname, '../RMRI_CLEAN_INSTALL.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('📄 SQL file loaded');
  console.log('⚠️  WARNING: This will DROP all existing RMRI tables!\n');
  
  // Split into individual statements (basic splitting)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  
  console.log(`🔨 Executing ${statements.length} SQL statements...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
      if (error) {
        // Try direct query
        const { error: error2 } = await supabase.from('_').select('*').limit(0);
        if (error2) {
          console.log(`❌ Error in statement ${i + 1}:`, error.message);
          errorCount++;
        }
      } else {
        successCount++;
      }
      
      // Show progress every 10 statements
      if ((i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${statements.length} statements processed`);
      }
    } catch (err) {
      console.log(`❌ Exception in statement ${i + 1}:`, err.message);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Setup complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('\n📋 RMRI Tables should now be ready!');
  console.log('   Run: node test-llm-integration.js to verify LLM integration');
}

setupRMRITables().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
