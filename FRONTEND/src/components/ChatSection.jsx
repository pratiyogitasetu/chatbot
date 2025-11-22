import React, { useState, useEffect, useRef } from 'react'
import { User, Bot, ChevronDown, ChevronUp, Send, Loader2, MessageCircle, FileText, Hash } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLayout } from '../contexts/LayoutContext'
import { useSearchHistory } from '../contexts/SearchHistoryContext'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../contexts/DashboardContext'
import { validateSearchQuery, sanitizeHtml } from '../utils/validation'
import apiService from '../services/api'
import SearchProgressIndicator from './SearchProgressIndicator'
import EmbeddedSearchBar from './EmbeddedSearchBar'

const ChatSection = () => {
  const { theme } = useTheme()
  const { sidebarVisible, pyqVisible } = useLayout()
  const { addToSearchHistory, addGuestChat, updateGuestChat, getGuestChat } = useSearchHistory()
  const { currentUser, saveMessage, getChatMessages, createNewChat, updateChatTitle, updateChatMessageCount } = useAuth()
  const { trackInteraction } = useDashboard()
  const messagesEndRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [systemStatus, setSystemStatus] = useState({ initialized: false, healthy: false })
  const [currentChatId, setCurrentChatId] = useState(null)
  const [currentChatTitle, setCurrentChatTitle] = useState('New Chat')
  const [rateLimitMessage, setRateLimitMessage] = useState('')
  const [expandedSources, setExpandedSources] = useState({}) // Track expanded sources for each message

  // Debug: Add test message to verify display is working
  useEffect(() => {
    console.log('💬 ChatSection mounted, messages state:', messages)
  }, [messages])

  const toggleSources = (sourceKey) => {
    setExpandedSources(prev => {
      // If clicking the same source, close it
      if (prev[sourceKey]) {
        const newState = { ...prev }
        delete newState[sourceKey]
        return newState
      }
      
      // Otherwise, close all sources for this message and open only the clicked one
      const messageId = sourceKey.split('-')[0]
      const newState = {}
      
      // Keep sources from other messages intact
      Object.keys(prev).forEach(key => {
        if (!key.startsWith(messageId + '-')) {
          newState[key] = prev[key]
        }
      })
      
      // Open only the clicked source
      newState[sourceKey] = true
      return newState
    })
  }

  // Check system health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await apiService.healthCheck()
        setSystemStatus({
          initialized: health.system_initialized,
          healthy: health.status === 'healthy'
        })
      } catch (error) {
        console.error('Health check failed:', error)
        setSystemStatus({ initialized: false, healthy: false })
      }
    }
    
    checkHealth()
  }, [])

  // Listen for chat events from Sidebar
  useEffect(() => {
    const handleNewChat = (event) => {
      setMessages([])
      // Always use the chatId from the event (created in Sidebar)
      if (currentUser) {
        setCurrentChatId(event.detail.chatId)
        setCurrentChatTitle('New Chat')
        console.log('🔄 Set chat ID for authenticated user:', event.detail.chatId)
      } else {
        setCurrentChatId(event.detail.chatId)
        setCurrentChatTitle('New Chat')
        console.log('👤 Created new guest chat ID:', event.detail.chatId)
      }
    }

    const handleLoadChat = async (event) => {
      const { chatId, title } = event.detail
      console.log('🔄 Loading chat:', chatId, title)
      setCurrentChatId(chatId)
      setCurrentChatTitle(title)
      setMessages([]) // Clear messages first
      
      try {
        // Always load all messages for this chatId from Firebase
        const chatMessages = await getChatMessages(chatId)
        console.log('✅ Loaded chat history for chatId:', chatId, 'messages:', chatMessages.length)
        setMessages(chatMessages)
      } catch (error) {
        console.error('❌ Failed to load chat messages:', error)
        setMessages([])
      }
    }

    const handleLoadGuestChat = (event) => {
      const { chatId, title, messages } = event.detail
      setCurrentChatId(chatId)
      setCurrentChatTitle(title)
      setMessages(messages || [])
      console.log('✅ Loaded guest chat:', { chatId, title, messageCount: messages?.length || 0 })
    }

    const handleChatDeleted = (event) => {
      const { chatId } = event.detail
      // If the deleted chat was currently active, clear the current chat
      if (currentChatId === chatId) {
        setMessages([])
        setCurrentChatId(null)
        setCurrentChatTitle('New Chat')
        console.log('🗑️ Cleared active chat after deletion:', chatId)
      }
    }

    // Add event listeners
    window.addEventListener('newChat', handleNewChat)
    window.addEventListener('loadChat', handleLoadChat)
    window.addEventListener('loadGuestChat', handleLoadGuestChat)
    window.addEventListener('chatDeleted', handleChatDeleted)

    // Cleanup function to prevent memory leaks
    return () => {
      window.removeEventListener('newChat', handleNewChat)
      window.removeEventListener('loadChat', handleLoadChat)
      window.removeEventListener('loadGuestChat', handleLoadGuestChat)
      window.removeEventListener('chatDeleted', handleChatDeleted)
    }
  }, [currentUser, currentChatId, getChatMessages])

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts or intervals
      if (window.chatTimeoutId) {
        clearTimeout(window.chatTimeoutId)
      }
    }
  }, [])

  // Handle guest chat saving
  const handleGuestChatSave = (messages) => {
    if (currentUser) return // Don't save guest chats for authenticated users
    
    if (!currentChatId || !currentChatId.startsWith('guest-')) {
      // Create a new guest chat
      const firstMessage = messages.find(msg => msg.type === 'user')?.content || 'New Chat'
      const newChat = addGuestChat({
        title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage,
        firstMessage: firstMessage,
        messages: messages
      })
      setCurrentChatId(newChat.id)
      setCurrentChatTitle(newChat.title)
      console.log('✅ Created new guest chat:', newChat.id)
    } else {
      // Update existing guest chat
      const firstMessage = messages.find(msg => msg.type === 'user')?.content || 'New Chat'
      const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage
      
      updateGuestChat(currentChatId, {
        title: title,
        firstMessage: firstMessage,
        messages: messages
      })
      setCurrentChatTitle(title)
      console.log('✅ Updated guest chat:', currentChatId)
    }
  }

  // Handle sending messages - can be called from EmbeddedSearchBar
  const sendMessage = async (query, selectedSubject = 'all') => {
    if (!query.trim()) return
    if (isLoading) return
    setIsLoading(true)

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: query,
      timestamp: new Date()
    }

    // Always use the currentChatId (created in Sidebar)
    const activeChatId = currentChatId

    // Add user message to chat immediately
    setMessages(prev => {
      const newMessages = [...prev, userMessage]
      if (!currentUser && prev.length === 0) {
        setTimeout(() => handleGuestChatSave(newMessages), 100)
      }
      return newMessages
    })

    // Save user message to Firebase for authenticated users
    if (currentUser && activeChatId) {
      try {
        await saveMessage(activeChatId, userMessage)
        await updateChatMessageCount(activeChatId, 1)
        // If this is the first message, update the chat title to the message text
        if (messages.length === 0) {
          const chatTitle = query.length > 50 ? query.substring(0, 50) + '...' : query
          await updateChatTitle(activeChatId, chatTitle)
          setCurrentChatTitle(chatTitle)
          window.dispatchEvent(new CustomEvent('refreshChatList'))
        }
      } catch (error) {
        console.error('❌ Failed to save user message:', error)
      }
    }

    try {
      addToSearchHistory(query)
    } catch {}

    // Create initial bot message with loading state
    const tempBotMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: '',
      isLoading: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, tempBotMessage])

    try {
      const response = await apiService.search(query, {
        subject: selectedSubject,
        n_results: 5,        // Increased from 3 to 5 for better context
        namespace: selectedSubject,
        mcq_threshold: 0.25, // Slightly increased for better MCQ matching
        mcq_limit: 8         // Increased from 5 to 8 for more PYQs
      })
      
      // Track successful search interaction
      trackInteraction('search', {
        subject: selectedSubject,
        query: query,
        hasResults: response.rag_response ? true : false
      })
      
      // Track question asked
      trackInteraction('question', {
        subject: selectedSubject,
        query: query,
        hasResults: response.rag_response ? true : false
      })
      
      // Track chat interaction if this is the first message
      if (messages.length === 0) {
        trackInteraction('chat', {
          chatId: activeChatId,
          isNewChat: true,
          subject: selectedSubject
        })
      }
      
      // Update the bot message with actual response
      const botMessage = {
        id: tempBotMessage.id,
        type: 'bot',
        content: response.rag_response || 'I received your question but couldn\'t generate a proper response.',
        sources: response.sources,
        isLoading: false,
        timestamp: new Date()
      }
      
      setMessages(prev => {
        const newMessages = prev.map(msg => 
          msg.id === tempBotMessage.id ? botMessage : msg
        )
        if (currentUser && activeChatId) {
          setTimeout(async () => {
            try {
              await saveMessage(activeChatId, botMessage)
              await updateChatMessageCount(activeChatId, 1)
            } catch {}
          }, 100)
        } else {
          handleGuestChatSave(newMessages)
        }
        return newMessages
      })
      
      if (response.mcq_results && response.mcq_results.length > 0) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('newMcqResults', { 
            detail: { 
              mcqs: response.mcq_results,
              query: query 
            } 
          }))
        }, 100)
      }
    } catch (error) {
      // Update the temporary bot message with error
      const errorMessage = {
        id: tempBotMessage.id,
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        error: true,
        isLoading: false,
        timestamp: new Date()
      }
      setMessages(prev => prev.map(msg => 
        msg.id === tempBotMessage.id ? errorMessage : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  // Auto scroll to bottom when messages change, but only if there are messages
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Calculate dynamic margins based on visibility
  const leftMargin = sidebarVisible ? 'ml-52 sm:ml-60 md:ml-68' : 'ml-12'
  const rightMargin = pyqVisible ? 'mr-[450px]' : 'mr-12'

  return (
    <div className={`flex-1 ${leftMargin} ${rightMargin} flex flex-col h-full overflow-hidden pl-2 pr-2 pb-2`}>
        {/* Main Chat Container with Theme-aware Background */}
        <div 
          className="flex-1 rounded-lg shadow-sm flex flex-col overflow-hidden transition-colors duration-300"
          style={{ 
            backgroundColor: '#ffffff',
            border: '1px solid #808080'
          }}
        >
          {/* Chat Header with Title */}
          {currentChatTitle && currentChatTitle !== 'New Chat' && (
            <div 
              className="mx-3 mt-2 mb-1 p-1.5 rounded-md transition-colors duration-300" 
              style={{ 
                backgroundColor: 'rgba(186, 255, 57, 0.15)',
                border: '1px solid rgba(186, 255, 57, 0.4)'
              }}
            >
              <div className="flex items-center space-x-1">
                <MessageCircle 
                  className="w-2.5 h-2.5" 
                  style={{ color: '#000000' }} 
                />
                <h2 
                  className="text-xs font-medium truncate" 
                  style={{ color: '#000000' }}
                >
                  {currentChatTitle}
                </h2>
              </div>
            </div>
          )}

          {/* System Status Banner */}
          {!systemStatus.healthy && (
            <div 
              className="mb-1 mx-3 mt-2 p-1.5 rounded-md transition-colors duration-300" 
              style={{ 
                backgroundColor: 'rgba(255, 146, 28, 0.15)',
                border: '1px solid rgba(255, 146, 28, 0.5)'
              }}
            >
              <p 
                className="text-xs" 
                style={{ color: '#d97706' }}
              >
                🔧 System initializing... Please wait for the backend to be ready.
              </p>
            </div>
          )}

          {/* Rate Limit Message */}
          {rateLimitMessage && (
            <div className="mb-1 mx-3 mt-2 p-1.5 bg-yellow-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-md">
              <p className={`text-xs text-yellow-900`}>
                {rateLimitMessage}
              </p>
            </div>
          )}
          
          {/* Scrollable Messages Container */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 chat-messages-container relative" style={{ overscrollBehavior: 'none' }}>
            {/* Grid background for empty welcome state - spans full chat width */}
            {messages.length === 0 && (
              <div
                className="absolute inset-0 z-0 transition-opacity duration-300"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(186, 255, 57, 0.2) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(186, 255, 57, 0.2) 1px, transparent 1px)`,
                  backgroundSize: "20px 30px",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
                  maskImage:
                    "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
                }}
              />
            )}

            <div className="max-w-4xl mx-auto space-y-2 py-2 relative z-10">            
              {/* Welcome message when no messages exist */}
              {messages.length === 0 && (
                <div className="text-center py-4 mt-2">
                  <div className="max-w-3xl mx-auto">
                    {/* Logo and Welcome Header */}
                    <div className="mb-2">
                      <img 
                        src="/mg.png" 
                        alt="MG Logo" 
                        className="w-40 h-40 mx-auto object-contain mb-3 mg-logo-shake transition-all duration-300"
                        style={{ 
                          filter: 'brightness(0) saturate(100%) invert(88%) sepia(56%) saturate(839%) hue-rotate(20deg) brightness(104%) contrast(102%)'
                        }}
                      />
                      <h3 
                        className="text-lg font-semibold mb-2 transition-colors duration-300" 
                        style={{ color: '#000000' }}
                      >
                        Welcome to PRATIYOGITA GYAN
                      </h3>
                      <p 
                        className="mb-2 text-sm transition-colors duration-300" 
                        style={{ 
                          color: '#000000',
                          opacity: 0.7
                        }}
                      >
                        Ask any question about your subjects and get comprehensive answers along with related previous year questions.
                      </p>
                    </div>

                    {/* Features Section */}
                    <div className="mb-6">
                      <h3 
                        className="text-lg font-semibold text-center mb-4 transition-colors duration-300" 
                        style={{ color: '#000000' }}
                      >
                        Features
                      </h3>
                      
                      {/* Feature Icons - Auto-scrolling with blurred edges */}
                      <div className="relative w-full max-w-4xl mx-auto">
                        {/* Gradient overlays for blurred/faded edges */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none transition-all duration-300"
                          style={{ 
                            background: 'linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0.8), transparent)'
                          }}
                        ></div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none transition-all duration-300"
                          style={{ 
                            background: 'linear-gradient(to left, #ffffff, rgba(255, 255, 255, 0.8), transparent)'
                          }}
                        ></div>
                        
                        {/* Auto-scrolling container */}
                        <div 
                          className="features-scroll-container overflow-hidden"
                          style={{
                            maskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black 60px, black calc(100% - 60px), transparent)'
                          }}
                        >
                          <div className="features-scroll-content flex items-center gap-4 animate-scroll-features">
                            {/* Duplicate the feature items twice for seamless loop */}
                            {[1, 2].map((iteration) => (
                              <React.Fragment key={iteration}>
                                {/* Subject Selection */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[240px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-purple-100 to-purple-200 hover:from-purple-50 hover:to-purple-100 shadow-lg shadow-purple-200/20' 
                                    : 'bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-25 hover:to-purple-50 shadow-lg shadow-purple-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/subject.svg" 
                                      alt="Subject Selection" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-purple-700'}`}>Subject</h4>
                                      <div className="flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-300 text-red-800">History</span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-300 text-yellow-800">Polity</span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-300 text-green-800">Geography</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* NCERT Content */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[220px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 hover:from-emerald-50 hover:to-emerald-100 shadow-lg shadow-emerald-200/20' 
                                    : 'bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-25 hover:to-emerald-50 shadow-lg shadow-emerald-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/book.svg" 
                                      alt="NCERT Books" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-emerald-700'}`}>NCERT</h4>
                                      <div className="flex justify-start">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-300 text-green-800">Class 6 - 12</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Previous Year Questions */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[260px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-blue-100 to-blue-200 hover:from-blue-50 hover:to-blue-100 shadow-lg shadow-blue-200/20' 
                                    : 'bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-25 hover:to-blue-50 shadow-lg shadow-blue-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/pyq.svg" 
                                      alt="PYQ Questions" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-blue-700'}`}>PYQ</h4>
                                      <div className="flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-300 text-indigo-800">UPSC</span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-violet-300 text-violet-800">CDS</span>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-300 text-pink-800">SSC</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* AI Analysis */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[220px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-orange-100 to-orange-200 hover:from-orange-50 hover:to-orange-100 shadow-lg shadow-orange-200/20' 
                                    : 'bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-25 hover:to-orange-50 shadow-lg shadow-orange-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/AI.svg" 
                                      alt="AI Analysis" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-orange-700'}`}>AI</h4>
                                      <div className="flex justify-start">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-300 text-red-800">Accurate &amp; Precise</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Comprehensive Learning */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[220px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-teal-100 to-teal-200 hover:from-teal-50 hover:to-teal-100 shadow-lg shadow-teal-200/20' 
                                    : 'bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-25 hover:to-teal-50 shadow-lg shadow-teal-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/Comprehensive.svg" 
                                      alt="Comprehensive Learning" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-teal-700'}`}>Learning</h4>
                                      <div className="flex justify-start">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-300 text-cyan-800">Great Learning</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Response */}
                                <div className={`p-5 rounded-[15px] group cursor-pointer transition-all duration-300 flex-shrink-0 min-w-[220px] ${
                                  'dark' 
                                    ? 'bg-gradient-to-br from-rose-100 to-rose-200 hover:from-rose-50 hover:to-rose-100 shadow-lg shadow-rose-200/20' 
                                    : 'bg-gradient-to-br from-rose-50 to-rose-100 hover:from-rose-25 hover:to-rose-50 shadow-lg shadow-rose-200/30'
                                }`}>
                                  <div className="flex items-center gap-4">
                                    <img 
                                      src="/quick.svg" 
                                      alt="Quick Response" 
                                      className="w-12 h-12 flex-shrink-0 transition-all duration-300"
                                    />
                                    <div className="flex-1">
                                      <h4 className={`font-medium text-sm mb-2 transition-colors ${'text-rose-700'}`}>Quick</h4>
                                      <div className="flex justify-start">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-300 text-yellow-800">Instant response</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-2xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                      {message.type === 'user' ? (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#BAFF39', color: '#000000' }}
                        >
                          <User className="w-3 h-3" />
                        </div>
                      ) : (
                        <img 
                          src="/mg.png" 
                          alt="MG Bot" 
                          className="w-24 h-24 object-contain mg-logo-shake"
                        />
                      )}
                    </div>

                    {/* Message content */}
                    <div className="rounded-lg p-2 transition-colors duration-300"
                    style={message.type === 'user' 
                      ? { 
                          backgroundColor: '#BAFF39',
                          color: '#000000'
                        } 
                      : { 
                          backgroundColor: '#ffffff',
                          border: '1px solid #e0e0e0',
                          color: '#000000'
                        }
                    }
                    >
                      {/* Loading Indicator - Only for bot messages when loading */}
                      {message.type === 'bot' && message.isLoading ? (
                        <SearchProgressIndicator isVisible={true} />
                      ) : (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">
                          {message.content}
                        </p>
                      )}
                      
                      {/* Sources Section - Only for bot messages with sources */}
                      {message.type === 'bot' && message.sources && message.sources.length > 0 && (
                        <div 
                          className="mt-2 pt-2" 
                          style={{ 
                            borderTop: '1px solid #e0e0e0'
                          }}
                        >
                          {/* Sources Header with Individual Source Buttons */}
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            {/* Left: Main Label */}
                            <div className="flex items-center space-x-1">
                              <FileText className="w-2.5 h-2.5" style={{ color: '#000000', opacity: 0.6 }} />
                              <span className="text-xs font-medium" style={{ color: '#000000', opacity: 0.7 }}>
                                Sources ({message.sources.length}):
                              </span>
                            </div>
                            
                            {/* Right: Individual Source Buttons */}
                            <div className="flex items-center space-x-1 flex-wrap">
                              {message.sources.map((source, index) => (
                                <button
                                  key={index}
                                  onClick={() => toggleSources(`${message.id}-${index}`)}
                                  className="px-1.5 py-0.5 text-xs rounded-full border transition-colors"
                                  style={expandedSources[`${message.id}-${index}`]
                                    ? { backgroundColor: '#BAFF39', borderColor: '#BAFF39', color: '#000000' }
                                    : { backgroundColor: '#f5f5f5', borderColor: '#d0d0d0', color: '#000000' }
                                  }
                                  onMouseEnter={(e) => {
                                    if (!expandedSources[`${message.id}-${index}`]) {
                                      e.currentTarget.style.backgroundColor = '#e8e8e8'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!expandedSources[`${message.id}-${index}`]) {
                                      e.currentTarget.style.backgroundColor = '#f5f5f5'
                                    }
                                  }}
                                >
                                  <div className="flex items-center space-x-0.5">
                                    <Hash className="w-2.5 h-2.5" />
                                    <span>{index + 1}</span>
                                    {source.score && (
                                      <span className="ml-0.5 opacity-75">
                                        ({(source.score * 100).toFixed(0)}%)
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Individual Source Content - Only show the specific expanded source */}
                          {message.sources.map((source, index) => {
                            const sourceKey = `${message.id}-${index}`
                            return expandedSources[sourceKey] ? (
                              <div 
                                key={index}
                                className="mt-2 rounded-md p-2 animate-in slide-in-from-top-1 duration-200"
                                style={{ backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0' }}
                              >
                                {/* Source Header */}
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-1">
                                    <Hash className="w-2.5 h-2.5" style={{ color: '#000000', opacity: 0.6 }} />
                                    <span className="text-xs font-medium" style={{ color: '#000000' }}>
                                      Source {index + 1}
                                    </span>
                                    {source.score && (
                                      <span 
                                        className="text-xs px-1.5 py-0.5 rounded-full"
                                        style={{ backgroundColor: '#BAFF39', color: '#000000' }}
                                      >
                                        {(source.score * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => toggleSources(sourceKey)}
                                    className="transition-colors"
                                    style={{ color: '#000000', opacity: 0.6 }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                  >
                                    <ChevronUp className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                
                                {/* Source Details */}
                                <div className="space-y-2">
                                  {/* Compact Metadata Badges */}
                                  <div className="flex flex-wrap gap-1">
                                    {source.subject && (
                                      <span 
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                        style={{ backgroundColor: '#BAFF39', color: '#000000' }}
                                      >
                                        {source.subject}
                                      </span>
                                    )}
                                    {source.class && (
                                      <span 
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                        style={{ backgroundColor: '#e0e0e0', color: '#000000' }}
                                      >
                                        {source.class}
                                      </span>
                                    )}
                                    {(source.chapter || source.chapter_name) && (
                                      <span 
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                        style={{ backgroundColor: '#e0e0e0', color: '#000000' }}
                                      >
                                        {source.chapter_name || source.chapter}
                                      </span>
                                    )}
                                    {source.topic && (
                                      <span 
                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                                        style={{ backgroundColor: '#e0e0e0', color: '#000000' }}
                                      >
                                        {source.topic}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Technical Details - without File info */}
                                  <div 
                                    className="flex items-center space-x-4 text-xs pt-2"
                                    style={{ borderTop: '1px solid #e0e0e0', color: '#000000', opacity: 0.6 }}
                                  >
                                    {source.chunk && (
                                      <span><strong>Chunk:</strong> {source.chunk}</span>
                                    )}
                                    <span><strong>Score:</strong> {(source.score * 100).toFixed(1)}%</span>
                                  </div>
                                  
                                  {/* Full Content */}
                                  {(source.content || source.text_preview || source.text || source.full_text) && (
                                    <div 
                                      className="rounded p-3 max-h-64 overflow-y-auto"
                                      style={{ backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0' }}
                                    >
                                      <p className="text-xs font-semibold mb-2" style={{ color: '#000000' }}>Content:</p>
                                      <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#000000', opacity: 0.8 }}>
                                        {source.content || source.full_text || source.text_preview || source.text || 'No content available'}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null
                          })}
                        </div>
                      )}
                      
                      {/* Legacy sources display (fallback) */}
                      {message.type === 'bot' && message.sources && typeof message.sources === 'string' && (
                        <div className={`text-xs mt-2 border-t pt-1 ${
                          'dark' 
                            ? 'border-white/20 text-white/60' 
                            : 'border-gray-200 text-gray-500'
                        }`}>
                          {message.sources}
                        </div>
                      )}
                      
                      {message.error && (
                        <div className={`text-xs mt-1 ${
                          'text-red-500'
                        }`}>
                          Error processing request
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Embedded Search Bar at Bottom */}
          <div 
            className="p-1 relative z-50 transition-colors duration-300" 
            style={{ 
              backgroundColor: '#ffffff'
            }}
          >
            <EmbeddedSearchBar onSendMessage={sendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
  )
}

export default ChatSection
