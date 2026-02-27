import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        // Safety timeout
        const timer = setTimeout(() => setLoading(false), 3000);

        try {
            supabase.auth.getSession()
                .then(({ data }) => {
                    clearTimeout(timer);
                    setUser(data?.session?.user ?? null);
                    setLoading(false);
                })
                .catch(() => {
                    clearTimeout(timer);
                    setLoading(false);
                });
        } catch {
            clearTimeout(timer);
            setLoading(false);
        }

        let subscription;
        try {
            const result = supabase.auth.onAuthStateChange((_event, session) => {
                setUser(session?.user ?? null);
                setLoading(false);
            });
            subscription = result?.data?.subscription;
        } catch { }

        return () => {
            try { subscription?.unsubscribe(); } catch { }
        };
    }, []);

    const signOut = async () => {
        try {
            if (supabase) await supabase.auth.signOut();
            localStorage.removeItem('alex_io_token');
            sessionStorage.removeItem('alex_io_token');
            localStorage.removeItem('demo_email');
            localStorage.removeItem('demo_mode');
        } catch { }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        // Return a safe fallback instead of throwing
        return { user: null, loading: false, signOut: async () => { } };
    }
    return context;
};
