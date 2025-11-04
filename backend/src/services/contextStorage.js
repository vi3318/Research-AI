/**
 * Context Storage Service for RMRI
 * Manages file-based context storage in Supabase Storage with DB metadata
 */

const { createClient } = require('@supabase/supabase-js');
const debug = require('debug')('researchai:contextStorage');
const path = require('path');

class ContextStorageService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Service key for backend operations
    );
    this.bucketName = 'rmri-contexts';
    this.maxContextSize = 10 * 1024 * 1024; // 10MB limit per context
  }

  /**
   * Initialize storage bucket if it doesn't exist
   */
  async initializeBucket() {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
          fileSizeLimit: this.maxContextSize
        });
        debug('✅ Created RMRI contexts bucket');
      }
    } catch (error) {
      debug('❌ Bucket initialization error:', error.message);
      // Bucket might already exist, continue
    }
  }

  /**
   * Write context data for an agent
   * @param {string} runId - RMRI run ID
   * @param {string} agentId - Agent ID
   * @param {string} contextKey - Context identifier (e.g., 'search_results', 'analysis')
   * @param {Object|string} data - Context data to store
   * @param {string} mode - 'append' or 'overwrite'
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Context metadata
   */
  async writeContext(runId, agentId, contextKey, data, mode = 'overwrite', metadata = {}) {
    try {
      debug(`📝 Writing context: ${contextKey} for agent ${agentId} (${mode})`);

      // Validate inputs
      if (!runId || !agentId || !contextKey) {
        throw new Error('runId, agentId, and contextKey are required');
      }

      if (!['append', 'overwrite'].includes(mode)) {
        throw new Error('mode must be "append" or "overwrite"');
      }

      // Get current context if appending
      let currentData = null;
      let currentVersion = 0;

      const { data: existingContext } = await this.supabase
        .from('contexts')
        .select('*')
        .eq('run_id', runId)
        .eq('agent_id', agentId)
        .eq('context_key', contextKey)
        .eq('is_active', true)
        .single();

      if (existingContext) {
        currentVersion = existingContext.version;
        
        if (mode === 'append') {
          // Read existing data
          const existingData = await this._readFromStorage(existingContext.storage_path);
          currentData = existingData;
        }
      }

      // Prepare new data
      let newData;
      if (mode === 'append' && currentData) {
        // Merge data intelligently
        if (typeof data === 'string' && typeof currentData === 'string') {
          newData = currentData + '\n\n' + data;
        } else if (Array.isArray(data) && Array.isArray(currentData)) {
          newData = [...currentData, ...data];
        } else if (typeof data === 'object' && typeof currentData === 'object') {
          newData = { ...currentData, ...data };
        } else {
          newData = data; // Fallback to overwrite if types don't match
        }
      } else {
        newData = data;
      }

      // Convert to string for storage
      const dataString = typeof newData === 'string' 
        ? newData 
        : JSON.stringify(newData, null, 2);
      
      const dataBuffer = Buffer.from(dataString, 'utf-8');
      const sizeBytes = dataBuffer.length;

      // Check size limit
      if (sizeBytes > this.maxContextSize) {
        throw new Error(`Context size ${sizeBytes} exceeds limit ${this.maxContextSize}`);
      }

      // Generate storage path: userId/runId/agentId/contextKey_timestamp.json
      const timestamp = Date.now();
      const newVersion = currentVersion + 1;
      const storagePath = `${runId}/${agentId}/${contextKey}_v${newVersion}_${timestamp}.json`;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, dataBuffer, {
          contentType: 'application/json',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Generate summary for quick access
      const summary = this._generateSummary(newData);

      // Deactivate old context if overwriting
      if (existingContext && mode === 'overwrite') {
        await this.supabase
          .from('contexts')
          .update({ is_active: false })
          .eq('id', existingContext.id);
      }

      // Create new context record
      const { data: contextRecord, error: dbError } = await this.supabase
        .from('contexts')
        .insert({
          run_id: runId,
          agent_id: agentId,
          context_key: contextKey,
          storage_path: storagePath,
          storage_type: 'supabase_storage',
          size_bytes: sizeBytes,
          version: newVersion,
          is_active: true,
          summary,
          metadata: {
            ...metadata,
            mode,
            timestamp
          }
        })
        .select()
        .single();

      if (dbError) {
        // Cleanup uploaded file
        await this.supabase.storage
          .from(this.bucketName)
          .remove([storagePath]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Create version record
      await this.supabase
        .from('context_versions')
        .insert({
          context_id: contextRecord.id,
          version: newVersion,
          storage_path: storagePath,
          size_bytes: sizeBytes,
          operation: mode === 'append' ? 'append' : 'overwrite',
          modified_by_agent_id: agentId,
          diff_summary: mode === 'append' 
            ? `Appended ${sizeBytes} bytes` 
            : `Created new version with ${sizeBytes} bytes`,
          metadata: { timestamp }
        });

      debug(`✅ Context written: ${contextKey} v${newVersion} (${sizeBytes} bytes)`);

      return {
        success: true,
        contextId: contextRecord.id,
        version: newVersion,
        sizeBytes,
        storagePath,
        summary
      };

    } catch (error) {
      debug('❌ Write context error:', error.message);
      throw error;
    }
  }

  /**
   * Read context data for an agent
   * @param {string} runId - RMRI run ID
   * @param {string} agentId - Agent ID (optional, if null returns all contexts for run)
   * @param {string} contextKey - Context identifier (optional)
   * @param {boolean} summaryOnly - Return only summary without full data
   * @param {number} version - Specific version to retrieve (optional)
   * @returns {Object|Array} Context data
   */
  async readContext(runId, agentId = null, contextKey = null, summaryOnly = false, version = null) {
    try {
      debug(`📖 Reading context: ${contextKey || 'all'} for agent ${agentId || 'all'}`);

      // Build query
      let query = this.supabase
        .from('contexts')
        .select('*')
        .eq('run_id', runId);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      if (contextKey) {
        query = query.eq('context_key', contextKey);
      }

      if (version) {
        query = query.eq('version', version);
      } else {
        query = query.eq('is_active', true);
      }

      const { data: contexts, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!contexts || contexts.length === 0) {
        return contextKey ? null : [];
      }

      // If summary only, return metadata
      if (summaryOnly) {
        return contextKey ? contexts[0] : contexts;
      }

      // Read full data from storage
      const contextsWithData = await Promise.all(
        contexts.map(async (ctx) => {
          try {
            const fullData = await this._readFromStorage(ctx.storage_path);
            return {
              ...ctx,
              data: fullData
            };
          } catch (readError) {
            debug(`⚠️  Failed to read context ${ctx.id}:`, readError.message);
            return {
              ...ctx,
              data: null,
              error: readError.message
            };
          }
        })
      );

      return contextKey ? contextsWithData[0] : contextsWithData;

    } catch (error) {
      debug('❌ Read context error:', error.message);
      throw error;
    }
  }

  /**
   * List all available contexts for a run
   * @param {string} runId - RMRI run ID
   * @param {string} agentId - Filter by agent ID (optional)
   * @returns {Array} List of context metadata
   */
  async listAvailableContexts(runId, agentId = null) {
    try {
      debug(`📋 Listing contexts for run ${runId}`);

      let query = this.supabase
        .from('contexts')
        .select('id, agent_id, context_key, size_bytes, version, is_active, summary, created_at, updated_at')
        .eq('run_id', runId)
        .eq('is_active', true);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      debug('❌ List contexts error:', error.message);
      throw error;
    }
  }

  /**
   * Get context version history
   * @param {string} contextId - Context ID
   * @returns {Array} Version history
   */
  async getContextVersions(contextId) {
    try {
      const { data, error } = await this.supabase
        .from('context_versions')
        .select('*')
        .eq('context_id', contextId)
        .order('version', { ascending: false });

      if (error) {
        throw new Error(`Query failed: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      debug('❌ Get versions error:', error.message);
      throw error;
    }
  }

  /**
   * Delete context (soft delete by marking inactive)
   * @param {string} contextId - Context ID
   * @returns {boolean} Success status
   */
  async deleteContext(contextId) {
    try {
      debug(`🗑️  Deleting context ${contextId}`);

      const { error } = await this.supabase
        .from('contexts')
        .update({ is_active: false })
        .eq('id', contextId);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }

      return true;

    } catch (error) {
      debug('❌ Delete context error:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup old contexts (hard delete from storage)
   * @param {string} runId - RMRI run ID
   * @param {number} daysOld - Delete contexts older than this many days
   */
  async cleanupOldContexts(runId, daysOld = 30) {
    try {
      debug(`🧹 Cleaning up contexts older than ${daysOld} days for run ${runId}`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get old inactive contexts
      const { data: oldContexts } = await this.supabase
        .from('contexts')
        .select('id, storage_path')
        .eq('run_id', runId)
        .eq('is_active', false)
        .lt('created_at', cutoffDate.toISOString());

      if (!oldContexts || oldContexts.length === 0) {
        debug('No old contexts to clean up');
        return 0;
      }

      // Delete from storage
      const storagePaths = oldContexts.map(ctx => ctx.storage_path);
      await this.supabase.storage
        .from(this.bucketName)
        .remove(storagePaths);

      // Delete from database
      const contextIds = oldContexts.map(ctx => ctx.id);
      await this.supabase
        .from('contexts')
        .delete()
        .in('id', contextIds);

      debug(`✅ Cleaned up ${oldContexts.length} old contexts`);
      return oldContexts.length;

    } catch (error) {
      debug('❌ Cleanup error:', error.message);
      throw error;
    }
  }

  /**
   * Internal: Read data from Supabase Storage
   */
  async _readFromStorage(storagePath) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(storagePath);

    if (error) {
      throw new Error(`Storage download failed: ${error.message}`);
    }

    const text = await data.text();
    
    // Try to parse as JSON, fallback to plain text
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Internal: Generate summary from data
   */
  _generateSummary(data) {
    try {
      if (typeof data === 'string') {
        return data.substring(0, 200) + (data.length > 200 ? '...' : '');
      }
      
      if (Array.isArray(data)) {
        return `Array with ${data.length} items`;
      }
      
      if (typeof data === 'object') {
        const keys = Object.keys(data);
        return `Object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`;
      }
      
      return String(data).substring(0, 200);
    } catch {
      return 'Context data';
    }
  }
}

// Singleton instance
const contextStorage = new ContextStorageService();

module.exports = contextStorage;
