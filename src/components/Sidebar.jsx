import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ChartBarIcon,
  HomeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  CogIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Users', href: '/users', icon: UsersIcon },
  { name: 'Bets', href: '/bets', icon: CurrencyDollarIcon },
  { 
    name: 'Smart Contracts', 
    icon: CogIcon,
    children: [
      { name: 'Wave Challenge Flip', href: '/admin/wave-challenge-flip' },
      { name: 'Wave Prize Pool', href: '/admin/wave-prize-pool' },
      { name: 'Wave Vault', href: '/admin/wave-vault' },
    ]
  },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({});
    // 'Smart Contracts': true // Auto-expand Smart Contracts by default

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleExpanded = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const isActive = (href) => {
    return location.pathname === href;
  };

  const isParentActive = (children) => {
    return children?.some(child => location.pathname === child.href);
  };
  const handleNavigation = (href) => {
    navigate(href);
  };

  return (
    <div className="flex flex-col w-64 bg-gray-900 dark:bg-gray-800">
      <div className="flex items-center justify-center h-16 px-4 bg-gray-800 dark:bg-gray-700">
        <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={`flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isParentActive(item.children)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedItems[item.name] ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedItems[item.name] && (
                  <div className="ml-8 mt-2 space-y-1">
                    {item.children.map((child) => (
                      <button
                        key={child.name}
                        onClick={() => handleNavigation(child.href)}
                        className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${
                          isActive(child.href)
                            ? 'bg-blue-700 text-white shadow-sm'
                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-300 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
        >
          <ArrowRightCircleIcon className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
}