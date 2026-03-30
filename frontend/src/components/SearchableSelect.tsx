'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export type SearchableOption = { id: number; label: string };

type SearchableSelectProps = {
  label: string;
  value: string;
  onChange: (id: string) => void;
  loadOptions: (query: string) => Promise<SearchableOption[]>;
  loadLabelById?: (id: string) => Promise<string | null>;
  placeholder?: string;
  emptyHint?: string;
  minChars?: number;
  disabled?: boolean;
  className?: string;
  /** Em tabelas, omitir o &lt;label&gt; visual */
  hideLabel?: boolean;
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function SearchableSelect({
  label,
  value,
  onChange,
  loadOptions,
  loadLabelById,
  placeholder = 'Digite para buscar…',
  emptyHint,
  minChars = 2,
  disabled = false,
  className = '',
  hideLabel = false,
}: SearchableSelectProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [options, setOptions] = useState<SearchableOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const debouncedQuery = useDebounced(query, 280);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    let cancelled = false;
    (async () => {
      if (loadLabelById) {
        const lbl = await loadLabelById(value);
        if (!cancelled && lbl) setSelectedLabel(lbl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, loadLabelById]);

  const fetchList = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const rows = await loadOptions(q);
        setOptions(rows);
        setHighlight(0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [loadOptions],
  );

  useEffect(() => {
    if (!open) return;
    if (minChars > 0 && debouncedQuery.trim().length < minChars) {
      setOptions([]);
      return;
    }
    void fetchList(debouncedQuery.trim());
  }, [open, debouncedQuery, minChars, fetchList]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (opt: SearchableOption) => {
    onChange(String(opt.id));
    setSelectedLabel(opt.label);
    setQuery('');
    setOpen(false);
    setOptions([]);
  };

  const inputDisplay = open ? query : value && selectedLabel ? selectedLabel : query;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          autoComplete="off"
          aria-label={hideLabel ? label : undefined}
          placeholder={placeholder}
          className="input-field pl-9"
          value={inputDisplay}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (value && v.trim().length > 0) {
              onChange('');
              setSelectedLabel('');
            }
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
        />
      </div>
      {emptyHint && <p className="text-xs text-gray-500 mt-1">{emptyHint}</p>}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {minChars > 0 && debouncedQuery.trim().length < minChars && !loading && (
            <li className="px-3 py-2 text-sm text-gray-500">
              Digite pelo menos {minChars} caracteres para buscar.
            </li>
          )}
          {(minChars === 0 || debouncedQuery.trim().length >= minChars) && (
            <>
              {loading && (
                <li className="px-3 py-2 text-sm text-gray-400">Buscando…</li>
              )}
              {!loading &&
                options.length === 0 &&
                debouncedQuery.trim().length >= minChars && (
                  <li className="px-3 py-2 text-sm text-gray-500">Nenhum resultado.</li>
                )}
              {!loading &&
                options.map((opt, i) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                        i === highlight ? 'bg-blue-50' : ''
                      }`}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(opt)}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
