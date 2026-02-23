import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const CustomSelect = ({ options, placeholder, onSelect, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    setSelected(option);
    setIsOpen(false);
    onSelect(option);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">{label}</label>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 flex justify-between items-center hover:border-blue-200 transition-all text-sm font-medium text-slate-700"
      >
        <span>{selected ? `${selected.id} (${selected.type})` : placeholder}</span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
          {options.length > 0 ? options.map((option) => (
            <li
              key={option.id}
              onClick={() => handleSelect(option)}
              className="px-5 py-3 hover:bg-blue-50 cursor-pointer text-sm font-medium text-slate-600 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              {option.id} <span className="text-xs text-blue-500 ml-1">({option.type})</span>
            </li>
          )) : (
            <li className="px-5 py-4 text-sm text-slate-400 italic">No spots available</li>
          )}
        </ul>
      )}
    </div>
  );
};