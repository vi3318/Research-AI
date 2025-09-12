import React, { createContext, useContext, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  url?: string;
  doi?: string;
  arxivId?: string;
  venue?: string;
  year?: number;
  keywords?: string[];
  pdfUrl?: string;
  citations?: number;
  metadata?: any;
  addedAt: string;
}

interface SearchResult {
  id: string;
  query: string;
  papers: Paper[];
  timestamp: string;
  totalResults: number;
  source: string;
}

interface PaperStorageContextType {
  papers: Paper[];
  searchHistory: SearchResult[];
  loading: boolean;
  addPaper: (paper: Paper) => void;
  removePaper: (paperId: string) => void;
  getPaper: (paperId: string) => Paper | undefined;
  addSearchResult: (result: SearchResult) => void;
  clearSearchHistory: () => void;
  clearPapers: () => void;
  searchPapers: (query: string) => Paper[];
  hasPapers: () => boolean;
}

const PaperStorageContext = createContext<PaperStorageContextType | undefined>(undefined);

export const usePaperStorage = () => {
  const context = useContext(PaperStorageContext);
  if (context === undefined) {
    throw new Error('usePaperStorage must be used within a PaperStorageProvider');
  }
  return context;
};

interface PaperStorageProviderProps {
  children: React.ReactNode;
}

export const PaperStorageProvider: React.FC<PaperStorageProviderProps> = ({ children }) => {
  const [papers, setPapers] = useLocalStorage<Paper[]>('research-papers', []);
  const [searchHistory, setSearchHistory] = useLocalStorage<SearchResult[]>('research-search-history', []);
  const [loading, setLoading] = useState(false);

  const addPaper = (paper: Paper) => {
    setPapers(prev => {
      // Avoid duplicates
      if (prev.some(p => p.id === paper.id)) {
        return prev.map(p => p.id === paper.id ? { ...paper, addedAt: new Date().toISOString() } : p);
      }
      return [...prev, { ...paper, addedAt: new Date().toISOString() }];
    });
  };

  const removePaper = (paperId: string) => {
    setPapers(prev => prev.filter(p => p.id !== paperId));
  };

  const getPaper = (paperId: string) => {
    return papers.find(p => p.id === paperId);
  };

  const addSearchResult = (result: SearchResult) => {
    setSearchHistory(prev => {
      // Keep only last 50 searches
      const newHistory = [result, ...prev].slice(0, 50);
      return newHistory;
    });

    // Also add papers to the main collection
    result.papers.forEach(paper => {
      if (!papers.some(p => p.id === paper.id)) {
        addPaper(paper);
      }
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const clearPapers = () => {
    setPapers([]);
  };

  const searchPapers = (query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return papers.filter(paper => 
      paper.title.toLowerCase().includes(lowercaseQuery) ||
      paper.abstract.toLowerCase().includes(lowercaseQuery) ||
      paper.authors.some(author => author.toLowerCase().includes(lowercaseQuery)) ||
      paper.keywords?.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
    );
  };

  const hasPapers = () => {
    return papers.length > 0;
  };

  const value = {
    papers,
    searchHistory,
    loading,
    addPaper,
    removePaper,
    getPaper,
    addSearchResult,
    clearSearchHistory,
    clearPapers,
    searchPapers,
    hasPapers,
  };

  return (
    <PaperStorageContext.Provider value={value}>
      {children}
    </PaperStorageContext.Provider>
  );
};
