# Google Earth Historical Imagery Collector

This Node.js application uses Puppeteer to automatically collect historical satellite imagery from Google Earth Web for a specified location from 2019 to the present.

## Features

- Searches for any location on Google Earth Web
- Automatically activates historical imagery mode
- Captures screenshots for available imagery from 2019 (or a specified year) to present
- Organizes images with timestamps in a folder
- Creates a ZIP archive for easy sharing/storage
- Includes both CLI interface and programmatic API

## Requirements

- Node.js 14.x or higher
- npm or yarn

## Installation

1. Clone the repository or download the files
2. Install dependencies:

```bash
npm install
```

## Usage

### Command Line Interface

Run the script and follow the prompts:

```bash
npm start
```

You will be asked to:
1. Enter a location (name or coordinates)
2. Specify a start year (defaults to 2019)
3. Choose whether to run in headless mode

### Programmatic API

You can also use the tool programmatically in your own Node.js applications:

```javascript
const { captureHistoricalImagery } = require('./index');

async function run() {
  try {
    const zipPath = await captureHistoricalImagery(
      'Accra, Ghana',    // Location
      2019,              // Start year
      false              // Headless mode (false = show browser)
    );
    
    console.log(`Images saved to: ${zipPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
```

## Notes and Limitations

- The script relies on Google Earth Web's UI elements, which may change over time. If Google updates their interface, the selectors in the script may need to be updated.
- Some locations may have limited or no historical imagery available.
- Google Earth Web may sometimes show a login prompt or other dialogs that could interrupt the automation. The script attempts to handle common cases.
- Running in non-headless mode (showing the browser) is recommended for debugging or when first using the tool.
- Google may rate-limit requests if too many are made in a short period.

## Troubleshooting

If you encounter issues:

1. Try running in non-headless mode to see what's happening
2. Check the console output for error messages
3. Look for error screenshots in the output directory
4. Verify your internet connection is stable
5. Make sure Google Earth Web is accessible from your location
6. Try a different location or time period

## License

MIT