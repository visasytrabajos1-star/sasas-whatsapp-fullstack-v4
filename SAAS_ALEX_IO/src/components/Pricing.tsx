import React from 'react';
import { Check, Zap, Shield, Crown } from 'lucide-react';

const plans = [
    {
        name: 'Free',
        price: '$0',
        description: 'Perfecto para empezar.',
        features: ['1 Bot ALEX IO', '100 msgs/mes', 'Soporte Básico', 'Voz Estándar'],
        icon: <Zap className="text-blue-400" />,
        buttonText: 'Empezar Gratis',
        highlight: false
    },
    {
        name: 'Pro',
        price: '$29.99',
        description: 'Para negocios en crecimiento.',
        features: ['5 Bots ALEX IO', '5.000 msgs/mes', 'Soporte Prioritario', 'Voz Clonada Premium', 'Analítica Avanzada'],
        icon: <Crown className="text-yellow-400" />,
        buttonText: 'Pasar a Pro',
        highlight: true
    },
    {
        name: 'Enterprise',
        price: '$99.99',
        description: 'Escalabilidad sin límites.',
        features: ['Bots Ilimitados', '50.000 msgs/mes', 'Soporte 24/7', 'White Label', 'API Dedicada'],
        icon: <Shield className="text-purple-400" />,
        buttonText: 'Contactar Ventas',
        highlight: false
    }
];

const Pricing: React.FC = () => {
    return (
        <div className="bg-slate-900 py-20 px-6">
            <div className="max-w-6xl mx-auto text-center mb-16">
                <h2 className="text-4xl font-bold text-white mb-4">Planes ALEX <span className="text-blue-500">IO</span></h2>
                <p className="text-slate-400">Escoge el cerebro que mejor se adapte a tu negocio.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {plans.map((plan) => (
                    <div
                        key={plan.name}
                        className={`relative p-8 rounded-3xl border ${plan.highlight
                                ? 'bg-slate-800 border-blue-500 shadow-2xl shadow-blue-500/10'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                    >
                        {plan.highlight && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                                Recomendado
                            </span>
                        )}

                        <div className="flex items-center gap-3 mb-6">
                            {plan.icon}
                            <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        </div>

                        <div className="mb-6">
                            <span className="text-4xl font-bold text-white">{plan.price}</span>
                            <span className="text-slate-500 ml-2">/mes</span>
                        </div>

                        <p className="text-slate-400 text-sm mb-8">{plan.description}</p>

                        <ul className="space-y-4 mb-10 text-sm">
                            {plan.features.map(feature => (
                                <li key={feature} className="flex items-center gap-3 text-slate-300">
                                    <Check size={16} className="text-blue-500" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button className={`w-full py-4 rounded-xl font-bold transition-all ${plan.highlight
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}>
                            {plan.buttonText}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Pricing;
