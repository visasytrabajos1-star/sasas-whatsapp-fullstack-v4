import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './Dashboard';
import Pricing from './Pricing';
import Login from './Login';

function App() {
  const token = localStorage.getItem('alex_io_token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={token ? <Dashboard /> : <Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/success" element={<Success />} />
      </Routes>
    </Router>
  );
}

function Success() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2">Pago Exitoso!</h1>
        <p className="text-slate-400 mb-8">Tu cuenta ALEX IO ha sido activada.</p>
        <Link to="/" className="bg-blue-600 px-6 py-3 rounded font-bold hover:bg-blue-500">
          Ir al Dashboard
        </Link>
      </div>
    </div>
  );
}

export default App;
