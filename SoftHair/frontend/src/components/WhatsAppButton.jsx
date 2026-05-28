import { useState } from 'react';
import { MessageCircle, X, Copy, Send } from 'lucide-react';
import { TEMPLATES, render, openWhatsApp } from '../utils/whatsapp';

/**
 * Botão WhatsApp + modal de templates.
 * Props:
 *   - telefone: string (obrigatório pra abrir wa.me)
 *   - vars: { nome, data, hora, servico } — placeholders dos templates
 *   - size, variant: cosméticos
 */
export default function WhatsAppButton({ telefone, vars = {}, size = 16, variant = 'icon' }) {
  const [open, setOpen] = useState(false);
  const [tplId, setTplId] = useState(TEMPLATES[0].id);
  const [text, setText] = useState(render(TEMPLATES[0].body, vars));

  const handleSelectTpl = (id) => {
    setTplId(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    setText(render(tpl?.body || '', vars));
  };

  const handleSend = () => {
    if (openWhatsApp(telefone, text)) setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Mensagem copiada!');
    } catch { /* noop */ }
  };

  const btn = variant === 'icon' ? (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
      title="WhatsApp"
    >
      <MessageCircle size={size} />
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm font-medium"
    >
      <MessageCircle size={size} /> WhatsApp
    </button>
  );

  return (
    <>
      {btn}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={20} />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">WhatsApp</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Modelo</label>
                <select
                  value={tplId}
                  onChange={(e) => handleSelectTpl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Mensagem</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Telefone: {telefone || '(não cadastrado)'}
              </p>
            </div>
            <div className="p-5 border-t dark:border-gray-700 flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Copy size={16} /> Copiar
              </button>
              <button
                onClick={handleSend}
                disabled={!telefone}
                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
