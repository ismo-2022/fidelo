import React, { useState } from 'react';
import { auth, googleProvider, appleProvider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Chrome, Apple, ArrowRight, QrCode, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoginProps {
  onSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'selection' | 'email_login' | 'email_register'>('selection');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, appleProvider);
      onSuccess(result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'email_login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onSuccess(result.user);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        onSuccess(result.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="mb-10">
        <div className="w-20 h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-100">
          <QrCode size={40} />
        </div>
        <h1 className="text-4xl font-black tracking-tighter">FIDELO</h1>
        <p className="text-zinc-500 mt-2">Votre fidélité récompensée, partout.</p>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'selection' ? (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm space-y-3"
          >
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-white border border-zinc-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Chrome size={20} className="text-blue-500" />
              Continuer avec Google
            </button>
            <button 
              onClick={handleAppleLogin}
              disabled={loading}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-800 transition-all shadow-lg"
            >
              <Apple size={20} />
              Continuer avec Apple
            </button>
            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ou</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <button 
              onClick={() => setMode('email_login')}
              className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all"
            >
              <Mail size={20} />
              Utiliser mon Email
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="email"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {mode === 'email_login' ? 'Connexion Email' : 'Créer un compte'}
              </h2>
              <button onClick={() => setMode('selection')} className="p-2 text-zinc-400 hover:text-zinc-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500 font-medium px-1">{error}</p>}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? 'Chargement...' : mode === 'email_login' ? 'Se connecter' : 'S\'inscrire'}
                {!loading && <ArrowRight size={18} />}
              </button>

              <button 
                type="button"
                onClick={() => setMode(mode === 'email_login' ? 'email_register' : 'email_login')}
                className="w-full py-2 text-sm text-zinc-500 font-medium hover:text-emerald-600 transition-colors"
              >
                {mode === 'email_login' ? 'Pas encore de compte ? S\'inscrire' : 'Déjà un compte ? Se connecter'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
