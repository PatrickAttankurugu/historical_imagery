/**
 * Google Earth Historical Imagery Capture - Simplified Version
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

// Configuration
const COORDINATES = "5.55551247,-0.26162416"; // Accra, Ghana
const START_YEAR = 2019;
const CURRENT_YEAR = new Date().getFullYear();
const OUTPUT_DIR = path.join(__dirname, 'historical_imagery_' + new Date().toISOString().replace(/[:.]/g, '-'));
const ZOOM_LEVEL = 250;  // Lower = more zoomed in
const ADDITIONAL_ZOOM_STEPS = 8;

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
 * Compare two screenshots to detect differences
 */
function compareScreenshots(before, after) {
  const sizeDiff = Math.abs(before.length - after.length);
  const percentDiff = (sizeDiff / before.length) * 100;
  log(`Image size difference: ${percentDiff.toFixed(2)}%`);
  return { 
    percentDiff, 
    hasSignificantChange: percentDiff > 0.5 
  };
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
    args: ['--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  
  try {
    // Step 1: Navigate to Google Earth Web with enhanced zoom
    log("Navigating to Google Earth Web...");
    const earthUrl = `https://earth.google.com/web/@${COORDINATES},${ZOOM_LEVEL}a,35y,0h,0t,0r`;
    await page.goto(earthUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Take screenshot of initial state
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_initial_load.png'), fullPage: true });
    
    // Wait for Google Earth to load
    log("Waiting for Google Earth to initialize...");
    await sleep(15000);
    
    // Additional zoom in after page load
    log("Zooming in for better detail...");
    for (let i = 0; i < ADDITIONAL_ZOOM_STEPS; i++) {
      await page.keyboard.press('+');
      await sleep(1000);
    }
    await sleep(3000);
    
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_zoomed_view.png'), fullPage: true });
    
    // Get viewport dimensions
    const dimensions = await page.evaluate(() => {
      return { width: window.innerWidth, height: window.innerHeight };
    });
    
    // Step 2: Click on the historical imagery icon
    const historyIconX = 520;
    const historyIconY = 37;
    
    log("Clicking on history icon...");
    const beforeHistoryClickPath = path.join(OUTPUT_DIR, '03_before_history_click.png');
    await page.screenshot({ path: beforeHistoryClickPath, fullPage: true });
    const beforeClickData = await readFileAsync(beforeHistoryClickPath);
    
    await page.mouse.click(historyIconX, historyIconY);
    await sleep(5000);
    
    const afterHistoryClickPath = path.join(OUTPUT_DIR, '04_after_history_click.png');
    await page.screenshot({ path: afterHistoryClickPath, fullPage: true });
    const afterClickData = await readFileAsync(afterHistoryClickPath);
    
    const comparison = compareScreenshots(beforeClickData, afterClickData);
    if (comparison.hasSignificantChange) {
      log("Historical mode activated successfully.");
    } else {
      log("Warning: No visual confirmation of historical mode. Continuing anyway.");
    }
    
    // Step 3: Explore the timeline
    log("Starting timeline exploration...");
    
    // The timeline spans from ~400px to ~1600px horizontally
    const timelineStartX = 400;
    const timelineEndX = 1600;
    const timelineY = 90;
    
    // Take a baseline screenshot for comparison
    const baselinePath = path.join(OUTPUT_DIR, 'baseline.png');
    await page.screenshot({ path: baselinePath, fullPage: true });
    let baselineData = await readFileAsync(baselinePath);  // Changed from const to let
    
    // Track captured unique images
    const capturedImages = [];
    
    // Calculate positions to focus on recent years (2019-present)
    // Timeline appears to span from 2002-2024, so we'll focus on the right portion
    const numPoints = 20;
    const timelineStart = 1200;  // Starting further right to focus on recent years
    const intervalWidth = (timelineEndX - timelineStart) / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const pointX = Math.round(timelineStart + (i * intervalWidth));
      
      log(`Exploring position ${i+1}/${numPoints} at (${pointX}, ${timelineY})`);
      
      // Click on this position
      await page.mouse.click(pointX, timelineY);
      await sleep(4000);
      
      // Take full screenshot
      const positionImagePath = path.join(OUTPUT_DIR, `position_${i+1}.png`);
      await page.screenshot({ path: positionImagePath, fullPage: true });
      const currentData = await readFileAsync(positionImagePath);
      
      // Capture date display at bottom left
      const dateDisplayPath = path.join(OUTPUT_DIR, `date_display_${i+1}.png`);
      await page.screenshot({
        path: dateDisplayPath,
        clip: {
          x: 100,
          y: dimensions.height - 35,
          width: 250,
          height: 35
        }
      });
      
      // Check if image is different from baseline
      const comparison = compareScreenshots(baselineData, currentData);
      if (comparison.hasSignificantChange) {
        log(`Found unique image at position ${i+1}`);
        
        // Create a renamed copy for this unique image
        const uniqueImagePath = path.join(OUTPUT_DIR, `unique_date_${capturedImages.length + 1}.png`);
        fs.copyFileSync(positionImagePath, uniqueImagePath);
        
        capturedImages.push({
          position: i + 1,
          pointX,
          uniquePath: uniqueImagePath,
          dateDisplayPath
        });
        
        // Update baseline to this new image
        baselineData = currentData;
      }
    }
    
    // Create an HTML report
    log(`Found ${capturedImages.length} unique historical images.`);
    
    const reportContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Historical Imagery Results</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .image-container { margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 20px; }
            img { max-width: 100%; }
            h1, h2 { color: #333; }
            .date-display { border: 2px solid red; margin-top: 10px; }
        </style>
    </head>
    <body>
        <h1>Historical Imagery Results</h1>
        <p>Coordinates: ${COORDINATES}</p>
        <p>Captured: ${new Date().toISOString()}</p>
        <p>Total unique images: ${capturedImages.length}</p>
        
        <div id="images">
            ${capturedImages.map((img, index) => `
                <div class="image-container">
                    <h2>Historical Image ${index + 1}</h2>
                    <p>Timeline position: ${img.position} (X: ${img.pointX})</p>
                    <img src="${path.basename(img.uniquePath)}" alt="Historical Image ${index + 1}">
                    <h3>Date Display:</h3>
                    <img class="date-display" src="${path.basename(img.dateDisplayPath)}" alt="Date Display ${index + 1}">
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
    
    await writeFileAsync(path.join(OUTPUT_DIR, 'report.html'), reportContent);
    log("Capture complete. Report generated.");
    
  } catch (error) {
    log(`Error: ${error.message}`);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'error_state.png'), fullPage: true });
  } finally {
    await browser.close();
    log("Browser closed");
  }
}

// Run the script
captureHistoricalImagery().catch(error => {
  console.error("Unhandled error:", error);
});