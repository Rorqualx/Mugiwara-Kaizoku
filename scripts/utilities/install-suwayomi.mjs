#!/usr/bin/env node

/**
 * @file Suwayomi Server Installation Script
 * @description Installs and configures the Suwayomi manga server by downloading the latest release
 * from GitHub and setting up the necessary directory structure and configuration files.
 * 
 * Features:
 * - Automatic Java runtime detection (requires Java 21+)
 * - Docker environment support
 * - Platform-specific Java installation instructions
 * - Default configuration file generation
 * - Custom installation paths support
 * 
 * Usage:
 * ```bash
 * # Default installation
 * node scripts/install-suwayomi.mjs
 * 
 * # Custom paths
 * node scripts/install-suwayomi.mjs /custom/server/path /custom/config/path
 * ```
 * 
 * Environment Variables:
 * - DOCKER: Set to 'true' to skip Java check in Docker environments
 * - DISABLE_SUWAYOMI: Set to 'true' to skip installation
 * 
 * Exit Codes:
 * - 0: Success
 * - 1: General error
 * - 2: Java not installed or version < 21
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import process from 'process';
import { platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

// For better error handling
const execAsync = promisify(exec);

// Use process.cwd() instead of fileURLToPath
const projectRoot = process.cwd();

// Default paths
const defaultServerPath = path.join(projectRoot, 'data', 'suwayomi-server');
const defaultConfigPath = path.join(projectRoot, 'data', 'suwayomi-config');

// Parse command line arguments
const args = process.argv.slice(2);
const serverPath = args[0] || defaultServerPath;
const configPath = args[1] || defaultConfigPath;

// Check if running in Docker environment
const isDocker = process.env.DOCKER === 'true';
const isSuwayomiDisabled = process.env.DISABLE_SUWAYOMI === 'true';

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Downloads and installs the latest Suwayomi server release
 * 
 * Installation steps:
 * 1. Creates required directories
 * 2. Fetches latest release info from GitHub
 * 3. Downloads the server JAR file
 * 4. Saves to specified location
 * 
 * @returns {Promise<void>}
 * @throws {Error} If download or file operations fail
 * 
 * @example
 * await downloadSuwayomiServer();
 */
