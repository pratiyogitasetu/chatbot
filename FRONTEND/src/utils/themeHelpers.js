/**
 * Theme Helper Utilities
 * Provides consistent theme-aware styling across components
 */

/**
 * Get background color based on theme mode
 * @param {string} mode - 'dark' or 'light'
 * @param {string} variant - 'primary', 'secondary', 'card', 'modal'
 * @returns {string} - The background color
 */
export const getBackgroundColor = (mode, variant = 'primary') => {
  const colors = {
    dark: {
      primary: '#000000',
      secondary: '#1a1a1a',
      card: '#0d0d0d',
      modal: '#1f1f1f',
      overlay: 'rgba(0, 0, 0, 0.8)'
    },
    light: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      card: '#fafafa',
      modal: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)'
    }
  }
  
  return colors[mode]?.[variant] || colors.dark.primary
}

/**
 * Get text color based on theme mode
 * @param {string} mode - 'dark' or 'light'
 * @param {string} variant - 'primary', 'secondary', 'muted', 'accent'
 * @returns {string} - The text color
 */
export const getTextColor = (mode, variant = 'primary') => {
  const colors = {
    dark: {
      primary: '#BAFF39',
      secondary: '#ffffff',
      muted: 'rgba(186, 255, 57, 0.7)',
      accent: '#FF921C',
      inverse: '#000000'
    },
    light: {
      primary: '#000000',
      secondary: '#000000',
      muted: 'rgba(0, 0, 0, 0.7)',
      accent: '#d97706',
      inverse: '#ffffff'
    }
  }
  
  return colors[mode]?.[variant] || colors.dark.primary
}

/**
 * Get border color based on theme mode
 * @param {string} mode - 'dark' or 'light'
 * @param {string} variant - 'primary', 'secondary', 'accent'
 * @returns {string} - The border color
 */
export const getBorderColor = (mode, variant = 'primary') => {
  const colors = {
    dark: {
      primary: '#BAFF39',
      secondary: 'rgba(186, 255, 57, 0.3)',
      accent: '#FF921C',
      muted: 'rgba(186, 255, 57, 0.2)'
    },
    light: {
      primary: '#d0d0d0',
      secondary: 'rgba(186, 255, 57, 0.4)',
      accent: '#d97706',
      muted: '#e0e0e0'
    }
  }
  
  return colors[mode]?.[variant] || colors.dark.primary
}

/**
 * Get hover background color based on theme mode
 * @param {string} mode - 'dark' or 'light'
 * @returns {string} - The hover background color
 */
export const getHoverBg = (mode) => {
  return mode === 'dark' ? 'rgba(186, 255, 57, 0.1)' : 'rgba(186, 255, 57, 0.15)'
}

/**
 * Get accent color (primary theme color)
 * @returns {string} - The accent color
 */
export const getAccentColor = () => {
  return '#BAFF39'
}

/**
 * Get complete theme object for a component
 * @param {string} mode - 'dark' or 'light'
 * @returns {object} - Complete theme object
 */
export const getThemeColors = (mode) => {
  return {
    background: {
      primary: getBackgroundColor(mode, 'primary'),
      secondary: getBackgroundColor(mode, 'secondary'),
      card: getBackgroundColor(mode, 'card'),
      modal: getBackgroundColor(mode, 'modal'),
      overlay: getBackgroundColor(mode, 'overlay')
    },
    text: {
      primary: getTextColor(mode, 'primary'),
      secondary: getTextColor(mode, 'secondary'),
      muted: getTextColor(mode, 'muted'),
      accent: getTextColor(mode, 'accent'),
      inverse: getTextColor(mode, 'inverse')
    },
    border: {
      primary: getBorderColor(mode, 'primary'),
      secondary: getBorderColor(mode, 'secondary'),
      accent: getBorderColor(mode, 'accent'),
      muted: getBorderColor(mode, 'muted')
    },
    hover: getHoverBg(mode),
    accent: getAccentColor()
  }
}
