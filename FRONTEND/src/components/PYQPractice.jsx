import React, { useState, useEffect } from 'react'
import { 
  ChevronDown, 
  Target, 
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLayout } from '../contexts/LayoutContext'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../contexts/DashboardContext'
import apiService from '../services/api'

const PYQPractice = () => {
  const { theme } = useTheme()
  const { sidebarVisible } = useLayout()
  const { currentUser } = useAuth()
  const { trackInteraction } = useDashboard()
  
  // Calculate dynamic margins based on sidebar visibility
  const leftMargin = sidebarVisible ? 'ml-52 sm:ml-60 md:ml-68' : 'ml-12'

  // State for filters
  const [selectedExam, setSelectedExam] = useState('all')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedYear, setSelectedYear] = useState('all')
  const [questionsPerPage, setQuestionsPerPage] = useState('10')
  
  // State for dropdowns
  const [showExamDropdown, setShowExamDropdown] = useState(false)
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  
  // State for data
  const [questions, setQuestions] = useState([])
  const [filteredQuestions, setFilteredQuestions] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // State for available filter options
  const [availableExams, setAvailableExams] = useState([])
  const [availableSubjects, setAvailableSubjects] = useState([])
  const [availableYears, setAvailableYears] = useState([])
  
  // State for user answers and explanations
  const [userAnswers, setUserAnswers] = useState({})
  // revealedAnswers now represents whether the question has been answered (checked)
  const [revealedAnswers, setRevealedAnswers] = useState({})
  const [expandedExplanations, setExpandedExplanations] = useState({})

  // Filter options
  const examOptions = [
    { id: 'all', name: 'All Exams' },
    { id: 'upsc', name: 'UPSC CSE' },
    { id: 'capf', name: 'CAPF' },
    { id: 'cds', name: 'CDS' },
    { id: 'mppsc', name: 'MPPSC' },
    { id: 'uppcs', name: 'UPPCS' },
    { id: 'bpsc', name: 'BPSC' },
    ...availableExams.map(exam => ({ id: exam.toLowerCase().replace(/\s+/g, '_'), name: exam }))
  ]

  const subjectOptions = [
    { id: 'all', name: 'All Subjects' },
    { id: 'history', name: 'History' },
    { id: 'geography', name: 'Geography' },
    { id: 'polity', name: 'Polity' },
    { id: 'economics', name: 'Economics' },
    { id: 'science', name: 'Science & Technology' },
    { id: 'environment', name: 'Environment' },
    { id: 'current_affairs', name: 'Current Affairs' },
    ...availableSubjects.map(subject => ({ id: subject.toLowerCase().replace(/\s+/g, '_'), name: subject }))
  ]

  const yearOptions = [
    { id: 'all', name: 'All Years' },
    { id: '2024', name: '2024' },
    { id: '2023', name: '2023' },
    { id: '2022', name: '2022' },
    { id: '2021', name: '2021' },
    { id: '2020', name: '2020' },
    { id: '2019', name: '2019' },
    { id: '2018', name: '2018' },
    { id: '2017', name: '2017' },
    { id: '2016', name: '2016' },
    { id: '2015', name: '2015' },
    ...availableYears.map(year => ({ id: year.toString(), name: year.toString() }))
  ]



  const questionsPerPageOptions = [
    { id: '5', name: '5 per page' },
    { id: '10', name: '10 per page' },
    { id: '20', name: '20 per page' },
    { id: '50', name: '50 per page' }
  ]

  // Load initial data and filters
  useEffect(() => {
    loadInitialData()
  }, [])

  // Load questions when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedExam !== 'all' || selectedSubject !== 'all' || selectedYear !== 'all') {
      loadFilteredQuestions()
    } else {
      setFilteredQuestions([])
      setIsLoading(false)
    }
  }, [selectedExam, selectedSubject, selectedYear])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside all dropdowns
      const isDropdownClick = event.target.closest('.dropdown-container')
      if (!isDropdownClick) {
        setShowExamDropdown(false)
        setShowSubjectDropdown(false)
        setShowYearDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])



  const loadInitialData = async () => {
    // Don't load anything initially - just set loading to false
    setIsLoading(false)
    setError('')
  }

  const loadFilteredQuestions = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await apiService.searchPyqQuestions({
        query: '',
        exam: selectedExam !== 'all' ? selectedExam : null,
        subject: selectedSubject !== 'all' ? selectedSubject : null,
        year: selectedYear !== 'all' ? selectedYear : null,
        limit: 20 // Reduced limit for faster loading
      })
      
      if (response && response.questions) {
        setQuestions(response.questions)
        setFilteredQuestions(response.questions)
        // Reset user answers and revealed states when new questions are loaded
        setUserAnswers({})
        setRevealedAnswers({})
        setExpandedExplanations({})
        setCurrentPage(1)
        // Extract available filters from results
        extractFiltersFromResults(response.questions)
      }
    } catch (error) {
      console.error('Failed to load questions:', error)
      setError('Failed to load questions')
    } finally {
      setIsLoading(false)
    }
  }

  const extractFiltersFromResults = (questionResults) => {
    const exams = new Set()
    const subjects = new Set()
    const years = new Set()
    
    questionResults.forEach(question => {
      if (question.exam_name) exams.add(question.exam_name)
      if (question.subject) subjects.add(question.subject)
      if (question.year) years.add(question.year)
    })
    
    setAvailableExams(Array.from(exams).sort())
    setAvailableSubjects(Array.from(subjects).sort())
    setAvailableYears(Array.from(years).sort())
  }



  const handleAnswerSelect = (questionId, optionIndex) => {
    // If already answered, don't allow changes
    if (revealedAnswers[questionId]) return;

    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }))

    // mark as answered (reveal feedback)
    setRevealedAnswers(prev => ({
      ...prev,
      [questionId]: true
    }))

    // Track the MCQ attempt (correct/wrong)
    const question = filteredQuestions.find(q => (q.id || `q_${filteredQuestions.indexOf(q)}`) === questionId)
    if (question) {
      const questionSubject = question.subject || question.metadata?.subject || 'Others'
      const isCorrect = optionIndex === question.correct_answer
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
    }
  }
  

  // Handle explanation toggle
  const toggleExplanation = (questionId) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const DropdownButton = ({ label, options, selected, onSelect, show, onToggle }) => (
    <div className="relative dropdown-container">
      <button 
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
      >
        <span>{options.find(opt => opt.id === selected)?.name || label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${show ? 'rotate-180' : ''}`} />
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(option.id)
                onToggle()
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                selected === option.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  )

  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * parseInt(questionsPerPage),
    currentPage * parseInt(questionsPerPage)
  )

  const totalPages = Math.ceil(filteredQuestions.length / parseInt(questionsPerPage))

  return (
    <div className={`flex-1 ${leftMargin} mr-4 flex flex-col h-full overflow-hidden pl-2 pr-2 pb-2`}>
      {/* Main Container */}
      <div className="flex-1 bg-white border border-gray-400 rounded-lg shadow-sm flex flex-col overflow-hidden">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 flex-shrink-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Target className="w-8 h-8 mr-3" style={{ color: theme.colors.primary }} />
                  PYQ Practice
                </h1>
                <p className="text-gray-600 mt-1">
                  Practice with previous year questions from various competitive exams
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                    {isLoading ? '...' : filteredQuestions.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Questions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="flex flex-wrap items-center gap-4">
              <DropdownButton 
                label="Select Exam"
                options={examOptions}
                selected={selectedExam}
                onSelect={setSelectedExam}
                show={showExamDropdown}
                onToggle={() => {
                  setShowExamDropdown(!showExamDropdown)
                  setShowSubjectDropdown(false)
                  setShowYearDropdown(false)
                }}
              />
              <DropdownButton 
                label="Select Subject"
                options={subjectOptions}
                selected={selectedSubject}
                onSelect={setSelectedSubject}
                show={showSubjectDropdown}
                onToggle={() => {
                  setShowSubjectDropdown(!showSubjectDropdown)
                  setShowExamDropdown(false)
                  setShowYearDropdown(false)
                }}
              />
              <DropdownButton 
                label="Select Year"
                options={yearOptions}
                selected={selectedYear}
                onSelect={setSelectedYear}
                show={showYearDropdown}
                onToggle={() => {
                  setShowYearDropdown(!showYearDropdown)
                  setShowExamDropdown(false)
                  setShowSubjectDropdown(false)
                }}
              />
              <select
                value={questionsPerPage}
                onChange={(e) => setQuestionsPerPage(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {questionsPerPageOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading questions...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-red-600 mb-4">
                  <XCircle className="w-12 h-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Questions</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadInitialData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-md">
                <div className="mb-4">
                  <Target className="w-16 h-16 mx-auto text-blue-500 opacity-50" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Ready to Start Practicing?
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  Select your <span className="font-medium text-blue-600">exam</span>, <span className="font-medium text-green-600">subject</span>, or <span className="font-medium text-purple-600">year</span> from the filters above to load previous year questions.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> You can combine multiple filters (e.g., UPSC CSE + History + 2024) to practice specific topics!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Questions List */}
              <div className="space-y-4">
                {paginatedQuestions.map((question, index) => {
                  const questionId = question.id || `fallback_${index}`
                  const userAnswer = userAnswers[questionId]
                  const isRevealed = revealedAnswers[questionId]
                  const isCorrect = userAnswer === question.correct_answer
                  
                  return (
                    <div 
                      key={questionId} 
                      className={`bg-white rounded-lg shadow-sm border ${isRevealed ? (isCorrect ? 'border-green-200' : 'border-red-200') : 'border-gray-200'}`}
                    >
                      {/* Question Header */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base font-medium text-gray-900 flex-1 pr-2">
                            {question.question}
                          </h3>
                          <div className="flex items-center space-x-1">
                            {/* Answer Status Icon */}
                            {isRevealed && (
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {isCorrect ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Options */}
                        <div className="space-y-2 mt-3">
                          {!question.options || question.options.length === 0 ? (
                            <div className="text-sm text-red-600 p-3 bg-red-50 rounded">
                              ⚠️ No options available for this question. Debug: {JSON.stringify(question)}
                            </div>
                          ) : (
                            question.options.map((option, optionIndex) => {
                              const isUserSelected = userAnswer === optionIndex
                              const isCorrectAnswer = question.correct_answer === optionIndex
                              
                              let optionClass = "flex items-start p-3 border rounded-md cursor-pointer transition-colors"
                              
                              // Not revealed yet
                              if (!isRevealed) {
                                optionClass += isUserSelected 
                                  ? " border-blue-500 bg-blue-50" 
                                  : " border-gray-200 hover:bg-gray-50"
                              }
                              // Revealed and this is user's selection
                              else if (isUserSelected) {
                                optionClass += isCorrect
                                  ? " border-green-500 bg-green-50"
                                  : " border-red-500 bg-red-50"
                              }
                              // Revealed and this is the correct answer
                              else if (isCorrectAnswer) {
                                optionClass += " border-green-500 bg-green-50"
                              }
                              // Revealed, not selected, not correct
                              else {
                                optionClass += " border-gray-200"
                              }
                              
                              return (
                                <div 
                                  key={optionIndex}
                                  className={optionClass}
                                  onClick={(e) => {
                                    if (!isRevealed) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleAnswerSelect(questionId, optionIndex);
                                    }
                                  }}
                                >
                                  <div className="flex-shrink-0 mr-3 mt-0.5">
                                    <div className={`w-5 h-5 flex items-center justify-center rounded-full border ${
                                      isUserSelected 
                                        ? 'border-blue-500 bg-blue-500 text-white' 
                                        : 'border-gray-300'
                                    }`}>
                                      {isUserSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                    </div>
                                  </div>
                                  <div className="flex-1 text-sm text-gray-900">
                                    {option}
                                  </div>
                                  {isRevealed && isCorrectAnswer && (
                                    <div className="flex-shrink-0 ml-2">
                                      <div className="w-5 h-5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
                                        ✓
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                        
                        {/* No reveal button: selecting an option immediately checks the answer */}
                      </div>
                      
                      {/* Question Footer with Metadata */}
                      <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
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
                          {isRevealed && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleExplanation(questionId);
                              }}
                              className="text-xs flex items-center space-x-1 transition-all duration-200 px-2 py-1 rounded flex-shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              <span>
                                {expandedExplanations[questionId] ? 'Hide Explanation' : 'Show Explanation'}
                              </span>
                              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedExplanations[questionId] ? 'rotate-180' : ''}`} />
                            </button>
                          )}
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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + Math.max(1, currentPage - 2)
                    if (page > totalPages) return null
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 border rounded-lg ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PYQPractice