async function downloadSuwayomiServer() {
  console.log(`${colors.blue}Installing Suwayomi Server...${colors.reset}`);
  
  // Create directories if they don't exist
  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }
  
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configPath, { recursive: true });
  }
  
  const jarPath = path.join(serverPath, 'Suwayomi-Server.jar');
  
  // Check if JAR already exists
  if (fs.existsSync(jarPath)) {
    console.log(`${colors.yellow}Suwayomi Server JAR already exists. Checking for updates...${colors.reset}`);
  }
  
  try {
    // Get the latest release info from GitHub API
    console.log(`${colors.blue}Fetching latest release information...${colors.reset}`);
    const releaseResponse = await axios.get(
      'https://api.github.com/repos/Suwayomi/Suwayomi-Server/releases/latest'
    );
    
    const assets = releaseResponse.data.assets;
    const jarAsset = assets.find(asset => 
      asset.name.endsWith('.jar') && 
      !asset.name.includes('sources') && 
      !asset.name.includes('javadoc')
    );
    
    if (!jarAsset) {
      console.error(`${colors.red}Could not find JAR file in the latest release${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.green}Found release: ${releaseResponse.data.tag_name}${colors.reset}`);
    console.log(`${colors.blue}Downloading ${jarAsset.name}...${colors.reset}`);
    
    // Download the JAR file
    const response = await axios({
      method: 'get',
      url: jarAsset.browser_download_url,
      responseType: 'stream'
    });
    
    // Save to disk
    const writer = fs.createWriteStream(jarPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`${colors.green}Suwayomi Server downloaded successfully to ${jarPath}${colors.reset}`);
        resolve();
      });
      writer.on('error', err => {
        console.error(`${colors.red}Error downloading Suwayomi Server: ${err}${colors.reset}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Parse Java version string into a comparable version object
 * 
 * @param {string} versionString - Raw Java version string
 * @returns {object} Version object with major, minor, and patch numbers
 */
function parseJavaVersion(versionString) {
  // Handle different format patterns
  // Pattern 1: "1.8.0_25" (old style)
  // Pattern 2: "11.0.2" (new style)
  // Pattern 3: "17.0.1"
  // Pattern 4: "openjdk version \"17.0.2\""
  
  // Extract just the version numbers
  const versionMatch = versionString.match(/\d+(\.\d+)(\.\d+)?(_\d+)?/);
  
  if (!versionMatch) {
    return { major: 0, minor: 0, patch: 0 };
  }
  
  const versionParts = versionMatch[0].split('.');
  
  // For old versions like "1.8.0_25", the major version is the second number (8)
  if (versionParts[0] === '1' && versionParts.length > 1) {
    return {
      major: parseInt(versionParts[1], 10),
      minor: versionParts[2] ? parseInt(versionParts[2].split('_')[0], 10) : 0,
      patch: 0
    };
  }
  
  // For new versions like "11.0.2", the major version is the first number
  return {
    major: parseInt(versionParts[0], 10),
    minor: versionParts[1] ? parseInt(versionParts[1], 10) : 0,
    patch: versionParts[2] ? parseInt(versionParts[2].split('_')[0], 10) : 0
  };
}

/**
 * Verifies Java runtime installation and version
 * 
 * @returns {Promise<{installed: boolean, version: string, majorVersion: number}>} Java installation status
 * 
 * @example
 * const javaStatus = await checkJava();
 * if (javaStatus.installed && javaStatus.majorVersion >= 11) {
 *   console.log('Java meets requirements');
 * }
 */
async function checkJava() {
  // First check macOS Homebrew locations directly for Java 21
  const brewPaths = [
    '/usr/local/opt/openjdk@21/bin/java',
    '/opt/homebrew/opt/openjdk@21/bin/java'
  ];
  
  for (const javaPath of brewPaths) {
    if (fs.existsSync(javaPath)) {
      try {
        const { stdout, stderr } = await execAsync(`${javaPath} -version`);
        const output = stderr || stdout;
        
        if (output && output.includes('version')) {
          const versionMatch = output.match(/version "([^"]+)"/);
          const version = versionMatch ? versionMatch[1] : 'unknown';
          
          console.log(`${colors.green}✓ Java 21 found at ${javaPath}${colors.reset}`);
          console.log(`${colors.blue}Note: Add this to your PATH to use Java 21 globally:${colors.reset}`);
          console.log(`${colors.cyan}export PATH="${path.dirname(javaPath)}:$PATH"${colors.reset}`);
          
          return { 
            installed: true, 
            version, 
            majorVersion: 21
          };
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }
  
  // Fall back to checking java in PATH
  try {
    const { stdout, stderr } = await execAsync('java -version');
    
    // Java outputs version info to stderr
    const output = stderr || stdout;
    
    if (output && output.includes('version')) {
      const versionMatch = output.match(/version "([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      // Parse the version to check if it meets requirements
      const parsedVersion = parseJavaVersion(output);
      
      console.log(`${colors.green}✓ Java is installed: ${version} (Major version: ${parsedVersion.major})${colors.reset}`);
      
      return { 
        installed: true, 
        version, 
        majorVersion: parsedVersion.major
      };
    }
    
    console.log(`${colors.red}✗ Java is installed but version check returned unexpected output${colors.reset}`);
    return { installed: false, version: 'unknown', majorVersion: 0 };
  } catch (error) {
    console.log(`${colors.red}✗ Java is not installed or not in PATH${colors.reset}`);
    return { installed: false, version: 'unknown', majorVersion: 0 };
  }
}

/**
 * Displays platform-specific Java installation instructions
 */
function printJavaInstallInstructions() {
  const osType = platform();
  
  console.error(`${colors.bold}${colors.yellow}Suwayomi requires Java 21 or higher to run.${colors.reset}`);
  console.error(`${colors.bold}Please install Java using one of the following methods:${colors.reset}\n`);
  
  if (osType === 'darwin') {
    // macOS
    console.error(`${colors.bold}${colors.blue}For macOS:${colors.reset}`);
    console.error(`1. Install Homebrew if not already installed:`);
    console.error(`   ${colors.cyan}/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"${colors.reset}`);
    console.error(`2. Install OpenJDK 21:`);
    console.error(`   ${colors.cyan}brew install openjdk@21${colors.reset}`);
    console.error(`3. Add Java to your PATH:`);
    console.error(`   ${colors.cyan}echo 'export PATH="$(brew --prefix)/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc${colors.reset}`);
    console.error(`   ${colors.cyan}source ~/.zshrc${colors.reset}`);
    console.error(`\nAlternatively, use SDKMAN (https://sdkman.io):`);
    console.error(`   ${colors.cyan}curl -s "https://get.sdkman.io" | bash${colors.reset}`);
    console.error(`   ${colors.cyan}source "$HOME/.sdkman/bin/sdkman-init.sh"${colors.reset}`);
    console.error(`   ${colors.cyan}sdk install java 21.0.2-tem${colors.reset}`);
  } else if (osType === 'win32') {
    // Windows
    console.error(`${colors.bold}${colors.blue}For Windows:${colors.reset}`);
    console.error(`1. Download OpenJDK from: ${colors.cyan}https://adoptium.net/${colors.reset}`);
    console.error(`2. Run the installer and follow the instructions`);
    console.error(`3. Restart your terminal/command prompt`);
    console.error(`\nAlternatively, install using winget:`);
    console.error(`   ${colors.cyan}winget install EclipseAdoptium.Temurin.21.JRE${colors.reset}`);
    console.error(`\nOr using Chocolatey:`);
    console.error(`   ${colors.cyan}choco install temurin21 -y${colors.reset}`);
  } else {
    // Linux
    console.error(`${colors.bold}${colors.blue}For Ubuntu/Debian:${colors.reset}`);
    console.error(`   ${colors.cyan}sudo apt update && sudo apt install openjdk-21-jre-headless${colors.reset}`);
    console.error(`\n${colors.bold}${colors.blue}For Fedora/RHEL:${colors.reset}`);
    console.error(`   ${colors.cyan}sudo dnf install java-21-openjdk-headless${colors.reset}`);
    console.error(`\n${colors.bold}${colors.blue}For Arch Linux:${colors.reset}`);
    console.error(`   ${colors.cyan}sudo pacman -S jre-openjdk-headless${colors.reset}`);
    console.error(`\nAlternatively, use SDKMAN (https://sdkman.io):`);
    console.error(`   ${colors.cyan}curl -s "https://get.sdkman.io" | bash${colors.reset}`);
    console.error(`   ${colors.cyan}source "$HOME/.sdkman/bin/sdkman-init.sh"${colors.reset}`);
    console.error(`   ${colors.cyan}sdk install java 21.0.2-tem${colors.reset}`);
  }
  
  console.error(`\n${colors.bold}After installing Java, run this script again.${colors.reset}`);
  console.error(`${colors.bold}You can enable Suwayomi in the application settings after starting the app.${colors.reset}`);
}

/**
 * Attempts to install Java 21 automatically
 * 
 * @returns {Promise<boolean>} True if installation succeeded
 */
async function attemptJavaInstallation() {
  console.log(`${colors.blue}Attempting to install Java 21 automatically...${colors.reset}`);
  
  try {
    const installScriptPath = path.join(projectRoot, 'scripts', 'install-java-21.sh');
    
    // Check if the install script exists
    if (!fs.existsSync(installScriptPath)) {
      console.error(`${colors.red}Java installation script not found at ${installScriptPath}${colors.reset}`);
      return false;
    }
    
    // Run the installation script
    const { stdout, stderr } = await execAsync(`bash ${installScriptPath}`);
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr && !stderr.includes('[SUCCESS]')) {
      console.error(stderr);
    }
    
    // Re-check Java after installation
    const javaStatus = await checkJava();
    return javaStatus.installed && javaStatus.majorVersion >= 21;
  } catch (error) {
    console.error(`${colors.red}Failed to install Java automatically: ${error.message}${colors.reset}`);
    
    // For non-interactive environments (like build process), just log a warning
    if (process.env.CI || process.env.NONINTERACTIVE || process.env.NODE_ENV === 'production') {
      console.log(`${colors.yellow}Running in non-interactive mode. Skipping manual Java installation.${colors.reset}`);
      return false;
    }
    
    return false;
  }
}

