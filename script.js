/**
 * ======================================
 * STUNNING WEATHER DASHBOARD JAVASCRIPT
 * ======================================
 */

// Configuration and Constants
const CONFIG = {
    API_KEY: 'f82820d136679b33651567b80cdbfae8', // Replace with your OpenWeatherMap API key
    API_BASE_URL: 'https://api.openweathermap.org/data/2.5',
    UNITS: 'metric',
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
    ANIMATION_DELAY: {
        CURRENT_WEATHER: 300,
        FORECAST: 600,
        CHART: 900
    }
};

// Global Variables
let temperatureChart = null;
let weatherCache = new Map();

// DOM Elements
const elements = {
    // Input elements
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    
    // Display elements
    errorMessage: document.getElementById('errorMessage'),
    loading: document.getElementById('loading'),
    
    // Weather sections
    currentWeather: document.getElementById('currentWeather'),
    forecastSection: document.getElementById('forecastSection'),
    chartSection: document.getElementById('chartSection'),
    
    // Current weather data elements
    cityName: document.getElementById('cityName'),
    currentDate: document.getElementById('currentDate'),
    currentIcon: document.getElementById('currentIcon'),
    weatherDescription: document.getElementById('weatherDescription'),
    currentTemp: document.getElementById('currentTemp'),
    feelsLike: document.getElementById('feelsLike'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('windSpeed'),
    pressure: document.getElementById('pressure'),
    
    // Forecast elements
    forecastContainer: document.getElementById('forecastContainer'),
    
    // Chart element
    temperatureChart: document.getElementById('temperatureChart')
};

/**
 * ======================================
 * INITIALIZATION
 * ======================================
 */

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    setupKeyboardShortcuts();
});

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('🌤️ Weather Dashboard initialized');
    
    // Check if API key is configured
    if (CONFIG.API_KEY === 'YOUR_API_KEY_HERE' || !CONFIG.API_KEY) {
        showError('⚠️ Please configure your OpenWeatherMap API key');
        return;
    }
    
    // Try to load weather for user's location
    if (navigator.geolocation) {
        elements.searchBtn.textContent = 'Detecting location...';
        elements.searchBtn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                getWeatherByCoords(position.coords.latitude, position.coords.longitude);
            },
            () => {
                // Fallback to default city if geolocation fails
                elements.searchBtn.textContent = 'Search';
                elements.searchBtn.disabled = false;
                console.log('📍 Geolocation not available, using manual search');
            }
        );
    }
    
    // Add some visual flair
    addVisualEffects();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Search functionality
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Clear error on input
    elements.cityInput.addEventListener('input', hideError);
    
    // Add focus effects
    elements.cityInput.addEventListener('focus', () => {
        elements.cityInput.parentElement.style.transform = 'scale(1.02)';
    });
    
    elements.cityInput.addEventListener('blur', () => {
        elements.cityInput.parentElement.style.transform = 'scale(1)';
    });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Focus search input with Ctrl/Cmd + K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.cityInput.focus();
        }
        
        // Escape to clear input
        if (e.key === 'Escape' && document.activeElement === elements.cityInput) {
            elements.cityInput.value = '';
            hideError();
        }
    });
}

/**
 * Add visual effects and animations
 */
function addVisualEffects() {
    // Animate search card on load
    setTimeout(() => {
        document.querySelector('.search-card').style.transform = 'translateY(0)';
        document.querySelector('.search-card').style.opacity = '1';
    }, 200);
    
    // Add parallax effect to floating shapes
    window.addEventListener('mousemove', (e) => {
        const shapes = document.querySelectorAll('.shape');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 0.5;
            const x = (mouseX - 0.5) * speed * 20;
            const y = (mouseY - 0.5) * speed * 20;
            
            shape.style.transform += ` translate(${x}px, ${y}px)`;
        });
    });
}

/**
 * ======================================
 * WEATHER DATA FETCHING
 * ======================================
 */

/**
 * Handle search button click or Enter key press
 */
async function handleSearch() {
    const city = elements.cityInput.value.trim();
    
    if (!city) {
        showError('🏙️ Please enter a city name');
        elements.cityInput.focus();
        return;
    }
    
    if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        showError('🔑 Please configure your OpenWeatherMap API key');
        return;
    }
    
    await getWeatherData(city);
}

/**
 * Get weather data by city name
 * @param {string} city - City name to search for
 */
