import React from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { VaultHome } from './components/VaultHome';
import { CredentialDetail } from './components/CredentialDetail';
import { CategoryView } from './components/CategoryView';
import { AddEditModal } from './components/AddEditModal';
import { ShareAccessModal } from './components/ShareAccessModal';
import { CategoryModal } from './components/CategoryModal';
import { LockScreen } from './components/LockScreen';
import { ToastContainer } from './components/ToastContainer';

const MainLayout: React.FC = () => {
  const { isLocked, activeTab, selectedItemId } = useVault();

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Mobile Nav Header */}
        <MobileNav />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {selectedItemId ? (
            <CredentialDetail />
          ) : activeTab === 'categories' ? (
            <CategoryView />
          ) : (
            <VaultHome />
          )}
        </main>
      </div>

      {/* Modals & Overlays */}
      <AddEditModal />
      <ShareAccessModal />
      <CategoryModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <VaultProvider>
      <MainLayout />
    </VaultProvider>
  );
}
