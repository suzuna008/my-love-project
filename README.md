# My Favorite Spots - Google Maps Web App

A beautiful web application to help you save and organize your favorite spots on Google Maps. Search for places, create categories, and save your favorite locations in organized folders.

## Features

- 🔍 **Search Places**: Search for any location on Google Maps
- 📍 **Save Spots**: Click on the map or search results to save locations
- 📁 **Category Management**: Create custom categories (e.g., Cafe, Restaurant) to organize your spots
- 🗺️ **Visual Markers**: See all your saved spots as markers on the map
- 💾 **Local Storage**: All your data is saved locally in your browser
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
4. Create credentials (API Key)
5. Copy your API key

### 2. Add Your API Key

Open `index.html` and replace `YOUR_API_KEY` with your actual Google Maps API key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
```

### 3. Run the Application

Simply open `index.html` in your web browser. No build process or server required!

Alternatively, you can use a local server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server
```

Then open `http://localhost:8000` in your browser.

## How to Use

1. **Search for Places**: Type a location in the search bar and click "Search" or press Enter
2. **Create Categories**: Click the "+" button next to "Categories" to create a new category
3. **Save Spots**: 
   - After searching or clicking on the map, click "Save Spot" in the info window
   - Select a category and click "Save Spot"
4. **View Saved Spots**: Click on a category to expand it and see all saved spots
5. **Navigate to Spots**: Click on any saved spot in the sidebar to view it on the map
6. **Delete Items**: Click the trash icon to delete categories or spots

## Technologies Used

- HTML5
- CSS3 (with modern features like flexbox and animations)
- JavaScript (Vanilla JS)
- Google Maps JavaScript API
- Google Places API
- LocalStorage for data persistence

## Browser Support

Works in all modern browsers that support:
- ES6 JavaScript
- LocalStorage
- Google Maps JavaScript API

## License

This project is open source and available for personal use.
