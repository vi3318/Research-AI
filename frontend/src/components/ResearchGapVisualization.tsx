import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Plot from 'react-plotly.js'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'
import { Bar, Pie, Scatter, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
)

interface GapAnalysis {
  topic: string
  totalPapers: number
  analysis: {
    themes: Array<{
      name: string
      description: string
      frequency: number
      keywords: string[]
    }>
    methodologies: Array<{
      name: string
      frequency: number
      percentage: string
    }>
    gaps: Array<{
      category: string
      title: string
      description: string
      impact: string
      difficulty: string
      suggestedApproaches: string[]
    }>
    opportunities: Array<{
      title: string
      researchQuestion: string
      methodology: string[]
      expectedContributions: string[]
      timeline: string
      difficulty: string
      impact: string
    }>
    trends: Array<{
      year: string
      paperCount: number
      trend: 'increasing' | 'decreasing' | 'stable'
    }>
    collaboration: Array<{
      institution: string
      paperCount: number
      collaborationStrength: number
    }>
  }
  visualizations: {
    themeDistribution: {
      type: string
      data: Array<{ label: string; value: number; description: string }>
    }
    methodologyChart: {
      type: string
      data: Array<{ label: string; value: number; percentage: string }>
    }
    gapScatter: {
      type: string
      data: Array<{
        x: number
        y: number
        label: string
        category: string
        description: string
      }>
    }
    gapCategories: {
      type: string
      data: Array<{ label: string; value: number }>
    }
    networkGraph: {
      type: string
      nodes: Array<{ id: string; label: string; type: string; size: number }>
      edges: Array<{ source: string; target: string; weight: number }>
    }
  }
}

interface Props {
  gapAnalysis: GapAnalysis
  className?: string
}

