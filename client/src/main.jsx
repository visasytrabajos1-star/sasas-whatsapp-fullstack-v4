import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n' // Importa la configuración de traducciones

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Global Error Boundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#580000', color: '#ffaaaa', padding: '20px', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>💥 ALEX IO FATAL REACT ERROR</h2>
          <p><strong>{this.state.error && this.state.error.toString()}</strong></p>
          <pre style={{ backgroundColor: '#2b0000', padding: '10px', overflowX: 'auto' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log("🚀 [ALEX IO] System Boot: main.jsx initiated");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("❌ [ALEX IO] FATAL: Root element not found in DOM");
    alert("Error de sistema: No se encontró el elemento raíz.");
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
      </StrictMode>
    );
    console.log("✅ [ALEX IO] Virtual DOM Mount requested");
  }
} catch (bootError) {
  console.error("❌ [ALEX IO] FATAL BOOT ERROR:", bootError);
  document.body.innerHTML = `<div style="color:white; background:black; padding:20px;"><h1>ERROR DE ARRANQUE</h1><p>${bootError.message}</p></div>`;
}
