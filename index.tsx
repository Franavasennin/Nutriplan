import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Error Boundary: evita la "pantalla en blanco" silenciosa ──────────────────
// Si algo revienta en el árbol de React, muestra el error en pantalla (con la
// opción de recargar) en lugar de dejar la página completamente en blanco.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App crash]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '40px auto' }}>
          <h2 style={{ color: '#dc2626', marginBottom: 8 }}>La aplicación ha fallado al cargar</h2>
          <p style={{ color: '#374151', marginBottom: 16 }}>
            Se ha producido un error inesperado. Prueba a recargar; si persiste, comparte este mensaje:
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: 12, borderRadius: 8,
            fontSize: 13, color: '#111827', overflow: 'auto',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#13ec5b', color: '#102216', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);