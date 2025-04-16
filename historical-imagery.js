/**
 * Google Earth Historical Imagery Capture - Further Revised Version
 * 
 * A Node.js implementation using Puppeteer to automate historical imagery capture,
 * with more precise targeting of the historical imagery button.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const COORDINATES = "5.55551247,-0.26162416"; // Accra, Ghana
const START_YEAR = 2019;
const CURRENT_YEAR = new Date().getFullYear();
const OUTPUT_DIR = path.join(__dirname, 'historical_imagery_' + new Date().toISOString().replace(/[:.]/g, '-'));

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
 * Compare two screenshots using simple blob comparison
 * @param {Buffer} before - Screenshot before action
 * @param {Buffer} after - Screenshot after action
 * @returns {boolean} - Whether significant changes were detected
 */
function hasSignificantChanges(before, after) {
  // Simple size comparison as a basic check
  const sizeDiff = Math.abs(before.length - after.length);
  const percentDiff = (sizeDiff / before.length) * 100;
  log(`Image size difference: ${percentDiff.toFixed(2)}%`);
  return percentDiff > 1; // Consider 1% difference as significant
}

/**
 * Main function to capture historical imagery
 */
async function captureHistoricalImagery() {
  log("Starting historical imagery capture for coordinates: " + COORDINATES);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: false, // Non-headless for better interaction with Flutter canvas
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--window-size=1920,1080', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  try {
    // Step 1: Navigate to Google Earth Web with coordinates
    log("Navigating to Google Earth Web...");
    await page.goto(`https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r`, { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Take screenshot of initial state
    const initialScreenshotPath = path.join(OUTPUT_DIR, '01_initial_load.png');
    await page.screenshot({ path: initialScreenshotPath, fullPage: true });
    
    // Wait for Google Earth to load
    log("Waiting for Google Earth to initialize...");
    await sleep(15000);
    
    // Take screenshot of loaded state
    const loadedScreenshotPath = path.join(OUTPUT_DIR, '02_loaded_state.png');
    await page.screenshot({ path: loadedScreenshotPath, fullPage: true });
    
    // Get viewport dimensions
    const dimensions = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    });
    
    // Step 2: Perform a systematic scan of the toolbar to find all clickable icons
    log("Performing systematic scan of the toolbar...");
    
    // First take a screenshot of the toolbar area for reference
    const toolbarScreenshotPath = path.join(OUTPUT_DIR, '03_toolbar.png');
    await page.screenshot({
      path: toolbarScreenshotPath,
      clip: {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: 100
      }
    });
    
    // Based on the previous runs and your feedback, we know:
    // 1. We clicked at (580, 37) which was NOT the history icon
    // 2. The history icon is to the left of this position
    
    // Let's try clicking at (520, 37) which should be the position to the left
    const historyIconX = 520; // Adjusted from 580 to 520 (one icon to the left)
    const historyIconY = 37;  // Same Y position
    
    log(`Clicking on adjusted history icon position at (${historyIconX}, ${historyIconY})...`);
    
    const beforeHistoryClickPath = path.join(OUTPUT_DIR, '04_before_history_click.png');
    await page.screenshot({ path: beforeHistoryClickPath, fullPage: true });
    const beforeHistoryData = fs.readFileSync(beforeHistoryClickPath);
    
    // Click the adjusted history icon position
    await page.mouse.click(historyIconX, historyIconY);
    log(`Clicked at adjusted position (${historyIconX}, ${historyIconY})`);
    
    // Wait to see if anything changes
    await sleep(5000);
    
    const afterHistoryClickPath = path.join(OUTPUT_DIR, '05_after_history_click.png');
    await page.screenshot({ path: afterHistoryClickPath, fullPage: true });
    const afterHistoryData = fs.readFileSync(afterHistoryClickPath);
    
    // Check if there were significant changes
    if (hasSignificantChanges(beforeHistoryData, afterHistoryData)) {
      log(`Detected significant changes after clicking adjusted history icon position. History mode may be activated.`);
      
      // Step 3: Look for a timeline or date slider that may have appeared
      log("Looking for timeline or date picker controls...");
      
      // Check bottom area first - this is where the timeline typically appears in Google Earth
      const bottomAreaX = Math.floor(dimensions.width / 2);
      const bottomAreaY = dimensions.height - 100;
      
      log(`Checking bottom area for timeline controls at (${bottomAreaX}, ${bottomAreaY})...`);
      
      const beforeBottomAreaPath = path.join(OUTPUT_DIR, '06_before_bottom_area.png');
      await page.screenshot({ path: beforeBottomAreaPath, fullPage: true });
      
      // Move mouse to the bottom area first
      await page.mouse.move(bottomAreaX, bottomAreaY);
      await sleep(2000);
      
      const afterBottomMoveArea = path.join(OUTPUT_DIR, '07_after_move_bottom_area.png');
      await page.screenshot({ path: afterBottomMoveArea, fullPage: true });
      
      // Try clicking in the bottom area
      await page.mouse.click(bottomAreaX, bottomAreaY);
      await sleep(2000);
      
      const afterBottomClickPath = path.join(OUTPUT_DIR, '08_after_click_bottom_area.png');
      await page.screenshot({ path: afterBottomClickPath, fullPage: true });
      
      // Step 4: Try to navigate the timeline
      log("Attempting to navigate the timeline...");
      
      // First try arrow keys, which often control timeline navigation
      const keySequence = [
        { name: 'left_arrow', key: 'ArrowLeft', count: 3 },
        { name: 'right_arrow', key: 'ArrowRight', count: 3 }
      ];
      
      for (const item of keySequence) {
        log(`Pressing ${item.name} key ${item.count} times...`);
        
        for (let i = 0; i < item.count; i++) {
          const beforeKeyPath = path.join(OUTPUT_DIR, `09_before_${item.name}_press_${i+1}.png`);
          await page.screenshot({ path: beforeKeyPath, fullPage: true });
          
          await page.keyboard.press(item.key);
          await sleep(2000);
          
          const afterKeyPath = path.join(OUTPUT_DIR, `10_after_${item.name}_press_${i+1}.png`);
          await page.screenshot({ path: afterKeyPath, fullPage: true });
          
          // Check for date information in the bottom-left corner
          const dateCornerPath = path.join(OUTPUT_DIR, `11_date_corner_${item.name}_${i+1}.png`);
          await page.screenshot({
            path: dateCornerPath,
            clip: {
              x: 0,
              y: dimensions.height - 50,
              width: 300,
              height: 50
            }
          });
        }
      }
      
      // Step 5: Try to locate a timeline slider
      log("Looking for timeline slider elements...");
      
      // Based on Google Earth's typical interface, timeline sliders are often at the bottom
      // Try clicking and dragging in areas where timeline sliders might be
      const timelineSliderY = dimensions.height - 50; // Near the bottom of the screen
      
      // Try several positions along the bottom of the screen
      for (let i = 0; i < 5; i++) {
        const sliderX = dimensions.width * (i + 1) / 6; // Divide screen into 6 parts
        
        log(`Testing potential timeline slider at (${sliderX}, ${timelineSliderY})...`);
        
        // First just click
        await page.mouse.click(sliderX, timelineSliderY);
        await sleep(1000);
        
        const afterSliderClickPath = path.join(OUTPUT_DIR, `12_after_slider_click_${i+1}.png`);
        await page.screenshot({ path: afterSliderClickPath, fullPage: true });
        
        // Then try dragging from this position to the left
        await page.mouse.move(sliderX, timelineSliderY);
        await page.mouse.down();
        await page.mouse.move(sliderX - 100, timelineSliderY, { steps: 10 });
        await page.mouse.up();
        await sleep(2000);
        
        const afterDragLeftPath = path.join(OUTPUT_DIR, `13_after_drag_left_${i+1}.png`);
        await page.screenshot({ path: afterDragLeftPath, fullPage: true });
        
        // Take a close-up of the date display area
        const dateRegionPath = path.join(OUTPUT_DIR, `14_date_region_after_drag_left_${i+1}.png`);
        await page.screenshot({
          path: dateRegionPath,
          clip: {
            x: 0,
            y: dimensions.height - 40,
            width: 300,
            height: 40
          }
        });
        
        // Then drag to the right
        await page.mouse.move(sliderX, timelineSliderY);
        await page.mouse.down();
        await page.mouse.move(sliderX + 100, timelineSliderY, { steps: 10 });
        await page.mouse.up();
        await sleep(2000);
        
        const afterDragRightPath = path.join(OUTPUT_DIR, `15_after_drag_right_${i+1}.png`);
        await page.screenshot({ path: afterDragRightPath, fullPage: true });
        
        // Take a close-up of the date display area again
        const dateRegionAfterRightPath = path.join(OUTPUT_DIR, `16_date_region_after_drag_right_${i+1}.png`);
        await page.screenshot({
          path: dateRegionAfterRightPath,
          clip: {
            x: 0,
            y: dimensions.height - 40,
            width: 300,
            height: 40
          }
        });
      }
      
    } else {
      log(`No significant changes detected after clicking the adjusted history icon position`);
      
      // If the adjusted position didn't work, try a systematic approach
      log("Trying a systematic approach to find the history icon...");
      
      // Try each potential icon position across the toolbar
      const possibleIconPositions = [];
      for (let x = 400; x <= 600; x += 60) { // Try every 60px from 400 to 600
        possibleIconPositions.push({ x, y: 37 });
      }
      
      let historyButtonActivated = false;
      
      for (const position of possibleIconPositions) {
        if (historyButtonActivated) break;
        
        log(`Trying icon position at (${position.x}, ${position.y})`);
        
        const beforePosClickPath = path.join(OUTPUT_DIR, `17_before_pos_click_${position.x}.png`);
        await page.screenshot({ path: beforePosClickPath, fullPage: true });
        const beforePosData = fs.readFileSync(beforePosClickPath);
        
        // Click the position
        await page.mouse.click(position.x, position.y);
        await sleep(3000);
        
        const afterPosClickPath = path.join(OUTPUT_DIR, `18_after_pos_click_${position.x}.png`);
        await page.screenshot({ path: afterPosClickPath, fullPage: true });
        const afterPosData = fs.readFileSync(afterPosClickPath);
        
        // Check if there were significant changes
        if (hasSignificantChanges(beforePosData, afterPosData)) {
          log(`Detected significant changes after clicking position (${position.x}, ${position.y}). History mode may be activated.`);
          historyButtonActivated = true;
          
          // Now try to interact with the timeline as in the main branch
          // (Timeline interaction code would go here, similar to above)
        }
      }
    }
    
    // Take a final screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '19_final_state.png'),
      fullPage: true
    });
    
    log("Exploration complete. Check the output directory for captured screenshots.");
    
  } catch (error) {
    log(`Error during capture: ${error.message}`);
    console.error(error);
    
    // Take error screenshot
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'error_state.png'),
      fullPage: true
    });
  } finally {
    await browser.close();
    log("Browser closed");
  }
}

// Run the script
captureHistoricalImagery().catch(error => {
  console.error("Unhandled error:", error);
});