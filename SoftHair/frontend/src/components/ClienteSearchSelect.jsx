import React from 'react';
import { clientesAPI } from '../services/api';

/**
 * Campo de busca de cliente por nome (autocomplete).
 * Mesmo comportamento usado na Agenda.
 *
 * Props:
 *  - value: id do cliente selecionado
 *  - onChange: (id, clienteObj) => void
 *  - selectedCliente: objeto { id, nome, telefone } para exibir o selecionado
 *  - disabled
 */
export default function ClienteSearchSelect({ value, onChange, selectedCliente, disabled }) {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef(null);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const doSearch = React.useCallback((text) => {
    clearTimeout(timerRef.current);
    if (!text || text.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await clientesAPI.getAll({ search: text, limit: 20 });
        const raw = res.data?.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setResults(list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, []);

  const displayLabel = (c) => `${c.nome}${c.telefone ? ' — ' + c.telefone : ''}`;
  const displayValue = focused ? search : (selectedCliente ? displayLabel(selectedCliente) : '');

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); doSearch(e.target.value); }}
        onFocus={() => { setFocused(true); setOpen(true); setSearch(''); setResults([]); }}
        placeholder={selectedCliente ? displayLabel(selectedCliente) : 'Buscar cliente por nome...'}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-[9999] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
          {loading && <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Buscando...</div>}
          {!loading && results.length === 0 && search.length > 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Nenhum resultado</div>
          )}
          {!loading && results.length === 0 && search.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Digite para buscar</div>
          )}
          {results.map(c => (
            <div
              key={c.id}
              className={`px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm ${c.id === value ? 'bg-indigo-100 dark:bg-indigo-900/40 font-medium text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-100'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.id, c);
                setOpen(false);
                setFocused(false);
                setSearch('');
              }}
            >
              {displayLabel(c)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
