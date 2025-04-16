/**
 * Google Earth Historical Imagery Collector - Updated for current interface
 * 
 * This script uses Puppeteer to capture historical satellite imagery from Google Earth Web
 * Specifically customized for the interface seen in April 2025
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configuration
const COORDINATES = "5.55551247,-0.26162416";
const START_YEAR = 2019;
const HEADLESS = false; // Set to true to run without UI
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
const WAIT_TIMEOUT = 60000; // 60 seconds timeout

// Updated selectors based on the current Google Earth interface
const SELECTORS = {
  // Search elements
  searchIcon: '.search-icon, [aria-label="Search"]',
  searchInput: 'input[placeholder="Search Google Earth"], #earth-search-input',
  
  // Menu and Timeline
  toolsMenu: 'button:has-text("Tools"), #menu-button-tools',
  historyOption: '[data-value="HistoricalImagery"], [data-tooltip="Historical imagery"]',
  timelineContainer: '.earth-time-scrubber, .time-control-container',
  
  // Date controls
  datePicker: '.date-input, [aria-label="Date selector"]',
  datePickerYear: '[aria-label="Year"], .date-year-selector',
  datePickerMonth: '[aria-label="Month"], .date-month-selector',
  dateApplyButton: '.apply-button, [aria-label="Apply"]',
  
  // Navigation
  zoomInButton: '.zoom-controls-in, [data-tooltip="Zoom in"]',
  
  // Loading indicators
  loadingProgress: '.loading-progress, .earth-loading'
};

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
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
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
    
    console.log("Page loaded. Taking initial screenshot...");
    await page.screenshot({
      path: path.join(outputDir, 'initial_load.png'),
      fullPage: true
    });
    
    // Wait for initial load
    console.log("Waiting for Google Earth interface to load...");
    await sleep(10000);
    
    // Take screenshot after waiting
    await page.screenshot({
      path: path.join(outputDir, 'after_wait.png'),
      fullPage: true
    });
    
    // Check if we can see the search input or icon
    const hasSearchInterface = await page.evaluate(() => {
      const searchInput = document.querySelector('input[placeholder="Search Google Earth"]');
      const searchBox = document.querySelector('.search-box');
      const searchIcon = document.querySelector('.search-icon');
      
      return {
        hasSearchInput: !!searchInput,
        hasSearchBox: !!searchBox,
        hasSearchIcon: !!searchIcon
      };
    });
    
    console.log("Search interface check:", hasSearchInterface);
    
    // Find and click the search icon/input
    if (hasSearchInterface.hasSearchInput || hasSearchInterface.hasSearchBox || hasSearchInterface.hasSearchIcon) {
      console.log("Found search interface elements, proceeding with search");
      
      try {
        // Click on search icon or input field
        if (hasSearchInterface.hasSearchIcon) {
          await page.click('.search-icon');
          console.log("Clicked search icon");
        } else if (hasSearchInterface.hasSearchBox) {
          await page.click('.search-box');
          console.log("Clicked search box");
        } else {
          await page.click('input[placeholder="Search Google Earth"]');
          console.log("Clicked search input");
        }
        
        await sleep(2000);
        
        // Type the coordinates in the search field
        console.log(`Entering coordinates: ${COORDINATES}`);
        await page.type('input[placeholder="Search Google Earth"]', COORDINATES);
        await page.keyboard.press('Enter');
        
        // Wait for search results to load
        console.log("Waiting for location to load...");
        await sleep(10000);
        
        // Take screenshot after search
        await page.screenshot({
          path: path.join(outputDir, 'after_search.png'),
          fullPage: true
        });
        
        // Try to find the Tools menu and click on it
        console.log("Looking for Tools menu...");
        const toolsMenuVisible = await page.evaluate(() => {
          const toolsButton = document.querySelector('button:has-text("Tools")') || 
                            document.querySelector('#menu-button-tools');
          return !!toolsButton;
        });
        
        if (toolsMenuVisible) {
          console.log("Found Tools menu, clicking it");
          await page.click('button:has-text("Tools")');
          await sleep(2000);
          
          // Look for Historical Imagery option
          console.log("Looking for Historical Imagery option...");
          const hasHistoricalOption = await page.evaluate(() => {
            const menuItems = Array.from(document.querySelectorAll('.menu-item, .dropdown-item'));
            const historyItem = menuItems.find(item => 
              item.textContent.includes('Historical imagery') || 
              item.getAttribute('data-value') === 'HistoricalImagery'
            );
            return !!historyItem;
          });
          
          if (hasHistoricalOption) {
            console.log("Found Historical Imagery option, clicking it");
            await page.evaluate(() => {
              const menuItems = Array.from(document.querySelectorAll('.menu-item, .dropdown-item'));
              const historyItem = menuItems.find(item => 
                item.textContent.includes('Historical imagery') || 
                item.getAttribute('data-value') === 'HistoricalImagery'
              );
              if (historyItem) historyItem.click();
            });
            
            await sleep(3000);
            
            // Take screenshot after activating historical imagery
            await page.screenshot({
              path: path.join(outputDir, 'historical_mode.png'),
              fullPage: true
            });
            
            // Check for timeline
            console.log("Checking for timeline elements...");
            const hasTimeline = await page.evaluate(() => {
              const timeControls = document.querySelector('.earth-time-scrubber') || 
                                document.querySelector('.time-control-container');
              return !!timeControls;
            });
            
            if (hasTimeline) {
              console.log("Found timeline, proceeding with date selection");
              // Here you would normally proceed with selecting dates and capturing screenshots
              
              // For now, let's just take a screenshot of the timeline interface
              await page.screenshot({
                path: path.join(outputDir, 'timeline_view.png'),
                fullPage: true
              });
              
              console.log("Successfully detected key interface elements. Manual adjustment of selectors needed for full automation.");
            } else {
              console.log("Timeline not found after activating historical imagery");
            }
          } else {
            console.log("Historical Imagery option not found in Tools menu");
          }
        } else {
          console.log("Tools menu not found");
        }
      } catch (e) {
        console.error("Error during search and navigation:", e.message);
        
        // Take error state screenshot
        await page.screenshot({
          path: path.join(outputDir, 'search_error.png'),
          fullPage: true
        });
      }
    } else {
      console.log("Search interface elements not found");
      
      // Take screenshot of interface
      await page.screenshot({
        path: path.join(outputDir, 'interface_state.png'),
        fullPage: true
      });
    }
    
    // Save current page HTML for analysis
    const pageContent = await page.content();
    fs.writeFileSync(path.join(outputDir, 'page_source.html'), pageContent);
    
    console.log("Diagnostic information captured in output directory");
    return outputDir;
    
  } catch (error) {
    console.error('Error during capture process:', error);
    
    try {
      await page.screenshot({
        path: path.join(outputDir, 'error_state.png'),
        fullPage: true
      });
      
      // Save page HTML for debugging
      const pageContent = await page.content();
      fs.writeFileSync(path.join(outputDir, 'error_page_source.html'), pageContent);
      
      console.log("Error state information saved");
    } catch (e) {
      console.error("Couldn't save diagnostic information:", e.message);
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
    console.log("\n✅ Diagnostic capture completed!");
    console.log(`📁 Check screenshots and page source in: ${outputDir}`);
    console.log("\nNote: This script needs to be customized based on the diagnostic information to create a complete solution.");
  })
  .catch(error => {
    console.error("\n❌ Capture process failed:", error.message);
  });