/**
 * Main execution function that orchestrates the installation process
 * 
 * Process flow:
 * 1. Checks for Docker environment
 * 2. Verifies Java installation (attempts auto-install if missing)
 * 3. Downloads Suwayomi server
 * 4. Creates default configuration
 * 
 * @returns {Promise<void>}
 * @throws {Error} If installation fails
 * 
 * @example
 * main().catch(error => {
 *   console.error('Installation failed:', error);
 *   process.exit(1);
 * });
 */
async function main() {
  // Check if Suwayomi is disabled via environment variable
  if (isSuwayomiDisabled) {
    console.log(`${colors.yellow}Suwayomi integration is disabled via environment variable. Skipping installation.${colors.reset}`);
    process.exit(0);
  }
  
  // Skip Java check if running in Docker
  if (isDocker) {
    console.log(`${colors.blue}Running in Docker environment, skipping Java check...${colors.reset}`);
  } else {
    const javaStatus = await checkJava();
    
    if (!javaStatus.installed || javaStatus.majorVersion < 21) {
      if (!javaStatus.installed) {
        console.error(`${colors.red}✗ Java is not installed. Suwayomi requires Java 21+ to run.${colors.reset}`);
      } else {
        console.error(`${colors.red}✗ Java ${javaStatus.version} (Major: ${javaStatus.majorVersion}) is installed, but Suwayomi requires Java 21 or higher.${colors.reset}`);
      }
      
      // Attempt automatic installation
      const installSuccess = await attemptJavaInstallation();
      
      if (!installSuccess) {
        console.error(`${colors.red}Automatic Java installation failed.${colors.reset}`);
        printJavaInstallInstructions();
        
        // Exit with a special code that can be detected by the build process
        process.exit(2);
      }
      
      console.log(`${colors.green}✓ Java 21 installed successfully!${colors.reset}`);
    }
    
    console.log(`${colors.green}✓ Java ${javaStatus.version} (Major: ${javaStatus.majorVersion}) meets the requirements for Suwayomi (requires Java 21+).${colors.reset}`);
  }
  
  await downloadSuwayomiServer();
  
  // Create a basic configuration file if it doesn't exist
  const configFile = path.join(configPath, 'server.conf');
  if (!fs.existsSync(configFile)) {
    console.log(`${colors.blue}Creating default configuration file...${colors.reset}`);
    const defaultConfig = `# Suwayomi Server Configuration
server.port=4567
server.rootDir=${configPath}
server.webUIEnabled=true
server.initialOpenInBrowserEnabled=false
server.webUIInterface=0.0.0.0
server.debugLogsEnabled=false
`;
    fs.writeFileSync(configFile, defaultConfig);
  }
  
  console.log(`${colors.green}${colors.bold}Suwayomi installation complete!${colors.reset}`);
  console.log(`${colors.blue}Suwayomi can be enabled in the application settings.${colors.reset}`);
}

main().catch(error => {
  console.error(`${colors.red}Error:${colors.reset}`, error);
  process.exit(1);
});
