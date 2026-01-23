# FleetMaxx Site Locator

A modern React web application for finding petrol stations that accept various fuel cards.

## Features

- 🔍 **Search Functionality**: Search stations by name, city, or address
- 🎯 **Fuel Card Filtering**: Filter stations by specific fuel cards (Esso Fleet, Shell CRT, UK Fuels, etc.)
- 📋 **List View**: Browse stations in a clean, card-based list view
- 🗺️ **Map View**: View stations on a map (basic implementation)
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Data Source

The application currently uses `stations_data.json` which was converted from the Excel file `fleetmaxx_fuelcard_stations.xlsx`. 

When you're ready to connect to a database, you can:
1. Replace the JSON import in `src/App.jsx` with an API call
2. Update the data fetching logic to use your backend API

## Supported Fuel Cards

The application supports filtering by the following fuel cards:
- Esso Fleet
- Esso Maxx
- FastFuels
- FuelGenie
- KeyFuels
- Shell CRT
- Shell Fleet
- UK Fuels
- Applegreen
- ASDA Express
- BP
- Esso
- Jet
- Phillips 66 Limited
- And more...

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── StationCard.jsx      # Individual station card component
│   │   ├── StationCard.css
│   │   ├── MapView.jsx           # Map view component
│   │   └── MapView.css
│   ├── utils/
│   │   └── dataProcessor.js      # Data processing utilities
│   ├── App.jsx                    # Main application component
│   ├── App.css                    # Main application styles
│   ├── main.jsx                   # Application entry point
│   └── index.css                  # Global styles
├── stations_data.json             # Station data (converted from Excel)
├── package.json
└── vite.config.js
```

## Future Enhancements

- Interactive map with Leaflet or Google Maps
- Distance-based sorting
- Location-based search (using geolocation)
- Export results to CSV
- Favorites/bookmarks functionality
- Advanced filtering (by region, network, etc.)

## License

ISC
