/**
 * RMRI Progress Component
 * 
 * Live tracker for RMRI run execution
 * Shows: Progress bars, agent status, iteration tracking
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  HiChartBar as ChartBarIcon,
  HiChip as CpuChipIcon,
  HiCheckCircle as CheckCircleIcon,
  HiExclamationCircle as ExclamationCircleIcon,
  HiClock as ClockIcon,
  HiRefresh as ArrowPathIcon
} from 'react-icons/hi';
import axios from 'axios';

const AGENT_TYPES = {
  micro: { label: 'Micro Agents', icon: '🔬', color: 'blue' },
  meso: { label: 'Meso Agent', icon: '🧩', color: 'purple' },
  meta: { label: 'Meta Agent', icon: '🧠', color: 'pink' }
};

const STATUS_COLORS = {
  pending: 'gray',
  active: 'blue',
  completed: 'green',
  failed: 'red',
  executing: 'indigo'
};

const RMRIProgress = ({ runId }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      setStatus(response.data.data);
      setLogs(response.data.data.logs?.slice(0, 50) || []);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  // Poll for updates
  useEffect(() => {
    if (!runId) return;

    fetchStatus();
    
    const interval = setInterval(() => {
      if (status?.status !== 'completed' && status?.status !== 'failed') {
        fetchStatus();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [runId, status?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <CpuChipIcon className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Error loading status: {error}</p>
      </div>
    );
  }

  if (!status) return null;

  const { run, agents, progress, currentIteration, totalIterations } = status;

  // Calculate agent statistics
  const agentStats = {
    micro: {
      total: agents?.micro?.length || 0,
      completed: agents?.micro?.filter(a => a.status === 'completed').length || 0,
      active: agents?.micro?.filter(a => a.status === 'active').length || 0,
      failed: agents?.micro?.filter(a => a.status === 'failed').length || 0
    },
    meso: {
      total: agents?.meso?.length || 0,
      completed: agents?.meso?.filter(a => a.status === 'completed').length || 0,
      active: agents?.meso?.filter(a => a.status === 'active').length || 0
    },
    meta: {
      total: agents?.meta?.length || 0,
      completed: agents?.meta?.filter(a => a.status === 'completed').length || 0,
      active: agents?.meta?.filter(a => a.status === 'active').length || 0
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RMRI Analysis Progress</h2>
          <p className="text-gray-600 mt-1">{run?.query}</p>
        </div>
        <motion.div
          animate={run?.status === 'executing' ? { rotate: 360 } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <ArrowPathIcon className={`w-8 h-8 ${run?.status === 'executing' ? 'text-indigo-600' : 'text-gray-400'}`} />
        </motion.div>
      </div>

      {/* Overall Status */}
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm opacity-90">Overall Progress</p>
            <p className="text-3xl font-bold mt-1">{Math.round(progress || 0)}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Iteration</p>
            <p className="text-3xl font-bold mt-1">
              {currentIteration || 0} / {totalIterations || 4}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress || 0}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-white rounded-full"
          />
        </div>

        {/* Status Badge */}
        <div className="mt-4 flex items-center gap-2">
          {run?.status === 'executing' && (
            <>
              <ClockIcon className="w-5 h-5" />
              <span className="font-medium">Executing...</span>
            </>
          )}
          {run?.status === 'completed' && (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              <span className="font-medium">Completed</span>
            </>
          )}
          {run?.status === 'failed' && (
            <>
              <ExclamationCircleIcon className="w-5 h-5" />
              <span className="font-medium">Failed</span>
            </>
          )}
        </div>
      </motion.div>

      {/* Agent Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(AGENT_TYPES).map(([type, config]) => {
          const stats = agentStats[type];
          const progressPct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

          return (
            <motion.div
              key={type}
              whileHover={{ y: -4 }}
              className="bg-white rounded-lg shadow-md p-5 border-2 border-gray-100"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{config.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{config.label}</h3>
                  <p className="text-sm text-gray-500">
                    {stats.completed} / {stats.total} completed
                  </p>
                </div>
              </div>

              {/* Agent Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  className={`h-full bg-${config.color}-500`}
                />
              </div>

              {/* Agent Counts */}
              <div className="flex items-center justify-between text-sm">
                {stats.active > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    {stats.active} active
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="text-red-600">{stats.failed} failed</span>
                )}
                {stats.completed === stats.total && stats.total > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircleIcon className="w-4 h-4" />
                    Complete
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg shadow-md p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Live Activity Log</h3>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {logs.map((log, index) => (
              <motion.div
                key={log.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.02 }}
                className={`p-3 rounded-lg border-l-4 ${
                  log.log_level === 'error' 
                    ? 'bg-red-50 border-red-500'
                    : log.log_level === 'warning'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{log.message}</p>
                    {log.metadata && (
                      <p className="text-xs text-gray-500 mt-1">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 ml-3">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {logs.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No activity logs yet
            </p>
          )}
        </div>
      </motion.div>

      {/* Iteration Timeline */}
      {currentIteration > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-md p-5"
        >
          <h3 className="font-semibold text-gray-900 mb-4">Iteration Timeline</h3>
          
          <div className="flex items-center gap-4">
            {Array.from({ length: totalIterations }).map((_, idx) => {
              const iterNum = idx + 1;
              const isComplete = iterNum < currentIteration;
              const isCurrent = iterNum === currentIteration;
              const isPending = iterNum > currentIteration;

              return (
                <div key={iterNum} className="flex items-center flex-1">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isComplete ? '✓' : iterNum}
                  </motion.div>
                  {idx < totalIterations - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      isComplete ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      {run?.status === 'executing' && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
        >
          Cancel Run
        </motion.button>
      )}
    </motion.div>
  );
};

export default RMRIProgress;
