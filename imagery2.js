/**
 * Google Earth Historical Imagery Capture - Enhanced Version
 * - Adds OCR for date extraction
 * - Improved HTML report with metadata
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
const LOCATION_NAME = "Accra, Ghana"; // Human-readable location name
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
 * Extract date from image using OCR
 */
async function extractDateFromImage(imagePath) {
  try {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Configure Tesseract for better date recognition
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789/-.~abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    
    // Look for date patterns in the text
    // Pattern for "older~3/20/2016" format
    const olderPattern = /older[\s~]+(\d{1,2}\/\d{1,2}\/\d{4})/;
    // Pattern for date only
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;
    // Pattern for "Jan 19, 2024" format
    const monthPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s,]+\d{1,2}[\s,]+\d{4}/i;
    
    // Try to match the patterns
    const olderMatch = text.match(olderPattern);
    const dateMatch = text.match(datePattern);
    const monthMatch = text.match(monthPattern);
    
    if (olderMatch && olderMatch[1]) {
      return { date: olderMatch[1], raw: text.trim() };
    } else if (dateMatch && dateMatch[1]) {
      return { date: dateMatch[1], raw: text.trim() };
    } else if (monthMatch && monthMatch[0]) {
      return { date: monthMatch[0], raw: text.trim() };
    }
    
    // If no specific pattern found, return the raw text
    return { date: null, raw: text.trim() };
  } catch (error) {
    log(`OCR error: ${error.message}`);
    return { date: null, raw: null, error: error.message };
  }
}

/**
 * Format date for filename
 */