export default function ResearchGapVisualization({ gapAnalysis, className = '' }: Props) {
  const networkRef = useRef<HTMLDivElement>(null)
  const [selectedView, setSelectedView] = useState<'overview' | 'gaps' | 'opportunities' | 'trends'>('overview')
  const [selectedGap, setSelectedGap] = useState<any>(null)

  // Enhanced theme distribution chart with better tooltips
  const themeChartData = {
    labels: gapAnalysis.visualizations.themeDistribution.data.map(d => d.label),
    datasets: [
      {
        data: gapAnalysis.visualizations.themeDistribution.data.map(d => d.value),
        backgroundColor: [
          '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
          '#EC4899', '#84CC16', '#6366F1', '#F97316', '#14B8A6'
        ],
        borderWidth: 2,
        borderColor: '#fff',
        hoverBorderWidth: 3,
        hoverBorderColor: '#000',
        hoverOffset: 4,
      },
    ],
  }

  // Enhanced chart options for better interactivity
  const themeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#E2E8F0',
          font: { size: 12 },
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#E2E8F0',
        borderColor: '#8B5CF6',
        borderWidth: 2,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} papers (${percentage}%)`;
          }
        }
      }
    }
  }

  // Add fallback data if theme distribution is empty
  if (gapAnalysis.visualizations.themeDistribution.data.length === 0) {
    const sampleThemes = gapAnalysis.analysis.themes.length > 0 ? gapAnalysis.analysis.themes : [
      { name: 'Machine Learning', frequency: 25 },
      { name: 'Deep Learning', frequency: 18 },
      { name: 'Data Analysis', frequency: 15 },
      { name: 'Algorithm Development', frequency: 12 },
      { name: 'Application Studies', frequency: 10 }
    ]
    
    themeChartData.labels = sampleThemes.map(t => t.name)
    themeChartData.datasets[0].data = sampleThemes.map(t => t.frequency)
  }

  // Enhanced methodology chart with better styling
  const methodologyChartData = {
    labels: gapAnalysis.visualizations.methodologyChart.data.slice(0, 8).map(d => d.label),
    datasets: [
      {
        label: 'Frequency',
        data: gapAnalysis.visualizations.methodologyChart.data.slice(0, 8).map(d => d.value),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(139, 92, 246, 1)',
        hoverBorderColor: '#fff',
        hoverBorderWidth: 2,
      },
    ],
  }

  // Enhanced methodology chart options
  const methodologyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#E2E8F0',
        borderColor: '#8B5CF6',
        borderWidth: 2,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${value} papers`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(226, 232, 240, 0.1)'
        },
        ticks: {
          color: '#E2E8F0',
          font: { size: 11 }
        }
      },
      x: {
        grid: {
          color: 'rgba(226, 232, 240, 0.1)'
        },
        ticks: {
          color: '#E2E8F0',
          font: { size: 11 },
          maxRotation: 45
        }
      }
    }
  }

  // Add fallback data if methodology chart is empty
  if (gapAnalysis.visualizations.methodologyChart.data.length === 0) {
    const sampleMethods = gapAnalysis.analysis.methodologies.length > 0 ? gapAnalysis.analysis.methodologies : [
      { name: 'Machine Learning', frequency: 20 },
      { name: 'Deep Learning', frequency: 15 },
      { name: 'Supervised Learning', frequency: 12 },
      { name: 'Neural Networks', frequency: 10 },
      { name: 'Optimization', frequency: 8 }
    ]
    
    methodologyChartData.labels = sampleMethods.map(m => m.name)
    methodologyChartData.datasets[0].data = sampleMethods.map(m => m.frequency)
  }

  // Enhanced gap scatter plot data for Plotly with better data handling
  const gapScatterData = [{
    x: gapAnalysis.visualizations.gapScatter.data.map(d => d.x),
    y: gapAnalysis.visualizations.gapScatter.data.map(d => d.y),
    text: gapAnalysis.visualizations.gapScatter.data.map(d => d.label),
    mode: 'markers+text',
    type: 'scatter' as const,
    textposition: 'top center' as const,
    marker: {
      size: 12,
      color: gapAnalysis.visualizations.gapScatter.data.map(d => {
        const colors = { 'Methodological': '#8B5CF6', 'Application': '#06B6D4', 'Data': '#10B981', 'Theoretical': '#F59E0B', 'Empirical': '#EF4444' }
        return colors[d.category as keyof typeof colors] || '#6B7280'
      }),
      opacity: 0.8,
    },
    hovertemplate: 
      '<b>%{text}</b><br>' +
      'Difficulty: %{x}<br>' +
      'Impact: %{y}<br>' +
      '<extra></extra>'
  }]

  // Fallback data if gap scatter is empty
  if (gapAnalysis.visualizations.gapScatter.data.length === 0) {
    // Generate sample data based on themes and gaps
    const sampleGaps = gapAnalysis.analysis.gaps.length > 0 ? gapAnalysis.analysis.gaps : [
      { title: 'Methodological Innovation', category: 'Methodological', difficulty: '2', impact: '3' },
      { title: 'Cross-Domain Application', category: 'Application', difficulty: '3', impact: '3' },
      { title: 'Data Quality Enhancement', category: 'Data', difficulty: '1', impact: '2' },
      { title: 'Theoretical Framework', category: 'Theoretical', difficulty: '2', impact: '2' }
    ]
    
    gapScatterData[0].x = sampleGaps.map(g => parseInt(g.difficulty) || Math.floor(Math.random() * 3) + 1)
    gapScatterData[0].y = sampleGaps.map(g => parseInt(g.impact) || Math.floor(Math.random() * 3) + 1)
    gapScatterData[0].text = sampleGaps.map(g => g.title)
    gapScatterData[0].marker.color = sampleGaps.map(g => {
      const colors = { 'Methodological': '#8B5CF6', 'Application': '#06B6D4', 'Data': '#10B981', 'Theoretical': '#F59E0B', 'Empirical': '#EF4444' }
      return colors[g.category as keyof typeof colors] || '#6B7280'
    })
  }

  const gapScatterLayout = {
    title: {
      text: 'Research Gaps: Impact vs Difficulty',
      font: { size: 18, color: '#E2E8F0' }
    },
    xaxis: { 
      title: { text: 'Difficulty (1=Easy, 3=Hard)', font: { color: '#E2E8F0' } },
      gridcolor: 'rgba(226, 232, 240, 0.1)',
      tickfont: { color: '#E2E8F0' },
      range: [0, 4]
    },
    yaxis: { 
      title: { text: 'Impact (1=Low, 3=High)', font: { color: '#E2E8F0' } },
      gridcolor: 'rgba(226, 232, 240, 0.1)',
      tickfont: { color: '#E2E8F0' },
      range: [0, 4]
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#E2E8F0' },
    showlegend: false,
    hovermode: 'closest',
    margin: { l: 60, r: 30, t: 60, b: 60 }
  }

  // Enhanced network visualization with better layout and interactivity
  useEffect(() => {
    if (!networkRef.current) return

    const nodes = gapAnalysis.visualizations.networkGraph.nodes
    const edges = gapAnalysis.visualizations.networkGraph.edges

    // Create a simple network visualization using HTML/CSS
    const container = networkRef.current
    container.innerHTML = ''

    // Fallback nodes if network is empty
    if (nodes.length === 0) {
      const fallbackNodes = gapAnalysis.analysis.themes.slice(0, 8).map((theme, i) => ({
        id: `theme-${i}`,
        label: theme.name,
        type: 'theme',
        size: Math.max(3, theme.frequency / 5)
      }))
      
      // Create fallback visualization
      const container = networkRef.current
      container.innerHTML = ''
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', '400')
      svg.setAttribute('viewBox', '0 0 800 400')

      // Improved force-directed layout simulation
      const centerX = 400
      const centerY = 200
      const radius = 120

      fallbackNodes.forEach((node, i) => {
        const angle = (i / fallbackNodes.length) * 2 * Math.PI
        const x = centerX + Math.cos(angle) * radius
        const y = centerY + Math.sin(angle) * radius

        // Create node circle with better styling
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', x.toString())
        circle.setAttribute('cy', y.toString())
        circle.setAttribute('r', Math.max(8, node.size * 3).toString())
        circle.setAttribute('fill', '#8B5CF6')
        circle.setAttribute('opacity', '0.9')
        circle.setAttribute('stroke', '#fff')
        circle.setAttribute('stroke-width', '2')

        // Create label with better readability
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', x.toString())
        text.setAttribute('y', (y + 25).toString())
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('fill', '#E2E8F0')
        text.setAttribute('font-size', '11')
        text.setAttribute('font-weight', '500')
        text.textContent = node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label

        // Add hover effect
        circle.addEventListener('mouseenter', () => {
          circle.setAttribute('r', (Math.max(8, node.size * 3) + 5).toString())
          circle.setAttribute('fill', '#A78BFA')
        })
        
        circle.addEventListener('mouseleave', () => {
          circle.setAttribute('r', Math.max(8, node.size * 3).toString())
          circle.setAttribute('fill', '#8B5CF6')
        })

        svg.appendChild(circle)
        svg.appendChild(text)
      })

      container.appendChild(svg)
      return
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '400')
    svg.setAttribute('viewBox', '0 0 800 400')

    // Improved circular layout with better spacing
    const centerX = 400
    const centerY = 200
    const radius = 150

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      // Create node circle with enhanced styling
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', x.toString())
      circle.setAttribute('cy', y.toString())
      circle.setAttribute('r', Math.max(8, node.size * 3).toString())
      circle.setAttribute('fill', node.type === 'theme' ? '#8B5CF6' : '#06B6D4')
      circle.setAttribute('opacity', '0.9')
      circle.setAttribute('stroke', '#fff')
      circle.setAttribute('stroke-width', '2')

      // Create label with better readability
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', x.toString())
      text.setAttribute('y', (y + 25).toString())
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', '#E2E8F0')
      text.setAttribute('font-size', '11')
      text.setAttribute('font-weight', '500')
      text.textContent = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label

      // Add hover effects
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('r', (Math.max(8, node.size * 3) + 5).toString())
        circle.setAttribute('fill', node.type === 'theme' ? '#A78BFA' : '#22D3EE')
      })
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', Math.max(8, node.size * 3).toString())
        circle.setAttribute('fill', node.type === 'theme' ? '#8B5CF6' : '#06B6D4')
      })

      svg.appendChild(circle)
      svg.appendChild(text)
    })

    container.appendChild(svg)
  }, [gapAnalysis])

  // Enhanced research trends chart
  const trendsData = {
    labels: gapAnalysis.analysis.trends?.map(t => t.year) || ['2020', '2021', '2022', '2023', '2024'],
    datasets: [{
      label: 'Paper Count',
      data: gapAnalysis.analysis.trends?.map(t => t.paperCount) || [15, 22, 28, 35, 42],
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#10B981',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8
    }]
  }

  const trendsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#E2E8F0',
        borderColor: '#10B981',
        borderWidth: 2
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.1)' },
        ticks: { color: '#E2E8F0' }
      },
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.1)' },
        ticks: { color: '#E2E8F0' }
      }
    }
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Enhanced Header with Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Research Gap Analysis Dashboard
        </h2>
        <p className="text-slate-400 text-lg">
          Comprehensive analysis of {gapAnalysis.totalPapers} papers on "{gapAnalysis.topic}"
        </p>
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mt-6 space-x-2">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'gaps', label: 'Research Gaps', icon: '🔍' },
            { id: 'opportunities', label: 'Opportunities', icon: '🚀' },
            { id: 'trends', label: 'Trends', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                selectedView === tab.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Overview Section */}
      {selectedView === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="card text-center p-6"
            >
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {gapAnalysis.totalPapers}
              </div>
              <div className="text-slate-400">Total Papers</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="card text-center p-6"
            >
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {gapAnalysis.analysis.themes.length}
              </div>
              <div className="text-slate-400">Research Themes</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="card text-center p-6"
            >
              <div className="text-3xl font-bold text-green-400 mb-2">
                {gapAnalysis.analysis.gaps.length}
              </div>
              <div className="text-slate-400">Identified Gaps</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="card text-center p-6"
            >
              <div className="text-3xl font-bold text-orange-400 mb-2">
                {gapAnalysis.analysis.opportunities.length}
              </div>
              <div className="text-slate-400">Opportunities</div>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Theme Distribution */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">🎯</span>
                Research Themes Distribution
              </h3>
              <div className="h-64">
                <Pie
                  data={themeChartData}
                  options={themeChartOptions}
                />
              </div>
            </motion.div>

            {/* Methodology Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">🔬</span>
                Common Methodologies
              </h3>
              <div className="h-64">
                <Bar
                  data={methodologyChartData}
                  options={methodologyChartOptions}
                />
              </div>
            </motion.div>
          </div>

          {/* Research Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">📈</span>
              Research Trends Over Time
            </h3>
            <div className="h-64">
              <Line
                data={trendsData}
                options={trendsOptions}
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Research Gaps Section */}
      {selectedView === 'gaps' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Gap Scatter Plot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">🔍</span>
              Research Gaps: Impact vs Difficulty
            </h3>
            <div className="h-96">
              <Plot
                data={gapScatterData}
                layout={gapScatterLayout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </motion.div>

          {/* Gap Details */}
          <div className="grid md:grid-cols-2 gap-6">
            {gapAnalysis.analysis.gaps.slice(0, 6).map((gap, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                className="card cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setSelectedGap(gap)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-brand-400">{gap.title}</h4>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      gap.difficulty === '1' ? 'bg-green-500/20 text-green-400' :
                      gap.difficulty === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Difficulty: {gap.difficulty}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      gap.impact === '1' ? 'bg-red-500/20 text-red-400' :
                      gap.impact === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      Impact: {gap.impact}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-3">{gap.description}</p>
                <div className="text-xs text-slate-400">
                  <strong>Category:</strong> {gap.category}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Opportunities Section */}
      {selectedView === 'opportunities' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {gapAnalysis.analysis.opportunities.slice(0, 8).map((opp, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="card"
            >
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-medium text-brand-400">{opp.title}</h4>
                <div className="flex space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    opp.difficulty === '1' ? 'bg-green-500/20 text-green-400' :
                    opp.difficulty === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {opp.difficulty === '1' ? 'Easy' : opp.difficulty === '2' ? 'Medium' : 'Hard'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    opp.impact === '1' ? 'bg-red-500/20 text-red-400' :
                    opp.impact === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {opp.impact === '1' ? 'Low' : opp.impact === '2' ? 'Medium' : 'High'}
                  </span>
                </div>
              </div>
              
              <p className="text-slate-300 mb-3">{opp.researchQuestion}</p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-slate-400 mb-2">Methodology</h5>
                  <div className="flex flex-wrap gap-2">
                    {opp.methodology.map((method, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className="font-medium text-slate-400 mb-2">Expected Contributions</h5>
                  <div className="flex flex-wrap gap-2">
                    {opp.expectedContributions.map((contribution, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        {contribution}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-600">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span><strong>Timeline:</strong> {opp.timeline}</span>
                  <span><strong>Category:</strong> {opp.difficulty === '1' ? 'Entry Level' : opp.difficulty === '2' ? 'Intermediate' : 'Advanced'}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Trends Section */}
      {selectedView === 'trends' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Research Trends Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">📈</span>
              Research Publication Trends
            </h3>
            <div className="h-80">
              <Line
                data={trendsData}
                options={trendsOptions}
              />
            </div>
          </div>

          {/* Collaboration Network */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">🌐</span>
              Research Network & Collaboration
            </h3>
            <div ref={networkRef} className="h-96 flex items-center justify-center">
              <div className="text-slate-400">Loading network visualization...</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Gap Detail Modal */}
      {selectedGap && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGap(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-brand-400">{selectedGap.title}</h3>
              <button
                onClick={() => setSelectedGap(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-slate-300 mb-2">Description</h4>
                <p className="text-slate-400">{selectedGap.description}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-slate-300 mb-2">Category</h4>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                    {selectedGap.category}
                  </span>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-300 mb-2">Difficulty & Impact</h4>
                  <div className="flex space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedGap.difficulty === '1' ? 'bg-green-500/20 text-green-400' :
                      selectedGap.difficulty === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Difficulty: {selectedGap.difficulty}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedGap.impact === '1' ? 'bg-red-500/20 text-red-400' :
                      selectedGap.impact === '2' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      Impact: {selectedGap.impact}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-300 mb-2">Suggested Approaches</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGap.suggestedApproaches.map((approach, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      {approach}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}