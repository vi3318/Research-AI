import React, { useState } from 'react';
import { Quote } from 'lucide-react';
import CitationModal from './CitationModal';

interface CitationButtonProps {
  paperData: any;
  variant?: 'primary' | 'secondary' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CitationButton: React.FC<CitationButtonProps> = ({
  paperData,
  variant = 'secondary',
  size = 'md',
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    minimal: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <>
      <button
        onClick={handleClick}
        className={buttonClasses}
        title="Cite this paper"
      >
        <Quote className={`${iconSizes[size]} mr-1.5`} />
        Cite
      </button>

      <CitationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        paperData={paperData}
      />
    </>
  );
};

export default CitationButton;
