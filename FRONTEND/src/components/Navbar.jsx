import React, { useState, useEffect } from 'react'
import { LogIn, UserPlus, Home, BarChart3, Info, Phone, LogOut, User, Target } from 'lucide-react'
import AuthModal from './AuthModal'
import AboutUsModal from './AboutUsModal'
import ContactModal from './ContactModal'
import EditProfileModal from './EditProfileModal'
import Clock from './Clock'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

const Navbar = ({ onViewChange, currentView }) => {
  const { theme } = useTheme()
  const { currentUser, logout } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  // Close modal when user becomes authenticated
  useEffect(() => {
    if (currentUser && showAuthModal) {
      console.log('User authenticated, closing modal:', currentUser.email)
      setShowAuthModal(false)
    }
  }, [currentUser, showAuthModal])

  // Also close modal when user changes (additional safety)
  useEffect(() => {
    if (currentUser) {
      setShowAuthModal(false)
    }
  }, [currentUser])

  // Listen for custom event to open auth modal from other components
  useEffect(() => {
    const handleOpenAuthModal = (event) => {
      const mode = event.detail?.mode || 'login'
      setAuthMode(mode)
      setShowAuthModal(true)
    }

    window.addEventListener('openAuthModal', handleOpenAuthModal)
    
    return () => {
      window.removeEventListener('openAuthModal', handleOpenAuthModal)
    }
  }, [])

  const handleAuthClick = (mode) => {
    setAuthMode(mode)
    setShowAuthModal(true)
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const getUserInitials = (displayName) => {
    if (!displayName) return 'U'
    const names = displayName.split(' ')
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0][0].toUpperCase()
  }

  return (
    <nav 
      className="fixed top-1 left-1 right-1 z-50 h-14 rounded-lg transition-all duration-300"
      style={{ 
        backgroundColor: '#ffffff',
        border: '1px solid #808080'
      }}
    >
      <div className="flex items-center h-full relative">
        {/* Left side - App name */}
        <div className="flex items-center space-x-1 px-1 sm:px-2 md:px-3">
          <img 
            src="/mg.png" 
            alt="MG Logo" 
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            style={{ filter: 'brightness(0) saturate(100%) invert(88%) sepia(56%) saturate(839%) hue-rotate(20deg) brightness(104%) contrast(102%)' }}
          />
          <span
            className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight truncate uppercase"
            style={{ color: '#BAFF39' }}
          >
            GYAN SETU
          </span>
        </div>

        {/* Center - Navigation perfectly centered using absolute positioning */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          {/* Navigation buttons - centered */}
          <div className="flex items-center space-x-0.5 sm:space-x-1 bg-white/90 px-1 sm:px-2 md:px-3 lg:px-6 py-2 rounded-lg shadow-sm h-10">
            <button 
              onClick={() => onViewChange('chat')}
              className={`flex items-center px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 transition-colors text-[10px] sm:text-xs font-bold ${
                currentView === 'chat' 
                  ? 'rounded-[10px]' 
                  : 'rounded-md hover:bg-gray-100'
              }`}
              style={currentView === 'chat' ? { backgroundColor: '#BAFF39', color: '#000000' } : { color: '#000000' }}
            >
              <Home className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button 
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 transition-colors text-[10px] sm:text-xs font-bold ${
                currentView === 'dashboard' 
                  ? 'rounded-[10px]' 
                  : 'rounded-md hover:bg-gray-100'
              }`}
              style={currentView === 'dashboard' ? { backgroundColor: '#BAFF39', color: '#000000' } : { color: '#000000' }}
            >
              <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button 
              onClick={() => onViewChange('pyq-practice')}
              className={`flex items-center px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 transition-colors text-[10px] sm:text-xs font-bold ${
                currentView === 'pyq-practice' 
                  ? 'rounded-[10px]' 
                  : 'rounded-md hover:bg-gray-100'
              }`}
              style={currentView === 'pyq-practice' ? { backgroundColor: '#BAFF39', color: '#000000' } : { color: '#000000' }}
            >
              <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">PYQ Practice</span>
            </button>
            <button 
              onClick={() => setShowAboutModal(true)}
              className="flex items-center px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-md hover:bg-gray-100 transition-colors text-[10px] sm:text-xs font-bold"
              style={{ color: '#000000' }}
            >
              <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">About Us</span>
            </button>
            <button 
              onClick={() => setShowContactModal(true)}
              className="flex items-center px-1 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-md hover:bg-gray-100 transition-colors text-[10px] sm:text-xs font-bold"
              style={{ color: '#000000' }}
            >
              <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Contact</span>
            </button>
          </div>
        </div>

        {/* Right side - flex-1 to push everything to the right */}
        <div className="flex-1"></div>

        {/* Clock positioned between navigation and right components - Hidden on mobile */}
        <div className="hidden md:flex items-center mr-1">
          <Clock />
        </div>

        {/* Right side - User actions */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 justify-end mr-2">
          {/* Mobile Clock - Shown on mobile devices */}
          <div className="md:hidden">
            <Clock isMobile={true} />
          </div>
          
          {/* Authentication Section */}
          {currentUser ? (
            <>
              <div
                className="hidden sm:flex items-center space-x-1 ml-0.5 cursor-pointer"
                role="button"
                onClick={() => setShowEditProfile(true)}
                title="Edit profile"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#BAFF39' }}
                >
                  <span className="font-semibold text-xs" style={{ color: '#000000' }}>
                    {getUserInitials(currentUser.displayName)}
                  </span>
                </div>
                <span
                  className="font-medium text-xs hidden md:inline"
                  style={{ color: '#BAFF39' }}
                >
                  {currentUser.displayName || currentUser.email}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors text-xs"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden xs:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => handleAuthClick('login')}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors text-xs"
              >
                <LogIn className="w-3 h-3" />
                <span className="hidden xs:inline">Log In</span>
              </button>
              <button 
                onClick={() => handleAuthClick('signup')}
                className="flex items-center space-x-1 px-2 py-1 rounded-full hover:opacity-90 transition-colors text-xs"
                style={{ backgroundColor: '#BAFF39', color: '#000000' }}
              >
                <UserPlus className="w-3 h-3" />
                <span className="hidden xs:inline">Sign up</span>
              </button>
            </>
          )}
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        initialMode={authMode}
      />
      
      <AboutUsModal 
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
      
      <ContactModal 
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />
    </nav>
  )
}

export default Navbar
