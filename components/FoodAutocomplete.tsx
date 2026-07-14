import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useFoodVocabulary } from './FoodVocabularyContext';
import { suggestFoods } from '../utils/foodVocabulary';
import { QUANTITY_RE } from '../utils/planScaling';

/**
 * Autocompletado de vocabulario de alimentos para los campos de texto libre.
 * Dos variantes que comparten el mismo desplegable de sugerencias y navegación
 * por teclado (↓/↑ mover, Enter/Tab aceptar, Esc cerrar, clic aceptar), con el
 * estilo del desplegable de recetas del editor de comidas.
 */

// ─── Desplegable presentacional compartido ──────────────────────────────────
const SuggestionDropdown: React.FC<{
  suggestions: string[];
  highlight: number;
  onPick: (s: string) => void;
}> = ({ suggestions, highlight, onPick }) => (
  <ul className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-xl py-1">
    {suggestions.map((s, i) => (
      <li key={s}>
        <button
          type="button"
          // preventDefault en mousedown: evita que el input pierda el foco
          // (blur) antes de que se registre el clic sobre la sugerencia.
          onMouseDown={e => e.preventDefault()}
          onClick={() => onPick(s)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            i === highlight
              ? 'bg-primary/10 text-primary'
              : 'text-text-main dark:text-white hover:bg-primary/5'
          }`}
        >
          {s}
        </button>
      </li>
    ))}
  </ul>
);

// ─── Input con autocompletado ────────────────────────────────────────────────
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** Si se pasa (p.ej. ','), solo se completa el último término tras el separador. */
  separator?: string;
  wrapperClassName?: string;
}

export const FoodAutocompleteInput: React.FC<InputProps> = ({
  value, onChange, separator, wrapperClassName, onKeyDown, ...rest
}) => {
  const vocab = useFoodVocabulary();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Término activo = valor entero, o el último segmento tras el separador.
  const { head, token } = useMemo(() => {
    if (separator) {
      const idx = value.lastIndexOf(separator);
      if (idx >= 0) return { head: value.slice(0, idx + 1), token: value.slice(idx + 1).trimStart() };
    }
    return { head: '', token: value };
  }, [value, separator]);

  const suggestions = useMemo(
    () => (token.trim().length >= 2 ? suggestFoods(vocab, token.trim()) : []),
    [vocab, token]
  );
  const showList = open && suggestions.length > 0;

  const accept = (s: string) => {
    onChange(head ? `${head.replace(/\s*$/, '')} ${s}` : s);
    setOpen(false);
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showList) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter')     { e.preventDefault(); accept(suggestions[highlight]); return; }
      if (e.key === 'Tab')       { accept(suggestions[highlight]); return; }
      if (e.key === 'Escape')    { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <input
        {...rest}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {showList && <SuggestionDropdown suggestions={suggestions} highlight={highlight} onPick={accept} />}
    </div>
  );
};

// ─── Textarea de ingredientes (una línea por ingrediente) ────────────────────
interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
}

/** Divide una línea en (prefijo de cantidad, nombre de alimento). */
function splitLine(line: string): { prefix: string; token: string } {
  const m = line.match(QUANTITY_RE);
  if (m) {
    const prefix = line.slice(0, line.length - m[3].length).trimEnd();
    return { prefix, token: m[3].trim() };
  }
  const bare = line.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
  if (bare) return { prefix: bare[1], token: bare[2].trim() };
  return { prefix: '', token: line.trim() };
}

export const IngredientTextarea: React.FC<TextareaProps> = ({
  value, onChange, wrapperClassName, onKeyDown, ...rest
}) => {
  const vocab = useFoodVocabulary();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [caret, setCaret] = useState(0);
  const pendingCaret = useRef<number | null>(null);

  // Límites de la línea donde está el cursor.
  const lineInfo = useMemo(() => {
    const start = value.lastIndexOf('\n', caret - 1) + 1;
    let end = value.indexOf('\n', caret);
    if (end === -1) end = value.length;
    const line = value.slice(start, end);
    return { start, end, ...splitLine(line) };
  }, [value, caret]);

  const suggestions = useMemo(
    () => (lineInfo.token.trim().length >= 2 ? suggestFoods(vocab, lineInfo.token.trim()) : []),
    [vocab, lineInfo.token]
  );
  const showList = open && suggestions.length > 0;

  // Reposicionar el cursor tras aceptar una sugerencia (reconstruimos el value).
  useLayoutEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      ref.current.selectionStart = ref.current.selectionEnd = pendingCaret.current;
      pendingCaret.current = null;
    }
  });

  const accept = (s: string) => {
    const newLine = lineInfo.prefix ? `${lineInfo.prefix} ${s}` : s;
    const next = value.slice(0, lineInfo.start) + newLine + value.slice(lineInfo.end);
    pendingCaret.current = lineInfo.start + newLine.length;
    onChange(next);
    setOpen(false);
    setHighlight(0);
  };

  const syncCaret = () => {
    if (ref.current) setCaret(ref.current.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showList) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); return; }
      // Enter con lista abierta acepta y NO inserta salto de línea.
      if (e.key === 'Enter')     { e.preventDefault(); accept(suggestions[highlight]); return; }
      if (e.key === 'Tab')       { accept(suggestions[highlight]); return; }
      if (e.key === 'Escape')    { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={e => { onChange(e.target.value); setCaret(e.target.selectionStart); setOpen(true); setHighlight(0); }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
      {showList && <SuggestionDropdown suggestions={suggestions} highlight={highlight} onPick={accept} />}
    </div>
  );
};
