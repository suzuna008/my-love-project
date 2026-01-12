// Google Maps and App State
let map;
let placesService;
let autocompleteService;
let markers = [];
let categories = [];
let currentSelectedPlace = null;

// Setup basic event listeners that don't depend on map
function setupBasicEventListeners() {
    // Category management
    const addCategoryBtn = document.getElementById('add-category-btn');
    const createCategoryBtn = document.getElementById('create-category-btn');
    const categoryModalClose = document.querySelector('#category-modal .close');
    
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', openCategoryModal);
    }
    if (createCategoryBtn) {
        createCategoryBtn.addEventListener('click', createCategory);
    }
    if (categoryModalClose) {
        categoryModalClose.addEventListener('click', closeCategoryModal);
    }

    // Spot modal
    const spotModalClose = document.querySelector('#spot-modal .close');
    const saveSpotBtn = document.getElementById('save-spot-btn');
    const floatingSaveBtn = document.getElementById('floating-save-btn');
    
    if (spotModalClose) {
        spotModalClose.addEventListener('click', closeSpotModal);
    }
    if (saveSpotBtn) {
        saveSpotBtn.addEventListener('click', saveSpotToCategory);
    }
    if (floatingSaveBtn) {
        floatingSaveBtn.addEventListener('click', openSpotModal);
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const categoryModal = document.getElementById('category-modal');
        const spotModal = document.getElementById('spot-modal');
        if (e.target === categoryModal) {
            closeCategoryModal();
        }
        if (e.target === spotModal) {
            closeSpotModal();
        }
    });
}

// Initialize the app
function initMap() {
    // Default location (San Francisco)
    const defaultLocation = { lat: 37.7749, lng: -122.4194 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 13,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    placesService = new google.maps.places.PlacesService(map);
    autocompleteService = new google.maps.places.AutocompleteService();

    // Load saved data from localStorage
    loadData();

    // Event listeners (map-dependent)
    setupEventListeners();

    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(userLocation);
                map.setZoom(14);
            },
            () => {
                console.log('Geolocation failed, using default location');
            }
        );
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    let autocompleteTimeout;

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const dropdown = document.getElementById('autocomplete-dropdown');
            if (dropdown && dropdown.classList.contains('show') && currentHighlightedIndex >= 0) {
                // If an item is highlighted, select it
                selectAutocompleteItem(currentHighlightedIndex);
            } else {
                // Otherwise perform normal search
                hideAutocomplete();
                performSearch();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightAutocompleteItem(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightAutocompleteItem(-1);
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });

    // Autocomplete as user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(autocompleteTimeout);
        
        if (query.length < 2) {
            hideAutocomplete();
            return;
        }

        // Debounce autocomplete requests
        autocompleteTimeout = setTimeout(() => {
            getAutocompleteSuggestions(query);
        }, 300);
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideAutocomplete();
        }
    });

    // Hide autocomplete when search input loses focus (with delay to allow clicks)
    searchInput.addEventListener('blur', () => {
        setTimeout(() => hideAutocomplete(), 200);
    });

    // Note: Basic event listeners (buttons, modals) are set up in setupBasicEventListeners()
    // which is called regardless of map initialization

    // Map click to add marker (only if map is initialized)
    if (map) {
        map.addListener('click', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            reverseGeocode(lat, lng);
        });
    }
}

// Autocomplete functionality
let currentHighlightedIndex = -1;
let autocompletePredictions = [];

function getAutocompleteSuggestions(query) {
    if (!autocompleteService) return;

    autocompleteService.getPlacePredictions(
        {
            input: query,
            types: ['establishment', 'geocode'],
            location: map.getCenter(),
            radius: 50000
        },
        (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                autocompletePredictions = predictions;
                displayAutocomplete(predictions);
            } else {
                hideAutocomplete();
            }
        }
    );
}

