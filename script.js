// **!!! IMPORTANT: THESE VALUES HAVE BEEN UPDATED !!!**
// 1. Your Google Form URL (Submission Endpoint)
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf4rDh_qVFIIKrNn977e342tfyTHDLAvv2wWbgNCItTgunhFQ/formResponse"; 

// 2. Your Input Field ID (for the 'Scanned QR Code Data' question)
const INPUT_FIELD_ID = "entry.58506922"; 
// **********************************************

/**
 * Get location string from URL parameters
 */
function getLocationPrefix() {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('s') || params.get('l');
    if (locationParam) {
        const formatted = locationParam.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        return `Location: ${formatted}\n`;
    }
    return '';
}

// Elements for status and history
const logStatus = document.getElementById('log-status');
const historyList = document.getElementById('history-list');
const locationDisplay = document.getElementById('locationDisplay');
const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
const modalQRData = document.getElementById('modalQRData');
const confirmButton = document.getElementById('confirmButton');

// Keeps track of the last scanned code to prevent double-logging
let lastScannedCode = null;
let scanTimeout = null; // Used to enforce a delay between scans
let isScanOnCooldown = false; // Cooldown flag to prevent rapid successive scans
let pendingQRCode = null; // Stores the QR code data pending confirmation
const SCAN_COOLDOWN_MS = 2000; // 2 second cooldown between scans

/**
 * Sends the scanned data to the Google Form.
 * @param {string} qrCodeData - The data extracted from the QR code.
 */
function logToGoogleSheet(qrCodeData) {
    // Clear previous status and set a loading message
    logStatus.className = '';
    logStatus.textContent = `Logging "${qrCodeData}"...`;
    
    // Prepend location information from URL parameters if available
    const locationPrefix = getLocationPrefix();
    const dataToSubmit = locationPrefix + qrCodeData;
    
    // Construct the data payload for the form submission
    const formData = new FormData();
    formData.append(INPUT_FIELD_ID, dataToSubmit);

    // Google Forms submission requires 'no-cors' mode 
    // and sends the data in the query string/URL-encoded body.
    fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors', // Essential for submitting to Google Forms from another domain
        body: formData
    })
    .then(() => {
        // Success message (Note: 'no-cors' means we can't check the *actual* response,
        // so we assume success if the fetch operation itself doesn't fail.)
        logStatus.className = 'success';
        logStatus.textContent = `SUCCESS: Logged "${qrCodeData}" at ${new Date().toLocaleTimeString()}`;
        
        // Add to history
        addToHistory(dataToSubmit);

        // Reset status after a brief period
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            logStatus.textContent = 'Ready for next scan...';
        }, 5000); // 5-second delay before resetting status
    })
    .catch(error => {
        // Error message
        logStatus.className = 'error';
        logStatus.textContent = `ERROR: Could not log data. ${error.message}`;
    });
}

/**
 * Adds the scanned data to the on-screen history list.
 * @param {string} data - The scanned QR code content.
 */
function addToHistory(data) {
    const listItem = document.createElement('li');
    listItem.textContent = `[${new Date().toLocaleTimeString()}] Scanned: ${data}`;
    historyList.prepend(listItem); // Add to the top of the list
}


/**
 * Play a success beep sound
 */
function playSuccessBeep() {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1000; // 1000 Hz frequency
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

/**
 * Callback function for successful QR code scanning.
 * @param {string} decodedText - The data from the QR code.
 * @param {object} decodedResult - The raw result object.
 */
function onScanSuccess(decodedText, decodedResult) {
    // Prevent scanning during cooldown period
    if (isScanOnCooldown) {
        return;
    }

    // Activate cooldown
    isScanOnCooldown = true;
    setTimeout(() => {
        isScanOnCooldown = false;
    }, SCAN_COOLDOWN_MS);

    // Store the scanned code and show confirmation modal
    pendingQRCode = decodedText;
    playSuccessBeep();
    
    // Display the QR code data in the modal (with location prefix if applicable)
    const locationPrefix = getLocationPrefix();
    const dataToDisplay = locationPrefix + decodedText;
    
    // Parse and format the data for better readability
    const lines = dataToDisplay.split('\n').filter(line => line.trim());
    const formattedContent = document.createElement('div');
    lines.forEach(line => {
        const lineDiv = document.createElement('div');
        lineDiv.textContent = line;
        formattedContent.appendChild(lineDiv);
    });
    
    modalQRData.innerHTML = '';
    modalQRData.appendChild(formattedContent);
    confirmationModal.show();
}

/**
 * Error callback for QR code scanning (optional).
 */
function onScanError(error) {
    // Handle errors silently to avoid cluttering the UI
    // The scanner continuously attempts to detect codes
}

// Initialize the QR code scanner
function initializeScanner() {
    // Wait for the Html5QrcodeScanner to be available
    if (typeof Html5QrcodeScanner === 'undefined') {
        console.log('Waiting for Html5QrcodeScanner library to load...');
        setTimeout(initializeScanner, 100);
        return;
    }

    try {
        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", // ID of the HTML element where the scanner will be rendered
            { 
                fps: 10, // Frames per second for scanning
                qrbox: { width: 250, height: 250 } // Size of the scanning box
            },
            false // Verbose logging (false to keep console clean)
        );

        html5QrcodeScanner.render(onScanSuccess, onScanError);
        console.log('QR Code scanner initialized successfully');
    } catch (error) {
        console.error('Error initializing scanner:', error);
        logStatus.textContent = 'Error: ' + error.message;
    }
}

// Handle confirmation button click
confirmButton.addEventListener('click', () => {
    if (pendingQRCode) {
        confirmationModal.hide();
        logToGoogleSheet(pendingQRCode);
        pendingQRCode = null;
    }
});

// Start the scanner when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        displayLocation();
        initializeScanner();
    });
} else {
    // If the DOM is already loaded, initialize immediately
    displayLocation();
    initializeScanner();
}

/**
 * Display the location from URL parameters in the header
 */
function displayLocation() {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('s') || params.get('l');
    if (locationParam) {
        const formatted = locationParam.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        locationDisplay.textContent = formatted;
    }
}