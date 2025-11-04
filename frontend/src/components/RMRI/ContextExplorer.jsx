/**
 * Context Explorer Component
 * 
 * Browse and explore saved RMRI contexts
 * Features: Summaries, full text, version history
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  HiFolderOpen as FolderOpenIcon,
  HiDocumentText as DocumentTextIcon,
  HiClock as ClockIcon,
  HiChevronRight as ChevronRightIcon,
  HiSearch as MagnifyingGlassIcon,
  HiDownload as ArrowDownTrayIcon
} from 'react-icons/hi';
import axios from 'axios';

const ContextExplorer = ({ runId }) => {
  const [contexts, setContexts] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [contextData, setContextData] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, micro, meso, meta

  // Fetch available contexts
  useEffect(() => {
    if (!runId) return;

    const fetchContexts = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/contexts`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        setContexts(response.data.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch contexts:', err);
        setLoading(false);
      }
    };

    fetchContexts();
  }, [runId]);

  // Load context details
  const loadContext = async (contextKey) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/context/${contextKey}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      setContextData(response.data.data);
      setSelectedContext(contextKey);

      // Fetch versions
      const versionsResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/context/${contextKey}/versions`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      setVersions(versionsResponse.data.data || []);
    } catch (err) {
      console.error('Failed to load context:', err);
    }
  };

  // Download context
  const downloadContext = async (contextKey) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/context/${contextKey}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contextKey}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download context:', err);
    }
  };

  // Filter contexts
  const filteredContexts = contexts.filter(ctx => {
    const matchesSearch = ctx.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || ctx.key.includes(filter);
    return matchesSearch && matchesFilter;
  });

  // Get context type icon and color
  const getContextStyle = (key) => {
    if (key.includes('micro')) return { icon: '🔬', color: 'blue', label: 'Micro' };
    if (key.includes('meso')) return { icon: '🧩', color: 'purple', label: 'Meso' };
    if (key.includes('meta')) return { icon: '🧠', color: 'pink', label: 'Meta' };
    return { icon: '📄', color: 'gray', label: 'Other' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <FolderOpenIcon className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Context Explorer</h2>
          <p className="text-gray-600 mt-1">
            Browse saved contexts from RMRI analysis
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contexts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            {['all', 'micro', 'meso', 'meta'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Context List Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 max-h-[600px] overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-3">
                Available Contexts ({filteredContexts.length})
              </h3>

              <div className="space-y-2">
                <AnimatePresence>
                  {filteredContexts.map((ctx, index) => {
                    const style = getContextStyle(ctx.key);
                    return (
                      <motion.button
                        key={ctx.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{ x: 4 }}
                        onClick={() => loadContext(ctx.key)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedContext === ctx.key
                            ? `border-${style.color}-500 bg-${style.color}-50`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {ctx.key}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(ctx.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {filteredContexts.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No contexts found
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Context Content */}
          <div className="lg:col-span-2">
            {!contextData ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a context to view details</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                {/* Context Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{selectedContext}</h3>
                      <p className="text-sm opacity-90">
                        {getContextStyle(selectedContext).label} Context
                      </p>
                    </div>
                    <button
                      onClick={() => downloadContext(selectedContext)}
                      className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      <span className="text-sm">Download</span>
                    </button>
                  </div>
                </div>

                {/* Context Data */}
                <div className="p-6">
                  {/* Summary */}
                  {contextData.summary && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                        {contextData.summary}
                      </p>
                    </div>
                  )}

                  {/* Full Data */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Full Content</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      <pre className="text-xs">
                        {JSON.stringify(contextData, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(contextData.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Size</p>
                      <p className="text-sm font-medium text-gray-900">
                        {(JSON.stringify(contextData).length / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  {/* Version History */}
                  {versions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ClockIcon className="w-5 h-5 text-gray-600" />
                        <h4 className="font-semibold text-gray-900">Version History</h4>
                      </div>
                      
                      <div className="space-y-2">
                        {versions.map((version, index) => (
                          <motion.div
                            key={version.version}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Version {version.version}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(version.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <span className="text-xs text-gray-600">
                              {(version.size / 1024).toFixed(1)} KB
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ContextExplorer;