function displayAutocomplete(predictions) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (!dropdown) return;

    if (predictions.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-no-results">No suggestions found</div>';
        dropdown.classList.add('show');
        return;
    }

    dropdown.innerHTML = predictions.map((prediction, index) => {
        const mainText = prediction.structured_formatting.main_text;
        const secondaryText = prediction.structured_formatting.secondary_text || '';
        const types = prediction.types || [];
        const typeLabel = types.length > 0 ? types[0].replace(/_/g, ' ') : '';

        return `
            <div class="autocomplete-item" data-index="${index}" data-place-id="${prediction.place_id}">
                <span class="autocomplete-item-icon">📍</span>
                <div class="autocomplete-item-content">
                    <div class="autocomplete-item-name">${escapeHtml(mainText)}</div>
                    ${secondaryText ? `<div class="autocomplete-item-address">${escapeHtml(secondaryText)}</div>` : ''}
                    ${typeLabel ? `<div class="autocomplete-item-type">${escapeHtml(typeLabel)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            selectAutocompleteItem(index);
        });
    });

    dropdown.classList.add('show');
    currentHighlightedIndex = -1;
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    currentHighlightedIndex = -1;
    autocompletePredictions = [];
}

function highlightAutocompleteItem(direction) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (!dropdown || !dropdown.classList.contains('show')) return;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    // Remove previous highlight
    if (currentHighlightedIndex >= 0 && items[currentHighlightedIndex]) {
        items[currentHighlightedIndex].classList.remove('highlighted');
    }

    // Calculate new index
    currentHighlightedIndex += direction;
    if (currentHighlightedIndex < 0) {
        currentHighlightedIndex = items.length - 1;
    } else if (currentHighlightedIndex >= items.length) {
        currentHighlightedIndex = 0;
    }

    // Add highlight
    if (items[currentHighlightedIndex]) {
        items[currentHighlightedIndex].classList.add('highlighted');
        items[currentHighlightedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function selectAutocompleteItem(index) {
    if (!autocompletePredictions[index]) return;

    const prediction = autocompletePredictions[index];
    const searchInput = document.getElementById('search-input');
    
    // Set input value
    searchInput.value = prediction.description;
    
    // Hide autocomplete
    hideAutocomplete();
    
    // Get place details and show on map
    getPlaceDetails(prediction.place_id);
}

function getPlaceDetails(placeId) {
    const request = {
        placeId: placeId,
        fields: ['name', 'geometry', 'formatted_address', 'place_id']
    };

    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            showPlaceOnMap(place);
        } else {
            // Fallback to text search
            performSearch();
        }
    });
}

// Perform search
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    hideAutocomplete();

    const request = {
        query: query,
        fields: ['name', 'geometry', 'formatted_address', 'place_id']
    };

    placesService.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
            const place = results[0];
            showPlaceOnMap(place);
        } else {
            alert('No results found. Please try a different search.');
        }
    });
}

