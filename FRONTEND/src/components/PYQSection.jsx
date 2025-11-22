import React, { useState, useEffect } from 'react'
import { ChevronDown, FileText, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLayout } from '../contexts/LayoutContext'
import { useDashboard } from '../contexts/DashboardContext'
import apiService from '../services/api'
import { ChevronFirst } from './icons/ChevronFirst'

const PYQSection = () => {
  const { theme } = useTheme()
  const { pyqVisible, togglePyq } = useLayout()
  const { trackInteraction } = useDashboard()
  const [searchResults, setSearchResults] = useState([])
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [selectedExam, setSelectedExam] = useState('all')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [showImportantOnly, setShowImportantOnly] = useState(false) // Filter for important questions only
  const [showExamDropdown, setShowExamDropdown] = useState(false)
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)
  const [filteredQuestions, setFilteredQuestions] = useState([])
  const [userAnswers, setUserAnswers] = useState({}) // Track user selections for each question
  const [expandedExplanations, setExpandedExplanations] = useState({}) // Track expanded explanations
  const [importantQuestions, setImportantQuestions] = useState(new Set()) // Track important/bookmarked questions

  // Load available exams and subjects from current search results only
  const [availableExams, setAvailableExams] = useState([])
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [loadingFilters, setLoadingFilters] = useState(false)
  
  // Dynamic exam and subject lists from search results only
  const exams = [
    { id: 'all', name: 'All Exams' },
    ...availableExams.map(exam => ({ id: exam.toLowerCase(), name: exam }))
  ]

  const subjects = [
    { id: 'all', name: 'All Subjects' },
    ...availableSubjects.map(subject => ({ id: subject.toLowerCase(), name: subject }))
  ]

  // Extract unique exams and subjects from search results
  const extractFiltersFromResults = (questions) => {
    const uniqueExams = new Set()
    const uniqueSubjects = new Set()
    
    questions.forEach(question => {
      // Extract exam name
      const examName = question.metadata?.exam_name || question.metadata?.exam || question.exam_name || ''
      if (examName && examName.trim()) {
        uniqueExams.add(examName.trim())
      }
      
      // Extract subject
      const subject = question.metadata?.subject || question.subject || ''
      if (subject && subject.trim()) {
        uniqueSubjects.add(subject.trim())
      }
    })
    
    return {
      exams: Array.from(uniqueExams).sort(),
      subjects: Array.from(uniqueSubjects).sort()
    }
  }

  // Load filter options and total questions count
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Get total questions for display only
        const response = await apiService.getTotalQuestions()
        setTotalQuestions(response.total_questions || 0)
        
        console.log(`✅ Total questions in database: ${response.total_questions || 0}`)
        
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    
    loadInitialData()
  }, [])

  // Load questions when filters change - but only if we have search results
  useEffect(() => {
    // Only apply filters if we have search results from the main search
    if (searchResults.length > 0) {
      applyFilters()
    }
  }, [selectedExam, selectedSubject, showImportantOnly, importantQuestions, searchResults.length])

  // Listen for MCQ results from chat searches
  useEffect(() => {
    const handleMcqResults = (event) => {
      const { mcqs, query } = event.detail
      setSearchResults(mcqs)
      setLastSearchQuery(query)
      
      // Extract filters from search results
      if (mcqs && mcqs.length > 0) {
        setLoadingFilters(true)
        const { exams, subjects } = extractFiltersFromResults(mcqs)
        setAvailableExams(exams)
        setAvailableSubjects(subjects)
        setLoadingFilters(false)
        
        console.log(`🔍 Search: "${query}" - Found ${mcqs.length} questions`)
        console.log(`📊 Available filters: ${exams.length} exams, ${subjects.length} subjects`)
        console.log(`📋 Exams: ${exams.join(', ')}`)
        console.log(`📚 Subjects: ${subjects.join(', ')}`)
      } else {
        // No results, clear filters
        setAvailableExams([])
        setAvailableSubjects([])
        setLoadingFilters(false)
      }
      
      applyFilters(mcqs)
    }

    const handleNewChat = () => {
      // Reset all PYQ state when a new chat is started
      setSearchResults([])
      setLastSearchQuery('')
      setFilteredQuestions([])
      setUserAnswers({})
      setExpandedExplanations({})
      setSelectedExam('all')
      setSelectedSubject('all')
      setShowImportantOnly(false)
      // Clear available filters since no search has been made
      setAvailableExams([])
      setAvailableSubjects([])
      setLoadingFilters(false)
      console.log('🔄 PYQ Section reset for new chat')
    }

    const handleLoadChat = () => {
      // Reset PYQ state when loading an existing chat (similar to new chat)
      setSearchResults([])
      setLastSearchQuery('')
      setFilteredQuestions([])
      setUserAnswers({})
      setExpandedExplanations({})
      setSelectedExam('all')
      setSelectedSubject('all')
      setShowImportantOnly(false)
      // Clear available filters since no search has been made
      setAvailableExams([])
      setAvailableSubjects([])
      setLoadingFilters(false)
      console.log('🔄 PYQ Section reset for loaded chat')
    }

    const handleLoadGuestChat = () => {
      // Reset PYQ state when loading a guest chat
      setSearchResults([])
      setLastSearchQuery('')
      setFilteredQuestions([])
      setUserAnswers({})
      setExpandedExplanations({})
      setSelectedExam('all')
      setSelectedSubject('all')
      setShowImportantOnly(false)
      // Clear available filters since no search has been made
      setAvailableExams([])
      setAvailableSubjects([])
      setLoadingFilters(false)
      console.log('🔄 PYQ Section reset for loaded guest chat')
    }

    window.addEventListener('newMcqResults', handleMcqResults)
    window.addEventListener('newChat', handleNewChat)
    window.addEventListener('loadChat', handleLoadChat)
    window.addEventListener('loadGuestChat', handleLoadGuestChat)
    return () => {
      window.removeEventListener('newMcqResults', handleMcqResults)
      window.removeEventListener('newChat', handleNewChat)
      window.removeEventListener('loadChat', handleLoadChat)
      window.removeEventListener('loadGuestChat', handleLoadGuestChat)
    }
  }, [])

  // Apply filters to current search results
  const applyFilters = (questions = searchResults) => {
    let filtered = [...questions]
    
    if (selectedExam !== 'all') {
      filtered = filtered.filter(q => {
        const examName = q.metadata?.exam_name || q.metadata?.exam || q.exam_name || ''
        return examName.toLowerCase() === selectedExam.toLowerCase()
      })
    }
    
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(q => {
        const subject = q.metadata?.subject || q.subject || ''
        return subject.toLowerCase() === selectedSubject.toLowerCase()
      })
    }

    // Filter for important questions only
    if (showImportantOnly) {
      filtered = filtered.filter(q => {
        const questionId = q.id || `fallback_${questions.indexOf(q)}`
        return importantQuestions.has(questionId)
      })
    }
    
    setFilteredQuestions(filtered)
  }

  // Apply filters whenever filters change for search results
  useEffect(() => {
    // Only apply filters if we have search results (from chat)
    if (searchResults.length > 0) {
      applyFilters()
    }
  }, [selectedExam, selectedSubject, showImportantOnly, searchResults, importantQuestions])

  // Function to refresh questions
  const refreshQuestions = () => {
    // This will trigger the useEffect to reload questions
    setSelectedExam(selectedExam)
  }

  // Handle option selection
  const handleOptionSelect = (questionId, optionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }))
    
    // Find the question to check if answer is correct
    const question = searchResults.find(q => q.id === questionId)
    if (question) {
      const isCorrect = optionIndex === question.correct_answer
      const questionSubject = question.subject || question.metadata?.subject || 'Others'
      
      // Track MCQ attempt with correct/wrong tracking
      if (isCorrect) {
        trackInteraction('mcq_correct', {
          questionId: questionId,
          subject: questionSubject,
          exam: question.exam_name || question.metadata?.exam_name || 'Unknown',
          selectedOption: optionIndex,
          correctOption: question.correct_answer
        })
      } else {
        trackInteraction('mcq_wrong', {
          questionId: questionId,
          subject: questionSubject,
          exam: question.exam_name || question.metadata?.exam_name || 'Unknown',
          selectedOption: optionIndex,
          correctOption: question.correct_answer
        })
      }
      
      console.log(`✅ MCQ ${isCorrect ? 'correct' : 'wrong'} answer tracked for subject: ${questionSubject}`)
    }
  }

  // Reset user answers when new search results come in
  useEffect(() => {
    setUserAnswers({})
    setExpandedExplanations({})
  }, [searchResults])

  // Handle explanation toggle
  const toggleExplanation = (questionId) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  // Handle important question toggle
  const toggleImportantQuestion = (questionId) => {
    setImportantQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  // Determine which questions to display based on search results or filtered API results
  const currentQuestions = searchResults.length > 0 ? filteredQuestions : filteredQuestions

  // Sidebar-like style
  const pyqStyle = {
    backgroundColor: '#ffffff',
    color: '#000000',
    border: '1px solid #808080'
  }

  return (
    <>
      {/* Full PYQ Section */}
      {pyqVisible && (
        <div 
          className="fixed right-1 top-[4rem] bottom-1 w-[450px] shadow-lg z-30 rounded-lg transition-colors duration-300"
          style={pyqStyle}
        >
          <div className="flex flex-col h-full">
            {/* Toggle Button and Header */}
            <div className="p-1 flex justify-between items-center">
              <div 
                onClick={togglePyq}
                className="rounded transition-colors -m-2"
                style={{ backgroundColor: 'transparent', transform: 'scaleX(-1)' }}
                title="Hide PYQ Section"
              >
                <ChevronFirst 
                  width={15} 
                  height={15} 
                  strokeWidth={2} 
                  stroke={'#000000'} 
                />
              </div>
              
              <div className="flex items-center space-x-2 pr-1">
                <span className="text-xs font-medium transition-colors duration-300" style={{ color: '#000000' }}>
                  PYQs
                </span>
                <span className="text-xs transition-colors duration-300" style={{ color: '#000000', opacity: 0.7 }}>
                  ({filteredQuestions.length} Questions)
                </span>
                {importantQuestions.size > 0 && (
                  <span className="text-xs flex items-center" style={{ color: '#FF921C' }}>
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {importantQuestions.size} important
                  </span>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div 
              className="flex-1 flex flex-col rounded-lg m-2 mt-0 min-h-0 transition-colors duration-300" 
              style={{ 
                backgroundColor: '#ffffff'
              }}
            >
              {/* Sticky Header */}
              <div 
                className="sticky top-0 border-b z-10 rounded-t-lg flex-shrink-0 transition-colors duration-300" 
                style={{ 
                  backgroundColor: '#ffffff',
                  borderColor: '#d0d0d0'
                }}
              >
                <div className="p-2 space-y-2">

                  {/* Filters - Show only when we have search results with filter data */}
                  {!loadingFilters && searchResults.length > 0 && (availableExams.length > 0 || availableSubjects.length > 0) && (
                    <div className="flex items-center space-x-1 mb-2">
                      {/* Exam Filter */}
                      <div className="relative">
                        <button 
                          onClick={() => !loadingFilters && setShowExamDropdown(!showExamDropdown)}
                          disabled={loadingFilters}
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                            loadingFilters ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          style={{ 
                            backgroundColor: '#BAFF39', 
                            color: '#000000' 
                          }}
                        >
                          <span>
                            {loadingFilters 
                              ? 'Loading...' 
                              : (exams.find(e => e.id === selectedExam)?.name || 'All Exams')
                            }
                          </span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showExamDropdown && !loadingFilters && (
                          <div 
                            className="absolute top-full left-0 mt-1 w-40 rounded-lg shadow-lg z-50"
                            style={{ 
                              backgroundColor: '#ffffff',
                              border: '1px solid #e0e0e0'
                            }}
                          >
                            {exams.map((exam) => (
                              <button
                                key={exam.id}
                                onClick={() => {
                                  setSelectedExam(exam.id)
                                  setShowExamDropdown(false)
                                }}
                                className={`w-full text-left px-3 py-1 text-xs first:rounded-t-lg last:rounded-b-lg ${
                                  selectedExam === exam.id ? 'font-medium' : ''
                                }`}
                                style={{ 
                                  color: '#000000',
                                  backgroundColor: selectedExam === exam.id 
                                    ? ('rgba(186, 255, 57, 0.15)')
                                    : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedExam !== exam.id) {
                                    e.currentTarget.style.backgroundColor = 'rgba(186, 255, 57, 0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedExam !== exam.id) {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }
                                }}
                              >
                                {exam.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Subject Filter */}
                      <div className="relative">
                        <button 
                          onClick={() => !loadingFilters && setShowSubjectDropdown(!showSubjectDropdown)}
                          disabled={loadingFilters}
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                            loadingFilters ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          style={{ 
                            backgroundColor: '#BAFF39', 
                            color: '#000000' 
                          }}
                        >
                          <span>
                            {loadingFilters 
                              ? 'Loading...' 
                              : (subjects.find(s => s.id === selectedSubject)?.name || 'All Subjects')
                            }
                          </span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showSubjectDropdown && !loadingFilters && (
                          <div 
                            className="absolute top-full left-0 mt-1 w-40 rounded-lg shadow-lg z-50"
                            style={{ 
                              backgroundColor: '#ffffff',
                              border: '1px solid #e0e0e0'
                            }}
                          >
                            {subjects.map((subject) => (
                              <button
                                key={subject.id}
                                onClick={() => {
                                  setSelectedSubject(subject.id)
                                  setShowSubjectDropdown(false)
                                }}
                                className={`w-full text-left px-3 py-1 text-xs first:rounded-t-lg last:rounded-b-lg ${
                                  selectedSubject === subject.id ? 'font-medium' : ''
                                }`}
                                style={{ 
                                  color: '#000000',
                                  backgroundColor: selectedSubject === subject.id 
                                    ? ('rgba(186, 255, 57, 0.15)')
                                    : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedSubject !== subject.id) {
                                    e.currentTarget.style.backgroundColor = 'rgba(186, 255, 57, 0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedSubject !== subject.id) {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }
                                }}
                              >
                                {subject.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Important Questions Filter */}
                      <button
                        onClick={() => setShowImportantOnly(!showImportantOnly)}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 ${
                          showImportantOnly
                            ? 'bg-yellow-500 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        title={showImportantOnly ? 'Show all questions' : 'Show only important questions'}
                      >
                        <Star className={`w-3 h-3 ${showImportantOnly ? 'fill-current' : ''}`} />
                        <span>{showImportantOnly ? 'Important' : 'All'}</span>
                      </button>
                    </div>
                  )}

                  {/* Progress */}
                  {filteredQuestions.length > 0 && Object.keys(userAnswers).length > 0 && (
                    <div className="flex items-center space-x-1 mb-1">
                      <span className="text-xs font-medium whitespace-nowrap transition-colors duration-300" style={{ color: '#000000' }}>Progress:</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="whitespace-nowrap" style={{ color: '#00ff00' }}>
                          {(() => {
                            let correct = 0
                            currentQuestions.forEach((q, idx) => {
                              const questionId = q.id || `fallback_${idx}`
                              const hasValidCorrectAnswer = 
                                q.correct_answer !== undefined && 
                                Number.isInteger(q.correct_answer) &&
                                q.correct_answer >= 0 && 
                                q.correct_answer < (q.options?.length || 0)
                              if (hasValidCorrectAnswer && userAnswers[questionId] === q.correct_answer) correct++
                            })
                            return correct
                          })()} Correct
                        </span>
                        <span className="whitespace-nowrap" style={{ color: '#ff4444' }}>
                          {(() => {
                            let wrong = 0
                            currentQuestions.forEach((q, idx) => {
                              const questionId = q.id || `fallback_${idx}`
                              const userAnswer = userAnswers[questionId]
                              const hasValidCorrectAnswer = 
                                q.correct_answer !== undefined && 
                                Number.isInteger(q.correct_answer) &&
                                q.correct_answer >= 0 && 
                                q.correct_answer < (q.options?.length || 0)
                              if (hasValidCorrectAnswer && userAnswer !== undefined && userAnswer !== q.correct_answer) wrong++
                            })
                            return wrong
                          })()} Wrong
                        </span>
                        <span className="whitespace-nowrap transition-colors duration-300" style={{ color: '#000000' }}>
                          {Object.keys(userAnswers).length}/{currentQuestions.length} Answered
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-2 min-h-0 pyq-content">
                {/* Questions */}
                <div className="space-y-4">
                  {!lastSearchQuery && currentQuestions.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="w-12 h-12 mx-auto mb-2 transition-colors duration-300" style={{ color: '#000000', opacity: 0.5 }} />
                      <p className="text-xs transition-colors duration-300" style={{ color: '#000000', opacity: 0.7 }}>
                        Search for topics to find relevant PYQs
                      </p>
                      <p className="text-xs mt-1 transition-colors duration-300" style={{ color: '#000000', opacity: 0.5 }}>
                        Use the chat below to search for questions on any topic
                      </p>
                    </div>
                  ) : lastSearchQuery && currentQuestions.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="w-12 h-12 mx-auto mb-2 transition-colors duration-300" style={{ color: '#000000', opacity: 0.5 }} />
                      <p className="text-xs transition-colors duration-300" style={{ color: '#000000', opacity: 0.7 }}>
                        No related questions found for "{lastSearchQuery}"
                      </p>
                      <p className="text-xs mt-1 transition-colors duration-300" style={{ color: '#000000', opacity: 0.5 }}>
                        Try different keywords or remove filters
                      </p>
                    </div>
                  ) : currentQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {currentQuestions.map((question, questionIndex) => {
                        // Use the unique ID from backend, fallback to index-based ID if needed
                        const questionId = question.id || `fallback_${questionIndex}`
                        const userAnswer = userAnswers[questionId]
                        const isCorrect = userAnswer === question.correct_answer
                        const hasAnswered = userAnswer !== undefined
                        
                        return (
                          <div 
                            key={questionId} 
                            className={`bg-white rounded-lg shadow-sm border ${hasAnswered ? (isCorrect ? 'border-green-200' : 'border-red-200') : 'border-gray-200'}`}
                          >
                            {/* Question Header */}
                            <div className="p-3 border-b border-gray-100">
                              <div className="flex justify-between items-start mb-1">
                                <h3 className="text-xs font-medium text-gray-900 flex-1 pr-2">
                                  {question.question}
                                </h3>
                                <div className="flex items-center space-x-1">
                                  {/* Important/Bookmark Icon */}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleImportantQuestion(questionId);
                                    }}
                                    className={`p-1 rounded-full transition-colors duration-200 ${
                                      importantQuestions.has(questionId)
                                        ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                                        : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                                    }`}
                                    title={importantQuestions.has(questionId) ? 'Remove from important' : 'Mark as important'}
                                  >
                                    <Star 
                                      className={`w-4 h-4 ${importantQuestions.has(questionId) ? 'fill-current' : ''}`} 
                                    />
                                  </button>
                                  {/* Answer Status Icon */}
                                  {hasAnswered && (
                                    <span className={`flex items-center justify-center w-5 h-5 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      {isCorrect ? '✓' : '✗'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Options */}
                              <div className="space-y-1 mt-2">
                                {question.options?.map((option, optionIndex) => {
                                  const isUserSelected = userAnswer === optionIndex
                                  const isCorrectAnswer = question.correct_answer === optionIndex
                                  
                                  let optionClass = "flex items-start p-2 border rounded-md cursor-pointer transition-colors"
                                  
                                  // Not answered yet
                                  if (!hasAnswered) {
                                    optionClass += " border-gray-200 hover:bg-gray-50"
                                  }
                                  // Answered and this is user's selection
                                  else if (isUserSelected) {
                                    optionClass += isCorrect
                                      ? " border-green-200 bg-green-50"
                                      : " border-red-200 bg-red-50"
                                  }
                                  // Answered, not user's selection, but is correct answer
                                  else if (isCorrectAnswer) {
                                    optionClass += " border-green-200 bg-green-50"
                                  }
                                  // Answered, not selected by user, not correct answer
                                  else {
                                    optionClass += " border-gray-200"
                                  }
                                  
                                  return (
                                    <div 
                                      key={optionIndex}
                                      className={optionClass}
                                      onClick={(e) => {
                                        if (!hasAnswered) {  // Only allow selection if not answered
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleOptionSelect(questionId, optionIndex);
                                        }
                                      }}
                                    >
                                      <div className="flex-shrink-0 mr-2 mt-0.5">
                                        <div className={`w-4 h-4 flex items-center justify-center rounded-full border ${isUserSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'}`}>
                                          {isUserSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </div>
                                      </div>
                                      <div className="flex-1 text-xs text-gray-900">
                                        {option}
                                      </div>
                                      {hasAnswered && isCorrectAnswer && !isUserSelected && (
                                        <div className="flex-shrink-0 ml-1">
                                          <div className="w-4 h-4 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                                            <div className="w-2 h-2 bg-green-600 rounded-full" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            
                            {/* Question Footer with Metadata */}
                            <div className="px-3 py-2 bg-gray-50 rounded-b-lg">
                              <div className="flex items-center justify-between">
                                {/* Left side - Metadata tags */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                  {/* Exam Name */}
                                  {(question.exam_name || question.metadata?.exam_name || question.metadata?.exam) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {question.exam_name || question.metadata?.exam_name || question.metadata?.exam}
                                    </span>
                                  )}
                                  
                                  {/* Year */}
                                  {(question.year || question.metadata?.year || question.metadata?.exam_year) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      {question.year || question.metadata?.year || question.metadata?.exam_year}
                                    </span>
                                  )}
                                  
                                  {/* Term */}
                                  {(question.term || question.metadata?.term || question.metadata?.exam_term) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      {question.term || question.metadata?.term || question.metadata?.exam_term}
                                    </span>
                                  )}
                                  
                                  {/* Subject */}
                                  {(question.subject || question.metadata?.subject) && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      {question.subject || question.metadata?.subject}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Right side - Show Explanation button */}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (hasAnswered) {  // Only show explanation after answering
                                      toggleExplanation(questionId);
                                    }
                                  }}
                                  disabled={!hasAnswered}
                                  className={`text-xs flex items-center space-x-1 transition-all duration-200 px-2 py-1 rounded flex-shrink-0 ${
                                    hasAnswered 
                                      ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer' 
                                      : 'text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  <span>
                                    {hasAnswered 
                                      ? (expandedExplanations[questionId] ? 'Hide Explanation' : 'Show Explanation')
                                      : 'Answer to view explanation'
                                    }
                                  </span>
                                  {hasAnswered && (
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedExplanations[questionId] ? 'rotate-180' : ''}`} />
                                  )}
                                </button>
                              </div>
                              
                              {/* Explanation Dropdown */}
                              {expandedExplanations[questionId] && question.explanation && (
                                <div className="mt-3 pt-3 border-t border-gray-200 animate-in slide-in-from-top-1 duration-200">
                                  <div className="text-xs text-gray-700">
                                    <div className="flex items-center mb-2">
                                      <p className="font-semibold text-blue-600">Explanation</p>
                                    </div>
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border-l-4 border-blue-400 shadow-sm">
                                      <p className="leading-relaxed text-gray-800">{question.explanation}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : !lastSearchQuery ? (
                    <div className="text-center py-6">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs text-gray-500">
                        Use the search bar below to find relevant PYQs
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed PYQ Section (Icon Bar) */}
      {!pyqVisible && (
        <div 
          className="fixed right-1 top-[4rem] bottom-1 w-10 shadow-lg flex flex-col rounded-lg transition-colors duration-300"
          style={{
            ...pyqStyle,
            border: '1px solid #808080'
          }}
        >
          {/* Toggle Button */}
          <div className="p-1 flex justify-center -m-1">
            <div 
              onClick={togglePyq}
              className="rounded transition-colors"
              style={{ backgroundColor: 'transparent' }}
              title="Show PYQ Section"
            >
              <ChevronFirst 
                width={15} 
                height={15} 
                strokeWidth={2} 
                stroke={'#000000'} 
              />
            </div>
          </div>

          {/* Icon */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <button 
              onClick={togglePyq}
              className="p-1 rounded-lg transition-colors"
              style={{ color: '#000000' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(186, 255, 57, 0.15)'
              }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Previous Year Questions"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default PYQSection
