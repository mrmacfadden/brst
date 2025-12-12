// **!!! IMPORTANT: THESE VALUES HAVE BEEN UPDATED !!!**
// 1. Your Google Form URL (Submission Endpoint)
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf4rDh_qVFIIKrNn977e342tfyTHDLAvv2wWbgNCItTgunhFQ/formResponse"; 

// 2. Your Input Field ID (for the 'Scanned QR Code Data' question)
const INPUT_FIELD_ID = "entry.58506922"; 
// **********************************************

// Elements for status and history
const logStatus = document.getElementById('log-status');
const historyList = document.getElementById('history-list');

// Keeps track of the last scanned code to prevent double-logging
let lastScannedCode = null;
let scanTimeout = null; // Used to enforce a delay between scans

/**
 * Sends the scanned data to the Google Form.
 * @param {string} qrCodeData - The data extracted from the QR code.
 */
function logToGoogleSheet(qrCodeData) {
    // Clear previous status and set a loading message
    logStatus.className = '';
    logStatus.textContent = `Logging "${qrCodeData}"...`;
    
    // Construct the data payload for the form submission
    const formData = new FormData();
    formData.append(INPUT_FIELD_ID, qrCodeData);

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
        addToHistory(qrCodeData);

        // Reset the lastScannedCode after a brief period to allow scanning the same code again
        // after a deliberate pause (e.g., 5 seconds)
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            lastScannedCode = null;
            logStatus.textContent = 'Ready for next scan...';
        }, 5000); // 5-second delay to re-scan the same code
    })
    .catch(error => {
        // Error message
        logStatus.className = 'error';
        logStatus.textContent = `ERROR: Could not log data. ${error.message}`;
        // Immediately reset to allow re-scan in case of a network error
        lastScannedCode = null; 
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
 * Callback function for successful QR code scanning.
 * @param {string} decodedText - The data from the QR code.
 * @param {object} decodedResult - The raw result object.
 */
function onScanSuccess(decodedText, decodedResult) {
    // Check if this is the specific QR code you want to log
    // **!!! IMPORTANT: Replace 'YOUR_SPECIFIC_QR_CODE' with the actual data from your special QR code !!!**
    const SPECIFIC_CODE = 'YOUR_SPECIFIC_QR_CODE'; 

    if (decodedText !== SPECIFIC_CODE) {
        logStatus.className = 'error';
        logStatus.textContent = `Code scanned: "${decodedText}". Waiting for the specific code: "${SPECIFIC_CODE}"`;
        return; // Stop if it's not the code you're looking for
    }
    
    // Prevent logging the same code repeatedly in quick succession
    if (decodedText === lastScannedCode) {
        logStatus.textContent = `Skipped: Already logged this specific code recently.`;
        return; 
    }

    // Update the last scanned code and log it
    lastScannedCode = decodedText;
    logToGoogleSheet(decodedText);
}

/**
 * Callback function for errors during scanning.
 * @param {string} errorMessage - The error details.
 */
function onScanError(errorMessage) {
    // We can keep this empty or log the error to the console for debugging
    // console.log(`Scan Error: ${errorMessage}`);
}

// Initialize the QR code scanner
const html5QrcodeScanner = new Html5QrcodeScanner(
    "reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
    },
    /* verbose= */ false
);

// Start the scanner
html5QrcodeScanner.render(onScanSuccess, onScanError);