import React from 'react';
import { useAuth, useProduct } from '../auth/AuthProvider';
import { 
    Bot, Languages, ChevronDown, Check, 
    LayoutDashboard, Settings, CreditCard 
} from 'lucide-react';

export const ProductSwitcher: React.FC = () => {
    const { user, subscriptions, setCurrentProduct, getSubscription, signOut } = useAuth();
    const { name, slug, primaryColor, isMultiProduct } = useProduct();
    const [isOpen, setIsOpen] = React.useState(false);

    const products = [
        { 
            slug: 'alex-io' as const, 
            name: 'ALEX IO', 
            icon: Bot, 
            color: '#3B82F6',
            description: 'WhatsApp AI Assistant'
        },
        { 
            slug: 'academia-idiomas' as const, 
            name: 'Academia de Idiomas', 
            icon: Languages, 
            color: '#10B981',
            description: 'Language Learning Platform'
        }
    ];

    const currentProductData = products.find(p => p.slug === slug);

    if (!user) return null;

    return (
        <div className="relative">
            {/* Product Selector */}
            {isMultiProduct && (
                <div className="mb-4">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            {currentProductData && (
                                <div 
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${currentProductData.color}20` }}
                                >
                                    <currentProductData.icon size={18} style={{ color: currentProductData.color }} />
                                </div>
                            )}
                            <div className="text-left">
                                <div className="font-medium text-white text-sm">{name}</div>
                                <div className="text-xs text-slate-400">{currentProductData?.description}</div>
                            </div>
                        </div>
                        <ChevronDown size={16} className="text-slate-400" />
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden z-50 shadow-xl">
                            {products.map((product) => {
                                const hasSubscription = getSubscription(product.slug);
                                const Icon = product.icon;
                                
                                return (
                                    <button
                                        key={product.slug}
                                        onClick={() => {
                                            setCurrentProduct(product.slug);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 hover:bg-slate-700 transition-colors ${
                                            slug === product.slug ? 'bg-slate-700/50' : ''
                                        }`}
                                    >
                                        <div 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${product.color}20` }}
                                        >
                                            <Icon size={18} style={{ color: product.color }} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="font-medium text-white text-sm">{product.name}</div>
                                            <div className="text-xs text-slate-400">
                                                {hasSubscription ? (
                                                    <span className="text-green-400">Activo - {hasSubscription.plan.name}</span>
                                                ) : (
                                                    <span>Sin suscripción</span>
                                                )}
                                            </div>
                                        </div>
                                        {slug === product.slug && (
                                            <Check size={16} className="text-blue-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* User Menu */}
            <div className="bg-slate-900/50 border-t border-slate-800 pt-4 mt-4">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold">
                        {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{user.email}</div>
                        <div className="text-xs text-slate-400">
                            {getSubscription(slug)?.plan.name || 'Sin plan'}
                        </div>
                    </div>
                </div>

                <nav className="space-y-1">
                    <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                        <LayoutDashboard size={16} />
                        Dashboard
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                        <CreditCard size={16} />
                        Suscripción
                    </a>
                    <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                        <Settings size={16} />
                        Configuración
                    </a>
                    <button 
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cerrar sesión
                    </button>
                </nav>
            </div>
        </div>
    );
};
