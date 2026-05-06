'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Edit, Trash2, Settings, Play, Pause, RefreshCw, Terminal, Shield, Activity } from 'lucide-react';

interface ActionOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface ActionDropdownProps {
  options: ActionOption[];
  disabled?: boolean;
  className?: string;
}

const ActionDropdown: React.FC<ActionDropdownProps> = ({
  options,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom, // Viewport-relative
        left: rect.right, // Viewport-relative
        width: 192,
      });
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setOpenUp(true);
      } else {
        setOpenUp(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option: ActionOption) => {
    if (!option.disabled) {
      option.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className={className} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          className="fixed z-[9999] w-48 bg-white border border-gray-200 rounded-md shadow-lg"
          style={{
            top: openUp ? 'auto' : `${coords.top + 4}px`,
            bottom: openUp ? `${window.innerHeight - (coords.top - (buttonRef.current?.offsetHeight || 0)) + 4}px` : 'auto',
            left: `${coords.left - 192}px`,
          }}
        >
          <div className="py-1 max-h-60 overflow-auto">
            {options.map((option, index) => (
              <React.Fragment key={option.key}>
                {option.divider && index > 0 ? (<div className="border-t border-gray-200 my-1" />) : (
                  <button
                    type="button"
                    onClick={() => handleOptionClick(option)}
                    disabled={option.disabled}
                    className={`w-full px-4 py-2 text-sm text-left flex items-center space-x-2 transition-colors ${
                      option.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : option.danger
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="w-4 h-4 flex-shrink-0">{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionDropdown;
