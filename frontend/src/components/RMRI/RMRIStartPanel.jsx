/**
 * RMRI Start Panel Component
 * 
 * Form to initiate a new RMRI research intelligence run
 * Features: Domain selection, iteration config, paper upload
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { 
  HiBeaker as BeakerIcon, 
  HiCloudUpload as CloudArrowUpIcon, 
  HiAdjustments as AdjustmentsHorizontalIcon,
  HiSparkles as SparklesIcon,
  HiDocumentAdd as DocumentPlusIcon
} from 'react-icons/hi';
import axios from 'axios';

const DOMAINS = [
  { id: 'machine_learning', label: 'Machine Learning', color: 'blue', icon: '🤖' },
  { id: 'natural_language_processing', label: 'Natural Language Processing', color: 'purple', icon: '💬' },
  { id: 'computer_vision', label: 'Computer Vision', color: 'pink', icon: '👁️' },
  { id: 'quantum_computing', label: 'Quantum Computing', color: 'indigo', icon: '⚛️' },
  { id: 'bioinformatics', label: 'Bioinformatics', color: 'green', icon: '🧬' },
  { id: 'robotics', label: 'Robotics', color: 'orange', icon: '🤖' },
  { id: 'cybersecurity', label: 'Cybersecurity', color: 'red', icon: '🔒' },
  { id: 'data_science', label: 'Data Science & Analytics', color: 'teal', icon: '📊' },
  { id: 'human_computer_interaction', label: 'Human-Computer Interaction', color: 'yellow', icon: '👆' },
  { id: 'blockchain', label: 'Blockchain & Distributed Systems', color: 'violet', icon: '⛓️' },
  { id: 'edge_computing', label: 'Edge & Cloud Computing', color: 'sky', icon: '☁️' },
  { id: 'iot', label: 'Internet of Things (IoT)', color: 'lime', icon: '🌐' },
  { id: 'augmented_reality', label: 'AR/VR & Extended Reality', color: 'fuchsia', icon: '🥽' },
  { id: 'healthcare_ai', label: 'Healthcare & Medical AI', color: 'rose', icon: '🏥' },
  { id: 'autonomous_systems', label: 'Autonomous Systems', color: 'amber', icon: '🚗' },
  { id: 'general', label: 'General / Cross-Domain', color: 'gray', icon: '🔬' }
];

const RMRIStartPanel = ({ onRunCreated }) => {
  const { user } = useAuth();

  // Form state
  const [query, setQuery] = useState('');
  const [selectedDomains, setSelectedDomains] = useState(['general']);
  const [maxIterations, setMaxIterations] = useState(3);
  const [convergenceThreshold, setConvergenceThreshold] = useState(0.7);
  const [papers, setPapers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);
  
  // Ref to prevent duplicate workspace creation
  const workspaceCreatedRef = useRef(false);

  // Create a fresh RMRI workspace (only once)
  useEffect(() => {
    const createWorkspace = async () => {
      // Prevent duplicate creation
      if (workspaceCreatedRef.current || workspaceId) return;
      workspaceCreatedRef.current = true;
      
      try {
        console.log('� Creating fresh RMRI workspace...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('❌ No session found');
          return;
        }

        // Create a new RMRI workspace with timestamp
        const timestamp = new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const { data: newWorkspace, error: createError } = await supabase
          .from('workspaces')
          .insert({
            name: `RMRI Analysis - ${timestamp}`,
            description: 'Research gap analysis workspace',
            owner_id: user.id
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating workspace:', createError);
          toast.error('Failed to create workspace');
          return;
        }

        if (newWorkspace) {
          console.log('✅ Created workspace:', newWorkspace.id);
          setWorkspaceId(newWorkspace.id);
          toast.success('Workspace ready for RMRI analysis');
        }
      } catch (err) {
        console.error('❌ Error creating workspace:', err);
        toast.error('Workspace setup failed');
        workspaceCreatedRef.current = false; // Reset on error
      }
    };

    if (user && !workspaceId && !workspaceCreatedRef.current) {
      createWorkspace();
    }
  }, [user]);

  // File upload handlers
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const uploadedPapers = [];
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

      for (const file of files) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File ${file.name} is too large. Maximum size is 10MB.`);
        }

        // Check file type
        if (file.type !== 'application/pdf') {
          throw new Error(`File ${file.name} is not a PDF. Please upload PDF files only.`);
        }

        // Read file as base64 for temporary storage
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        uploadedPapers.push({
          title: file.name.replace('.pdf', ''),
          fileName: file.name,
          url: base64, // Store as base64 temporarily
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }

      setPapers([...papers, ...uploadedPapers]);
      setError(null);
      toast.success(`${uploadedPapers.length} paper(s) uploaded successfully`);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removePaper = (index) => {
    setPapers(papers.filter((_, i) => i !== index));
  };

  const toggleDomain = (domainId) => {
    if (selectedDomains.includes(domainId)) {
      setSelectedDomains(selectedDomains.filter(d => d !== domainId));
    } else {
      setSelectedDomains([...selectedDomains, domainId]);
    }
  };

  // Start RMRI run
  const handleStartRun = async () => {
    if (!query.trim()) {
      setError('Please enter a research query');
      return;
    }

    if (papers.length === 0) {
      setError('Please upload at least one paper');
      return;
    }

    if (!workspaceId) {
      setError('Setting up workspace...');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to start RMRI analysis');
        return;
      }

      console.log('📊 Starting RMRI run with query:', query);
      console.log('📄 Papers:', papers.length);
      
      // Step 1: Create RMRI run
      const startResponse = await axios.post(
        '/api/rmri/start',
        {
          query,
          domains: selectedDomains,
          config: {
            workspace_id: workspaceId,
            maxDepth: maxIterations,
            convergenceThreshold,
            minClusterSize: 2,
            maxGapsToRank: 20
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ RMRI run created:', startResponse.data);
      const runId = startResponse.data.data.runId;

      // Step 2: Execute orchestration
      console.log('🚀 Executing RMRI orchestration for run:', runId);
      await axios.post(
        `/api/rmri/${runId}/execute`,
        {
          papers: papers.map(p => ({
            title: p.title,
            url: p.url,
            fileName: p.fileName
          })),
          llmClient: 'cerebras'
        },
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ RMRI execution started successfully');
      toast.success('RMRI analysis started successfully!');

      // Notify parent
      if (onRunCreated) {
        onRunCreated(runId);
      }

      // Reset form
      setQuery('');
      setPapers([]);
      setSelectedDomains(['general']);
    } catch (err) {
      console.error('❌ RMRI start error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to start analysis';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto p-8"
    >
      {/* Header - Full Width */}
      <div className="mb-8">
        <motion.div 
          className="flex items-center gap-3 mb-2"
          initial={{ x: -20 }}
          animate={{ x: 0 }}
        >
          <BeakerIcon className="w-10 h-10 text-indigo-600" />
          <h2 className="text-4xl font-bold text-gray-900">
            Start RMRI Analysis
          </h2>
        </motion.div>
        <p className="text-lg text-gray-600">
          Recursive Multi-Agent Research Intelligence for deep gap analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Form - Takes 3/4 of space */}
        <div className="lg:col-span-3">
          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
            >
              {error}
            </motion.div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
            >
              {error}
            </motion.div>
          )}

      {/* Research Query */}
      <motion.div 
        className="mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Research Query
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What research gaps exist in transformer architectures for graph learning?"
          className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-sm hover:border-gray-400 transition-colors"
          rows={4}
        />
        <p className="mt-1.5 text-sm text-gray-500">
          Describe the research area you want to analyze
        </p>
      </motion.div>

      {/* Domain Selection */}
      <motion.div 
        className="mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Research Domains
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {DOMAINS.map((domain) => {
            const isSelected = selectedDomains.includes(domain.id);
            return (
              <motion.button
                key={domain.id}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggleDomain(domain.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-100 text-indigo-900 shadow-md'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{domain.icon}</span>
                  <span className="text-sm font-semibold">{domain.label}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Select one or more research domains for targeted analysis
        </p>
      </motion.div>

      {/* Configuration */}
      <motion.div 
        className="mb-5 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <AdjustmentsHorizontalIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-900">Advanced Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Max Iterations */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Max Iterations
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of refinement iterations (1-5)
            </p>
          </div>

          {/* Convergence Threshold */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Convergence Threshold
            </label>
            <input
              type="number"
              min={0.5}
              max={1.0}
              step={0.05}
              value={convergenceThreshold}
              onChange={(e) => setConvergenceThreshold(parseFloat(e.target.value))}
              className="w-full px-4 py-2.5 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Similarity threshold for convergence (0.5-1.0)
            </p>
          </div>
        </div>
      </motion.div>

      {/* Paper Upload */}
      <motion.div 
        className="mb-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <label className="block text-base font-semibold text-gray-700 mb-2">
          Upload Research Papers
        </label>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition-all">
          <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-3">
            Drop PDF files here or click to browse
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="paper-upload"
          />
          <label
            htmlFor="paper-upload"
            className="inline-block px-5 py-2.5 bg-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            style={{ color: 'white' }}
          >
            <span className="text-white font-semibold">
              {uploading ? 'Uploading...' : 'Select Papers'}
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            PDF format, max 10MB per file
          </p>
        </div>

        {/* Uploaded Papers List */}
        {papers.length > 0 && (
          <motion.div 
            className="mt-4 space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {papers.map((paper, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <DocumentPlusIcon className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{paper.title}</p>
                    <p className="text-xs text-gray-500">{paper.fileName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePaper(index)}
                  className="px-3 py-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-md text-xs font-medium transition-all border border-red-200 hover:border-red-600"
                >
                  Remove
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Start Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={handleStartRun}
        disabled={starting || !query.trim() || papers.length === 0 || !workspaceId}
        className={`w-full py-4 rounded-lg text-base font-bold text-white transition-all ${
          starting || !query.trim() || papers.length === 0 || !workspaceId
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
        }`}
      >
        {starting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting RMRI Analysis...
          </span>
        ) : !workspaceId ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Setting up workspace...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <SparklesIcon className="w-5 h-5" />
            Start Analysis ({papers.length} papers)
          </span>
        )}
      </motion.button>

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
      >
        <p className="text-sm text-blue-800">
          <strong>What happens next?</strong> The RMRI system will:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-blue-700 ml-4">
          <li>• Analyze each paper individually (Micro Agents)</li>
          <li>• Cluster findings by theme (Meso Agent)</li>
          <li>• Synthesize cross-domain gaps (Meta Agent)</li>
          <li>• Iteratively refine until convergence</li>
        </ul>
      </motion.div>
        </div>

        {/* Help Guide - Right Sidebar (1/4 width) */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="sticky top-6 space-y-4"
          >
            {/* Quick Guide Card */}
            <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 rounded-lg p-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-6 h-6 text-indigo-600" />
                <h3 className="font-bold text-lg text-indigo-900">Quick Guide</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                {/* Max Iterations Guide */}
                <div className="bg-white bg-opacity-80 rounded-lg p-3 border border-indigo-100 shadow-sm">
                  <h4 className="font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5 text-sm">
                    🔄 Max Iterations
                  </h4>
                  <p className="text-gray-700 mb-1.5 leading-relaxed text-xs">
                    Number of refinement cycles the RMRI system will perform.
                  </p>
                  <ul className="space-y-0.5 text-xs text-gray-600 ml-2">
                    <li>• <strong>1-2:</strong> Quick analysis (15-30 min)</li>
                    <li>• <strong>3:</strong> Balanced depth (30-45 min) ⭐</li>
                    <li>• <strong>4-5:</strong> Deep analysis (1+ hour)</li>
                  </ul>
                  <p className="text-xs text-indigo-700 mt-1.5 font-medium">
                    💡 Recommended: 3 iterations for most research
                  </p>
                </div>

                {/* Convergence Threshold Guide */}
                <div className="bg-white bg-opacity-80 rounded-lg p-3 border border-indigo-100 shadow-sm">
                  <h4 className="font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5 text-sm">
                    🎯 Convergence Threshold
                  </h4>
                  <p className="text-gray-700 mb-1.5 leading-relaxed text-xs">
                    Similarity score needed to stop early (0.5 = loose, 1.0 = perfect match).
                  </p>
                  <ul className="space-y-0.5 text-xs text-gray-600 ml-2">
                    <li>• <strong>0.5-0.6:</strong> Broad exploration</li>
                    <li>• <strong>0.7:</strong> Balanced ⭐</li>
                    <li>• <strong>0.8-1.0:</strong> Very precise</li>
                  </ul>
                  <p className="text-xs text-indigo-700 mt-1.5 font-semibold">
                    💡 Recommended: 0.7 for most cases
                  </p>
                </div>

                {/* Research Domains Guide */}
                <div className="bg-white bg-opacity-80 rounded-lg p-3 border border-indigo-100 shadow-sm">
                  <h4 className="font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5 text-sm">
                    🔬 Research Domains
                  </h4>
                  <p className="text-gray-700 mb-1.5 leading-relaxed text-xs">
                    Select specific domains or choose "General" for cross-domain analysis.
                  </p>
                  <p className="text-xs text-gray-600">
                    Multiple selections help identify interdisciplinary research gaps.
                  </p>
                </div>

                {/* Paper Upload Guide */}
                <div className="bg-white bg-opacity-80 rounded-lg p-3 border border-indigo-100 shadow-sm">
                  <h4 className="font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5 text-sm">
                    📄 Paper Upload
                  </h4>
                  <p className="text-gray-700 mb-1.5 leading-relaxed text-xs">
                    Upload 5-20 research papers for best results.
                  </p>
                  <ul className="space-y-0.5 text-xs text-gray-600 ml-2">
                    <li>• More papers = deeper insights</li>
                    <li>• PDF format only (max 10MB each)</li>
                    <li>• Recent papers (last 5 years) work best</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Pro Tips Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 shadow-md">
              <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2 text-sm">
                💡 Pro Tips
              </h4>
              <ul className="space-y-1.5 text-xs text-amber-900">
                <li className="flex gap-1.5">
                  <span>✓</span>
                  <span>Start with 3 iterations and 0.7 threshold</span>
                </li>
                <li className="flex gap-1.5">
                  <span>✓</span>
                  <span>Upload diverse papers from different perspectives</span>
                </li>
                <li className="flex gap-1.5">
                  <span>✓</span>
                  <span>Be specific in your research query</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Select 2-3 related domains for interdisciplinary gaps</span>
                </li>
              </ul>
            </div>

            {/* System Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
              <h4 className="font-semibold text-gray-900 mb-2">How RMRI Works</h4>
              <ol className="space-y-2 ml-3 list-decimal">
                <li><strong>Micro Agents:</strong> Analyze each paper individually</li>
                <li><strong>Meso Agent:</strong> Cluster similar findings</li>
                <li><strong>Meta Agent:</strong> Synthesize cross-domain insights</li>
                <li><strong>Refinement:</strong> Iterate until convergence</li>
              </ol>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default RMRIStartPanel;
