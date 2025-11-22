# NCERT + PYQ Chatbot Frontend

A modern, responsive React frontend for the NCERT + PYQ (Previous Year Questions) chatbot system. Built with React, Tailwind CSS, and integrated with a Flask backend.

## Features

✅ **Modern UI Components**
- Clean, responsive design with Tailwind CSS
- Collapsible sidebar with search history
- Interactive chat interface
- Previous Year Questions section with filtering
- Dynamic theming with custom color picker

✅ **Backend Integration**
- API integration with Flask backend
- Real-time search and response generation
- Question filtering by exam and subject
- System health monitoring

✅ **Interactive Features**
- Subject-specific search
- Collapsible panels (sidebar and PYQ section)
- Dynamic color theming
- Loading states and error handling

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+ with pip
- API keys for Groq and Pinecone (optional for development)

### Development Setup

1. **Install Dependencies**
   ```bash
   # Install frontend dependencies
   cd FRONTEND
   npm install
   
   # Install backend dependencies (from project root)
   pip install -r requirements.txt
   ```

2. **Start Development Environment**
   ```bash
   # From project root
   chmod +x dev-start.sh
   ./dev-start.sh
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### Manual Setup

**Backend:**
```bash
cd server
python3 react_app.py
```

**Frontend:**
```bash
cd FRONTEND
npm run dev
```
- **Responsive Design**: Modern UI with green gradient theme

## Layout Components

### 1. Navbar
- Fixed top navigation with green theme
- Navigation links (Home, Dashboard, About Us, Contact)
- User authentication buttons and profile section

### 2. Sidebar
- Left sidebar with vertical green gradient
- New Chat button
- Search history with input field
- Bottom action buttons (Books, PYQs, What's New, Help)

### 3. Chat Section
- Main chat area with user and bot messages
- Source citations for bot responses
- Floating input bar for new questions

### 4. PYQ Section
- Right panel for question browsing
- Filter options for exams and subjects
- Question cards with options and metadata
- Solution button and explanation area

### 5. Floating Search Bar
- Bottom-right floating search for questions
- Subject dropdown and search input

## Tech Stack

- **React 18** - Frontend framework
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Vite** - Build tool and development server

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Color Scheme

- Primary Green: `#059669`
- Secondary Green: `#10b981`
- Light Green: `#d1fae5`
- Dark Green: `#047857`
- Chat Gray: `#f3f4f6`
- Chat White: `#ffffff`

## Project Structure

```
src/
├── components/
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   ├── ChatSection.jsx
│   ├── PYQSection.jsx
│   └── FloatingSearchBar.jsx
├── App.jsx
├── main.jsx
└── index.css
```