async function getWeatherData(city) {
    try {
        showLoading(true);
        hideError();
        
        // Check cache first
        const cacheKey = city.toLowerCase();
        const cachedData = weatherCache.get(cacheKey);
        
        if (cachedData && Date.now() - cachedData.timestamp < CONFIG.CACHE_DURATION) {
            console.log('📦 Using cached data for', city);
            displayWeatherData(cachedData.current, cachedData.forecast);
            return;
        }
        
        // Fetch current weather
        const currentResponse = await fetchWithRetry(
            `${CONFIG.API_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`
        );
        
        if (!currentResponse.ok) {
            throw new Error(getErrorMessage(currentResponse.status));
        }
        
        const currentData = await currentResponse.json();
        
        // Fetch 5-day forecast
        const forecastResponse = await fetchWithRetry(
            `${CONFIG.API_BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`
        );
        
        const forecastData = await forecastResponse.json();
        
        // Cache the data
        weatherCache.set(cacheKey, {
            current: currentData,
            forecast: forecastData,
            timestamp: Date.now()
        });
        
        // Display the data
        displayWeatherData(currentData, forecastData);
        
    } catch (error) {
        console.error('❌ Weather fetch error:', error);
        showError(`🚫 ${error.message}`);
        hideWeatherSections();
    } finally {
        showLoading(false);
    }
}

/**
 * Get weather data by coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
async function getWeatherByCoords(lat, lon) {
    try {
        showLoading(true);
        
        const currentResponse = await fetchWithRetry(
            `${CONFIG.API_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`
        );
        
        const currentData = await currentResponse.json();
        
        const forecastResponse = await fetchWithRetry(
            `${CONFIG.API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`
        );
        
        const forecastData = await forecastResponse.json();
        
        // Update input field with detected city
        elements.cityInput.value = `${currentData.name}, ${currentData.sys.country}`;
        
        displayWeatherData(currentData, forecastData);
        
    } catch (error) {
        console.error('❌ Location weather fetch error:', error);
        elements.searchBtn.textContent = 'Search';
        elements.searchBtn.disabled = false;
    } finally {
        showLoading(false);
    }
}

/**
 * Fetch with retry logic
 * @param {string} url - URL to fetch
 * @param {number} retries - Number of retries
 */
async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

/**
 * Get user-friendly error message
 * @param {number} status - HTTP status code
 */
function getErrorMessage(status) {
    const errorMessages = {
        400: 'Invalid city name. Please check your spelling.',
        404: 'City not found. Please try a different city.',
        401: 'Invalid API key. Please check your configuration.',
        429: 'Too many requests. Please try again later.',
        500: 'Weather service temporarily unavailable.',
        503: 'Weather service temporarily unavailable.'
    };
    
    return errorMessages[status] || 'Unable to fetch weather data. Please try again.';
}

/**
 * ======================================
 * DATA DISPLAY FUNCTIONS
 * ======================================
 */

/**
 * Display all weather data
 * @param {Object} currentData - Current weather data
 * @param {Object} forecastData - Forecast data
 */
function displayWeatherData(currentData, forecastData) {
    updateCurrentWeather(currentData);
    updateForecast(forecastData);
    updateChart(forecastData);
    showWeatherSections();
}

/**
 * Update current weather display
 * @param {Object} data - Current weather data from API
 */
function updateCurrentWeather(data) {
    // Update location and date
    elements.cityName.textContent = `${data.name}, ${data.sys.country}`;
    elements.currentDate.textContent = formatDate(new Date());
    
    // Update weather icon and description
    const iconCode = data.weather[0].icon;
    elements.currentIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    elements.currentIcon.alt = data.weather[0].description;
    elements.weatherDescription.textContent = capitalizeFirst(data.weather[0].description);
    
    // Update temperature with animation
    animateNumber(elements.currentTemp, Math.round(data.main.temp), '°');
    animateNumber(elements.feelsLike, Math.round(data.main.feels_like), '°');
    
    // Update metrics with animations
    setTimeout(() => {
        animateNumber(elements.humidity, data.main.humidity, '%', 50);
        animateNumber(elements.windSpeed, Math.round(data.wind.speed * 3.6), ' km/h', 100);
        animateNumber(elements.pressure, data.main.pressure, ' hPa', 150);
    }, 300);
    
    console.log('🌡️ Current weather updated for', data.name);
}

/**
 * Update 5-day forecast display
 * @param {Object} data - Forecast data from API
 */
function updateForecast(data) {
    elements.forecastContainer.innerHTML = '';
    
    // Group forecast data by day
    const dailyData = groupForecastByDay(data.list);
    
    // Create forecast items for next 5 days
    const dailyEntries = Object.values(dailyData).slice(0, 5);
    
    dailyEntries.forEach((day, index) => {
        const minTemp = Math.round(Math.min(...day.temps));
        const maxTemp = Math.round(Math.max(...day.temps));
        
        const forecastItem = createForecastItem(day, minTemp, maxTemp);
        
        // Add staggered animation
        forecastItem.style.animationDelay = `${index * 0.1}s`;
        
        elements.forecastContainer.appendChild(forecastItem);
    });
    
    console.log('📅 5-day forecast updated');
}

/**
 * Group forecast data by day
 * @param {Array} forecastList - List of forecast items
 */