function formatDateForFilename(dateString) {
  // Quick check for null or empty
  if (!dateString) return 'unknown_date';
  
  try {
    // Check for various date formats and convert to YYYY-MM-DD
    
    // For MM/DD/YYYY format
    const regexSlash = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    if (regexSlash.test(dateString)) {
      const matches = dateString.match(regexSlash);
      const month = matches[1].padStart(2, '0');
      const day = matches[2].padStart(2, '0');
      const year = matches[3];
      return `${year}-${month}-${day}`;
    }
    
    // For "Month Day, Year" format
    const monthNames = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    
    const regexMonth = /([a-z]{3})[a-z]*\s+(\d{1,2})[,\s]+(\d{4})/i;
    if (regexMonth.test(dateString)) {
      const matches = dateString.match(regexMonth);
      const month = monthNames[matches[1].toLowerCase()];
      const day = matches[2].padStart(2, '0');
      const year = matches[3];
      return `${year}-${month}-${day}`;
    }
    
    // If no known format is detected, clean up the string for filename use
    return dateString.replace(/[\/\s,:]/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
  } catch (error) {
    log(`Date formatting error: ${error.message}`);
    return 'date_error';
  }
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
 * Calculate approximate year from timeline position
 * This is just an estimation based on the observed timeline
 */
function estimateYearFromPosition(x) {
  // Timeline observed to span from ~400 (2002) to ~1600 (2024)
  const timelineStartX = 400;
  const timelineEndX = 1600;
  const startYear = 2002;
  const endYear = 2024;
  
  const yearSpan = endYear - startYear;
  const pixelSpan = timelineEndX - timelineStartX;
  const pixelsPerYear = pixelSpan / yearSpan;
  
  const yearOffset = Math.round((x - timelineStartX) / pixelsPerYear);
  const estimatedYear = startYear + yearOffset;
  
  return estimatedYear;
}

/**
 * Main function to capture historical imagery
 */
async function captureHistoricalImagery() {
  const startTime = new Date();
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
    let baselineData = await readFileAsync(baselinePath);
    
    // Track captured unique images
    const capturedImages = [];
    
    // Calculate positions to focus on recent years (2019-present)
    // Timeline appears to span from 2002-2024, so we'll focus on the right portion
    const numPoints = 30;  // Increased for higher precision
    const timelineStart = 1100;  // Starting further right to focus on recent years
    const intervalWidth = (timelineEndX - timelineStart) / numPoints;
    
    for (let i = 0; i < numPoints; i++) {
      const pointX = Math.round(timelineStart + (i * intervalWidth));
      const estimatedYear = estimateYearFromPosition(pointX);
      
      log(`Exploring position ${i+1}/${numPoints} at (${pointX}, ${timelineY}) - Estimated year: ~${estimatedYear}`);
      
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
      
      // Extract date using OCR
      const ocrResult = await extractDateFromImage(dateDisplayPath);
      const formattedDate = ocrResult.date ? formatDateForFilename(ocrResult.date) : `est_${estimatedYear}`;
      log(`Position ${i+1}: Detected date text: "${ocrResult.raw || 'None'}", Formatted: ${formattedDate}`);
      
      // Check if image is different from baseline
      const comparison = compareScreenshots(baselineData, currentData);
      if (comparison.hasSignificantChange) {
        log(`Found unique image at position ${i+1} (${comparison.percentDiff.toFixed(2)}% different)`);
        
        // Create a renamed copy with date in filename
        const uniqueImagePath = path.join(OUTPUT_DIR, `${LOCATION_NAME.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${formattedDate}.png`);
        fs.copyFileSync(positionImagePath, uniqueImagePath);
        
        capturedImages.push({
          position: i + 1,
          pointX,
          estimatedYear,
          detectedDateText: ocrResult.raw,
          formattedDate,
          uniquePath: uniqueImagePath,
          dateDisplayPath,
          percentDiff: comparison.percentDiff
        });
        
        // Update baseline to this new image
        baselineData = currentData;
      }
    }
    
    // Extract metadata about the capture
    const endTime = new Date();
    const metadata = {
      coordinates: COORDINATES,
      locationName: LOCATION_NAME,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Math.round((endTime - startTime) / 1000) + " seconds",
      capturedImages: capturedImages.length,
      targetYearRange: `${START_YEAR} to ${CURRENT_YEAR}`,
      actualYearRange: capturedImages.length > 0 ? 
        `${capturedImages[0].formattedDate} to ${capturedImages[capturedImages.length-1].formattedDate}` : 
        "No images captured",
      outputDirectory: OUTPUT_DIR
    };
    
    // Save metadata as JSON
    await writeFileAsync(
      path.join(OUTPUT_DIR, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Create an enhanced HTML report with interactive features
    const reportContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Historical Imagery Results - ${LOCATION_NAME}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            header {
                background-color: #2c3e50;
                color: white;
                padding: 20px;
                margin-bottom: 30px;
                border-radius: 5px;
            }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #2c3e50; margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .metadata {
                background-color: #fff;
                border-radius: 5px;
                padding: 20px;
                margin-bottom: 30px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .metadata dl {
                display: grid;
                grid-template-columns: 30% 70%;
                gap: 10px;
            }
            .metadata dt {
                font-weight: bold;
                color: #555;
            }
            .image-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }
            .image-card {
                background-color: white;
                border-radius: 5px;
                overflow: hidden;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                transition: transform 0.3s ease;
            }
            .image-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .image-container {
                position: relative;
                overflow: hidden;
                height: 200px;
            }
            .image-container img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            .image-card:hover .image-container img {
                transform: scale(1.05);
            }
            .image-details {
                padding: 15px;
            }
            .date-badge {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
            }
            .image-details h3 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #2c3e50;
            }
            .image-meta {
                color: #666;
                font-size: 14px;
                margin-bottom: 5px;
            }
            .image-actions {
                margin-top: 15px;
                display: flex;
                justify-content: space-between;
            }
            .image-actions a {
                background-color: #3498db;
                color: white;
                text-decoration: none;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
                transition: background-color 0.3s ease;
            }
            .image-actions a:hover {
                background-color: #2980b9;
            }
            .timeline {
                position: relative;
                margin: 40px 0;
                height: 4px;
                background-color: #ddd;
            }
            .timeline-marker {
                position: absolute;
                top: -8px;
                width: 20px;
                height: 20px;
                background-color: #3498db;
                border-radius: 50%;
                cursor: pointer;
                transition: transform 0.3s ease;
            }
            .timeline-marker:hover {
                transform: scale(1.3);
            }
            .timeline-year {
                position: absolute;
                top: 15px;
                transform: translateX(-50%);
                font-size: 12px;
                color: #666;
            }
            .lightbox {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.9);
                z-index: 999;
                justify-content: center;
                align-items: center;
                flex-direction: column;
            }
            .lightbox img {
                max-width: 90%;
                max-height: 80%;
                margin-bottom: 20px;
            }
            .lightbox-caption {
                color: white;
                text-align: center;
                padding: 10px;
            }
            .close-lightbox {
                position: absolute;
                top: 20px;
                right: 30px;
                color: white;
                font-size: 30px;
                cursor: pointer;
            }
            footer {
                text-align: center;
                margin-top: 50px;
                padding: 20px;
                color: #666;
                font-size: 14px;
            }
            @media (max-width: 768px) {
                .metadata dl {
                    grid-template-columns: 1fr;
                }
                .image-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>Historical Satellite Imagery: ${LOCATION_NAME}</h1>
                <p>Captured on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </header>
            
            <section class="metadata">
                <h2>Capture Metadata</h2>
                <dl>
                    <dt>Location Coordinates</dt>
                    <dd>${COORDINATES}</dd>
                    
                    <dt>Target Date Range</dt>
                    <dd>${START_YEAR} to ${CURRENT_YEAR}</dd>
                    
                    <dt>Actual Date Range Found</dt>
                    <dd>${capturedImages.length > 0 ? 
                         `${capturedImages[0].formattedDate} to ${capturedImages[capturedImages.length-1].formattedDate}` : 
                         "No images captured"}</dd>
                    
                    <dt>Total Unique Images</dt>
                    <dd>${capturedImages.length}</dd>
                    
                    <dt>Capture Duration</dt>
                    <dd>${Math.round((endTime - startTime) / 1000)} seconds</dd>
                    
                    <dt>Zoom Level</dt>
                    <dd>${ZOOM_LEVEL}a (+ ${ADDITIONAL_ZOOM_STEPS} additional steps)</dd>
                </dl>
            </section>
            
            <h2>Timeline Visualization</h2>
            <div class="timeline">
                ${capturedImages.map((img, index) => {
                    // Calculate position as percentage along timeline (0-100%)
                    const position = ((img.pointX - timelineStart) / (timelineEndX - timelineStart)) * 100;
                    return `
                        <div class="timeline-marker" style="left: ${position}%;" 
                             onclick="document.getElementById('card-${index}').scrollIntoView({behavior: 'smooth'})">
                            <div class="timeline-year">${img.estimatedYear}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <h2>Historical Images (${capturedImages.length})</h2>
            <div class="image-grid">
                ${capturedImages.map((img, index) => `
                    <div class="image-card" id="card-${index}">
                        <div class="image-container">
                            <img src="${path.basename(img.uniquePath)}" alt="Historical Image ${index + 1}">
                            <div class="date-badge">${img.formattedDate}</div>
                        </div>
                        <div class="image-details">
                            <h3>Historical Image: ${img.formattedDate}</h3>
                            <div class="image-meta">Timeline Position: ${img.position} (X: ${img.pointX})</div>
                            <div class="image-meta">Estimated Year: ${img.estimatedYear}</div>
                            <div class="image-meta">Detected Date: ${img.detectedDateText || 'Unknown'}</div>
                            <div class="image-actions">
                                <a href="#" onclick="openLightbox('${path.basename(img.uniquePath)}', '${img.formattedDate}'); return false;">View Full Size</a>
                                <a href="${path.basename(img.dateDisplayPath)}" target="_blank">View Date Display</a>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="lightbox" id="lightbox">
                <span class="close-lightbox" onclick="closeLightbox()">&times;</span>
                <img id="lightbox-img" src="" alt="Full size image">
                <div class="lightbox-caption" id="lightbox-caption"></div>
            </div>
            
            <footer>
                <p>Generated by Google Earth Historical Imagery Capture Tool</p>
                <p>Coordinates: ${COORDINATES} &bull; Generated: ${new Date().toISOString()}</p>
            </footer>
        </div>
        
        <script>
            function openLightbox(imageSrc, caption) {
                document.getElementById('lightbox').style.display = 'flex';
                document.getElementById('lightbox-img').src = imageSrc;
                document.getElementById('lightbox-caption').textContent = caption;
                document.body.style.overflow = 'hidden';
            }
            
            function closeLightbox() {
                document.getElementById('lightbox').style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            
            // Close lightbox when clicking outside the image
            document.getElementById('lightbox').addEventListener('click', function(e) {
                if (e.target === this) {
                    closeLightbox();
                }
            });
            
            // Close lightbox with Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeLightbox();
                }
            });
        </script>
    </body>
    </html>
    `;
    
    await writeFileAsync(path.join(OUTPUT_DIR, 'enhanced_report.html'), reportContent);
    
    log(`Found ${capturedImages.length} unique historical images.`);
    log("Capture complete. Enhanced report generated.");
    
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