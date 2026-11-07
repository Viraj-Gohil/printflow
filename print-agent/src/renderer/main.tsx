import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[RootErrorBoundary] Caught unhandled rendering exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetAndReload = (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage access errors
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '680px',
            width: '100%',
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                display: 'grid',
                placeItems: 'center',
                fontSize: '22px',
                fontWeight: 'bold'
              }}>
                !
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                  PrintFlow Agent Interface Recovery
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  An unexpected error occurred in the desktop user interface.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#0B1120',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              padding: '14px',
              margin: '20px 0',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: '#F87171',
              overflowX: 'auto'
            }}>
              <strong>{this.state.error?.name || 'Error'}: </strong>
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            {this.state.error?.stack && (
              <details style={{ marginBottom: '24px', fontSize: '11px', color: '#64748B' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px', color: '#94A3B8' }}>
                  View technical stack trace
                </summary>
                <pre style={{
                  backgroundColor: '#0B1120',
                  padding: '12px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  margin: 0,
                  color: '#CBD5E1',
                  maxHeight: '160px'
                }}>
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reload Interface
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                style={{
                  backgroundColor: '#334155',
                  color: '#F8FAFC',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear UI Cache &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);
