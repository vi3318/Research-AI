import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ForceGraph2D } from 'react-force-graph';
import { 
  Download, 
  Filter, 
  Settings, 
  TrendingUp, 
  Network, 
  PieChart as PieIcon,
  BarChart as BarIcon,
  LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Paper {
  id: string;
  title: string;
  publication_year?: number;
  citation_count?: number;
}

interface CitationTrend {
  year: number;
  totalCitations: number;
  avgCitations: number;
}

interface KeywordNode {
  id: string;
  label: string;
  val?: number;
  x?: number;
  y?: number;
}

interface KeywordLink {
  source: string;
  target: string;
  value: number;
}

interface ComparisonData {
  title: string;
  value: number;
}

interface Filters {
  startYear: string;
  endYear: string;
  minOccurrence: number;
  maxKeywords: number;
}

interface VisualAnalyticsProps {
  workspaceId: string;
  papers?: Paper[];
}

interface ChartContainerProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onExport: () => void;
  onGenerate?: () => void;
  chartType?: string;
}

interface FiltersPanelProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const VisualAnalytics: React.FC<VisualAnalyticsProps> = ({ workspaceId, papers = [] }) => {
  const [citationTrends, setCitationTrends] = useState<CitationTrend[]>([]);
  const [keywordNetwork, setKeywordNetwork] = useState<{ nodes: KeywordNode[], links: KeywordLink[] }>({ nodes: [], links: [] });
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [chartJobs, setChartJobs] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({
    startYear: '',
    endYear: '',
    minOccurrence: 2,
    maxKeywords: 50
  });

  useEffect(() => {
    loadAnalyticsData();
    loadExistingCharts();
  }, [workspaceId, filters]);

