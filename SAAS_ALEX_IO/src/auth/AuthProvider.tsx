import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, User } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

export type ProductSlug = 'alex-io' | 'academia-idiomas';

interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    max_bots?: number;
    max_messages_monthly?: number;
    max_students?: number;
    max_courses?: number;
    features: string[];
}

interface ProductSubscription {
    product_id: string;
    product_slug: ProductSlug;
    plan: Plan;
    status: 'active' | 'cancelled' | 'past_due';
    subscription_end?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    subscriptions: ProductSubscription[];
    currentProduct: ProductSlug;
    setCurrentProduct: (slug: ProductSlug) => void;
    getSubscription: (productSlug: ProductSlug) => ProductSubscription | undefined;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
    const [currentProduct, setCurrentProduct] = useState<ProductSlug>('alex-io');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
                fetchSubscriptions(session.user.id);
            }
            setLoading(false);
        });

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
                fetchSubscriptions(session.user.id);
            } else {
                setSubscriptions([]);
                setIsAdmin(false);
            }
        });

        return () => authSubscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single();
        
        setIsAdmin(data?.is_admin || false);
    };

    const fetchSubscriptions = async (userId: string) => {
        const { data } = await supabase
            .from('user_products')
            .select(`
                product_id,
                status,
                subscription_end,
                product:products(slug),
                plan:plans(*)
            `)
            .eq('user_id', userId);

        if (!data) return;

        const subs = data.map((s: any) => ({
            product_id: s.product_id,
            product_slug: s.product?.slug,
            plan: s.plan,
            status: s.status,
            subscription_end: s.subscription_end
        })).filter((s: any) => s.product_slug);

        setSubscriptions(subs);
    };

    const getSubscription = (productSlug: ProductSlug) => {
        return subscriptions.find(s => s.product_slug === productSlug);
    };

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            subscriptions, 
            currentProduct, 
            setCurrentProduct,
            getSubscription,
            signIn, 
            signUp, 
            signOut,
            isAdmin 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const useProduct = () => {
    const { currentProduct, setCurrentProduct, getSubscription, subscriptions } = useAuth();
    
    const productConfig = {
        'alex-io': {
            name: 'ALEX IO',
            slug: 'alex-io' as ProductSlug,
            primaryColor: '#3B82F6',
            description: 'Asistente de IA para WhatsApp'
        },
        'academia-idiomas': {
            name: 'Academia de Idiomas',
            slug: 'academia-idiomas' as ProductSlug,
            primaryColor: '#10B981',
            description: 'Plataforma de aprendizaje de idiomas'
        }
    };

    const config = productConfig[currentProduct];
    const subscription = getSubscription(currentProduct);
    const hasAccess = subscription?.status === 'active';

    return {
        ...config,
        subscription,
        hasAccess,
        setCurrentProduct,
        subscriptions,
        isMultiProduct: subscriptions.length > 1
    };
};
