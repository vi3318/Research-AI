/**
 * RMRI Admin Component
 * 
 * Visualize agent hierarchy and execution flow
 * Uses react-force-graph for interactive graph visualization
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  HiChip as CpuChipIcon,
  HiChartBar as ChartBarIcon,
  HiClock as ClockIcon,
  HiCheckCircle as CheckCircleIcon,
  HiXCircle as XCircleIcon
} from 'react-icons/hi';
import axios from 'axios';

const AGENT_COLORS = {
  micro: '#3b82f6',  // blue
  meso: '#a855f7',   // purple
  meta: '#ec4899',   // pink
  orchestrator: '#10b981' // green
};

const STATUS_COLORS = {
  pending: '#9ca3af',    // gray
  active: '#3b82f6',     // blue
  completed: '#10b981',  // green
  failed: '#ef4444'      // red
};

const RMRIAdmin = ({ runId }) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('hierarchy'); // hierarchy, timeline, status

  // Fetch agent data and build graph
  useEffect(() => {
    if (!runId) return;

    const fetchData = async () => {
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

        const data = response.data.data;
        buildGraph(data);
        calculateStats(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
        setLoading(false);
      }
    };

    fetchData();

    // Poll for updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [runId]);

  // Build force-directed graph structure
  const buildGraph = (data) => {
    const nodes = [];
    const links = [];

    // Add orchestrator node
    nodes.push({
      id: 'orchestrator',
      name: 'Orchestrator',
      type: 'orchestrator',
      status: data.run?.status,
      val: 30,
      color: AGENT_COLORS.orchestrator
    });

    // Add micro agents
    if (data.agents?.micro) {
      data.agents.micro.forEach((agent, idx) => {
        const nodeId = `micro-${agent.id || idx}`;
        nodes.push({
          id: nodeId,
          name: `Micro Agent ${idx + 1}`,
          type: 'micro',
          status: agent.status,
          metadata: agent.metadata,
          val: 10,
          color: STATUS_COLORS[agent.status] || AGENT_COLORS.micro
        });

        // Link to orchestrator
        links.push({
          source: 'orchestrator',
          target: nodeId,
          label: 'manages'
        });
      });
    }

    // Add meso agent
    if (data.agents?.meso && data.agents.meso.length > 0) {
      const mesoAgent = data.agents.meso[0];
      nodes.push({
        id: 'meso',
        name: 'Meso Agent',
        type: 'meso',
        status: mesoAgent.status,
        metadata: mesoAgent.metadata,
        val: 20,
        color: STATUS_COLORS[mesoAgent.status] || AGENT_COLORS.meso
      });

      links.push({
        source: 'orchestrator',
        target: 'meso',
        label: 'coordinates'
      });

      // Link from all micro agents to meso
      if (data.agents.micro) {
        data.agents.micro.forEach((agent, idx) => {
          links.push({
            source: `micro-${agent.id || idx}`,
            target: 'meso',
            label: 'feeds'
          });
        });
      }
    }

    // Add meta agent
    if (data.agents?.meta && data.agents.meta.length > 0) {
      const metaAgent = data.agents.meta[0];
      nodes.push({
        id: 'meta',
        name: 'Meta Agent',
        type: 'meta',
        status: metaAgent.status,
        metadata: metaAgent.metadata,
        val: 25,
        color: STATUS_COLORS[metaAgent.status] || AGENT_COLORS.meta
      });

      links.push({
        source: 'orchestrator',
        target: 'meta',
        label: 'manages'
      });

      links.push({
        source: 'meso',
        target: 'meta',
        label: 'synthesizes'
      });
    }

    setGraphData({ nodes, links });
  };

  // Calculate statistics
  const calculateStats = (data) => {
    const totalAgents = 
      (data.agents?.micro?.length || 0) +
      (data.agents?.meso?.length || 0) +
      (data.agents?.meta?.length || 0);

    const completedAgents = [
      ...(data.agents?.micro || []),
      ...(data.agents?.meso || []),
      ...(data.agents?.meta || [])
    ].filter(a => a.status === 'completed').length;

    const activeAgents = [
      ...(data.agents?.micro || []),
      ...(data.agents?.meso || []),
      ...(data.agents?.meta || [])
    ].filter(a => a.status === 'active').length;

    const failedAgents = [
      ...(data.agents?.micro || []),
      ...(data.agents?.meso || []),
      ...(data.agents?.meta || [])
    ].filter(a => a.status === 'failed').length;

    setStats({
      total: totalAgents,
      completed: completedAgents,
      active: activeAgents,
      failed: failedAgents,
      successRate: totalAgents > 0 ? (completedAgents / totalAgents) * 100 : 0
    });
  };

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  // Organize nodes by hierarchy level
  const getHierarchyLevels = () => {
    const levels = {
      orchestrator: [],
      meta: [],
      meso: [],
      micro: []
    };

    graphData.nodes.forEach(node => {
      if (levels[node.type]) {
        levels[node.type].push(node);
      }
    });

    return levels;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <CpuChipIcon className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">RMRI Admin Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Agent hierarchy and execution visualization
            </p>
          </div>

          {/* View Mode Selector */}
          <div className="flex gap-2">
            {['hierarchy', 'timeline', 'status'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-indigo-600">
                {stats.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Hierarchy Visualization */}
        <div className="flex-1 bg-gradient-to-br from-gray-900 to-indigo-900 relative overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Hierarchical Tree View */}
            <div className="space-y-8">
              {Object.entries(getHierarchyLevels()).map(([level, nodes]) => (
                nodes.length > 0 && (
                  <div key={level} className="relative">
                    {/* Level Label */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-1 h-8 rounded-full"
                        style={{ backgroundColor: AGENT_COLORS[level] }}
                      />
                      <h3 className="text-xl font-bold text-white capitalize">
                        {level} {nodes.length > 1 ? 'Agents' : 'Agent'}
                      </h3>
                      <span className="text-sm text-gray-400">({nodes.length})</span>
                    </div>

                    {/* Nodes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-8">
                      {nodes.map(node => (
                        <motion.div
                          key={node.id}
                          whileHover={{ scale: 1.02, y: -2 }}
                          onClick={() => handleNodeClick(node)}
                          className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 cursor-pointer border-2 transition-all ${
                            selectedNode?.id === node.id
                              ? 'border-white shadow-xl'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          {/* Node Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: node.color }}
                              >
                                {node.type[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{node.name}</p>
                                <p className="text-xs text-gray-400 capitalize">{node.type}</p>
                              </div>
                            </div>
                            
                            {/* Status Indicator */}
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[node.status] }}
                              title={node.status}
                            />
                          </div>

                          {/* Node Metrics */}
                          {node.metrics && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-white/5 rounded px-2 py-1">
                                <p className="text-gray-400">Papers</p>
                                <p className="text-white font-semibold">
                                  {node.metrics.papers_analyzed || 0}
                                </p>
                              </div>
                              <div className="bg-white/5 rounded px-2 py-1">
                                <p className="text-gray-400">Time</p>
                                <p className="text-white font-semibold">
                                  {node.metrics.processing_time || '0'}s
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Progress Bar */}
                          {node.status === 'active' && (
                            <div className="mt-3">
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-blue-400"
                                  initial={{ width: 0 }}
                                  animate={{ width: '60%' }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Connecting Line to Next Level */}
                    {level !== 'micro' && (
                      <div className="absolute left-2 top-12 w-px h-8 bg-white/20" />
                    )}
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <h4 className="font-semibold text-gray-900 mb-3">Agent Types</h4>
            <div className="space-y-2">
              {Object.entries(AGENT_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 capitalize">{type}</span>
                </div>
              ))}
            </div>

            <h4 className="font-semibold text-gray-900 mt-4 mb-3">Status</h4>
            <div className="space-y-2">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          {selectedNode ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {selectedNode.type[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{selectedNode.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{selectedNode.type}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    selectedNode.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : selectedNode.status === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedNode.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedNode.status === 'completed' && <CheckCircleIcon className="w-4 h-4" />}
                  {selectedNode.status === 'active' && <ClockIcon className="w-4 h-4 animate-spin" />}
                  {selectedNode.status === 'failed' && <XCircleIcon className="w-4 h-4" />}
                  {selectedNode.status}
                </span>
              </div>

              {/* Metadata */}
              {selectedNode.metadata && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Metadata</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <pre className="text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(selectedNode.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Connections */}
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-3">Connections</h4>
                <div className="space-y-2">
                  {graphData.links
                    .filter(link => 
                      link.source.id === selectedNode.id || 
                      link.target.id === selectedNode.id
                    )
                    .map((link, idx) => {
                      const otherNode = 
                        link.source.id === selectedNode.id ? link.target : link.source;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: otherNode.color }}
                          />
                          <span className="text-sm text-gray-700">
                            {otherNode.name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <CpuChipIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p>Click on a node to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMRIAdmin;
