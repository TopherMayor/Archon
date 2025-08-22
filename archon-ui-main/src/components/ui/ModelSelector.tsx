import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Star, Gift, Zap, DollarSign } from 'lucide-react';
import { ModelDirectory, ModelInfo } from '../../services/modelDirectory';

interface ModelSelectorProps {
  label: string;
  value: string;
  onChange: (modelId: string) => void;
  type: 'chat' | 'embedding';
  provider?: string;
  placeholder?: string;
  accentColor?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  label,
  value,
  onChange,
  type,
  provider,
  placeholder,
  accentColor = 'green'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get filtered models based on search and provider
  const filteredModels = ModelDirectory.searchModels(searchQuery, type, provider);
  
  // Find current model info
  const currentModel = ModelDirectory.getModelById(value, type);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredModels.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredModels.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredModels[highlightedIndex]) {
          handleModelSelect(filteredModels[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleModelSelect = (model: ModelInfo) => {
    onChange(model.id);
    setIsOpen(false);
  };

  const getDisplayValue = () => {
    if (currentModel) {
      return currentModel.name;
    }
    return value || placeholder || `Select ${type} model...`;
  };

  const getPriceDisplay = (model: ModelInfo) => {
    if (model.isFree) return null;
    if (!model.pricing) return null;
    
    const { input, output } = model.pricing;
    if (output) {
      return `$${input}/$${output} per 1M tokens`;
    }
    return `$${input} per 1M tokens`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      
      {/* Input Field */}
      <div
        className={`relative w-full px-3 py-2 border rounded-md cursor-pointer transition-all duration-200
          ${isOpen 
            ? `border-${accentColor}-500 ring-1 ring-${accentColor}-500` 
            : `border-gray-300 dark:border-gray-600 hover:border-${accentColor}-400`}
          bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {currentModel?.isFree && (
              <Gift className="w-4 h-4 text-green-500" title="Free Model" />
            )}
            {currentModel?.recommended && (
              <Star className="w-4 h-4 text-yellow-500" title="Recommended" />
            )}
            <span className={`${!currentModel ? 'text-gray-500' : ''}`}>
              {getDisplayValue()}
            </span>
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 
              ${isOpen ? 'transform rotate-180' : ''}`} 
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 
          border border-${accentColor}-500 rounded-md shadow-lg max-h-80 overflow-hidden`}>
          
          {/* Search Box */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Search ${type} models...`}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 
                  rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Model List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredModels.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No models found
              </div>
            ) : (
              filteredModels.map((model, index) => (
                <div
                  key={model.id}
                  className={`p-3 cursor-pointer transition-colors duration-150
                    ${index === highlightedIndex 
                      ? `bg-${accentColor}-50 dark:bg-${accentColor}-900/20` 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => handleModelSelect(model)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {model.isFree && (
                          <div className="flex items-center space-x-1">
                            <Gift className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-medium text-green-600 dark:text-green-400 
                              bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                              FREE
                            </span>
                          </div>
                        )}
                        {model.recommended && (
                          <div className="flex items-center space-x-1">
                            <Star className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 
                              bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">
                              RECOMMENDED
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white mt-1">
                        {model.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {model.description}
                      </div>
                      {model.contextLength && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Context: {model.contextLength.toLocaleString()} tokens
                        </div>
                      )}
                    </div>
                    <div className="ml-3 text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {model.provider}
                      </div>
                      {model.isFree ? (
                        <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                          <Zap className="w-3 h-3 mr-1" />
                          Free
                        </div>
                      ) : (
                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                          <DollarSign className="w-3 h-3 mr-1" />
                          <span>{getPriceDisplay(model) || 'Paid'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with free model count */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
              {ModelDirectory.getFreeModels(type).filter(m => !provider || m.provider === provider).length} free models available
              {provider ? ` for ${provider}` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};