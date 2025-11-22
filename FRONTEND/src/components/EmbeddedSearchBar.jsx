import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import apiService from '../services/api'

const EmbeddedSearchBar = ({ onSendMessage, isLoading }) => {
  const { theme } = useTheme()
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('All Subjects')
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef(null)

  // Load available subjects from Pinecone
  const loadAvailableSubjects = async () => {
    setIsLoadingSubjects(true)
    try {
      console.log('🔍 EmbeddedSearchBar: Loading available subjects...')
      const response = await apiService.getBooks()
      console.log('📚 EmbeddedSearchBar: Books response:', response)
      
      const indexedBooks = response.filter(book => book.total_chunks > 0)
      console.log('✅ EmbeddedSearchBar: Indexed books:', indexedBooks)
      
      // Create subject list with indexed subjects only
      const subjects = ['All Subjects'] // Always include "All Subjects"
      indexedBooks.forEach(book => {
        // Extract subject name from title (e.g., "NCERT Geography" -> "Geography")
        const subjectName = book.title.replace('NCERT ', '')
        if (!subjects.includes(subjectName)) {
          subjects.push(subjectName)
        }
      })
      
      console.log('🎯 EmbeddedSearchBar: Final subjects list:', subjects)
      setAvailableSubjects(subjects)
    } catch (error) {
      console.error('❌ EmbeddedSearchBar: Failed to load available subjects:', error)
      // Fallback to show only "All Subjects" if API fails
      setAvailableSubjects(['All Subjects'])
    } finally {
      setIsLoadingSubjects(false)
    }
  }

  // Load subjects on component mount
  useEffect(() => {
    loadAvailableSubjects()
  }, [])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject)
    setShowDropdown(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const query = inputValue.trim()
    if (!query || isLoading) return
    
    // Convert subject name to the format expected by the API
    let subjectId = 'all'
    if (selectedSubject !== 'All Subjects') {
      subjectId = selectedSubject.toLowerCase()
    }
    
    onSendMessage(query, subjectId)
    setInputValue('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="rounded-2xl shadow-sm p-1.5" style={{ backgroundColor: '#000000', border: '1px solid #BAFF39' }}>
        <div className="flex items-center space-x-1.5">
          {/* Subject Dropdown - Compact for mobile */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button 
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center justify-between space-x-1 px-2 py-1.5 rounded-md text-xs hover:opacity-90 transition-opacity min-w-[80px] max-w-[120px]"
              style={{ 
                backgroundColor: '#BAFF39', 
                color: '#000000' 
              }}
              disabled={isLoadingSubjects}
            >
              <span className="whitespace-nowrap truncate text-xs">
                {isLoadingSubjects ? 'Loading...' : 
                 selectedSubject === 'All Subjects' ? 'All' : 
                 selectedSubject.length > 8 ? selectedSubject.substring(0, 8) + '...' : 
                 selectedSubject}
              </span>
              <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
                showDropdown ? 'rotate-180' : ''
              }`} />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && !isLoadingSubjects && (
              <div className="absolute bottom-full left-0 mb-1 w-40 rounded-md shadow-lg z-[60]" style={{ backgroundColor: '#000000', border: '1px solid #BAFF39' }}>
                <div className="py-1">
                  {availableSubjects.map((subject, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSubjectSelect(subject)}
                      className="w-full text-left px-2 py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: selectedSubject === subject ? 'rgba(186, 255, 57, 0.2)' : 'transparent',
                        color: selectedSubject === subject ? '#BAFF39' : '#BAFF39',
                        fontWeight: selectedSubject === subject ? '500' : '400'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSubject !== subject) {
                          e.currentTarget.style.backgroundColor = 'rgba(186, 255, 57, 0.1)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSubject !== subject) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{subject}</span>
                        {subject !== 'All Subjects' && (
                          <span className="text-xs font-medium" style={{ color: '#00ff00' }}>✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Footer info */}
                <div className="px-2 py-1" style={{ borderTop: '1px solid rgba(186, 255, 57, 0.3)' }}>
                  <div className="text-xs" style={{ color: '#BAFF39', opacity: 0.7 }}>
                    {availableSubjects.length - 1} indexed subjects
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search Input - Takes remaining space */}
          <div className="flex-1 relative">
            <style>
              {`
                .dark-search-input::placeholder {
                  color: rgba(186, 255, 57, 0.5);
                  opacity: 1;
                }
                .dark-search-input:focus {
                  ring-color: #BAFF39;
                }
              `}
            </style>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a Question to get answers and Related PYQ..."
              className="dark-search-input w-full px-2 py-1.5 text-xs rounded-md focus:outline-none focus:ring-1 focus:border-transparent"
              style={{
                backgroundColor: '#6E6E6E',
                border: '1px solid #BAFF39',
                color: '#BAFF39',
                caretColor: '#BAFF39'
              }}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          {/* Search Button - Compact */}
          <button 
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="flex-shrink-0 p-1.5 rounded-md transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: '#BAFF39',
              color: '#000000'
            }}
            onMouseOver={(e) => {
              if (!isLoading && inputValue.trim()) {
                e.target.style.backgroundColor = '#FF921C'
              }
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#BAFF39'
            }}
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default EmbeddedSearchBar
