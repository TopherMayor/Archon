import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { credentialsService } from '../services/credentialsService';

interface SettingsContextType {
  projectsEnabled: boolean;
  setProjectsEnabled: (enabled: boolean) => void;
  showScrollbars: boolean;
  setShowScrollbars: (enabled: boolean) => void;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [projectsEnabled, setProjectsEnabledState] = useState(true);
  const [showScrollbars, setShowScrollbarsState] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load Projects setting
      const projectsResponse = await credentialsService.getCredential('PROJECTS_ENABLED').catch(() => ({ value: undefined }));
      
      // Load Show Scrollbars setting
      const scrollbarsResponse = await credentialsService.getCredential('SHOW_SCROLLBARS').catch(() => ({ value: undefined }));
      
      if (projectsResponse.value !== undefined) {
        setProjectsEnabledState(projectsResponse.value === 'true');
      } else {
        setProjectsEnabledState(true); // Default to true
      }
      
      if (scrollbarsResponse.value !== undefined) {
        setShowScrollbarsState(scrollbarsResponse.value === 'true');
      } else {
        setShowScrollbarsState(true); // Default to true
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      setProjectsEnabledState(true);
      setShowScrollbarsState(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const setProjectsEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setProjectsEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: 'PROJECTS_ENABLED',
        value: enabled.toString(),
        is_encrypted: false,
        category: 'features',
        description: 'Enable or disable Projects and Tasks functionality'
      });
    } catch (error) {
      console.error('Failed to update projects setting:', error);
      // Revert on error
      setProjectsEnabledState(!enabled);
      throw error;
    }
  };

  const setShowScrollbars = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setShowScrollbarsState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: 'SHOW_SCROLLBARS',
        value: enabled.toString(),
        is_encrypted: false,
        category: 'ui',
        description: 'Show or hide scrollbars in the UI'
      });
    } catch (error) {
      console.error('Failed to update scrollbars setting:', error);
      // Revert on error
      setShowScrollbarsState(!enabled);
      throw error;
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  const value: SettingsContextType = {
    projectsEnabled,
    setProjectsEnabled,
    showScrollbars,
    setShowScrollbars,
    loading,
    refreshSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 