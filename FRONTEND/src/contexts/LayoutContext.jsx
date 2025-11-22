import React, { createContext, useContext, useState } from 'react'

const LayoutContext = createContext()

export const useLayout = () => {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

export const LayoutProvider = ({ children }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [pyqVisible, setPyqVisible] = useState(false)

  const toggleSidebar = () => setSidebarVisible(!sidebarVisible)
  const togglePyq = () => setPyqVisible(!pyqVisible)

  return (
    <LayoutContext.Provider value={{
      sidebarVisible,
      pyqVisible,
      toggleSidebar,
      togglePyq
    }}>
      {children}
    </LayoutContext.Provider>
  )
}
