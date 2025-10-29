import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAutoKick } from './hooks/useAutoKick';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Bets from './pages/Bets';
import WaveChallengeFlip from './pages/admin/WaveChallengeFlip';
import WavePrizePool from './pages/admin/WavePrizePool';
import WaveVault from './pages/admin/WaveVault';
import Login from './pages/Login';
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { config } from "./config.jsx";
import { WagmiProvider, createConfig, http } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryParamProvider } from 'use-query-params';

const metadata = {
  name: 'Wave Wealth',
  description: 'Play, Invest,Exchange and Join the Contest with high rewards at Wave Wealth!',
  url: 'https://wavewealth.io',
};
const projectId = import.meta.env.VITE_PROJECT_ID || "166c810a1a76fedfcbfb4a4c442c40ed"
createWeb3Modal({
  themeVariables: {
    '--w3m-accent': '#581c87',
    '--w3m-color-mix': '#004200',
    "--w3m-color-mix-strength": 40,
    '--w3m-border-radius-master': '12px'
  },
  projectId,
  metadata,
  wagmiConfig: config
})

function AppContent() {
  useAutoKick();
  
  // Initialize dark mode on app load
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedDarkMode === 'true' || (savedDarkMode === null && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <QueryParamProvider>
              <WagmiProvider config={config}>
                <RainbowKitProvider>
                  <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                    <Sidebar />
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/bets" element={<Bets />} />
                        <Route path="/admin/wave-challenge-flip" element={<WaveChallengeFlip />} />
                        
                        <Route path="/admin/wave-prize-pool" element={<WavePrizePool />} />
                        <Route path="/admin/wave-vault" element={<WaveVault />} />
                    </Routes>
                  </div>
                </RainbowKitProvider>
              </WagmiProvider>
            </QueryParamProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router basename='/admin'>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}