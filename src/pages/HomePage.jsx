import React from 'react'
import { Link } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-content">
          <h1 className="home-title">
            <span className="home-icon">🚗</span>
            Fuel Card Site Locator
          </h1>
          <p className="home-subtitle">
            Find petrol stations that accept your fuel card
          </p>
          <p className="home-description">
            Search thousands of stations across the UK. Compare fuel card coverage, 
            find stations along your route, and discover the best options for your fleet.
          </p>
          
          <Link to="/site-locator" className="home-cta-btn">
            <svg className="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Start Searching
          </Link>
          
          <div className="home-features">
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Interactive Map</h3>
              <p>View stations on an interactive map with real-time filtering</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3>Fuel Card Comparison</h3>
              <p>Compare coverage across multiple fuel cards instantly</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Route Planning</h3>
              <p>Draw custom routes and find stations along your journey</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Location-Based Search</h3>
              <p>Search by postcode or use your current location</p>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="home-footer">
        <p>&copy; 2026 Fuel Card Site Locator. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default HomePage
