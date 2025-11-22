import React from 'react'
import { X, Bot, Mail, Phone, MapPin, Clock, Globe } from 'lucide-react'

const InfoModals = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null

  const AboutUsContent = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-3 mb-4">
        <Bot className="w-8 h-8 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">About Pratiyogita Gyan</h2>
      </div>
      
      <div className="space-y-3 text-sm text-gray-700">
        <p>
          <strong>Pratiyogita Gyan</strong> is an AI-powered educational chatbot designed to help students prepare for competitive exams with comprehensive study materials and practice questions.
        </p>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Key Features:</h3>
          <ul className="space-y-1 text-blue-700 text-sm">
            <li>📚 NCERT-based comprehensive answers</li>
            <li>📝 Previous Year Questions (PYQ) integration</li>
            <li>🎯 Subject-specific learning (Geography, History, Polity, Science, Economics)</li>
            <li>💡 AI-powered instant responses</li>
            <li>🔍 Smart search and relevance scoring</li>
          </ul>
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Perfect For:</h3>
          <ul className="space-y-1 text-green-700 text-sm">
            <li>• UPSC Civil Services preparation</li>
            <li>• SSC examinations</li>
            <li>• Banking & Insurance exams</li>
            <li>• Teaching & Defence exams</li>
            <li>• General knowledge enhancement</li>
          </ul>
        </div>
        
        <p className="text-center text-gray-600 italic">
          "Empowering students with AI-driven learning for competitive exam success"
        </p>
      </div>
    </div>
  )

  const ContactContent = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-3 mb-4">
        <Mail className="w-8 h-8 text-green-600" />
        <h2 className="text-xl font-bold text-gray-900">Contact Us</h2>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-800">Email Support</p>
              <p className="text-sm text-gray-600">support@pratiyogitagyan.com</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-semibold text-gray-800">Phone</p>
              <p className="text-sm text-gray-600">+91 9876543210</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-semibold text-gray-800">Support Hours</p>
              <p className="text-sm text-gray-600">Mon-Fri: 9:00 AM - 6:00 PM IST</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="font-semibold text-gray-800">Website</p>
              <p className="text-sm text-gray-600">www.pratiyogitagyan.com</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Quick Help:</h3>
          <ul className="space-y-1 text-blue-700 text-sm">
            <li>💬 Use the chatbot for instant study help</li>
            <li>📧 Email us for technical support</li>
            <li>📞 Call for urgent queries</li>
            <li>🕒 Response time: Within 24 hours</li>
          </ul>
        </div>
        
        <p className="text-center text-gray-600 text-sm italic">
          "We're here to support your learning journey!"
        </p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === 'about' ? 'About Us' : 'Contact Us'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          {type === 'about' ? <AboutUsContent /> : <ContactContent />}
        </div>
        
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
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

export default InfoModals
