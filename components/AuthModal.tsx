
import React, { useState } from 'react';
import { signInAdmin, initSupabase, signOutAdmin } from '../services/supabase';
import { DEFAULT_CONFIG } from '../constants';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';

export const AuthModal: React.FC<{ onLoginSuccess: () => void, onCancel: () => void }> = ({ onLoginSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Use default config strictly
  const sbUrl = DEFAULT_CONFIG.SUPABASE_URL;
  const sbKey = DEFAULT_CONFIG.SUPABASE_KEY;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Ensure Supabase is initialized with current config before attempting login
    if (sbUrl && sbKey) initSupabase(sbUrl, sbKey);
    
    try {
       // 1. Sign In via Supabase
       await signInAdmin(email.trim(), pass);
       
       onLoginSuccess();
    } catch (err: any) {
        setError(err.message || "Invalid credentials. Please check your email and password.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
      <div className="w-full max-w-sm relative">
        
        {/* Abstract Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl opacity-75 blur-2xl"></div>

        <div className="relative bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden transition-colors">
            
            <button type="button" onClick={onCancel} className="absolute top-4 right-4 text-content-secondary hover:text-content-primary transition-colors z-10">✕</button>
            
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-light text-content-primary tracking-widest uppercase">Admin Portal</h2>
                <p className="text-[10px] text-content-secondary mt-2 font-mono uppercase tracking-wider">
                    Secure Access // Authorized Personnel Only
                </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1">
                    <div className="relative group">
                        <Mail className="absolute left-3 top-3.5 w-4 h-4 text-content-secondary group-focus-within:text-content-primary transition-colors" />
                        <input 
                            type="email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="Email Address"
                            className="w-full bg-surface-100 dark:bg-black/40 border border-surface-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-content-primary focus:border-content-secondary/30 focus:bg-white dark:focus:bg-black/60 focus:ring-1 focus:ring-content-secondary/20 outline-none transition-all placeholder:text-content-secondary/50 text-xs font-mono"
                        />
                    </div>
                </div>
                
                <div className="space-y-1">
                    <div className="relative group">
                        <Lock className="absolute left-3 top-3.5 w-4 h-4 text-content-secondary group-focus-within:text-content-primary transition-colors" />
                        <input 
                            type="password" 
                            value={pass}
                            onChange={e => setPass(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-surface-100 dark:bg-black/40 border border-surface-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-content-primary focus:border-content-secondary/30 focus:bg-white dark:focus:bg-black/60 focus:ring-1 focus:ring-content-secondary/20 outline-none transition-all placeholder:text-content-secondary/50 text-xs font-mono"
                        />
                    </div>
                </div>
                
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 animate-fade-in">
                        <p className="text-red-600 dark:text-red-400 text-[10px] text-center uppercase tracking-wide font-bold">{error}</p>
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={loading || !email.trim() || !pass} 
                    className="w-full py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-lg flex justify-center items-center group relative overflow-hidden text-content-inverted bg-content-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="relative z-10">{loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Authenticate'}</span>
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
