// Google Maps and App State
let map;
let placesService;
let autocompleteService;
let markers = [];
let categories = [];
let currentSelectedPlace = null;
let showPOIs = true; // Show Points of Interest by default

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

    // POI toggle button
    const togglePOIBtn = document.getElementById('toggle-poi-btn');
    if (togglePOIBtn) {
        togglePOIBtn.textContent = showPOIs ? '📍 Hide Places' : '📍 Show Places';
        togglePOIBtn.classList.toggle('active', showPOIs);
        togglePOIBtn.addEventListener('click', togglePOIVisibility);
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

// Get map styles based on POI visibility setting
function getMapStyles() {
    if (showPOIs) {
        // Show POIs - return empty array for default styling
        return [];
    } else {
        // Hide POI labels but keep POI icons visible
        return [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ];
    }
}

// Toggle POI visibility
function togglePOIVisibility() {
    showPOIs = !showPOIs;
    if (map) {
        map.setOptions({ styles: getMapStyles() });
    }
    
    // Update button text and icon
    const toggleBtn = document.getElementById('toggle-poi-btn');
    if (toggleBtn) {
        toggleBtn.textContent = showPOIs ? '📍 Hide Places' : '📍 Show Places';
        toggleBtn.classList.toggle('active', showPOIs);
    }
    
    // Save preference
    localStorage.setItem('favoriteSpots_showPOIs', JSON.stringify(showPOIs));
    
    showSuccessMessage(showPOIs ? 'Places are now visible' : 'Places are now hidden');
}

// Initialize the app
function initMap() {
    // Default location (San Francisco)
    const defaultLocation = { lat: 37.7749, lng: -122.4194 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultLocation,
        zoom: 13,
        styles: getMapStyles()
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
    const isMobile = window.innerWidth <= 768;
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: ${isMobile ? '0.75rem' : '0.5rem'};">
                <h3 style="margin: 0 0 0.5rem 0; font-size: ${isMobile ? '0.95rem' : '1rem'};">${place.name}</h3>
                <p style="margin: 0; color: #666; font-size: ${isMobile ? '0.8rem' : '0.875rem'};">${place.formatted_address}</p>
                <button onclick="openSpotModal()" style="margin-top: 0.5rem; padding: ${isMobile ? '0.625rem 0.875rem' : '0.5rem 1rem'}; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: ${isMobile ? '0.875rem' : '1rem'};">
                    <span>💾</span> Save Spot
                </button>
            </div>
        `,
        maxWidth: isMobile ? Math.min(300, window.innerWidth - 40) : 350
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
            const placeId = results[0].place_id;
            
            // Try to get actual place details using Places API if we have a place_id
            if (placeId && placesService) {
                getPlaceDetailsById(placeId, (placeDetails) => {
                    if (placeDetails && placeDetails.name) {
                        // Use the place details we fetched
                        const place = {
                            name: placeDetails.name,
                            formatted_address: placeDetails.address || results[0].formatted_address,
                            geometry: {
                                location: { lat, lng }
                            },
                            place_id: placeId
                        };
                        showPlaceOnMap(place);
                    } else {
                        // Fallback: try to find nearby places
                        fetchPlaceDetailsByLocation(lat, lng, (nearbyPlace) => {
                            if (nearbyPlace && nearbyPlace.name) {
                                const place = {
                                    name: nearbyPlace.name,
                                    formatted_address: nearbyPlace.address || results[0].formatted_address,
                                    geometry: {
                                        location: { lat, lng }
                                    },
                                    place_id: nearbyPlace.placeId || placeId
                                };
                                showPlaceOnMap(place);
                            } else {
                                // Last resort: use address
                                const place = {
                                    name: results[0].formatted_address.split(',')[0],
                                    formatted_address: results[0].formatted_address,
                                    geometry: {
                                        location: { lat, lng }
                                    },
                                    place_id: placeId
                                };
                                showPlaceOnMap(place);
                            }
                        });
                    }
                });
            } else {
                // No place_id, try nearby search
                fetchPlaceDetailsByLocation(lat, lng, (nearbyPlace) => {
                    if (nearbyPlace && nearbyPlace.name) {
                        const place = {
                            name: nearbyPlace.name,
                            formatted_address: nearbyPlace.address || results[0].formatted_address,
                            geometry: {
                                location: { lat, lng }
                            },
                            place_id: nearbyPlace.placeId || ''
                        };
                        showPlaceOnMap(place);
                    } else {
                        // Fallback to address
                        const place = {
                            name: results[0].formatted_address.split(',')[0],
                            formatted_address: results[0].formatted_address,
                            geometry: {
                                location: { lat, lng }
                            },
                            place_id: results[0].place_id || ''
                        };
                        showPlaceOnMap(place);
                    }
                });
            }
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

function moveCategoryUp(categoryId) {
    const index = categories.findIndex(cat => cat.id === categoryId);
    if (index > 0) {
        [categories[index - 1], categories[index]] = [categories[index], categories[index - 1]];
        saveData();
        renderCategories();
        showSuccessMessage('Category moved up!');
    }
}

function moveCategoryDown(categoryId) {
    const index = categories.findIndex(cat => cat.id === categoryId);
    if (index < categories.length - 1) {
        [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
        saveData();
        renderCategories();
        showSuccessMessage('Category moved down!');
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

function moveSpotUp(categoryId, spotId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const index = category.spots.findIndex(spot => spot.id === spotId);
    if (index > 0) {
        [category.spots[index - 1], category.spots[index]] = [category.spots[index], category.spots[index - 1]];
        saveData();
        renderCategories();
        showSuccessMessage('Spot moved up!');
    }
}

function moveSpotDown(categoryId, spotId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const index = category.spots.findIndex(spot => spot.id === spotId);
    if (index < category.spots.length - 1) {
        [category.spots[index], category.spots[index + 1]] = [category.spots[index + 1], category.spots[index]];
        saveData();
        renderCategories();
        showSuccessMessage('Spot moved down!');
    }
}

function editSpotName(categoryId, spotId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const spot = category.spots.find(s => s.id === spotId);
    if (!spot) return;

    const spotNameElement = document.querySelector(`[data-category-id="${categoryId}"][data-spot-id="${spotId}"]`);
    if (!spotNameElement) return;

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'spot-name-input';
    input.value = spot.name;
    input.style.width = '100%';
    input.style.padding = '0.25rem';
    input.style.border = '2px solid #4285f4';
    input.style.borderRadius = '4px';
    input.style.fontSize = '0.9rem';
    input.style.outline = 'none';

    // Replace span with input
    const parent = spotNameElement.parentElement;
    parent.replaceChild(input, spotNameElement);
    input.focus();
    input.select();

    // Save on Enter
    const saveEdit = () => {
        const newName = input.value.trim();
        if (newName && newName !== spot.name) {
            spot.name = newName;
            saveData();
            renderCategories();
            updateMarkers();
            showSuccessMessage('Spot name updated!');
        } else if (!newName) {
            // If empty, restore original name
            renderCategories();
        } else {
            // If unchanged, just restore
            renderCategories();
        }
    };

    // Cancel on Escape
    const cancelEdit = () => {
        renderCategories();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
        }
    });

    input.addEventListener('blur', () => {
        saveEdit();
    });

    // Prevent click event from bubbling to parent
    input.addEventListener('click', (e) => {
        e.stopPropagation();
    });
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

    categoriesList.innerHTML = categories.map((category, categoryIndex) => `
        <div class="category-item" data-category-id="${category.id}" draggable="true">
            <div class="category-header" onclick="toggleCategory('${category.id}')">
                <span class="category-drag-handle" title="Drag to reorder">⋮⋮</span>
                <span class="category-name">${escapeHtml(category.name)}</span>
                <div class="category-actions">
                    <div class="category-order-buttons">
                        <button class="category-order-btn" onclick="event.stopPropagation(); moveCategoryUp('${category.id}')" title="Move up" ${categoryIndex === 0 ? 'disabled' : ''}>▲</button>
                        <button class="category-order-btn" onclick="event.stopPropagation(); moveCategoryDown('${category.id}')" title="Move down" ${categoryIndex === categories.length - 1 ? 'disabled' : ''}>▼</button>
                    </div>
                    <button class="category-delete-btn" onclick="event.stopPropagation(); deleteCategory('${category.id}')" title="Delete category">🗑️</button>
                </div>
            </div>
            <div class="spots-list">
                ${category.spots.length === 0 
                    ? '<div style="padding: 0.75rem 1rem 0.75rem 2rem; color: #999; font-size: 0.875rem;">No spots saved yet</div>'
                    : category.spots.map((spot, spotIndex) => `
                        <div class="spot-item" data-category-id="${category.id}" data-spot-id="${spot.id}" draggable="true" data-spot-lat="${spot.lat}" data-spot-lng="${spot.lng}" data-spot-name="${escapeHtml(spot.name)}" data-spot-place-id="${spot.placeId || ''}">
                            <span class="spot-drag-handle" title="Drag to reorder">⋮⋮</span>
                            <span class="spot-name" data-category-id="${category.id}" data-spot-id="${spot.id}">${escapeHtml(spot.name)}</span>
                            <div class="spot-actions">
                                <div class="spot-order-buttons">
                                    <button class="spot-order-btn" onclick="event.stopPropagation(); moveSpotUp('${category.id}', '${spot.id}')" title="Move up" ${spotIndex === 0 ? 'disabled' : ''}>▲</button>
                                    <button class="spot-order-btn" onclick="event.stopPropagation(); moveSpotDown('${category.id}', '${spot.id}')" title="Move down" ${spotIndex === category.spots.length - 1 ? 'disabled' : ''}>▼</button>
                                </div>
                                <button class="spot-edit-btn" onclick="event.stopPropagation(); editSpotName('${category.id}', '${spot.id}')" title="Edit spot name">✏️</button>
                                <button class="spot-delete-btn" onclick="event.stopPropagation(); deleteSpot('${category.id}', '${spot.id}')" title="Delete spot">🗑️</button>
                            </div>
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

    // Setup drag and drop event listeners
    setupDragAndDrop();
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

// Drag and Drop functionality
let draggedElement = null;
let draggedElementType = null; // 'category' or 'spot'
let draggedCategoryId = null;
let draggedSpotId = null;

function setupDragAndDrop() {
    // Category drag handlers
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('dragstart', handleCategoryDragStart);
        item.addEventListener('dragover', handleCategoryDragOver);
        item.addEventListener('drop', handleCategoryDrop);
        item.addEventListener('dragend', handleCategoryDragEnd);
    });

    // Spot drag handlers
    const spotItems = document.querySelectorAll('.spot-item');
    spotItems.forEach(item => {
        item.addEventListener('dragstart', handleSpotDragStart);
        item.addEventListener('dragover', handleSpotDragOver);
        item.addEventListener('drop', handleSpotDrop);
        item.addEventListener('dragend', handleSpotDragEnd);
        
        // Click handler for showing spot on map (only if not dragging)
        let isDragging = false;
        item.addEventListener('mousedown', () => {
            isDragging = false;
        });
        item.addEventListener('mousemove', () => {
            isDragging = true;
        });
        item.addEventListener('click', (e) => {
            // Don't navigate if clicking on buttons or drag handle
            if (e.target.closest('.spot-actions') || e.target.closest('.spot-drag-handle')) {
                return;
            }
            // Don't navigate if we just dragged
            if (isDragging) {
                isDragging = false;
                return;
            }
            const lat = parseFloat(item.getAttribute('data-spot-lat'));
            const lng = parseFloat(item.getAttribute('data-spot-lng'));
            const name = item.getAttribute('data-spot-name');
            const placeId = item.getAttribute('data-spot-place-id');
            if (lat && lng && name) {
                showSpotOnMap(lat, lng, name, placeId);
            }
        });
    });
}

function handleCategoryDragStart(e) {
    draggedElement = this;
    draggedElementType = 'category';
    draggedCategoryId = this.getAttribute('data-category-id');
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleCategoryDragOver(e) {
    if (draggedElementType === 'category' && draggedElement !== this) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const rect = this.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
            this.classList.add('drag-over-top');
            this.classList.remove('drag-over-bottom');
        } else {
            this.classList.add('drag-over-bottom');
            this.classList.remove('drag-over-top');
        }
    }
}

function handleCategoryDrop(e) {
    if (draggedElementType === 'category' && draggedElement !== this) {
        e.preventDefault();
        e.stopPropagation();
        
        const targetCategoryId = this.getAttribute('data-category-id');
        const draggedIndex = categories.findIndex(cat => cat.id === draggedCategoryId);
        const targetIndex = categories.findIndex(cat => cat.id === targetCategoryId);
        
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            // Remove dragged item
            const [draggedCategory] = categories.splice(draggedIndex, 1);
            
            // Insert at new position
            const newIndex = e.clientY < midpoint ? targetIndex : targetIndex + 1;
            categories.splice(newIndex, 0, draggedCategory);
            
            saveData();
            renderCategories();
            showSuccessMessage('Category reordered!');
        }
    }
    
    // Clean up
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

function handleCategoryDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedElement = null;
    draggedElementType = null;
    draggedCategoryId = null;
}

function handleSpotDragStart(e) {
    draggedElement = this;
    draggedElementType = 'spot';
    draggedCategoryId = this.getAttribute('data-category-id');
    draggedSpotId = this.getAttribute('data-spot-id');
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    e.stopPropagation(); // Prevent category toggle
}

function handleSpotDragOver(e) {
    if (draggedElementType === 'spot' && draggedElement !== this) {
        const targetCategoryId = this.getAttribute('data-category-id');
        
        // Only allow dragging within the same category
        if (targetCategoryId === draggedCategoryId) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                this.classList.add('drag-over-top');
                this.classList.remove('drag-over-bottom');
            } else {
                this.classList.add('drag-over-bottom');
                this.classList.remove('drag-over-top');
            }
        }
    }
}

function handleSpotDrop(e) {
    if (draggedElementType === 'spot' && draggedElement !== this) {
        const targetCategoryId = this.getAttribute('data-category-id');
        const targetSpotId = this.getAttribute('data-spot-id');
        
        // Only allow dropping within the same category
        if (targetCategoryId === draggedCategoryId) {
            e.preventDefault();
            e.stopPropagation();
            
            const category = categories.find(cat => cat.id === draggedCategoryId);
            if (!category) return;
            
            const draggedIndex = category.spots.findIndex(spot => spot.id === draggedSpotId);
            const targetIndex = category.spots.findIndex(spot => spot.id === targetSpotId);
            
            if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
                const rect = this.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                // Remove dragged item
                const [draggedSpot] = category.spots.splice(draggedIndex, 1);
                
                // Insert at new position
                const newIndex = e.clientY < midpoint ? targetIndex : targetIndex + 1;
                category.spots.splice(newIndex, 0, draggedSpot);
                
                saveData();
                renderCategories();
                showSuccessMessage('Spot reordered!');
            }
        }
    }
    
    // Clean up
    document.querySelectorAll('.spot-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
}

function handleSpotDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.spot-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedElement = null;
    draggedElementType = null;
    draggedCategoryId = null;
    draggedSpotId = null;
}

// Format place types to readable labels
function formatPlaceType(types) {
    if (!types || types.length === 0) return 'Place';
    
    // Filter out generic types
    const excludeTypes = ['point_of_interest', 'establishment', 'geocode', 'premise'];
    const filteredTypes = types.filter(type => !excludeTypes.includes(type));
    
    if (filteredTypes.length === 0) {
        return 'Place';
    }
    
    // Map common types to readable labels
    const typeMap = {
        'restaurant': 'Restaurant',
        'cafe': 'Cafe',
        'bar': 'Bar',
        'lodging': 'Hotel',
        'park': 'Park',
        'museum': 'Museum',
        'shopping_mall': 'Shopping Mall',
        'store': 'Store',
        'gas_station': 'Gas Station',
        'hospital': 'Hospital',
        'school': 'School',
        'church': 'Church',
        'tourist_attraction': 'Tourist Attraction',
        'amusement_park': 'Amusement Park',
        'zoo': 'Zoo',
        'aquarium': 'Aquarium',
        'library': 'Library',
        'gym': 'Gym',
        'pharmacy': 'Pharmacy',
        'bank': 'Bank',
        'atm': 'ATM',
        'subway_station': 'Subway Station',
        'bus_station': 'Bus Station',
        'airport': 'Airport',
        'movie_theater': 'Movie Theater',
        'night_club': 'Night Club',
        'spa': 'Spa',
        'beauty_salon': 'Beauty Salon'
    };
    
    // Return the first meaningful type, formatted nicely
    const primaryType = filteredTypes[0];
    return typeMap[primaryType] || primaryType.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Fetch place details by coordinates
function fetchPlaceDetailsByLocation(lat, lng, callback) {
    if (!placesService) {
        callback(null);
        return;
    }
    
    // First try to find nearby places - use a reasonable radius
    const request = {
        location: new google.maps.LatLng(lat, lng),
        radius: 100, // 100 meters - reasonable radius to find nearby establishments
        type: ['establishment', 'point_of_interest']
    };
    
    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Score and sort results
            const placesWithScore = results.map(place => {
                const placeLat = place.geometry.location.lat();
                const placeLng = place.geometry.location.lng();
                const distance = getDistance(lat, lng, placeLat, placeLng);
                
                // Check if it's an address (not a business)
                const isAddress = place.name && (
                    place.name.match(/^\d+[-chōme]/) || // Japanese address pattern
                    place.name.match(/^\d+\s+[A-Z]/) || // Starts with number and street name
                    place.name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i) ||
                    (place.types && place.types.every(type => 
                        type === 'street_address' || 
                        type === 'premise' || 
                        type === 'subpremise' ||
                        type === 'geocode' ||
                        type === 'route'
                    ))
                );
                
                // Check if it's a real business/establishment
                const isBusiness = place.types && place.types.some(type => 
                    type === 'lodging' ||
                    type === 'restaurant' ||
                    type === 'cafe' ||
                    type === 'bar' ||
                    type === 'store' ||
                    type === 'shopping_mall' ||
                    type === 'museum' ||
                    type === 'park' ||
                    type === 'tourist_attraction' ||
                    type === 'establishment' ||
                    type === 'point_of_interest'
                );
                
                // Score: higher is better
                let score = 0;
                if (isBusiness && !isAddress) score += 1000; // Business gets very high priority
                if (!isAddress && place.name) score += 500; // Not an address and has a name
                if (place.name && place.name.length > 3) score += 100; // Has a meaningful name
                score -= distance * 10; // Closer is better (subtract distance in meters * 10)
                
                return {
                    place: place,
                    distance: distance,
                    score: score,
                    isBusiness: isBusiness && !isAddress
                };
            });
            
            // Sort by score (highest first), prioritizing businesses
            placesWithScore.sort((a, b) => {
                if (a.isBusiness !== b.isBusiness) {
                    return b.isBusiness - a.isBusiness; // Business first
                }
                return b.score - a.score; // Higher score first
            });
            
            // Try the best matches (top 3) and use the first one that's close enough
            for (let i = 0; i < Math.min(3, placesWithScore.length); i++) {
                const match = placesWithScore[i];
                if (match.distance < 0.15) { // Within 150 meters
                    getPlaceDetailsById(match.place.place_id, callback);
                    return;
                }
            }
            
            // If no good match found, try with larger radius
            fetchPlaceDetailsWithLargerRadius(lat, lng, callback);
        } else {
            // Try with a larger radius
            fetchPlaceDetailsWithLargerRadius(lat, lng, callback);
        }
    });
}

// Try with a larger radius if initial search fails
function fetchPlaceDetailsWithLargerRadius(lat, lng, callback) {
    if (!placesService) {
        reverseGeocodeForDetails(lat, lng, callback);
        return;
    }
    
    const request = {
        location: new google.maps.LatLng(lat, lng),
        radius: 200, // 200 meters - larger radius
        type: ['establishment', 'point_of_interest']
    };
    
    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Find establishments (not just addresses)
            const establishments = results.filter(place => {
                const isAddress = place.name && (
                    place.name.match(/^\d+[-chōme]/) ||
                    place.name.match(/^\d+\s+[A-Z]/) ||
                    place.name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i) ||
                    (place.types && place.types.every(type => 
                        type === 'street_address' || 
                        type === 'premise' || 
                        type === 'subpremise' ||
                        type === 'geocode' ||
                        type === 'route'
                    ))
                );
                
                const isBusiness = place.types && place.types.some(type => 
                    type === 'lodging' ||
                    type === 'restaurant' ||
                    type === 'cafe' ||
                    type === 'bar' ||
                    type === 'store' ||
                    type === 'shopping_mall' ||
                    type === 'museum' ||
                    type === 'park' ||
                    type === 'tourist_attraction' ||
                    type === 'establishment' ||
                    type === 'point_of_interest'
                );
                
                return !isAddress && (isBusiness || (place.name && place.name.length > 3));
            });
            
            if (establishments.length > 0) {
                // Find closest establishment
                let closest = establishments[0];
                let minDist = getDistance(lat, lng, 
                    closest.geometry.location.lat(), 
                    closest.geometry.location.lng());
                
                establishments.forEach(place => {
                    const dist = getDistance(lat, lng, 
                        place.geometry.location.lat(), 
                        place.geometry.location.lng());
                    if (dist < minDist) {
                        minDist = dist;
                        closest = place;
                    }
                });
                
                if (minDist < 0.2) { // Within 200 meters
                    getPlaceDetailsById(closest.place_id, callback);
                    return;
                }
            }
            
            // If no good establishment found, try the closest result anyway
            let closestPlace = results[0];
            let minDistance = getDistance(lat, lng, 
                closestPlace.geometry.location.lat(), 
                closestPlace.geometry.location.lng());
            
            results.forEach(place => {
                const placeLat = place.geometry.location.lat();
                const placeLng = place.geometry.location.lng();
                const distance = getDistance(lat, lng, placeLat, placeLng);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPlace = place;
                }
            });
            
            if (minDistance < 0.2) {
                getPlaceDetailsById(closestPlace.place_id, callback);
            } else {
                reverseGeocodeForDetails(lat, lng, callback);
            }
        } else {
            reverseGeocodeForDetails(lat, lng, callback);
        }
    });
}

// Get place details by place ID
function getPlaceDetailsById(placeId, callback) {
    if (!placesService || !placeId) {
        callback(null);
        return;
    }
    
    const request = {
        placeId: placeId,
        fields: [
            'name', 
            'formatted_address', 
            'types', 
            'geometry', 
            'place_id',
            'photos',
            'reviews',
            'rating',
            'user_ratings_total',
            'price_level',
            'website',
            'formatted_phone_number',
            'opening_hours'
        ]
    };
    
    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            // Get photo URL if available
            let photoUrl = null;
            if (place.photos && place.photos.length > 0) {
                photoUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
            }
            
            // Format reviews
            const reviews = place.reviews ? place.reviews.slice(0, 3).map(review => ({
                author_name: review.author_name,
                rating: review.rating,
                text: review.text,
                relative_time_description: review.relative_time_description,
                profile_photo_url: review.profile_photo_url
            })) : [];
            
            callback({
                name: place.name,
                address: place.formatted_address || '',
                types: place.types || [],
                placeId: place.place_id,
                photoUrl: photoUrl,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                reviews: reviews,
                price_level: place.price_level,
                website: place.website,
                phone: place.formatted_phone_number,
                opening_hours: place.opening_hours
            });
        } else {
            callback(null);
        }
    });
}

// Reverse geocode to get address
function reverseGeocodeForDetails(lat, lng, callback) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
            // Look for a result that has a place_id and is an establishment
            let bestResult = results[0];
            
            for (const result of results) {
                // Prefer results that have establishment types
                const hasEstablishmentType = result.types && result.types.some(type => 
                    type === 'establishment' || 
                    type === 'point_of_interest' ||
                    (type !== 'street_address' && type !== 'premise' && type !== 'subpremise' && type !== 'geocode')
                );
                
                if (hasEstablishmentType && result.place_id) {
                    bestResult = result;
                    break;
                }
            }
            
            // If we have a place_id, try to get full place details
            if (bestResult.place_id && placesService) {
                getPlaceDetailsById(bestResult.place_id, (placeDetails) => {
                    if (placeDetails && placeDetails.name && 
                        !placeDetails.name.match(/^\d+\s+[A-Z]/)) {
                        // Got a good place with a business name
                        callback(placeDetails);
                    } else {
                        // Try text search as last resort
                        tryTextSearchNearLocation(lat, lng, callback, bestResult);
                    }
                });
            } else {
                // Try text search
                tryTextSearchNearLocation(lat, lng, callback, bestResult);
            }
        } else {
            callback(null);
        }
    });
}

// Try text search near the location as a last resort
function tryTextSearchNearLocation(lat, lng, callback, fallbackResult) {
    if (!placesService) {
        if (fallbackResult) {
            callback({
                name: fallbackResult.formatted_address.split(',')[0],
                address: fallbackResult.formatted_address,
                types: fallbackResult.types || [],
                placeId: fallbackResult.place_id || ''
            });
        } else {
            callback(null);
        }
        return;
    }
    
    // Use the address from geocoding to search for the place
    const address = fallbackResult ? fallbackResult.formatted_address : '';
    const addressParts = address.split(',');
    const streetAddress = addressParts[0] || '';
    
    // Try searching with the street address
    const request = {
        query: streetAddress,
        location: new google.maps.LatLng(lat, lng),
        radius: 100
    };
    
    placesService.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Find the closest match
            let closest = results[0];
            let minDist = getDistance(lat, lng, 
                closest.geometry.location.lat(), 
                closest.geometry.location.lng());
            
            results.forEach(place => {
                const dist = getDistance(lat, lng, 
                    place.geometry.location.lat(), 
                    place.geometry.location.lng());
                if (dist < minDist) {
                    minDist = dist;
                    closest = place;
                }
            });
            
            if (minDist < 0.1) { // Within 100 meters
                getPlaceDetailsById(closest.place_id, callback);
            } else if (fallbackResult) {
                callback({
                    name: fallbackResult.formatted_address.split(',')[0],
                    address: fallbackResult.formatted_address,
                    types: fallbackResult.types || [],
                    placeId: fallbackResult.place_id || ''
                });
            } else {
                callback(null);
            }
        } else if (fallbackResult) {
            callback({
                name: fallbackResult.formatted_address.split(',')[0],
                address: fallbackResult.formatted_address,
                types: fallbackResult.types || [],
                placeId: fallbackResult.place_id || ''
            });
        } else {
            callback(null);
        }
    });
}

// Calculate distance between two coordinates (in km)
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Update info window with place details
function updateInfoWindowWithDetails(infoWindow, marker, placeDetails, spot, categoryName) {
    // Determine the best name to display - prefer business names over addresses
    let displayName = spot.name;
    if (placeDetails && placeDetails.name) {
        // Check if placeDetails.name is an address pattern
        const isAddressPattern = placeDetails.name.match(/^\d+[-chōme]/) ||
            placeDetails.name.match(/^\d+\s+[A-Z]/) ||
            placeDetails.name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i);
        
        // Check if the original spot name looks like a business name
        const originalIsBusiness = spot.name && 
            !spot.name.match(/^\d+[-chōme]/) &&
            !spot.name.match(/^\d+\s+[A-Z]/) &&
            !spot.name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i);
        
        // Use placeDetails.name if it's not an address, or if original name is an address
        if (!isAddressPattern || !originalIsBusiness) {
            displayName = placeDetails.name;
        }
    }
    
    let content = `
        <div style="padding: 0; min-width: 280px; max-width: 90vw; max-width: 400px; max-height: 70vh; overflow-y: auto;">
    `;
    
        const isMobileView = window.innerWidth <= 768;
        const photoHeight = isMobileView ? '150px' : '200px';
        const baseFontSize = isMobileView ? '0.85rem' : '0.875rem';
        const headingFontSize = isMobileView ? '1rem' : '1.1rem';
        const padding = isMobileView ? '0.625rem' : '0.75rem';
        
        // Photo
        if (placeDetails && placeDetails.photoUrl) {
            content += `
                <img src="${placeDetails.photoUrl}" style="width: 100%; height: ${photoHeight}; object-fit: cover; border-radius: 8px 8px 0 0;" alt="${escapeHtml(displayName)}">
            `;
        }
        
        content += `
                <div style="padding: ${padding};">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: ${headingFontSize}; font-weight: 600;">${escapeHtml(displayName)}</h3>
        `;
    
    // Rating
    if (placeDetails && placeDetails.rating) {
        const stars = '★'.repeat(Math.round(placeDetails.rating)) + '☆'.repeat(5 - Math.round(placeDetails.rating));
        const ratingsText = placeDetails.user_ratings_total 
            ? ` (${placeDetails.user_ratings_total} reviews)`
            : '';
        content += `
            <div style="margin-bottom: 0.5rem;">
                <span style="color: #ffa500; font-size: 0.9rem;">${stars}</span>
                <span style="color: #666; font-size: 0.875rem; margin-left: 0.5rem;">${placeDetails.rating.toFixed(1)}${ratingsText}</span>
            </div>
        `;
    }
    
    // Place type badge
    if (placeDetails && placeDetails.types && placeDetails.types.length > 0) {
        const placeType = formatPlaceType(placeDetails.types);
        content += `
            <div style="margin-bottom: 0.5rem;">
                <span style="display: inline-block; background: #4285f4; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${escapeHtml(placeType)}</span>
            </div>
        `;
    }
    
    // Address
    const address = placeDetails ? (placeDetails.address || spot.address) : spot.address;
    if (address) {
        content += `
            <p style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.875rem; line-height: 1.4;">📍 ${escapeHtml(address)}</p>
        `;
    }
    
    // Phone
    if (placeDetails && placeDetails.phone) {
        content += `
            <p style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.875rem;">📞 ${escapeHtml(placeDetails.phone)}</p>
        `;
    }
    
    // Website
    if (placeDetails && placeDetails.website) {
        content += `
            <p style="margin: 0 0 0.5rem 0; font-size: 0.875rem;">
                <a href="${placeDetails.website}" target="_blank" style="color: #4285f4; text-decoration: none;">🌐 Visit Website</a>
            </p>
        `;
    }
    
    // Opening hours
    if (placeDetails && placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
        const isOpen = placeDetails.opening_hours.open_now;
        content += `
            <div style="margin: 0.5rem 0; padding: 0.5rem; background: #f8f9fa; border-radius: 4px;">
                <p style="margin: 0 0 0.25rem 0; font-size: 0.875rem; font-weight: 500;">
                    ${isOpen ? '<span style="color: #4caf50;">●</span> Open now' : '<span style="color: #dc3545;">●</span> Closed now'}
                </p>
                <details style="font-size: 0.75rem; color: #666;">
                    <summary style="cursor: pointer; margin-top: 0.25rem;">View hours</summary>
                    <div style="margin-top: 0.5rem;">
                        ${placeDetails.opening_hours.weekday_text.map(day => `<div>${escapeHtml(day)}</div>`).join('')}
                    </div>
                </details>
            </div>
        `;
    }
    
    // Reviews
    if (placeDetails && placeDetails.reviews && placeDetails.reviews.length > 0) {
        content += `
            <div style="margin-top: 0.75rem; border-top: 1px solid #e0e0e0; padding-top: 0.75rem;">
                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 600;">Recent Reviews</h4>
        `;
        
        placeDetails.reviews.forEach(review => {
            const reviewStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const reviewText = review.text.length > 150 ? review.text.substring(0, 150) + '...' : review.text;
            content += `
                <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f0f0f0;">
                    <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                        ${review.profile_photo_url ? `<img src="${review.profile_photo_url}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 0.5rem;" alt="${escapeHtml(review.author_name)}">` : ''}
                        <span style="font-weight: 500; font-size: 0.875rem;">${escapeHtml(review.author_name)}</span>
                        <span style="margin-left: auto; color: #999; font-size: 0.75rem;">${escapeHtml(review.relative_time_description)}</span>
                    </div>
                    <div style="color: #ffa500; font-size: 0.75rem; margin-bottom: 0.25rem;">${reviewStars}</div>
                    <p style="margin: 0; color: #666; font-size: 0.875rem; line-height: 1.4;">${escapeHtml(reviewText)}</p>
                </div>
            `;
        });
        
        content += `</div>`;
    }
    
    // Category
    content += `
            <p style="margin: 0.75rem 0 0 0; padding-top: 0.75rem; border-top: 1px solid #e0e0e0; color: #4285f4; font-size: 0.75rem; font-weight: 500;">📁 ${escapeHtml(categoryName)}</p>
        </div>
    </div>
    `;
    
    infoWindow.setContent(content);
}

function showSpotOnMap(lat, lng, name, placeId = null) {
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
    
    // Show loading info window first
    const isMobile = window.innerWidth <= 768;
    const loadingInfoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: ${isMobile ? '0.75rem' : '0.5rem'};">
                <h3 style="margin: 0 0 0.5rem 0; font-size: ${isMobile ? '0.95rem' : '1rem'};">${escapeHtml(name)}</h3>
                <p style="margin: 0; color: #999; font-size: ${isMobile ? '0.8rem' : '0.875rem'};">Loading details...</p>
            </div>
        `,
        maxWidth: isMobile ? Math.min(300, window.innerWidth - 40) : 350
    });
    loadingInfoWindow.open(map, marker);
    
    // Fetch place details - use placeId if available for precise results
    const fetchDetails = placeId && placeId.trim() 
        ? (callback) => getPlaceDetailsById(placeId, callback)
        : (callback) => fetchPlaceDetailsByLocation(lat, lng, callback);
    
    fetchDetails((placeDetails) => {
        // Determine the best name to display
        let displayName = name;
        if (placeDetails && placeDetails.name) {
            // Check if placeDetails.name is an address pattern
            const isAddressPattern = placeDetails.name.match(/^\d+[-chōme]/) ||
                placeDetails.name.match(/^\d+\s+[A-Z]/) ||
                placeDetails.name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i);
            
            // Check if the original name looks like a business name
            const originalIsBusiness = name && 
                !name.match(/^\d+[-chōme]/) &&
                !name.match(/^\d+\s+[A-Z]/) &&
                !name.match(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)/i);
            
            // Use placeDetails.name if it's not an address, or if original name is an address
            if (!isAddressPattern || !originalIsBusiness) {
                displayName = placeDetails.name;
            }
        }
        
        const isMobileView = window.innerWidth <= 768;
        const photoHeight = isMobileView ? '150px' : '200px';
        const baseFontSize = isMobileView ? '0.85rem' : '0.875rem';
        const headingFontSize = isMobileView ? '1rem' : '1.1rem';
        const smallFontSize = isMobileView ? '0.75rem' : '0.875rem';
        const padding = isMobileView ? '0.625rem' : '0.75rem';
        
        let content = `
            <div style="padding: 0; min-width: 280px; max-width: 90vw; max-width: 400px; max-height: 70vh; overflow-y: auto;">
        `;
        
        // Photo
        if (placeDetails && placeDetails.photoUrl) {
            content += `
                <img src="${placeDetails.photoUrl}" style="width: 100%; height: ${photoHeight}; object-fit: cover; border-radius: 8px 8px 0 0;" alt="${escapeHtml(displayName)}">
            `;
        }
        
        content += `
                <div style="padding: ${padding};">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: ${headingFontSize}; font-weight: 600;">${escapeHtml(displayName)}</h3>
        `;
        
        // Rating
        if (placeDetails && placeDetails.rating) {
            const stars = '★'.repeat(Math.round(placeDetails.rating)) + '☆'.repeat(5 - Math.round(placeDetails.rating));
            const ratingsText = placeDetails.user_ratings_total 
                ? ` (${placeDetails.user_ratings_total} reviews)`
                : '';
            content += `
                <div style="margin-bottom: 0.5rem;">
                    <span style="color: #ffa500; font-size: ${isMobileView ? '0.8rem' : '0.9rem'};">${stars}</span>
                    <span style="color: #666; font-size: ${baseFontSize}; margin-left: 0.5rem;">${placeDetails.rating.toFixed(1)}${ratingsText}</span>
                </div>
            `;
        }
        
        // Place type
        if (placeDetails && placeDetails.types && placeDetails.types.length > 0) {
            const placeType = formatPlaceType(placeDetails.types);
            content += `
                <div style="margin-bottom: 0.5rem;">
                    <span style="display: inline-block; background: #4285f4; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: ${isMobileView ? '0.7rem' : '0.75rem'}; font-weight: 500;">${escapeHtml(placeType)}</span>
                </div>
            `;
        }
        
        // Address
        if (placeDetails && placeDetails.address) {
            content += `
                <p style="margin: 0 0 0.5rem 0; color: #666; font-size: ${baseFontSize}; line-height: 1.4;">📍 ${escapeHtml(placeDetails.address)}</p>
            `;
        }
        
        // Phone
        if (placeDetails && placeDetails.phone) {
            content += `
                <p style="margin: 0 0 0.5rem 0; color: #666; font-size: ${baseFontSize};">📞 ${escapeHtml(placeDetails.phone)}</p>
            `;
        }
        
        // Website
        if (placeDetails && placeDetails.website) {
            content += `
                <p style="margin: 0 0 0.5rem 0; font-size: ${baseFontSize};">
                    <a href="${placeDetails.website}" target="_blank" style="color: #4285f4; text-decoration: none;">🌐 Visit Website</a>
                </p>
            `;
        }
        
        // Opening hours
        if (placeDetails && placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
            const isOpen = placeDetails.opening_hours.open_now;
            content += `
                <div style="margin: 0.5rem 0; padding: 0.5rem; background: #f8f9fa; border-radius: 4px;">
                    <p style="margin: 0 0 0.25rem 0; font-size: ${baseFontSize}; font-weight: 500;">
                        ${isOpen ? '<span style="color: #4caf50;">●</span> Open now' : '<span style="color: #dc3545;">●</span> Closed now'}
                    </p>
                    <details style="font-size: ${isMobileView ? '0.7rem' : '0.75rem'}; color: #666;">
                        <summary style="cursor: pointer; margin-top: 0.25rem;">View hours</summary>
                        <div style="margin-top: 0.5rem;">
                            ${placeDetails.opening_hours.weekday_text.map(day => `<div style="font-size: ${isMobileView ? '0.7rem' : '0.75rem'};">${escapeHtml(day)}</div>`).join('')}
                        </div>
                    </details>
                </div>
            `;
        }
        
        // Reviews
        if (placeDetails && placeDetails.reviews && placeDetails.reviews.length > 0) {
            content += `
                <div style="margin-top: 0.75rem; border-top: 1px solid #e0e0e0; padding-top: 0.75rem;">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: ${isMobileView ? '0.85rem' : '0.9rem'}; font-weight: 600;">Recent Reviews</h4>
            `;
            
            placeDetails.reviews.forEach(review => {
                const reviewStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                const reviewTextLength = isMobileView ? 100 : 150;
                const reviewText = review.text.length > reviewTextLength ? review.text.substring(0, reviewTextLength) + '...' : review.text;
                content += `
                    <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f0f0f0;">
                        <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                            ${review.profile_photo_url ? `<img src="${review.profile_photo_url}" style="width: ${isMobileView ? '20px' : '24px'}; height: ${isMobileView ? '20px' : '24px'}; border-radius: 50%; margin-right: 0.5rem;" alt="${escapeHtml(review.author_name)}">` : ''}
                            <span style="font-weight: 500; font-size: ${baseFontSize};">${escapeHtml(review.author_name)}</span>
                            <span style="margin-left: auto; color: #999; font-size: ${isMobileView ? '0.7rem' : '0.75rem'};">${escapeHtml(review.relative_time_description)}</span>
                        </div>
                        <div style="color: #ffa500; font-size: ${isMobileView ? '0.7rem' : '0.75rem'}; margin-bottom: 0.25rem;">${reviewStars}</div>
                        <p style="margin: 0; color: #666; font-size: ${baseFontSize}; line-height: 1.4;">${escapeHtml(reviewText)}</p>
                    </div>
                `;
            });
            
            content += `</div>`;
        }
        
        content += `
                </div>
            </div>
        `;
        
        // Detect mobile screen for info window sizing
        const infoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: isMobileView ? Math.min(350, window.innerWidth - 40) : 400
        });
        
        infoWindow.open(map, marker);
    });
    
    // Set current selected place for potential saving
    currentSelectedPlace = {
        name: name,
        address: '',
        lat: lat,
        lng: lng,
        placeId: placeId || ''
    };
    
    showFloatingSaveButton();
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
            
            // Store spot data on marker for later use
            marker.spotData = {
                name: spot.name,
                address: spot.address,
                lat: spot.lat,
                lng: spot.lng,
                placeId: spot.placeId,
                categoryName: category.name
            };

            // Create initial info window (will be updated with place details)
            const initialContent = `
                <div style="padding: 0.75rem; min-width: 250px;">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 600;">${escapeHtml(spot.name)}</h3>
                    <p style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.875rem; line-height: 1.4;">${spot.address ? `📍 ${escapeHtml(spot.address)}` : ''}</p>
                    <p style="margin: 0; color: #4285f4; font-size: 0.75rem; font-weight: 500;">📁 ${escapeHtml(category.name)}</p>
                    <p style="margin: 0.5rem 0 0 0; color: #999; font-size: 0.75rem;">Loading place details...</p>
                </div>
            `;
            
            // Detect mobile screen
            const isMobile = window.innerWidth <= 768;
            const infoWindow = new google.maps.InfoWindow({
                content: initialContent,
                maxWidth: isMobile ? Math.min(350, window.innerWidth - 40) : 400
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
                
                // Fetch place details when clicked
                if (spot.placeId) {
                    // Use placeId if available
                    getPlaceDetailsById(spot.placeId, (placeDetails) => {
                        updateInfoWindowWithDetails(infoWindow, marker, placeDetails, spot, category.name);
                    });
                } else {
                    // Otherwise use coordinates
                    fetchPlaceDetailsByLocation(spot.lat, spot.lng, (placeDetails) => {
                        updateInfoWindowWithDetails(infoWindow, marker, placeDetails, spot, category.name);
                    });
                }
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
window.editSpotName = editSpotName;
window.moveCategoryUp = moveCategoryUp;
window.moveCategoryDown = moveCategoryDown;
window.moveSpotUp = moveSpotUp;
window.moveSpotDown = moveSpotDown;

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Load POI visibility preference first
    const savedPOISetting = localStorage.getItem('favoriteSpots_showPOIs');
    if (savedPOISetting !== null) {
        showPOIs = JSON.parse(savedPOISetting);
    }
    
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
