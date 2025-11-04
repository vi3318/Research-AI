/**
 * ONE-TIME SCRIPT: Create notes table in Supabase
 * Run this once to create the missing notes table
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createNotesTable() {
  console.log('🚀 Creating notes table in Supabase...');
  
  try {
    // Execute raw SQL to create the table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create notes table if it doesn't exist
        CREATE TABLE IF NOT EXISTS notes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT 'Untitled Note',
          content JSONB NOT NULL DEFAULT '{}',
          content_text TEXT,
          author_id TEXT NOT NULL,
          last_edited_by TEXT,
          version_number INTEGER DEFAULT 1,
          is_published BOOLEAN DEFAULT false,
          tags TEXT[] DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_notes_author ON notes(author_id);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

        -- Enable RLS
        ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
      `
    });

    if (error) {
      console.error('❌ Error creating notes table:', error);
      return false;
    }

    console.log('✅ Notes table created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

// Run the script
createNotesTable()
  .then(success => {
    if (success) {
      console.log('✅ Database migration complete!');
      process.exit(0);
    } else {
      console.log('❌ Migration failed. Please run the SQL manually in Supabase dashboard.');
      console.log('📋 Copy CREATE_NOTES_TABLE.sql and run it in SQL Editor at:');
      console.log(`   ${process.env.SUPABASE_URL.replace('//', '//app.')}/project/_/sql`);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