// Show place on map
function showPlaceOnMap(place) {
    // Hide autocomplete if visible
    hideAutocomplete();
    
    // Clear existing markers
    clearMarkers();

    // Center map on place
    map.setCenter(place.geometry.location);
    map.setZoom(16);

    // Add marker (not a saved spot marker)
    const marker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
        animation: google.maps.Animation.DROP
    });
    
    marker.isSavedSpot = false;
    markers.push(marker);

    // Store current place
    // Handle both LatLng objects (with .lat()/.lng() methods) and plain objects (with .lat/.lng properties)
    const location = place.geometry.location;
    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
    
    currentSelectedPlace = {
        name: place.name,
        address: place.formatted_address,
        lat: lat,
        lng: lng,
        placeId: place.place_id
    };

    // Show floating save button
    showFloatingSaveButton();

    // Show info window
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 0.5rem;">
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${place.name}</h3>
                <p style="margin: 0; color: #666; font-size: 0.875rem;">${place.formatted_address}</p>
                <button onclick="openSpotModal()" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                    <span>💾</span> Save Spot
                </button>
            </div>
        `
    });

    infoWindow.open(map, marker);

    // Make openSpotModal available globally
    // window.openSpotModal = () => {
    //     openSpotModal();
    //     infoWindow.close();
    // };
}

// Reverse geocode (for map clicks)
function reverseGeocode(lat, lng) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const place = {
                name: results[0].formatted_address.split(',')[0],
                formatted_address: results[0].formatted_address,
                geometry: {
                    location: { lat, lng }
                },
                place_id: results[0].place_id
            };
            showPlaceOnMap(place);
        }
    });
}

// Clear markers
function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    hideFloatingSaveButton();
}

// Show/hide floating save button
function showFloatingSaveButton() {
    const btn = document.getElementById('floating-save-btn');
    if (btn) {
        btn.classList.add('show');
    }
}

function hideFloatingSaveButton() {
    const btn = document.getElementById('floating-save-btn');
    if (btn) {
        btn.classList.remove('show');
    }
    currentSelectedPlace = null;
}

// Category Management
function openCategoryModal() {
    document.getElementById('category-modal').style.display = 'block';
    document.getElementById('category-name-input').focus();
}

function closeCategoryModal() {
    document.getElementById('category-modal').style.display = 'none';
    document.getElementById('category-name-input').value = '';
}

function createCategory() {
    const name = document.getElementById('category-name-input').value.trim();
    if (!name) {
        alert('Please enter a category name');
        return;
    }

    // Check if category already exists
    if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        alert('Category already exists');
        return;
    }

    const category = {
        id: Date.now().toString(),
        name: name,
        spots: []
    };

    categories.push(category);
    saveData();
    renderCategories();
    closeCategoryModal();
}

function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category? All spots in it will be removed.')) {
        categories = categories.filter(cat => cat.id !== categoryId);
        saveData();
        renderCategories();
        // Remove markers for deleted category
        updateMarkers();
    }
}

// Spot Management
function openSpotModal() {
    if (!currentSelectedPlace) {
        alert('Please select a place first');
        return;
    }

    document.getElementById('spot-name').textContent = currentSelectedPlace.name;
    document.getElementById('spot-address').textContent = currentSelectedPlace.address;

    // Populate category select
    const categorySelect = document.getElementById('category-select');
    categorySelect.innerHTML = '<option value="">Select a category...</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });

    document.getElementById('spot-modal').style.display = 'block';
}

function closeSpotModal() {
    document.getElementById('spot-modal').style.display = 'none';
    // Don't hide the floating button when closing modal, keep it visible
}

function saveSpotToCategory() {
    try {
        if (!currentSelectedPlace) {
            alert('Please select a place first');
            return;
        }

        const categorySelect = document.getElementById('category-select');
        if (!categorySelect) {
            console.error('Category select element not found');
            return;
        }

        const categoryId = categorySelect.value;
        if (!categoryId) {
            alert('Please select a category');
            return;
        }

        const category = categories.find(cat => cat.id === categoryId);
        if (!category) {
            console.error('Category not found:', categoryId);
            return;
        }

        // Check if spot already exists in this category
        const existingSpot = category.spots.find(
            spot => spot.placeId === currentSelectedPlace.placeId
        );

        if (existingSpot) {
            alert('This spot is already saved in this category');
            return;
        }

        // Add spot to category
        category.spots.push({
            id: Date.now().toString(),
            name: currentSelectedPlace.name,
            address: currentSelectedPlace.address,
            lat: currentSelectedPlace.lat,
            lng: currentSelectedPlace.lng,
            placeId: currentSelectedPlace.placeId
        });

        saveData();
        renderCategories();
        updateMarkers();
        closeSpotModal();
        
        // Show success message
        showSuccessMessage('Spot saved successfully!');
        
        // Keep the floating button visible
        showFloatingSaveButton();
    } catch (error) {
        console.error('Error saving spot:', error);
        alert('An error occurred while saving the spot. Please try again.');
    }
}

function deleteSpot(categoryId, spotId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    category.spots = category.spots.filter(spot => spot.id !== spotId);
    saveData();
    renderCategories();
    updateMarkers();
}

// Render Categories
function renderCategories() {
    const categoriesList = document.getElementById('categories-list');
    
    if (categories.length === 0) {
        categoriesList.innerHTML = `
            <div class="empty-state">
                <p>No categories yet</p>
                <p>Click the + button to create one</p>
            </div>
        `;
        return;
    }

    categoriesList.innerHTML = categories.map(category => `
        <div class="category-item" data-category-id="${category.id}">
            <div class="category-header" onclick="toggleCategory('${category.id}')">
                <span class="category-name">${escapeHtml(category.name)}</span>
                <div class="category-actions">
                    <button class="category-delete-btn" onclick="event.stopPropagation(); deleteCategory('${category.id}')" title="Delete category">🗑️</button>
                </div>
            </div>
            <div class="spots-list">
                ${category.spots.length === 0 
                    ? '<div style="padding: 0.75rem 1rem 0.75rem 2rem; color: #999; font-size: 0.875rem;">No spots saved yet</div>'
                    : category.spots.map(spot => `
                        <div class="spot-item" onclick="showSpotOnMap(${spot.lat}, ${spot.lng}, '${escapeHtml(spot.name)}')">
                            <span class="spot-name">${escapeHtml(spot.name)}</span>
                            <button class="spot-delete-btn" onclick="event.stopPropagation(); deleteSpot('${category.id}', '${spot.id}')" title="Delete spot">🗑️</button>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `).join('');

    // Restore expanded state
    categories.forEach(category => {
        const categoryElement = document.querySelector(`[data-category-id="${category.id}"]`);
        if (categoryElement && category.expanded) {
            categoryElement.classList.add('expanded');
        }
    });
}

