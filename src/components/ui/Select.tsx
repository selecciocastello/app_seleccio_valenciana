import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string | number;
  badgeColor?: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  isActive?: boolean;
  disabled?: boolean;
  id?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecciona una opció',
  label,
  icon,
  searchable,
  searchPlaceholder = 'Cercar...',
  theme = 'light',
  size = 'md',
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  isActive,
  disabled = false,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Find currently selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Determine if search should be enabled (explicit prop or > 7 options)
  const isSearchEnabled = searchable !== undefined ? searchable : normalizedOptions.length > 7;

  // Filter options by search term
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      if (isSearchEnabled) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen, isSearchEnabled]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = filteredOptions.findIndex((o) => o.value === value);
        const nextIndex = (currentIndex + 1) % filteredOptions.length;
        if (filteredOptions[nextIndex]) {
          onChange(filteredOptions[nextIndex].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        const currentIndex = filteredOptions.findIndex((o) => o.value === value);
        const prevIndex = currentIndex <= 0 ? filteredOptions.length - 1 : currentIndex - 1;
        if (filteredOptions[prevIndex]) {
          onChange(filteredOptions[prevIndex].value);
        }
      }
    }
  };

  const isDark = theme === 'dark';

  const isFilterActive = isActive !== undefined ? isActive : value !== 'all' && value !== '';

  return (
    <div
      ref={containerRef}
      className={clsx('relative select-none', className)}
      onKeyDown={handleKeyDown}
      id={id}
    >
      {label && (
        <label
          className={clsx(
            'block text-xs font-bold mb-1.5 uppercase tracking-wider',
            isDark ? 'text-slate-300' : 'text-slate-700'
          )}
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={clsx(
          'w-full flex items-center justify-between gap-2.5 rounded-xl text-left transition-all duration-200 outline-none',
          // Sizing
          size === 'sm' && 'px-3 py-1.5 text-xs font-semibold',
          size === 'md' && 'px-3.5 py-2.5 text-sm font-semibold',
          size === 'lg' && 'px-4 py-3 text-base font-semibold',
          // Themes & Active State
          isDark
            ? clsx(
                'bg-slate-900 border text-white',
                isOpen
                  ? 'border-[#ff6600] ring-2 ring-[#ff6600]/20 shadow-lg shadow-black/40'
                  : isFilterActive
                  ? 'border-sky-500/80 bg-sky-950/30 text-sky-300'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
              )
            : clsx(
                'border text-slate-900',
                isOpen
                  ? 'border-[#002568] bg-white ring-2 ring-[#002568]/15 shadow-md'
                  : isFilterActive
                  ? 'border-blue-500 bg-blue-50/80 text-[#002568] font-bold shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
              ),
          disabled && 'opacity-50 cursor-not-allowed',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
          {icon && (
            <span
              className={clsx(
                'shrink-0 text-base',
                isDark
                  ? isFilterActive ? 'text-sky-400' : 'text-slate-400'
                  : isFilterActive ? 'text-[#002568]' : 'text-slate-400'
              )}
            >
              {icon}
            </span>
          )}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span
              className={clsx(
                'ml-1 px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0',
                selectedOption.badgeColor || (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-blue-100 text-blue-800')
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={clsx(
            'w-4 h-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
            isDark
              ? isFilterActive ? 'text-sky-400' : 'text-slate-400'
              : isFilterActive ? 'text-[#002568]' : 'text-slate-400'
          )}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1.5 w-full min-w-[200px] rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150',
            isDark
              ? 'bg-slate-900 border-slate-800 text-white shadow-black/70'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/15',
            dropdownClassName
          )}
          style={{ minWidth: 'max(100%, 220px)' }}
        >
          {/* Search Box if list is long */}
          {isSearchEnabled && (
            <div
              className={clsx(
                'p-2.5 border-b sticky top-0 z-10',
                isDark ? 'bg-slate-900/95 backdrop-blur-sm border-slate-800' : 'bg-white/95 backdrop-blur-sm border-slate-100'
              )}
            >
              <div className="relative">
                <Search
                  className={clsx(
                    'w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2',
                    isDark ? 'text-slate-400' : 'text-slate-400'
                  )}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={clsx(
                    'w-full pl-9 pr-8 py-2 rounded-xl text-sm font-semibold outline-none transition-all',
                    isDark
                      ? 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-[#ff6600]'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#002568] focus:bg-white'
                  )}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className={clsx(
                      'absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200/50',
                      isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div
                className={clsx(
                  'py-6 px-4 text-center text-sm font-medium',
                  isDark ? 'text-slate-500' : 'text-slate-400'
                )}
              >
                No s'han trobat opcions
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm font-semibold transition-all duration-150 cursor-pointer',
                      isSelected
                        ? isDark
                          ? 'bg-gradient-to-r from-sky-600/30 to-sky-500/10 text-sky-300 font-bold border border-sky-500/30'
                          : 'bg-gradient-to-r from-blue-50 to-sky-50/50 text-[#002568] font-bold border border-blue-200/80 shadow-2xs'
                        : isDark
                        ? 'text-slate-200 hover:bg-slate-800/90 hover:text-white'
                        : 'text-slate-800 hover:bg-slate-100/90 hover:text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <div className="truncate">
                        <div className="truncate text-sm leading-snug">{option.label}</div>
                        {option.description && (
                          <div
                            className={clsx(
                              'text-xs font-normal truncate mt-0.5',
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            )}
                          >
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {option.badge !== undefined && (
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-extrabold',
                            option.badgeColor || (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700')
                          )}
                        >
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check
                          className={clsx(
                            'w-4 h-4 shrink-0',
                            isDark ? 'text-sky-400' : 'text-[#002568]'
                          )}
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
