import React, { useState, useEffect } from 'react'
import { Clock as ClockIcon, Calendar } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

const Clock = ({ isMobile = false }) => {
  const { theme } = useTheme()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
    return date.toLocaleTimeString('en-US', options)
  }

  const formatDate = (date) => {
    const options = {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }
    return date.toLocaleDateString('en-US', options)
  }

  const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: '2-digit',
      day: '2-digit'
    })
  }

  if (isMobile) {
    return (
      <div 
        className="flex items-center space-x-0.5 px-1 py-0.5 rounded-md shadow-sm" 
        style={{ 
          backgroundColor: 'rgba(186, 255, 57, 0.15)', 
          border: '1px solid rgba(186, 255, 57, 0.3)' 
        }}
      >
        <div className="flex items-center space-x-0.5">
          <ClockIcon className="w-2 h-2" style={{ color: '#000000' }} />
          <span 
            className="text-[8px] font-semibold whitespace-nowrap font-mono"
            style={{ color: '#000000' }}
          >
            {formatTime(currentTime)}
          </span>
        </div>
        <span 
          className="text-[8px]"
          style={{ color: '#000000', opacity: 0.6 }}
        >
          /
        </span>
        <div className="flex items-center space-x-0.5">
          <Calendar className="w-2 h-2" style={{ color: '#000000' }} />
          <span 
            className="text-[8px] whitespace-nowrap"
            style={{ color: '#000000', opacity: 0.8 }}
          >
            {formatDateShort(currentTime)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md shadow-sm" 
      style={{ 
        backgroundColor: 'rgba(186, 255, 57, 0.15)', 
        border: '1px solid rgba(186, 255, 57, 0.3)' 
      }}
    >
      <div className="flex items-center space-x-0.5">
        <ClockIcon className="w-2.5 h-2.5" style={{ color: '#000000' }} />
        <span 
          className="text-[10px] font-semibold whitespace-nowrap font-mono"
          style={{ color: '#000000' }}
        >
          {formatTime(currentTime)}
        </span>
      </div>
      <span 
        className="text-[10px]"
        style={{ color: '#000000', opacity: 0.6 }}
      >
        /
      </span>
      <div className="flex items-center space-x-0.5">
        <Calendar className="w-2.5 h-2.5" style={{ color: '#000000' }} />
        <span 
          className="text-[10px] whitespace-nowrap"
          style={{ color: '#000000', opacity: 0.9 }}
        >
          {formatDate(currentTime)}
        </span>
      </div>
    </div>
  )
}

export default Clock
