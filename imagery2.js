/**
 * Google Earth Historical Imagery Capture - Refined Version
 * 
 * Focuses on the successful strategy (blue dots)
 * Fixes date display capture
 * Increases zoom level
 * Adds OCR verification
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const { createWorker } = require('tesseract.js'); // Add this with: npm install tesseract.js

// Configuration
const COORDINATES = "5.55551247,-0.26162416"; // Accra, Ghana
const START_YEAR = 2019;
const CURRENT_YEAR = new Date().getFullYear();
const OUTPUT_DIR = path.join(__dirname, 'historical_imagery_' + new Date().toISOString().replace(/[:.]/g, '-'));
const MAX_RETRIES = 3;
const ZOOM_LEVEL = 250;  // Reduced from 500 for more zoom (lower = more zoomed in)
const ADDITIONAL_ZOOM_STEPS = 8; // Increased from 5

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function for logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync(path.join(OUTPUT_DIR, 'capture_log.txt'), `[${timestamp}] ${message}\n`);
}

// Helper function for waiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract date text from image using OCR
 */
async function extractDateFromImage(imagePath) {
  try {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Configure for better date recognition
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789/.-JanFebMrAprMyJunlgSctOvD',
    });
    
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    
    // Look for date patterns
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/,             // MM/DD/YYYY
      /[A-Z][a-z]{2}\s\d{1,2},\s\d{4}/,       // MMM DD, YYYY
      /\d{1,2}\s[A-Z][a-z]{2}\s\d{4}/         // DD MMM YYYY
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return text.trim(); // Return the text even if no date pattern found
  } catch (error) {
    log(`OCR error: ${error.message}`);
    return null;
  }
}

/**
 * Main function to capture historical imagery
 */
