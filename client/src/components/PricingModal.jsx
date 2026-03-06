import { X, Check, Crown, Star, Zap, CreditCard, Bitcoin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { fetchWithApiFallback } from '../api';

const PricingModal = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('');

    if (!isOpen) return null;

    const handlePayment = async (planId, method) => {
        if (!email) {
            alert("Por favor ingresa tu email para continuar.");
            return;
        }

        setLoading(true);
        setStatus(`Conectando con ${method}...`);

        try {
            const endpoint = method === 'stripe'
                ? '/api/payments/stripe/checkout'
                : '/api/payments/crypto/invoice';

            const { response, data } = await fetchWithApiFallback(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    plan: planId,
                    currency: 'USDT' // Default for crypto
                })
            });

            if (method === 'stripe' && data.url) {
                window.location.href = data.url;
            } else if (method === 'crypto') {
                // For crypto, we might want to show an invoice UI or alert the user
                alert(`Factura Crypto Generada ID: ${data.id}. Por favor sigue las instrucciones enviadas a ${email}`);
            } else {
                throw new Error("Respuesta de pago inválida.");
            }
        } catch (e) {
            console.error("Payment error:", e);
            alert(`Error al procesar pago: ${e.message}`);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8 text-center border-b border-slate-800 bg-gradient-to-b from-indigo-900/20 to-slate-900">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
                            <Crown className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Desbloquea tu Potencial</h2>

                        <div className="max-w-xs mx-auto mt-4">
                            <input
                                type="email"
                                placeholder="Tu email para la facturación"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-0">
                        {/* Free Plan */}
                        <div className="p-6 md:p-8 md:border-r border-slate-800">
                            <h3 className="text-xl font-bold text-white mb-2">Plan Gratuito</h3>
                            <p className="text-3xl font-bold text-white mb-6">$0 <span className="text-sm font-normal text-slate-500">/mes</span></p>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>3 Bots Básicos</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>1,000 Mensajes / mes</span>
                                </li>
                                <li className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>Soporte por Email</span>
                                </li>
                            </ul>

                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors"
                            >
                                Continuar Gratis
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className="p-6 md:p-8 bg-slate-800/30 relative overflow-hidden">
                            {/* Popular Badge */}
                            <div className="absolute top-0 right-0 bg-gradient-to-bl from-indigo-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                                RECOMENDADO
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                Plan Pro
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            </h3>
                            <p className="text-3xl font-bold text-white mb-6">$9.99 <span className="text-sm font-normal text-slate-500">/mes</span></p>

                            <ul className="space-y-4 mb-8">
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Sesiones Ilimitadas (V8)</span>
                                </li>
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Voz TTS Ultra-Realista</span>
                                </li>
                                <li className="flex items-center gap-3 text-white">
                                    <div className="p-1 bg-indigo-500/20 rounded-full">
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <span>Multi-Provider (Meta/360)</span>
                                </li>
                            </ul>

                            <div className="space-y-3">
                                <button
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
                                    onClick={() => handlePayment('PRO', 'stripe')}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                                    Pagar con Tarjeta
                                </button>

                                <button
                                    disabled={loading}
                                    className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    onClick={() => handlePayment('PRO', 'crypto')}
                                >
                                    <Bitcoin size={20} className="text-orange-500" />
                                    Pagar con Crypto
                                </button>
                            </div>

                            {status && <p className="text-[10px] text-center text-indigo-400 mt-2 animate-pulse">{status}</p>}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PricingModal;
