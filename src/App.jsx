import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SiteLocatorPage from './pages/SiteLocatorPage'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/site-locator" element={<SiteLocatorPage />} />
      </Routes>
    </Router>
  )
}

export default App
