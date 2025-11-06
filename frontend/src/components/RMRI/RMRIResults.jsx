/**
 * RMRI Results Component
 * 
 * Display final ranked research gaps with confidence scores
 * Features: Sortable table, filtering, evidence display
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import {
  HiStar as TrophyIcon,
  HiChartBar as ChartBarIcon,
  HiBeaker as BeakerIcon,
  HiLightBulb as LightBulbIcon,
  HiFilter as FunnelIcon,
  HiDownload as ArrowDownTrayIcon,
  HiChevronUp as ChevronUpIcon,
  HiChevronDown as ChevronDownIcon
} from 'react-icons/hi';
import axios from 'axios';

const CRITERIA_COLORS = {
  importance: 'blue',
  novelty: 'purple',
  feasibility: 'green',
  impact: 'pink'
};

const RMRIResults = ({ runId }) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('ranking'); // ranking, importance, novelty, feasibility, impact
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterTheme, setFilterTheme] = useState('all');
  const [showDetails, setShowDetails] = useState(null);

  // Fetch results
  useEffect(() => {
    if (!runId) return;

    const fetchResults = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/rmri/${runId}/results?finalOnly=true`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        console.log('📊 RMRI Results Response:', response.data);
        console.log('📊 Results Data:', response.data.data);
        console.log('📊 First Result:', response.data.data?.results?.[0]);
        console.log('📊 First Result Data:', response.data.data?.results?.[0]?.data);
        console.log('📊 Ranked Gaps:', response.data.data?.results?.[0]?.data?.rankedGaps);

        setResults(response.data.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch results:', err);
        setLoading(false);
      }
    };

    fetchResults();
  }, [runId]);

  // Export results
  const exportResults = () => {
    if (!results) return;

    const csv = generateCSV(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmri-results-${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateCSV = (data) => {
    const gaps = data.results[0]?.data?.rankedGaps || [];
    const headers = ['Rank', 'Gap', 'Theme', 'Total Score', 'Importance', 'Novelty', 'Feasibility', 'Impact', 'Confidence'];
    
    const rows = gaps.map(gap => [
      gap.ranking,
      `"${gap.gap}"`,
      gap.theme,
      gap.totalScore?.toFixed(3),
      gap.scores?.importance?.toFixed(3),
      gap.scores?.novelty?.toFixed(3),
      gap.scores?.feasibility?.toFixed(3),
      gap.scores?.impact?.toFixed(3),
      gap.confidence?.toFixed(3)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  // Sort and filter
  const getSortedGaps = () => {
    if (!results?.results?.[0]?.data?.rankedGaps) return [];

    let gaps = [...results.results[0].data.rankedGaps];

    // Filter by theme
    if (filterTheme !== 'all') {
      gaps = gaps.filter(gap => gap.theme === filterTheme);
    }

    // Sort
    gaps.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'ranking':
          aVal = a.ranking;
          bVal = b.ranking;
          break;
        case 'importance':
        case 'novelty':
        case 'feasibility':
        case 'impact':
          aVal = a.scores?.[sortBy] || 0;
          bVal = b.scores?.[sortBy] || 0;
          break;
        default:
          aVal = a.totalScore || 0;
          bVal = b.totalScore || 0;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return gaps;
  };

  const sortedGaps = getSortedGaps();
  const uniqueThemes = [...new Set(results?.results?.[0]?.data?.rankedGaps?.map(g => g.theme) || [])];

  // Get confidence badge
  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return { label: 'High', color: 'green' };
    if (confidence >= 0.6) return { label: 'Medium', color: 'yellow' };
    return { label: 'Low', color: 'red' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <TrophyIcon className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">No results available yet. Analysis may still be in progress.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto p-6"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrophyIcon className="w-8 h-8 text-yellow-500" />
              <h2 className="text-3xl font-bold text-gray-900">
                Research Gap Rankings
              </h2>
            </div>
            <p className="text-gray-600">
              {sortedGaps.length} research gaps identified and ranked
            </p>
          </div>

          <button
            onClick={exportResults}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Theme Filter */}
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-5 h-5 text-gray-600" />
          <select
            value={filterTheme}
            onChange={(e) => setFilterTheme(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Themes</option>
            {uniqueThemes.map(theme => (
              <option key={theme} value={theme}>{theme}</option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ranking">Sort by Ranking</option>
          <option value="importance">Sort by Importance</option>
          <option value="novelty">Sort by Novelty</option>
          <option value="feasibility">Sort by Feasibility</option>
          <option value="impact">Sort by Impact</option>
        </select>

        {/* Sort Order */}
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {sortOrder === 'asc' ? (
            <ChevronUpIcon className="w-5 h-5" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" />
          )}
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Research Gap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Theme
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <AnimatePresence>
                {sortedGaps.map((gap, index) => {
                  const confBadge = getConfidenceBadge(gap.confidence || 0);
                  const isExpanded = showDetails === gap.ranking;

                  return (
                    <motion.tr
                      key={gap.ranking}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setShowDetails(isExpanded ? null : gap.ranking)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {gap.ranking <= 3 && (
                            <TrophyIcon className={`w-6 h-6 mr-2 ${
                              gap.ranking === 1 ? 'text-yellow-500' :
                              gap.ranking === 2 ? 'text-gray-400' :
                              'text-orange-600'
                            }`} />
                          )}
                          <span className="text-lg font-bold text-gray-900">
                            #{gap.ranking}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900 font-medium">
                          {gap.gap}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                          {gap.theme}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold text-gray-900">
                          {gap.totalScore?.toFixed(3)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${(gap.totalScore || 0) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-medium bg-${confBadge.color}-100 text-${confBadge.color}-800 rounded-full`}>
                          {confBadge.label}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {(gap.confidence * 100).toFixed(1)}%
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {sortedGaps.length === 0 && (
          <div className="text-center py-12">
            <BeakerIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No gaps found matching filters</p>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {showDetails && sortedGaps.find(g => g.ranking === showDetails) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-white rounded-lg shadow-md overflow-hidden"
          >
            {(() => {
              const gap = sortedGaps.find(g => g.ranking === showDetails);
              return (
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Gap Details: {gap.gap}
                  </h3>

                  {/* Scoring Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(CRITERIA_COLORS).map(([criterion, color]) => {
                      const score = gap.scores?.[criterion] || 0;
                      return (
                        <div key={criterion} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            {criterion === 'importance' && <ChartBarIcon className={`w-5 h-5 text-${color}-600`} />}
                            {criterion === 'novelty' && <LightBulbIcon className={`w-5 h-5 text-${color}-600`} />}
                            {criterion === 'feasibility' && <BeakerIcon className={`w-5 h-5 text-${color}-600`} />}
                            {criterion === 'impact' && <TrophyIcon className={`w-5 h-5 text-${color}-600`} />}
                            <p className="text-sm font-medium text-gray-700 capitalize">
                              {criterion}
                            </p>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {(score * 100).toFixed(1)}%
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className={`bg-${color}-500 h-2 rounded-full`}
                              style={{ width: `${score * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Theme</p>
                      <p className="text-blue-800">{gap.theme}</p>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-900 mb-1">Total Score</p>
                      <p className="text-purple-800 text-lg font-bold">
                        {gap.totalScore?.toFixed(4)}
                      </p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-900 mb-1">Confidence</p>
                      <p className="text-green-800 text-lg font-bold">
                        {(gap.confidence * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Stats */}
      {results.results?.[0]?.content && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-1">Total Research Gaps</p>
            <p className="text-4xl font-bold">
              {results.results[0].data.rankedGaps?.length || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-1">Cross-Domain Patterns</p>
            <p className="text-4xl font-bold">
              {results.results[0].data.crossDomainPatterns?.length || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-1">Research Frontiers</p>
            <p className="text-4xl font-bold">
              {results.results[0].data.researchFrontiers?.length || 0}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default RMRIResults;