  const loadExistingCharts = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `/api/workspaces/${workspaceId}/charts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setChartJobs(data.data);
      }
    } catch (error) {
      console.error('Error loading existing charts:', error);
    }
  };

  const generateChart = async (chartType: 'citation_trend' | 'keyword_network' | 'venue_distribution', params = {}) => {
    try {
      const token = localStorage.getItem('authToken');
      
      console.log(`🎨 Generating ${chartType} chart...`);
      
      const response = await fetch(
        `/api/workspaces/${workspaceId}/charts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: chartType,
            params: {
              ...filters,
              ...params
            }
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Chart generation job queued: ${data.job_id}`);
        
        // Add to chart jobs for tracking
        setChartJobs(prev => [...prev, {
          id: data.job_id,
          type: chartType,
          status: 'queued',
          created_at: new Date().toISOString()
        }]);

        // Poll for completion
        pollJobStatus(data.job_id, chartType);
        
        return data.job_id;
      } else {
        throw new Error(data.message || 'Failed to generate chart');
      }
    } catch (error) {
      console.error(`❌ Error generating ${chartType} chart:`, error);
      throw error;
    }
  };

  const pollJobStatus = async (jobId: string, chartType: string) => {
    const maxAttempts = 30; // 30 attempts = 1 minute
    let attempts = 0;

    const poll = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `/api/jobs/${jobId}/status?type=chart`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const data = await response.json();
        
        if (data.success) {
          if (data.status === 'completed') {
            console.log(`✅ Chart ${chartType} completed!`);
            loadExistingCharts(); // Refresh chart list
            return;
          } else if (data.status === 'failed') {
            console.error(`❌ Chart ${chartType} failed:`, data.error);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          console.warn(`⏱️ Chart ${chartType} polling timeout`);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    poll();
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCitationTrends(),
        loadKeywordNetwork(),
        loadComparisonData()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCitationTrends = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startYear) params.append('startYear', filters.startYear);
      if (filters.endYear) params.append('endYear', filters.endYear);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/citation-trends?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setCitationTrends(data.data);
      }
    } catch (error) {
      console.error('Error loading citation trends:', error);
    }
  };

  const loadKeywordNetwork = async () => {
    try {
      const params = new URLSearchParams({
        minOccurrence: filters.minOccurrence.toString(),
        maxKeywords: filters.maxKeywords.toString()
      });

      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/keyword-network?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setKeywordNetwork({
          nodes: data.data.nodes,
          links: data.data.edges.map((edge: any) => ({
            source: edge.source,
            target: edge.target,
            value: edge.weight
          }))
        });
      }
    } catch (error) {
      console.error('Error loading keyword network:', error);
    }
  };

  const loadComparisonData = async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/paper-comparison`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setComparisonData(data.data);
      }
    } catch (error) {
      console.error('Error loading comparison data:', error);
    }
  };

  const exportChart = async (chartType: string, format = 'png') => {
    try {
      // Generate chart via backend API
      const jobId = await generateChart(chartType as any, { format });
      console.log(`Chart ${chartType} export started: ${jobId}`);
    } catch (error) {
      console.error('Error exporting chart:', error);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-8">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Visual Analytics</h2>
        <div className="flex items-center space-x-4">
          <FiltersPanel filters={filters} onFiltersChange={setFilters} />
          
          {/* Chart Generation Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => generateChart('citation_trend')}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Citation Trend</span>
            </button>
            
            <button
              onClick={() => generateChart('keyword_network')}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Network className="h-4 w-4" />
              <span>Keyword Network</span>
            </button>
            
            <button
              onClick={() => generateChart('venue_distribution')}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <PieIcon className="h-4 w-4" />
              <span>Venue Distribution</span>
            </button>
          </div>
          
          <motion.button
            className="p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadExistingCharts}
          >
            <Settings className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Chart Jobs Status */}
      {chartJobs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Chart Generation Status</h3>
          <div className="space-y-2">
            {chartJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between text-sm">
                <span className="text-blue-700">{job.type.replace('_', ' ').toUpperCase()}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  job.status === 'completed' ? 'bg-green-100 text-green-800' :
                  job.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Citation Trends Chart */}
      <ChartContainer
        title="Citation Trends Over Time"
        icon={TrendingUp}
        onExport={() => exportChart('citation_trend')}
        onGenerate={() => generateChart('citation_trend')}
        chartType="citation_trend"
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={citationTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [value, name === 'totalCitations' ? 'Total Citations' : 'Average Citations']}
              labelFormatter={(label) => `Year: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="totalCitations" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="Total Citations"
            />
            <Line 
              type="monotone" 
              dataKey="avgCitations" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Average Citations"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Paper Comparison Chart */}
      <ChartContainer
        title="Paper Citation Comparison"
        icon={BarIcon}
        onExport={() => exportChart('paper-comparison')}
      >
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={comparisonData.slice(0, 10)} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              type="category" 
              dataKey="title" 
              width={200}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value) => [value, 'Citations']}
              labelFormatter={(label) => `Paper: ${label}`}
            />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Keyword Network */}
      <ChartContainer
        title="Keyword Co-occurrence Network"
        icon={Network}
        onExport={() => exportChart('keyword_network')}
        onGenerate={() => generateChart('keyword_network')}
        chartType="keyword_network"
      >
        <div className="h-96 border border-gray-200 rounded-lg">
          {keywordNetwork.nodes.length > 0 ? (
            <ForceGraph2D
              graphData={keywordNetwork}
              nodeLabel="label"
              nodeColor={() => '#69b3a2'}
              nodeRelSize={6}
              linkColor={() => '#999'}
              linkWidth={(link: any) => Math.sqrt(link.value)}
              onNodeHover={(node: KeywordNode | null) => {
                document.body.style.cursor = node ? 'pointer' : '';
              }}
              nodeCanvasObjectMode={() => 'after'}
              nodeCanvasObject={(node: KeywordNode, ctx: CanvasRenderingContext2D) => {
                const label = node.label;
                const fontSize = 12;
                ctx.font = `${fontSize}px Sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#333';
                if (node.x !== undefined && node.y !== undefined) {
                  ctx.fillText(label, node.x, node.y + 20);
                }
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Network className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No keyword relationships found</p>
                <p className="text-sm">Add more papers to see keyword connections</p>
              </div>
            </div>
          )}
        </div>
      </ChartContainer>

      {/* Publication Year Distribution */}
      <ChartContainer
        title="Publication Year Distribution"
        icon={PieIcon}
        onExport={() => exportChart('year-distribution')}
      >
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={getYearDistribution(papers)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.year} (${(entry.percent * 100).toFixed(0)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {getYearDistribution(papers).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [value, 'Papers']} />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
};

// Chart Container Component
const ChartContainer: React.FC<ChartContainerProps> = ({ title, icon: Icon, children, onExport, onGenerate, chartType }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-lg shadow border border-gray-200 p-6"
  >
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center space-x-2">
        <Icon className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex items-center space-x-2">
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <Icon className="h-4 w-4" />
            <span>Generate</span>
          </button>
        )}
        <button
          onClick={onExport}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
      </div>
    </div>
    {children}
  </motion.div>
);

// Filters Panel Component
const FiltersPanel: React.FC<FiltersPanelProps> = ({ filters, onFiltersChange }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const updateFilter = (key: keyof Filters, value: string | number) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Filter className="h-4 w-4" />
        <span>Filters</span>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50"
        >
          <h4 className="font-medium text-gray-900 mb-4">Chart Filters</h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Year
                </label>
                <input
                  type="number"
                  value={filters.startYear}
                  onChange={(e) => updateFilter('startYear', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Year
                </label>
                <input
                  type="number"
                  value={filters.endYear}
                  onChange={(e) => updateFilter('endYear', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2024"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Keyword Occurrence: {filters.minOccurrence}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={filters.minOccurrence}
                onChange={(e) => updateFilter('minOccurrence', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Keywords: {filters.maxKeywords}
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={filters.maxKeywords}
                onChange={(e) => updateFilter('maxKeywords', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Utility Functions
function getYearDistribution(papers: Paper[]): { year: string | number; count: number }[] {
  const yearCounts: Record<string | number, number> = {};
  
  papers.forEach(paper => {
    const year = paper.publication_year || 'Unknown';
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });

  return Object.entries(yearCounts)
    .map(([year, count]) => ({ year, count: count as number }))
    .sort((a, b) => {
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      return parseInt(b.year.toString()) - parseInt(a.year.toString());
    })
    .slice(0, 8); // Limit to top 8 years for readability
}

export default VisualAnalytics;
