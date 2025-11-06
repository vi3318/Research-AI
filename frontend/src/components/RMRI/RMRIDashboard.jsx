/**
 * RMRI Dashboard Component
 * 
 * Main dashboard that orchestrates all RMRI components
 * Features: Tab navigation, run management, responsive layout
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  HiBeaker as BeakerIcon,
  HiChartBar as ChartBarIcon,
  HiFolderOpen as FolderOpenIcon,
  HiStar as TrophyIcon,
  HiChip as CpuChipIcon,
  HiPlusCircle as PlusCircleIcon,
  HiClock as ClockIcon
} from 'react-icons/hi';
import axios from 'axios';

import RMRIStartPanel from './RMRIStartPanel';
import RMRIProgress from './RMRIProgress';
import ContextExplorer from './ContextExplorer';
import RMRIResults from './RMRIResults';
import RMRIAdmin from './RMRIAdmin';

const TABS = [
  { id: 'start', label: 'New Analysis', icon: PlusCircleIcon, color: 'indigo' },
  { id: 'progress', label: 'Progress', icon: ChartBarIcon, color: 'blue' },
  { id: 'results', label: 'Results', icon: TrophyIcon, color: 'yellow' },
  { id: 'contexts', label: 'Contexts', icon: FolderOpenIcon, color: 'purple' },
  { id: 'admin', label: 'Admin', icon: CpuChipIcon, color: 'green' }
];

const RMRIDashboard = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('start');
  const [currentRunId, setCurrentRunId] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's RMRI runs
  useEffect(() => {
    if (!user) return;

    const fetchRuns = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await axios.get(
          '/api/rmri/runs',
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        const userRuns = response.data.runs || [];
        setRuns(userRuns);
        
        // Auto-select most recent run
        if (userRuns.length > 0 && !currentRunId) {
          setCurrentRunId(userRuns[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch runs:', err);
        setLoading(false);
      }
    };

    fetchRuns();

    // Poll for updates
    const interval = setInterval(fetchRuns, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle new run started
  const handleRunStarted = (runId) => {
    setCurrentRunId(runId);
    setActiveTab('progress');
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'green';
      case 'executing': return 'blue';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <BeakerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600">
            Please sign in to access RMRI Dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <BeakerIcon className="w-10 h-10 text-indigo-600" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  RMRI Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Recursive Multi-Agent Research Intelligence
                </p>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.email}
                </p>
                <p className="text-xs text-gray-500">
                  {runs.length} total runs
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-4 font-medium transition-colors ${
                    isActive
                      ? `text-${tab.color}-600`
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </div>
                  
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.color}-600`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Run Selector (for progress, results, contexts, admin tabs) */}
      {activeTab !== 'start' && runs.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                Select Run:
              </label>
              <select
                value={currentRunId || ''}
                onChange={(e) => setCurrentRunId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.query} ({new Date(run.created_at).toLocaleDateString()}) - {run.status}
                  </option>
                ))}
              </select>

              {runs.find(r => r.id === currentRunId) && (
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full bg-${getStatusColor(
                    runs.find(r => r.id === currentRunId).status
                  )}-100 text-${getStatusColor(
                    runs.find(r => r.id === currentRunId).status
                  )}-800`}
                >
                  {runs.find(r => r.id === currentRunId).status}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'start' && (
              <RMRIStartPanel onRunCreated={handleRunStarted} />
            )}
            
            {activeTab === 'progress' && currentRunId && (
              <RMRIProgress runId={currentRunId} />
            )}
            
            {activeTab === 'results' && currentRunId && (
              <RMRIResults runId={currentRunId} />
            )}
            
            {activeTab === 'contexts' && currentRunId && (
              <ContextExplorer runId={currentRunId} />
            )}
            
            {activeTab === 'admin' && currentRunId && (
              <RMRIAdmin runId={currentRunId} />
            )}

            {/* No Run Selected State */}
            {activeTab !== 'start' && !currentRunId && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <ClockIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Run Selected
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Start a new analysis or select an existing run
                  </p>
                  <button
                    onClick={() => setActiveTab('start')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Recent Runs Sidebar (Optional) - Only show completed/running runs */}
      {runs.filter(r => r.status !== 'pending').length > 0 && activeTab === 'start' && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed right-6 top-32 w-80 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto"
        >
          <h3 className="font-semibold text-gray-900 mb-3">Recent Runs</h3>
          <div className="space-y-2">
            {runs.filter(r => r.status !== 'pending').slice(0, 5).map((run) => (
              <button
                key={run.id}
                onClick={() => {
                  setCurrentRunId(run.id);
                  setActiveTab('progress');
                }}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {run.query}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${getStatusColor(
                      run.status
                    )}-100 text-${getStatusColor(run.status)}-800`}
                  >
                    {run.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RMRIDashboard;
