import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../auth/AuthContext';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Plan {
    name: string;
    max_bots: number;
    max_messages_monthly: number;
}

interface Usage {
    messages_sent: number;
    bot_count: number;
}

export const useSubscription = () => {
    const { user } = useAuth();
    const [plan, setPlan] = useState<Plan | null>(null);
    const [usage, setUsage] = useState<Usage>({ messages_sent: 0, bot_count: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // 1. Get Profile and Plan Info
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*, plans(*)')
                    .eq('id', user.id)
                    .single();

                if (profile?.plans) {
                    setPlan(profile.plans);
                }

                // 2. Get Current Usage (Messages this month)
                const currentMonth = new Date().toISOString().substring(0, 7);
                const { data: usageData } = await supabase
                    .from('usage_metrics')
                    .select('messages_sent')
                    .eq('user_id', user.id)
                    .eq('month_year', currentMonth)
                    .single();

                // 3. Get Bot Count
                const { count: botCount } = await supabase
                    .from('bot_configs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                setUsage({
                    messages_sent: usageData?.messages_sent || 0,
                    bot_count: botCount || 0
                });

            } catch (err) {
                console.error("Error fetching subscription data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const checkLimit = (type: 'bots' | 'messages') => {
        if (!plan) return false;

        if (type === 'bots') {
            return usage.bot_count < plan.max_bots;
        }

        if (type === 'messages') {
            return usage.messages_sent < plan.max_messages_monthly;
        }

        return true;
    };

    const getUsagePercent = (type: 'bots' | 'messages') => {
        if (!plan) return 0;
        const max = type === 'bots' ? plan.max_bots : plan.max_messages_monthly;
        const current = type === 'bots' ? usage.bot_count : usage.messages_sent;
        return Math.min(100, (current / max) * 100);
    };

    return { plan, usage, loading, checkLimit, getUsagePercent };
};
