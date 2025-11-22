import React from 'react'
import { X, Bot } from 'lucide-react'

const AboutUsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    // Close only if the user clicks directly on the semi-transparent backdrop
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
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()} // Prevent inside clicks from closing
      >
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">About Pratiyogita Gyan</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700 text-center">
            <strong>Pratiyogita Gyan</strong> is an AI-powered educational chatbot designed to help students prepare for competitive exams with comprehensive study materials and practice questions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-3 text-center">Key Features</h3>
              <ul className="space-y-2 text-blue-700 text-sm">
                <li className="flex items-center space-x-2">
                  <span>📚</span>
                  <span>NCERT-based comprehensive answers</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>📝</span>
                  <span>Previous Year Questions integration</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Subject-specific learning</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>💡</span>
                  <span>AI-powered instant responses</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>🔍</span>
                  <span>Smart search & relevance scoring</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-3 text-center">Perfect For</h3>
              <ul className="space-y-2 text-green-700 text-sm">
                <li className="flex items-center space-x-2">
                  <span>🎓</span>
                  <span>UPSC Civil Services preparation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>SSC examinations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>🏦</span>
                  <span>Banking & Insurance exams</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>🛡️</span>
                  <span>Teaching & Defence exams</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span>🧠</span>
                  <span>General knowledge enhancement</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-center text-gray-700 font-medium text-sm">
              "Empowering students with AI-driven learning for competitive exam success"
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 border-t border-gray-200 p-4 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AboutUsModal
