/**
 * Chart Generation Service
 * Server-side chart data preparation and export
 * 
 * Supported chart types:
 * - citation_trend: Papers published over time
 * - keyword_network: Co-occurrence network of keywords
 * - venue_distribution: Papers by venue/journal
 * 
 * Uses frontend chart libraries for rendering, backend for data processing
 */

const { createClient } = require('@supabase/supabase-js');
const debug = require('debug')('researchai:charts');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class ChartService {
  constructor() {
    // Chart configuration
    this.width = 800;
    this.height = 600;
  }

  /**
   * Generate citation trend chart
   * Shows papers published over time
   */
  async generateCitationTrend(workspaceId, params = {}) {
    debug(`Generating citation trend for workspace ${workspaceId}`);

    // Get pinned papers for workspace
    const { data: pins, error } = await supabase
      .from('workspace_papers')
      .select(`
        *,
        papers:paper_id (
          id,
          year,
          citation_count
        )
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    // Group by year
    const yearCounts = {};
    pins.forEach(pin => {
      if (pin.papers?.year) {
        yearCounts[pin.papers.year] = (yearCounts[pin.papers.year] || 0) + 1;
      }
    });

    // Sort years and prepare data
    const years = Object.keys(yearCounts).sort();
    const counts = years.map(y => yearCounts[y]);

    // Prepare chart configuration for frontend
    const chartConfig = {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'Papers Published',
          data: counts,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Publication Trend Over Time'
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };
    
    return {
      type: 'citation_trend',
      chartConfig,
      data: { years, counts },
      metadata: {
        total_papers: pins.length,
        year_range: years.length > 0 ? [years[0], years[years.length - 1]] : []
      }
    };
  }

  /**
   * Generate keyword network chart
   * Extracts keywords and builds co-occurrence network
   */
  async generateKeywordNetwork(workspaceId, params = {}) {
    debug(`Generating keyword network for workspace ${workspaceId}`);

    // Get pinned papers with keywords
    const { data: pins, error } = await supabase
      .from('workspace_papers')
      .select(`
        *,
        papers:paper_id (
          id,
          keywords,
          abstract
        )
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    // Extract and count keywords
    const keywordCounts = {};
    const keywordPairs = {};

    pins.forEach(pin => {
      const keywords = pin.papers?.keywords || [];
      
      keywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });

      // Track co-occurrences
      for (let i = 0; i < keywords.length; i++) {
        for (let j = i + 1; j < keywords.length; j++) {
          const pair = [keywords[i], keywords[j]].sort().join('|||');
          keywordPairs[pair] = (keywordPairs[pair] || 0) + 1;
        }
      }
    });

    // Get top keywords
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, params.maxKeywords || 15)
      .map(([keyword, count]) => ({ keyword, count }));

    // Create bar chart configuration for keyword frequencies
    const chartConfig = {
      type: 'bar',
      data: {
        labels: topKeywords.map(k => k.keyword),
        datasets: [{
          label: 'Keyword Frequency',
          data: topKeywords.map(k => k.count),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Top Keywords in Workspace Papers'
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };

    // Build network data for frontend visualization
    const nodes = topKeywords.map((k, i) => ({
      id: i,
      label: k.keyword,
      value: k.count
    }));

    const edges = [];
    Object.entries(keywordPairs).forEach(([pair, weight]) => {
      const [k1, k2] = pair.split('|||');
      const idx1 = topKeywords.findIndex(k => k.keyword === k1);
      const idx2 = topKeywords.findIndex(k => k.keyword === k2);
      
      if (idx1 !== -1 && idx2 !== -1) {
        edges.push({ from: idx1, to: idx2, value: weight });
      }
    });

    return {
      type: 'keyword_network',
      chartConfig,
      data: {
        keywords: topKeywords,
        network: { nodes, edges }
      },
      metadata: {
        total_keywords: Object.keys(keywordCounts).length,
        total_connections: Object.keys(keywordPairs).length
      }
    };
  }

  /**
   * Generate venue distribution chart
   * Shows distribution of papers across venues/journals
   */
  async generateVenueDistribution(workspaceId, params = {}) {
    debug(`Generating venue distribution for workspace ${workspaceId}`);

    const { data: pins, error } = await supabase
      .from('workspace_papers')
      .select(`
        *,
        papers:paper_id (
          venue
        )
      `)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    // Count papers by venue
    const venueCounts = {};
    pins.forEach(pin => {
      const venue = pin.papers?.venue || 'Unknown';
      venueCounts[venue] = (venueCounts[venue] || 0) + 1;
    });

    // Get top venues
    const topVenues = Object.entries(venueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, params.maxVenues || 10);

    const chartConfig = {
      type: 'doughnut',
      data: {
        labels: topVenues.map(([venue]) => venue),
        datasets: [{
          label: 'Papers by Venue',
          data: topVenues.map(([, count]) => count),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)',
            'rgba(83, 102, 255, 0.6)',
            'rgba(255, 99, 255, 0.6)',
            'rgba(99, 255, 132, 0.6)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Papers by Venue/Journal'
          },
          legend: {
            position: 'right'
          }
        }
      }
    };

    return {
      type: 'venue_distribution',
      chartConfig,
      data: { venues: topVenues },
      metadata: {
        total_venues: Object.keys(venueCounts).length,
        total_papers: pins.length
      }
    };
  }

  /**
   * Generate chart data URL from config
   */
  generateDataURL(chartConfig) {
    // For now, return a simple data URL - frontend will handle rendering
    const data = JSON.stringify(chartConfig);
    return `data:application/json;base64,${Buffer.from(data).toString('base64')}`;
  }

  /**
   * Upload chart data to Supabase Storage
   */
  async uploadChartData(chartConfig, workspaceId, chartType) {
    const filename = `${workspaceId}/${chartType}_${Date.now()}.json`;
    const bucket = 'chart-exports';
    const data = JSON.stringify(chartConfig, null, 2);

    try {
      // Upload to Supabase Storage
      const { data: uploadData, error } = await supabase.storage
        .from(bucket)
        .upload(filename, data, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error) {
      debug(`Failed to upload chart data: ${error.message}`);
      // Return data URL as fallback
      return this.generateDataURL(chartConfig);
    }
  }

  /**
   * Save chart metadata to database
   */
  async saveChartExport(workspaceId, userId, chartType, dataUrl, data, params) {
    try {
      const { data: chartExport, error } = await supabase
        .from('chart_exports')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          type: chartType,
          title: params.title || `${chartType.replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
          params: params,
          image_url: dataUrl // Now stores JSON data URL instead of image
        })
        .select()
        .single();

      if (error) throw error;

      return chartExport;
    } catch (error) {
      debug(`Failed to save chart export: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate chart (main method)
   */
  async generateChart(workspaceId, userId, chartType, params = {}) {
    const startTime = Date.now();
    
    debug(`Generating ${chartType} chart for workspace ${workspaceId}`);

    let result;
    
    switch (chartType) {
      case 'citation_trend':
        result = await this.generateCitationTrend(workspaceId, params);
        break;
      case 'keyword_network':
        result = await this.generateKeywordNetwork(workspaceId, params);
        break;
      case 'venue_distribution':
        result = await this.generateVenueDistribution(workspaceId, params);
        break;
      default:
        throw new Error(`Unsupported chart type: ${chartType}`);
    }

    // Upload chart configuration
    const dataUrl = await this.uploadChartData(
      result.chartConfig,
      workspaceId,
      chartType
    );

    // Save to database
    const chartExport = await this.saveChartExport(
      workspaceId,
      userId,
      chartType,
      dataUrl,
      result.data,
      params
    );

    const latency = Date.now() - startTime;

    return {
      chart_id: chartExport.id,
      type: chartType,
      chart_config: result.chartConfig,
      data_url: dataUrl,
      data: result.data,
      metadata: result.metadata,
      latency_ms: latency
    };
  }

  /**
   * Get all charts for a workspace
   */
  async getWorkspaceCharts(workspaceId) {
    const { data, error } = await supabase
      .from('chart_exports')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  }

  /**
   * Delete chart
   */
  async deleteChart(chartId, userId) {
    // Verify ownership
    const { data: chart, error: fetchError } = await supabase
      .from('chart_exports')
      .select('*')
      .eq('id', chartId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !chart) {
      throw new Error('Chart not found or access denied');
    }

    // Delete from storage if URL is from Supabase
    if (chart.image_url && chart.image_url.includes('supabase')) {
      try {
        const urlPath = new URL(chart.image_url).pathname;
        const filename = urlPath.split('/').pop();
        await supabase.storage.from('chart-exports').remove([filename]);
      } catch (error) {
        debug(`Failed to delete image from storage: ${error.message}`);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('chart_exports')
      .delete()
      .eq('id', chartId);

    if (deleteError) throw deleteError;

    return { success: true };
  }
}

// Export singleton
const chartService = new ChartService();

module.exports = {
  chartService,
  ChartService
};
