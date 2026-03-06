import React, { useState } from 'react';
import { Check, CreditCard, Bitcoin, Loader } from 'lucide-react';
import { fetchWithApiFallback } from './api';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 29,
    features: [
      '1 Número de WhatsApp',
      '1,000 Mensajes al mes',
      'IA Básica (Gemini)',
      'Soporte por Email',
      'Panel de Control'
    ]
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 79,
    popular: true,
    features: [
      '3 Números de WhatsApp',
      '10,000 Mensajes al mes',
      'IA Avanzada + Fallback',
      'Soporte Prioritario',
      'Panel de Control',
      'API Access'
    ]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    features: [
      'Números Ilimitados',
      'Mensajes Ilimitados',
      'IA Premium + Memoria',
      'Soporte 24/7',
      'API Access',
      'Multi-idioma',
      'Account Manager'
    ]
  }
];

function Pricing() {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [cryptoCurrency, setCryptoCurrency] = useState('USDT');
  const [invoice, setInvoice] = useState(null);
  const [email, setEmail] = useState('');

  const handleStripePayment = async (planId) => {
    setLoading(true);
    try {
      const res = await fetchWithApiFallback('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleCryptoPayment = async (planId) => {
    setLoading(true);
    try {
      const res = await fetchWithApiFallback('/api/payments/crypto/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planId, currency: cryptoCurrency })
      });
      const data = await res.json();
      setInvoice(data);
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Elige tu Plan <span className="text-blue-500">ALEX IO</span></h1>
          <p className="text-slate-400">Escala tu negocio con WhatsApp + IA</p>
        </div>

        {/* Email Input */}
        <div className="max-w-md mx-auto mb-8">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu correo electrónico"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-center text-xl font-bold focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-slate-800 rounded-2xl p-8 border-2 transition-all duration-300 relative ${plan.popular ? 'border-blue-500 scale-105 shadow-2xl shadow-blue-500/20' : 'border-slate-700 hover:border-slate-500'}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 px-3 py-1 rounded-full text-xs font-black uppercase">
                  Más Popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black">${plan.price}</span>
                <span className="text-slate-400">/mes</span>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <Check className="text-blue-500 shrink-0" size={18} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedPlan(plan)}
                className={`w-full py-4 rounded-xl font-black transition-all ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                Elegir {plan.name}
              </button>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-3xl p-8 max-w-md w-full border border-slate-700 shadow-2xl">
              <h2 className="text-2xl font-bold mb-2 text-center">Finalizar Pago</h2>
              <p className="text-slate-400 text-center mb-8">Plan {selectedPlan.name} - ${selectedPlan.price}/mes</p>

              <div className="space-y-4">
                <button
                  onClick={() => handleStripePayment(selectedPlan.id)}
                  disabled={loading || !email}
                  className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-2xl flex items-center justify-between font-bold disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={24} /> Tarjeta de Crédito (Stripe)
                  </div>
                  {loading && <Loader className="animate-spin" size={20} />}
                </button>

                <button
                  onClick={() => setPaymentMethod('crypto')}
                  disabled={loading || !email}
                  className="w-full bg-slate-700 hover:bg-slate-600 p-4 rounded-2xl flex items-center justify-between font-bold disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Bitcoin size={24} /> Criptomonedas (USDT/BTC)
                  </div>
                </button>

                {paymentMethod === 'crypto' && (
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selecciona Moneda</label>
                    <div className="flex gap-2">
                      {['USDT', 'BTC', 'ETH'].map(cur => (
                        <button
                          key={cur}
                          onClick={() => setCryptoCurrency(cur)}
                          className={`flex-1 p-2 rounded-lg text-sm font-bold border transition-all ${cryptoCurrency === cur ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCryptoPayment(selectedPlan.id)}
                      className="w-full bg-orange-600 hover:bg-orange-500 mt-4 p-3 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      Generar Factura {cryptoCurrency}
                    </button>
                  </div>
                )}
              </div>

              {invoice && (
                <div className="mt-8 p-4 bg-green-900/20 border border-green-700 rounded-2xl text-center">
                  <h4 className="font-bold text-green-400 mb-2">Factura Generada</h4>
                  <p className="text-sm text-green-200 mb-4">Envía {invoice.amount} {invoice.currency} a:</p>
                  <code className="block bg-black p-3 rounded-lg text-xs break-all mb-4">{invoice.address}</code>
                  <div className="bg-white p-2 inline-block rounded-lg mb-4">
                    <img src={invoice.qr} alt="Crypto QR" className="w-32 h-32" />
                  </div>
                  <p className="text-[10px] text-slate-500 italic">El acceso se activará tras 2 confirmaciones en la red</p>
                </div>
              )}

              <button
                onClick={() => setSelectedPlan(null)}
                className="w-full mt-6 text-slate-500 text-sm hover:text-white transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pricing;
