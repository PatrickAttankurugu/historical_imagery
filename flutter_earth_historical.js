/**
 * Google Earth Historical Imagery Collector - For Flutter-based Google Earth
 * 
 * This script uses Puppeteer to automate the Flutter-based Google Earth Web interface
 * It uses mouse simulations and keyboard shortcuts to navigate the interface
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuration
const COORDINATES = "5.55551247,-0.26162416";
const START_YEAR = 2019;
const HEADLESS = false; // Set to false to see what's happening
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
const WAIT_TIMEOUT = 60000; // 60 seconds timeout

// Helper functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDatesFromStartYear(startYear) {
  const dates = [];
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date();
  
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return dates;
}

function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    output.on('close', () => {
      console.log(`Archive created: ${outputPath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Main function
async function captureHistoricalImagery() {
  console.log(`Starting capture for ${COORDINATES} from ${START_YEAR} to present...`);
  
  // Create output directory
  const sanitizedLocation = COORDINATES.toString().replace(/[^a-z0-9\-\.]/gi, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'output', `${sanitizedLocation}_${timestamp}`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`Output directory: ${outputDir}`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: DEFAULT_VIEWPORT,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });
  
  const page = await browser.newPage();
  page.setDefaultTimeout(WAIT_TIMEOUT);
  
  try {
    // Navigate to Google Earth Web
    console.log("Opening Google Earth Web...");
    await page.goto('https://earth.google.com/web/', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log("Waiting for Earth to load...");
    await sleep(10000); // Wait for the Earth to fully render
    
    await page.screenshot({
      path: path.join(outputDir, 'initial_load.png'),
      fullPage: true
    });
    
    // STEP 1: Click the search box using mouse coordinates
    console.log("Clicking search box...");
    // The search box appears in the top-left area of the screen
    await page.mouse.click(180, 37); // Adjusted coordinates based on your screenshots
    await sleep(2000);
    
    await page.screenshot({
      path: path.join(outputDir, 'after_search_click.png'),
      fullPage: true
    });
    
    // STEP 2: Enter coordinates
    console.log(`Entering coordinates: ${COORDINATES}`);
    await page.keyboard.type(COORDINATES);
    await sleep(1000);
    await page.keyboard.press('Enter');
    
    // Wait for location to load
    console.log("Waiting for location to load...");
    await sleep(10000);
    
    await page.screenshot({
      path: path.join(outputDir, 'after_search.png'),
      fullPage: true
    });
    
    // STEP 3: Click on Tools menu
    console.log("Clicking Tools menu...");
    // Tools menu is in the top menu bar
    await page.mouse.click(176, 9); // Adjusted coordinates for Tools menu
    await sleep(2000);
    
    await page.screenshot({
      path: path.join(outputDir, 'tools_menu.png'),
      fullPage: true
    });
    
    // STEP 4: Look for Historical Imagery option
    // Since we can't easily select elements in the Flutter interface,
    // try using keyboard shortcuts
    console.log("Trying keyboard shortcut for historical imagery...");
    // Try Alt+H which is a common shortcut for Historical imagery in Earth
    await page.keyboard.down('Alt');
    await page.keyboard.press('h');
    await page.keyboard.up('Alt');
    await sleep(3000);
    
    await page.screenshot({
      path: path.join(outputDir, 'after_shortcut.png'),
      fullPage: true
    });
    
    // Another approach: Try clicking where Historical Imagery might be in the Tools menu
    console.log("Trying to click on Historical Imagery option...");
    await page.mouse.click(250, 250); // Approximate position of Historical Imagery in menu
    await sleep(3000);
    
    await page.screenshot({
      path: path.join(outputDir, 'after_history_click.png'),
      fullPage: true
    });
    
    // STEP 5: Try zooming in to get better detail for the specified location
    console.log("Zooming in for better detail...");
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('+');
      await sleep(1000);
    }
    
    await page.screenshot({
      path: path.join(outputDir, 'zoomed_in.png'),
      fullPage: true
    });
    
    // STEP 6: Try accessing date selector if timeline appeared
    console.log("Checking if timeline is visible and capturing current state...");
    await page.screenshot({
      path: path.join(outputDir, 'timeline_check.png'),
      fullPage: true
    });
    
    // Instead of trying to automatically capture all dates, which is difficult
    // with the Flutter interface, let's take screenshots of important parts of
    // the interface that will help us understand how to interact with it
    
    // Take screenshots of different sections of the screen
    for (let x = 200; x < 1800; x += 400) {
      for (let y = 200; y < 900; y += 200) {
        await page.mouse.move(x, y);
        await sleep(500);
        await page.screenshot({
          path: path.join(outputDir, `section_${x}_${y}.png`),
          fullPage: true
        });
      }
    }
    
    console.log("Diagnostic exploration complete");
    console.log("Captured various interface elements for analysis");
    
    return outputDir;
    
  } catch (error) {
    console.error('Error during capture process:', error);
    
    try {
      await page.screenshot({
        path: path.join(outputDir, 'error_state.png'),
        fullPage: true
      });
      console.log("Error state screenshot saved");
    } catch (e) {
      console.error("Couldn't take error screenshot:", e.message);
    }
    
    throw error;
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}

// Run the program
captureHistoricalImagery()
  .then(outputDir => {
    console.log("\n✅ Diagnostic exploration completed!");
    console.log(`📁 Check screenshots in: ${outputDir}`);
    console.log("\nNext steps:");
    console.log("1. Review the screenshots to understand the interface");
    console.log("2. Identify if historical imagery is accessible through the interface");
    console.log("3. Determine whether automation is feasible with this approach");
  })
  .catch(error => {
    console.error("\n❌ Exploration process failed:", error.message);
  });