function groupForecastByDay(forecastList) {
    const dailyData = {};
    
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toDateString();
        
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                date: date,
                temps: [],
                weather: item.weather[0],
                humidity: item.main.humidity,
                windSpeed: item.wind.speed
            };
        }
        
        dailyData[dateKey].temps.push(item.main.temp);
    });
    
    return dailyData;
}

/**
 * Create forecast item element
 * @param {Object} day - Day data
 * @param {number} minTemp - Minimum temperature
 * @param {number} maxTemp - Maximum temperature
 */
function createForecastItem(day, minTemp, maxTemp) {
    const forecastItem = document.createElement('div');
    forecastItem.className = 'forecast-item fade-in';
    
    forecastItem.innerHTML = `
        <div class="forecast-day">${formatForecastDate(day.date)}</div>
        <img src="https://openweathermap.org/img/wn/${day.weather.icon}@2x.png" 
             alt="${day.weather.description}" 
             class="forecast-icon" />
        <div class="forecast-temps">${maxTemp}° / ${minTemp}°</div>
        <div class="forecast-desc">${capitalizeFirst(day.weather.description)}</div>
    `;
    
    // Add hover effect for additional info
    forecastItem.addEventListener('mouseenter', () => {
        forecastItem.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    forecastItem.addEventListener('mouseleave', () => {
        forecastItem.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    return forecastItem;
}

/**
 * Update temperature trend chart
 * @param {Object} data - Forecast data from API
 */
function updateChart(data) {
    const ctx = elements.temperatureChart.getContext('2d');
    
    // Prepare chart data
    const dailyData = groupForecastByDay(data.list);
    const chartData = Object.values(dailyData).slice(0, 5).map(day => ({
        date: formatChartDate(day.date),
        avgTemp: Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length),
        maxTemp: Math.round(Math.max(...day.temps)),
        minTemp: Math.round(Math.min(...day.temps))
    }));
    
    // Destroy existing chart
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    // Create new chart with stunning visuals
    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(item => item.date),
            datasets: [
                {
                    label: 'Max Temperature',
                    data: chartData.map(item => item.maxTemp),
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#ff6b6b',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                },
                {
                    label: 'Average Temperature',
                    data: chartData.map(item => item.avgTemp),
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#4facfe',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                },
                {
                    label: 'Min Temperature',
                    data: chartData.map(item => item.minTemp),
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#4ecdc4',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            backgroundColor: 'transparent',
            plugins: {
                title: {
                    display: true,
                    text: '5-Day Temperature Trend',
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    console.log('📊 Temperature chart updated');
}

/**
 * ======================================
 * UI STATE MANAGEMENT
 * ======================================
 */

/**
 * Show or hide loading state
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
    if (show) {
        elements.loading.classList.remove('hidden');
        elements.searchBtn.disabled = true;
        elements.searchBtn.innerHTML = `
            <span class="btn-text">Searching...</span>
            <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
        `;
    } else {
        elements.loading.classList.add('hidden');
        elements.searchBtn.disabled = false;
        elements.searchBtn.innerHTML = `
            <span class="btn-text">Search</span>
            <span class="btn-icon">→</span>
        `;
    }
}

/**
 * Show error message with animation
 * @param {string} message - Error message to display
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    
    // Shake animation for search input
    elements.cityInput.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        elements.cityInput.style.animation = '';
    }, 500);
}

/**
 * Hide error message
 */
function hideError() {
    elements.errorMessage.classList.add('hidden');
}

/**
 * Show all weather sections with staggered animations
 */
function showWeatherSections() {
    const sections = [elements.currentWeather, elements.forecastSection, elements.chartSection];
    
    sections.forEach((section, index) => {
        setTimeout(() => {
            section.classList.remove('hidden');
            section.style.animation = 'fadeInUp 0.6s ease forwards';
        }, index * 200);
    });
}

/**
 * Hide all weather sections
 */
function hideWeatherSections() {
    const sections = [elements.currentWeather, elements.forecastSection, elements.chartSection];
    sections.forEach(section => {
        section.classList.add('hidden');
    });
}

/**
 * ======================================
 * UTILITY FUNCTIONS
 * ======================================
 */

/**
 * Animate number changes
 * @param {HTMLElement} element - Element to animate
 * @param {number} targetValue - Target number
 * @param {string} suffix - Suffix to add (e.g., '°', '%')
 * @param {number} delay - Animation delay
 */
function animateNumber(element, targetValue, suffix = '', delay = 0) {
    setTimeout(() => {
        let currentValue = 0;
        const increment = targetValue / 30;
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(currentValue) + suffix;
        }, 30);
    }, delay);
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 */
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date for forecast cards
 * @param {Date} date - Date to format
 */
function formatForecastDate(date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

/**
 * Format date for chart labels
 * @param {Date} date - Date to format
 */
function formatChartDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Add CSS for shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

console.log('🚀 Weather Dashboard script loaded successfully!');