function toggleCategory(categoryId) {
    const categoryElement = document.querySelector(`[data-category-id="${categoryId}"]`);
    const category = categories.find(cat => cat.id === categoryId);
    
    if (categoryElement) {
        categoryElement.classList.toggle('expanded');
        if (category) {
            category.expanded = categoryElement.classList.contains('expanded');
            saveData();
        }
    }
}

function showSpotOnMap(lat, lng, name) {
    if (!map) {
        alert('Map is not available. Please check your Google Maps API key.');
        return;
    }
    
    map.setCenter({ lat, lng });
    map.setZoom(16);

    // Clear existing markers
    clearMarkers();

    // Add marker for this spot (not a saved spot marker)
    const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: name,
        animation: google.maps.Animation.DROP
    });
    
    marker.isSavedSpot = false;
    markers.push(marker);
    
    // Set current selected place for potential saving
    currentSelectedPlace = {
        name: name,
        address: '',
        lat: lat,
        lng: lng,
        placeId: ''
    };
    
    showFloatingSaveButton();

    const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 0.5rem;"><h3 style="margin: 0; font-size: 1rem;">${escapeHtml(name)}</h3></div>`
    });

    infoWindow.open(map, marker);
}

// Update markers on map (for saved spots)
function updateMarkers() {
    if (!map) return; // Don't update markers if map isn't initialized
    
    // Only clear saved spot markers, not the current selected marker
    const savedMarkers = markers.filter(m => m.isSavedSpot);
    savedMarkers.forEach(marker => marker.setMap(null));
    markers = markers.filter(m => !m.isSavedSpot);
    
    categories.forEach(category => {
        category.spots.forEach(spot => {
            const marker = new google.maps.Marker({
                position: { lat: spot.lat, lng: spot.lng },
                map: map,
                title: spot.name,
                label: {
                    text: category.name.charAt(0).toUpperCase(),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold'
                },
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }
            });
            
            // Mark as saved spot
            marker.isSavedSpot = true;

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 0.5rem;">
                        <h3 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${escapeHtml(spot.name)}</h3>
                        <p style="margin: 0; color: #666; font-size: 0.875rem;">${escapeHtml(spot.address)}</p>
                        <p style="margin: 0.25rem 0 0 0; color: #4285f4; font-size: 0.75rem;">Category: ${escapeHtml(category.name)}</p>
                    </div>
                `
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            markers.push(marker);
        });
    });
}

// Data persistence
function saveData() {
    localStorage.setItem('favoriteSpots_categories', JSON.stringify(categories));
}

function loadData() {
    const saved = localStorage.getItem('favoriteSpots_categories');
    if (saved) {
        try {
            categories = JSON.parse(saved);
            renderCategories();
            updateMarkers();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

// Show success message
function showSuccessMessage(message) {
    const notification = document.getElementById('success-notification');
    const messageEl = document.getElementById('success-message');
    if (notification && messageEl) {
        messageEl.textContent = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    } else {
        // Fallback to alert if notification element doesn't exist
        alert(message);
    }
}

// Utility function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.toggleCategory = toggleCategory;
window.deleteCategory = deleteCategory;
window.deleteSpot = deleteSpot;
window.showSpotOnMap = showSpotOnMap;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Setup basic event listeners first (these work even without map)
    setupBasicEventListeners();
    
    // Load and render categories (works without map)
    const saved = localStorage.getItem('favoriteSpots_categories');
    if (saved) {
        try {
            categories = JSON.parse(saved);
            renderCategories();
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
    
    // Check if Google Maps API is loaded
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
    } else {
        console.error('Google Maps API not loaded. Please check your API key.');
        document.getElementById('map').innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; color: #666;">
                <div style="text-align: center; padding: 2rem;">
                    <h2>Google Maps API Key Required</h2>
                    <p>Please add your Google Maps API key to the script tag in index.html</p>
                    <p style="font-size: 0.875rem; margin-top: 0.5rem;">Replace YOUR_API_KEY with your actual API key</p>
                </div>
            </div>
        `;
    }
});