async function captureHistoricalImagery() {
  log("Starting historical imagery capture for coordinates: " + COORDINATES);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--window-size=1920,1080', 
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');
  
  try {
    // Step 1: Navigate to Google Earth Web with enhanced zoom
    log("Navigating to Google Earth Web with enhanced zoom...");
    const earthUrl = `https://earth.google.com/web/@${COORDINATES},${ZOOM_LEVEL}a,35y,0h,0t,0r`;
    log(`Opening URL: ${earthUrl}`);
    
    await page.goto(earthUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Take screenshot of initial state
    const initialScreenshotPath = path.join(OUTPUT_DIR, '01_initial_load.png');
    await page.screenshot({ path: initialScreenshotPath, fullPage: true });
    
    // Wait for Google Earth to load
    log("Waiting for Google Earth to initialize...");
    await sleep(15000);
    
    // Additional zoom in after page load
    log(`Zooming in further (${ADDITIONAL_ZOOM_STEPS} steps)...`);
    for (let i = 0; i < ADDITIONAL_ZOOM_STEPS; i++) {
      await page.keyboard.press('+');
      await sleep(1000);
    }
    await sleep(3000);
    
    const zoomedScreenshotPath = path.join(OUTPUT_DIR, '02_zoomed_view.png');
    await page.screenshot({ path: zoomedScreenshotPath, fullPage: true });
    
    // Get viewport dimensions
    const dimensions = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    });
    
    // Step 2: Click on the historical imagery icon
    const historyIconX = 520;
    const historyIconY = 37;
    
    let historyModeActivated = false;
    let retryCount = 0;
    
    while (!historyModeActivated && retryCount < MAX_RETRIES) {
      log(`Attempt ${retryCount + 1}: Clicking on history icon at (${historyIconX}, ${historyIconY})...`);
      
      const beforeHistoryClickPath = path.join(OUTPUT_DIR, `03_before_history_click_${retryCount + 1}.png`);
      await page.screenshot({ path: beforeHistoryClickPath, fullPage: true });
      
      await page.mouse.click(historyIconX, historyIconY);
      log(`Clicked history icon`);
      
      await sleep(5000);
      
      const afterHistoryClickPath = path.join(OUTPUT_DIR, `04_after_history_click_${retryCount + 1}.png`);
      await page.screenshot({ path: afterHistoryClickPath, fullPage: true });
      
      // Check if the timeline appeared
      // We can verify this by looking for the "Deactivate Historical Imagery" button
      const buttonVisible = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, div, span'));
        return elements.some(el => 
          el.innerText && el.innerText.includes('Deactivate Historical Imagery')
        );
      });
      
      if (buttonVisible) {
        log(`Historical imagery mode activated! (Found "Deactivate" button)`);
        historyModeActivated = true;
      } else {
        log(`No "Deactivate" button found. Retrying...`);
        retryCount++;
      }
    }
    
    if (!historyModeActivated) {
      throw new Error("Failed to activate historical imagery mode after multiple attempts");
    }
    
    // Step 3: Pause any auto-playback
    log("Checking for and pausing any auto-playback...");
    const playPauseX = 355;
    const playPauseY = 85;
    await page.mouse.click(playPauseX, playPauseY);
    await sleep(2000);
    
    // Step 4: Focus on the SUCCESSFUL strategy - clicking on blue dots
    log("Starting optimized blue dot strategy - clicking across timeline to find all available dates");
    
    // The timeline spans from ~400px to ~1600px horizontally
    const timelineStartX = 400;
    const timelineEndX = 1600;
    const dotsY = 95;  // Y-coordinate for the blue dots (below the main timeline)
    
    // Track captured dates
    const capturedDates = new Map();
    
    // Use more points for a finer-grained search
    const numPoints = 30;  // Increased from 10
    const intervalWidth = (timelineEndX - timelineStartX) / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const dotX = Math.round(timelineStartX + (i * intervalWidth));
      
      log(`Clicking timeline position ${i+1}/${numPoints} at (${dotX}, ${dotsY})`);
      
      // Take screenshot before clicking
      const beforeDotClickPath = path.join(OUTPUT_DIR, `before_dot_click_${i+1}.png`);
      await page.screenshot({ path: beforeDotClickPath, fullPage: true });
      
      // Click on this position
      await page.mouse.click(dotX, dotsY);
      await sleep(4000);  // Increased wait time for imagery to load
      
      // Take a screenshot after clicking
      const afterDotClickPath = path.join(OUTPUT_DIR, `dot_click_${i+1}.png`);
      await page.screenshot({ path: afterDotClickPath, fullPage: true });
      
      // Capture the date indicator (correctly positioned this time)
      // The date is in the bottom-left corner, near the Google logo
      const dateDisplayPath = path.join(OUTPUT_DIR, `date_display_${i+1}.png`);
      await page.screenshot({
        path: dateDisplayPath,
        clip: {
          x: 100,
          y: dimensions.height - 30,  // Correctly positioned at bottom
          width: 200,
          height: 30
        }
      });
      
      // Use OCR to read the date
      const extractedDate = await extractDateFromImage(dateDisplayPath);
      log(`Position ${i+1}: Detected date: ${extractedDate || 'None detected'}`);
      
      if (extractedDate) {
        // Save a high-resolution capture of this date
        const highResPath = path.join(OUTPUT_DIR, `imagery_position_${i+1}_${extractedDate.replace(/\//g, '-')}.png`);
        await page.screenshot({ path: highResPath, fullPage: true });
        
        // Record this date
        capturedDates.set(extractedDate, {
          position: i+1,
          x: dotX,
          imagePath: highResPath
        });
      }
    }
    
    // Generate a summary of captured dates
    log("Historical imagery capture complete.");
    log(`Successfully captured ${capturedDates.size} unique dates`);
    
    // Create a JSON summary of captured dates
    const capturedDatesArray = Array.from(capturedDates.entries()).map(([date, info]) => ({
      date,
      position: info.position,
      imagePath: path.basename(info.imagePath)
    }));
    
    await writeFileAsync(
      path.join(OUTPUT_DIR, 'captured_dates.json'),
      JSON.stringify(capturedDatesArray, null, 2)
    );
    
    // Take a final screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'final_state.png'),
      fullPage: true
    });
    
    log("Check the output directory for captured screenshots and the captured_dates.json summary.");
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error("Detailed error:", error);
    
    try {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'error_state.png'),
        fullPage: true
      });
    } catch (screenshotError) {
      log(`Failed to take error screenshot: ${screenshotError.message}`);
    }
    
  } finally {
    if (browser) {
      await browser.close();
      log("Browser closed");
    }
  }
}

// Run the script
captureHistoricalImagery().catch(error => {
  console.error("Unhandled error at top level:", error);
  process.exit(1);
});