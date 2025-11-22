import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiService from '../services/api';

const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }) => {
  const { 
    currentUser, 
    getDashboardStats, 
    saveDashboardStats, 
    trackUserInteraction,
    trackSubjectInteraction,
    getSubjectStats,
    saveSubjectStats,
    getRecentActivity,
    getUserAchievements,
    getUserLearningGoals,
    saveAchievement,
    saveLearningGoal,
    updateLearningGoalProgress
  } = useAuth();

  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalChats: 0,
      totalQuestions: 0,
      totalMcqAttempted: 0,
      mcqCorrect: 0,
      mcqWrong: 0,
      mcqAccuracy: 0
    },
    subjectStats: [],
    achievements: [],
    learningGoals: [],
    recentActivity: [],
    loading: true,
    error: null
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!currentUser) {
      setDashboardData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }));

      // Get data from Firebase
      const [
        firebaseStats,
        firebaseSubjectStats,
        firebaseAchievements,
        firebaseLearningGoals,
        firebaseActivity
      ] = await Promise.all([
        getDashboardStats(),
        getSubjectStats(),
        getUserAchievements(),
        getUserLearningGoals(),
        getRecentActivity(10)
      ]);

      // Calculate accuracy if we have MCQ data
      const stats = firebaseStats || {
        totalChats: 0,
        totalQuestions: 0,
        totalMcqAttempted: 0,
        mcqCorrect: 0,
        mcqWrong: 0,
        mcqAccuracy: 0
      };

      if (stats.totalMcqAttempted > 0) {
        stats.mcqAccuracy = Math.round((stats.mcqCorrect / stats.totalMcqAttempted) * 100);
      }

      setDashboardData({
        stats,
        subjectStats: firebaseSubjectStats || [],
        achievements: firebaseAchievements || [],
        learningGoals: firebaseLearningGoals || [],
        recentActivity: firebaseActivity || [],
        loading: false,
        error: null
      });

      console.log('✅ Dashboard data loaded from Firebase');
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Refresh dashboard data
  const refreshDashboardData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Track user interaction and update stats
  const trackInteraction = async (type, data = {}) => {
    if (!currentUser) return;

    try {
      const subject = data.subject || 'Others';
      
      // Track subject-specific interaction (this also tracks general interaction)
      await trackSubjectInteraction(subject, type, data);

      // Update global stats based on interaction type
      const currentStats = dashboardData.stats;
      let newStats = { ...currentStats };

      switch (type) {
        case 'chat':
          newStats.totalChats = (currentStats.totalChats || 0) + 1;
          break;
        case 'question':
          newStats.totalQuestions = (currentStats.totalQuestions || 0) + 1;
          break;
        case 'mcq_attempt':
          newStats.totalMcqAttempted = (currentStats.totalMcqAttempted || 0) + 1;
          break;
        case 'mcq_correct':
          newStats.mcqCorrect = (currentStats.mcqCorrect || 0) + 1;
          newStats.totalMcqAttempted = (currentStats.totalMcqAttempted || 0) + 1;
          break;
        case 'mcq_wrong':
          newStats.mcqWrong = (currentStats.mcqWrong || 0) + 1;
          newStats.totalMcqAttempted = (currentStats.totalMcqAttempted || 0) + 1;
          break;
      }

      // Recalculate accuracy
      if (newStats.totalMcqAttempted > 0) {
        newStats.mcqAccuracy = Math.round((newStats.mcqCorrect / newStats.totalMcqAttempted) * 100);
      }

      // Save updated stats to Firebase
      await saveDashboardStats(newStats);

      // Refresh dashboard data
      refreshDashboardData();
      
      console.log('✅ Interaction tracked and stats updated:', type, 'for subject:', subject);
    } catch (error) {
      console.error('❌ Error tracking interaction:', error);
    }
  };

  // Update specific stats
  const updateStats = async (newStats) => {
    if (!currentUser) return;

    try {
      // Merge with existing stats
      const currentStats = dashboardData.stats;
      const mergedStats = { ...currentStats, ...newStats };

      // Recalculate accuracy if MCQ data is updated
      if (mergedStats.totalMcqAttempted > 0) {
        mergedStats.mcqAccuracy = Math.round((mergedStats.mcqCorrect / mergedStats.totalMcqAttempted) * 100);
      }

      // Save to Firebase
      await saveDashboardStats(mergedStats);
      
      // Refresh dashboard data
      refreshDashboardData();
      
      console.log('✅ Stats updated:', newStats);
    } catch (error) {
      console.error('❌ Error updating stats:', error);
    }
  };

  // Add new achievement
  const addAchievement = async (achievement) => {
    if (!currentUser) return;

    try {
      await saveAchievement(achievement);
      refreshDashboardData();
      console.log('✅ Achievement added:', achievement.title);
    } catch (error) {
      console.error('❌ Error adding achievement:', error);
    }
  };

  // Add new learning goal
  const addLearningGoal = async (goal) => {
    if (!currentUser) return;

    try {
      const goalId = await saveLearningGoal(goal);
      refreshDashboardData();
      console.log('✅ Learning goal added:', goal.title);
      return goalId;
    } catch (error) {
      console.error('❌ Error adding learning goal:', error);
    }
  };

  // Update learning goal progress
  const updateGoalProgress = async (goalId, progress) => {
    if (!currentUser) return;

    try {
      await updateLearningGoalProgress(goalId, progress);
      refreshDashboardData();
      console.log('✅ Goal progress updated');
    } catch (error) {
      console.error('❌ Error updating goal progress:', error);
    }
  };

  // Load data on mount and when refresh is triggered
  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger, currentUser]);

  const value = {
    ...dashboardData,
    refreshDashboardData,
    trackInteraction,
    updateStats,
    loadDashboardData,
    addAchievement,
    addLearningGoal,
    updateGoalProgress
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardContext;
