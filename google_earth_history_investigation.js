/**
 * Google Earth Historical Imagery Direct Access Investigation
 * 
 * This script explores methods to access historical imagery in Google Earth Web
 * through URL parameters and JavaScript console interactions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const COORDINATES = "5.55551247,-0.26162416";
const OUTPUT_DIR = path.join(__dirname, 'output', `investigation_${new Date().toISOString().replace(/[:.]/g, '-')}`);

// Create the output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Method 1: Try different URL parameters to access historical imagery
 */
async function tryUrlParameters() {
  console.log("Testing URL parameter approach...");
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  // List of potential URL parameter patterns to test
  const urlPatterns = [
    // Basic coordinates
    `https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r`,
    
    // Add potential time parameters
    `https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r/data=KAI`,
    
    // Try with history flag
    `https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r?history=1`,
    
    // Try with time parameter
    `https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r/data=date=20190101`,
    
    // Try with different date format
    `https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r/when/2019`,
    
    // Try the Earth Time Machine format
    `https://earth.google.com/web/search/${COORDINATES}/@${COORDINATES},873a,35y,0h,0t,0r/data=KAE`
  ];
  
  // Test each URL pattern
  for (let i = 0; i < urlPatterns.length; i++) {
    const url = urlPatterns[i];
    console.log(`Testing URL pattern ${i+1}: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Take a screenshot to record what happened
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `url_pattern_${i+1}.png`),
        fullPage: true
      });
      
      // Wait a bit to observe the result
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error(`Error with URL pattern ${i+1}:`, error.message);
    }
  }
  
  await browser.close();
}

/**
 * Method 2: Try to use JavaScript console commands to activate historical imagery
 */
async function tryJavaScriptCommands() {
  console.log("Testing JavaScript console commands approach...");
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  // Navigate to Google Earth Web with basic coordinates
  try {
    await page.goto(`https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r`, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Give Earth time to load
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Take screenshot of initial state
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'js_initial_state.png'),
      fullPage: true
    });
    
    // List of JavaScript commands to try
    const commands = [
      // Try to find history related functions or objects
      `Object.keys(window).filter(k => k.toLowerCase().includes('history') || k.toLowerCase().includes('time')).slice(0, 20)`,
      
      // Try to inspect the Flutter application
      `window.flutter && Object.keys(window.flutter)`,
      
      // Check for Earth-specific global objects
      `Object.keys(window).filter(k => k.toLowerCase().includes('earth') || k.toLowerCase().includes('map')).slice(0, 20)`,
      
      // Look for React or Angular components
      `document.querySelector('[data-reactroot]') || document.querySelectorAll('[ng-*]').length`,
      
      // Check for potential APIs
      `window.googleearth || window.ee || window.google && window.google.earth`
    ];
    
    // Execute each command and log the result
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executing JS command ${i+1}: ${command}`);
      
      try {
        const result = await page.evaluate(cmd => {
          try {
            // Execute the command
            const res = eval(cmd);
            return {
              success: true,
              result: typeof res === 'object' ? JSON.stringify(res) : String(res)
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
          }
        }, command);
        
        console.log(`Result for command ${i+1}:`, result);
        
        // Save the result to file
        fs.writeFileSync(
          path.join(OUTPUT_DIR, `js_command_${i+1}_result.json`),
          JSON.stringify(result, null, 2)
        );
      } catch (error) {
        console.error(`Error executing command ${i+1}:`, error.message);
      }
    }
    
    // Try to find and trigger Tools menu
    try {
      console.log("Attempting to find and click Tools menu...");
      
      await page.evaluate(() => {
        // Try to find the Tools menu button by text content
        const menuButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const toolsButton = menuButtons.find(el => 
          el.textContent && el.textContent.toLowerCase().includes('tools')
        );
        
        if (toolsButton) {
          console.log("Found Tools button, clicking...");
          toolsButton.click();
          return true;
        }
        
        // Try by role and position
        const allButtons = document.querySelectorAll('button, [role="button"]');
        if (allButtons.length > 3) {
          console.log("Clicking potential Tools button by position...");
          allButtons[3].click();
          return true;
        }
        
        return false;
      });
      
      // Wait a moment for menu to appear
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take screenshot after menu interaction
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'js_after_tools_menu.png'),
        fullPage: true
      });
      
      // Try to find and click a Historical Imagery option
      const foundHistoricalOption = await page.evaluate(() => {
        // Look for historical imagery option in menu
        const menuItems = Array.from(document.querySelectorAll('a, li, div[role="menuitem"], [role="option"]'));
        const historyOption = menuItems.find(el => 
          el.textContent && (
            el.textContent.toLowerCase().includes('history') ||
            el.textContent.toLowerCase().includes('time') ||
            el.textContent.toLowerCase().includes('past')
          )
        );
        
        if (historyOption) {
          console.log("Found historical option, clicking...");
          historyOption.click();
          return true;
        }
        
        return false;
      });
      
      console.log("Historical option found and clicked:", foundHistoricalOption);
      
      // Wait for any UI changes
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take final screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'js_final_state.png'),
        fullPage: true
      });
      
    } catch (error) {
      console.error("Error during menu interaction:", error.message);
    }
    
  } catch (error) {
    console.error("Error in JavaScript approach:", error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Method 3: Try to find network requests that might reveal time-based API
 */
async function monitorNetworkRequests() {
  console.log("Monitoring network requests...");
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  // Storage for requests
  const requests = [];
  
  // Set up request interception
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('earth') || url.includes('maps') || url.includes('google')) {
      requests.push({
        url: url,
        method: request.method(),
        resourceType: request.resourceType(),
        headers: request.headers()
      });
    }
    request.continue();
  });
  
  try {
    // Navigate to Google Earth Web
    await page.goto(`https://earth.google.com/web/@${COORDINATES},873a,35y,0h,0t,0r`, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    // Wait for the page to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Save the requests
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'network_requests.json'),
      JSON.stringify(requests, null, 2)
    );
    
    console.log(`Captured ${requests.length} network requests`);
    
    // Analyze the requests for anything related to time or historical data
    const timeRelatedRequests = requests.filter(req => 
      req.url.includes('time') || 
      req.url.includes('history') || 
      req.url.includes('date') ||
      req.url.includes('archive')
    );
    
    if (timeRelatedRequests.length > 0) {
      console.log("Found potentially time-related requests:", timeRelatedRequests.length);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'time_related_requests.json'),
        JSON.stringify(timeRelatedRequests, null, 2)
      );
    } else {
      console.log("No time-related requests found in the initial load");
    }
    
  } catch (error) {
    console.error("Error monitoring network requests:", error.message);
  } finally {
    await browser.close();
  }
}

// Main function
async function investigateHistoricalAccess() {
  console.log("Starting investigation of Google Earth historical imagery access...");
  console.log(`Results will be saved to: ${OUTPUT_DIR}`);
  
  // Run all investigation methods
  await tryUrlParameters();
  await tryJavaScriptCommands();
  await monitorNetworkRequests();
  
  console.log("Investigation complete. Check the output directory for results.");
}

// Run the investigation
investigateHistoricalAccess().catch(console.error);