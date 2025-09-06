const supabase = require('../config/supabase');
const debug = require('debug')('researchai:cleanup');

class DatabaseCleanupService {
  constructor() {
    this.RETENTION_DAYS = 30; // Keep data for 30 days
    this.MAX_PAPERS_PER_USER = 1000; // Max papers per user
    this.MAX_MESSAGES_PER_SESSION = 500; // Max messages per session
  }

  /**
   * Clean up old and excessive data
   */
  async performCleanup() {
    try {
      debug('Starting database cleanup...');
      
      const results = await Promise.all([
        this.cleanupOldSessions(),
        this.cleanupExcessivePaperContext(),
        this.cleanupOldMessages(),
        this.cleanupOrphanedRecords(),
        this.updateUserStats()
      ]);

      const summary = {
        timestamp: new Date().toISOString(),
        sessionsDeleted: results[0],
        papersDeleted: results[1],
        messagesDeleted: results[2],
        orphansDeleted: results[3],
        usersUpdated: results[4]
      };

      debug('Cleanup completed:', summary);
      return summary;
    } catch (error) {
      debug('Cleanup error:', error);
      throw error;
    }
  }

  /**
   * Delete sessions older than retention period with no activity
   */
  async cleanupOldSessions() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const { data, error } = await supabase
        .from('chat_sessions')
        .delete()
        .lt('updated_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      debug(`Deleted ${data?.length || 0} old sessions`);
      return data?.length || 0;
    } catch (error) {
      debug('Error cleaning up old sessions:', error);
      return 0;
    }
  }

  /**
   * Remove excessive paper context per user (keep most recent)
   */
  async cleanupExcessivePaperContext() {
    try {
      // Get users with too many papers
      const { data: userCounts, error: countError } = await supabase
        .from('paper_context')
        .select('session_id, count(*)')
        .group('session_id')
        .having('count(*)', 'gt', this.MAX_PAPERS_PER_USER);

      if (countError) throw countError;

      let totalDeleted = 0;

      for (const userCount of userCounts || []) {
        // Keep only the most recent papers for this user
        const { data: oldPapers, error: selectError } = await supabase
          .from('paper_context')
          .select('id')
          .eq('session_id', userCount.session_id)
          .order('created_at', { ascending: false })
          .range(this.MAX_PAPERS_PER_USER, -1);

        if (selectError) continue;

        if (oldPapers && oldPapers.length > 0) {
          const idsToDelete = oldPapers.map(p => p.id);
          const { error: deleteError } = await supabase
            .from('paper_context')
            .delete()
            .in('id', idsToDelete);

          if (!deleteError) {
            totalDeleted += oldPapers.length;
          }
        }
      }

      debug(`Deleted ${totalDeleted} excessive paper contexts`);
      return totalDeleted;
    } catch (error) {
      debug('Error cleaning up excessive papers:', error);
      return 0;
    }
  }

  /**
   * Remove excessive messages per session (keep most recent)
   */
  async cleanupOldMessages() {
    try {
      // Get sessions with too many messages
      const { data: sessionCounts, error: countError } = await supabase
        .from('messages')
        .select('session_id, count(*)')
        .group('session_id')
        .having('count(*)', 'gt', this.MAX_MESSAGES_PER_SESSION);

      if (countError) throw countError;

      let totalDeleted = 0;

      for (const sessionCount of sessionCounts || []) {
        // Keep only the most recent messages for this session
        const { data: oldMessages, error: selectError } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', sessionCount.session_id)
          .order('created_at', { ascending: false })
          .range(this.MAX_MESSAGES_PER_SESSION, -1);

        if (selectError) continue;

        if (oldMessages && oldMessages.length > 0) {
          const idsToDelete = oldMessages.map(m => m.id);
          const { error: deleteError } = await supabase
            .from('messages')
            .delete()
            .in('id', idsToDelete);

          if (!deleteError) {
            totalDeleted += oldMessages.length;
          }
        }
      }

      debug(`Deleted ${totalDeleted} old messages`);
      return totalDeleted;
    } catch (error) {
      debug('Error cleaning up old messages:', error);
      return 0;
    }
  }

  /**
   * Remove orphaned records (messages without sessions, etc.)
   */
  async cleanupOrphanedRecords() {
    try {
      let totalDeleted = 0;

      // Delete messages for non-existent sessions
      const { data: orphanMessages, error: messageError } = await supabase
        .from('messages')
        .delete()
        .not('session_id', 'in', 
          supabase.from('chat_sessions').select('id')
        )
        .select('id');

      if (!messageError) {
        totalDeleted += orphanMessages?.length || 0;
      }

      // Delete paper context for non-existent sessions
      const { data: orphanPapers, error: paperError } = await supabase
        .from('paper_context')
        .delete()
        .not('session_id', 'in', 
          supabase.from('chat_sessions').select('id')
        )
        .select('id');

      if (!paperError) {
        totalDeleted += orphanPapers?.length || 0;
      }

      debug(`Deleted ${totalDeleted} orphaned records`);
      return totalDeleted;
    } catch (error) {
      debug('Error cleaning up orphaned records:', error);
      return 0;
    }
  }

  /**
   * Update user statistics and fix anonymous users
   */
  async updateUserStats() {
    try {
      // Fix anonymous users - set proper names from Clerk
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .or('name.is.null,name.eq.anonymous');

      if (userError) throw userError;

      let updatedCount = 0;
      for (const user of users || []) {
        // Generate a better name if it's anonymous
        const newName = user.email 
          ? user.email.split('@')[0] 
          : `User_${user.clerk_id?.substring(0, 8) || 'Unknown'}`;

        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            name: newName,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (!updateError) updatedCount++;
      }

      debug(`Updated ${updatedCount} user records`);
      return updatedCount;
    } catch (error) {
      debug('Error updating user stats:', error);
      return 0;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const [
        { count: userCount },
        { count: sessionCount },
        { count: messageCount },
        { count: paperCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('paper_context').select('*', { count: 'exact', head: true })
      ]);

      return {
        users: userCount,
        sessions: sessionCount,
        messages: messageCount,
        papers: paperCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debug('Error getting database stats:', error);
      return null;
    }
  }

  /**
   * Schedule automatic cleanup (call this on server start)
   */
  scheduleCleanup() {
    // Run cleanup every 30 days instead of every 6 hours
    const CLEANUP_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        debug('Scheduled cleanup failed:', error);
      }
    }, CLEANUP_INTERVAL);

    debug('Scheduled automatic cleanup every 30 days');
  }
}

module.exports = new DatabaseCleanupService();