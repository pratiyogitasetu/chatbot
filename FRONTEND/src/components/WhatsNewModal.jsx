import React from 'react'
import { X, Lightbulb, Calendar, Star, Zap, MessageCircle, Search, Book, Shield } from 'lucide-react'

const WhatsNewModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const updates = [
    {
      date: "July 2025",
      version: "v2.1",
      features: [
        {
          icon: <MessageCircle className="w-4 h-4 text-blue-600" />,
          title: "Enhanced Chat Experience",
          description: "Improved message display with better source references and expandable content sections."
        },
        {
          icon: <Search className="w-4 h-4 text-green-600" />,
          title: "Smart Source Discovery",
          description: "Click individual source buttons to view detailed references with relevance scores."
        }
      ]
    },
    {
      date: "June 2025",
      version: "v2.0",
      features: [
        {
          icon: <Shield className="w-4 h-4 text-purple-600" />,
          title: "User Authentication",
          description: "Sign up and login to save your chat history permanently across devices."
        },
        {
          icon: <Book className="w-4 h-4 text-orange-600" />,
          title: "Chat Management",
          description: "Create, view, and delete chat conversations with automatic title generation."
        }
      ]
    },
    {
      date: "May 2025",
      version: "v1.5",
      features: [
        {
          icon: <Zap className="w-4 h-4 text-yellow-600" />,
          title: "Faster Response Times",
          description: "Optimized backend for 50% faster question processing and answer delivery."
        },
        {
          icon: <Star className="w-4 h-4 text-red-600" />,
          title: "Subject-Specific Learning",
          description: "Enhanced subject selection with Geography, History, Polity, Science, and Economics."
        }
      ]
    },
    {
      date: "April 2025",
      version: "v1.0",
      features: [
        {
          icon: <Book className="w-4 h-4 text-indigo-600" />,
          title: "NCERT Integration",
          description: "Complete integration with NCERT textbooks for accurate, curriculum-based answers."
        },
        {
          icon: <Search className="w-4 h-4 text-teal-600" />,
          title: "PYQ Database",
          description: "Extensive database of Previous Year Questions from UPSC, SSC, Banking, and more."
        }
      ]
    }
  ]

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="What's New"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Lightbulb className="w-6 h-6 text-yellow-600" />
            <h2 className="text-lg font-semibold text-gray-900">What's New</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5">
          {/* Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            
            {updates.map((update, index) => (
              <div key={index} className="relative pb-6 last:pb-0">
                {/* Timeline dot */}
                <div className="absolute left-4 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-sm"></div>
                
                {/* Content */}
                <div className="ml-12">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-800">{update.date}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {update.version}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {update.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {feature.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800 text-sm mb-1">
                              {feature.title}
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Coming Soon Section */}
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-purple-800 text-sm">Coming Soon</span>
            </div>
            <div className="space-y-2 text-xs text-purple-700">
              <p>🎯 Advanced question suggestions based on your study pattern</p>
              <p>📊 Performance analytics and progress tracking</p>
              <p>🔔 Daily study reminders and custom notifications</p>
              <p>📱 Mobile app for iOS and Android</p>
            </div>
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-3 rounded-b-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Stay updated with our latest features!</span>
            <button
              onClick={onClose}
              className="bg-yellow-600 text-white py-1 px-3 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WhatsNewModal
