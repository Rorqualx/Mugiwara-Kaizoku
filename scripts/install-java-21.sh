#!/bin/bash

# Java 21 Automatic Installation Script
# This script attempts to install Java 21 automatically based on the platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

log_info "Detecting platform: $PLATFORM $ARCH"

# Function to check if Java 21 is already installed
check_java_21() {
    # Check Homebrew locations first
    if [ -f "/usr/local/opt/openjdk@21/bin/java" ]; then
        log_success "Java 21 already installed via Homebrew (Intel Mac)"
        echo "[SUCCESS] Java 21 is installed at /usr/local/opt/openjdk@21/bin/java"
        return 0
    elif [ -f "/opt/homebrew/opt/openjdk@21/bin/java" ]; then
        log_success "Java 21 already installed via Homebrew (Apple Silicon)"
        echo "[SUCCESS] Java 21 is installed at /opt/homebrew/opt/openjdk@21/bin/java"
        return 0
    fi
    
    # Check if java is in PATH and is version 21+
    if command -v java >/dev/null 2>&1; then
        JAVA_VERSION=$(java -version 2>&1 | grep "version" | awk -F '"' '{print $2}' | cut -d'.' -f1)
        if [ "$JAVA_VERSION" -ge 21 ] 2>/dev/null; then
            log_success "Java $JAVA_VERSION is already installed"
            echo "[SUCCESS] Java $JAVA_VERSION is installed"
            return 0
        fi
    fi
    
    return 1
}

# Check if already installed
if check_java_21; then
    exit 0
fi

# Platform-specific installation
case "$PLATFORM" in
    Darwin)
        log_info "Installing Java 21 on macOS..."
        
        # Check if Homebrew is installed
        if ! command -v brew >/dev/null 2>&1; then
            log_error "Homebrew is not installed"
            log_info "Please install Homebrew first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
        
        # Install OpenJDK 21
        log_info "Installing OpenJDK 21 via Homebrew..."
        if brew install openjdk@21; then
            log_success "OpenJDK 21 installed successfully"
            
            # Create symlinks if needed
            if [ -d "/opt/homebrew/opt/openjdk@21" ]; then
                # Apple Silicon
                log_info "Setting up Java 21 for Apple Silicon..."
                echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
                echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@21"' >> ~/.zshrc
            else
                # Intel Mac
                log_info "Setting up Java 21 for Intel Mac..."
                echo 'export PATH="/usr/local/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
                echo 'export JAVA_HOME="/usr/local/opt/openjdk@21"' >> ~/.zshrc
            fi
            
            log_success "Java 21 installation complete!"
            echo "[SUCCESS] Java 21 installed successfully"
            exit 0
        else
            log_error "Failed to install OpenJDK 21"
            exit 1
        fi
        ;;
        
    Linux)
        log_info "Installing Java 21 on Linux..."
        
        # Detect Linux distribution
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$ID
            VER=$VERSION_ID
        fi
        
        case "$OS" in
            ubuntu|debian)
                log_info "Detected Ubuntu/Debian"
                if command -v apt-get >/dev/null 2>&1; then
                    log_info "Updating package list..."
                    sudo apt-get update -y
                    
                    log_info "Installing OpenJDK 21..."
                    if sudo apt-get install -y openjdk-21-jre-headless; then
                        log_success "Java 21 installed successfully"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    else
                        log_error "Failed to install Java 21"
                        exit 1
                    fi
                fi
                ;;
                
            fedora|rhel|centos)
                log_info "Detected Fedora/RHEL/CentOS"
                if command -v dnf >/dev/null 2>&1; then
                    log_info "Installing OpenJDK 21..."
                    if sudo dnf install -y java-21-openjdk-headless; then
                        log_success "Java 21 installed successfully"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    else
                        log_error "Failed to install Java 21"
                        exit 1
                    fi
                elif command -v yum >/dev/null 2>&1; then
                    log_info "Installing OpenJDK 21..."
                    if sudo yum install -y java-21-openjdk-headless; then
                        log_success "Java 21 installed successfully"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    else
                        log_error "Failed to install Java 21"
                        exit 1
                    fi
                fi
                ;;
                
            arch|manjaro)
                log_info "Detected Arch Linux"
                if command -v pacman >/dev/null 2>&1; then
                    log_info "Installing OpenJDK 21..."
                    if sudo pacman -S --noconfirm jre-openjdk; then
                        log_success "Java 21 installed successfully"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    else
                        log_error "Failed to install Java 21"
                        exit 1
                    fi
                fi
                ;;
                
            *)
                log_warning "Unknown Linux distribution: $OS"
                log_info "Attempting generic installation..."
                
                # Try to use SDKMAN
                if command -v sdk >/dev/null 2>&1; then
                    log_info "Using SDKMAN to install Java 21..."
                    if sdk install java 21.0.2-tem; then
                        log_success "Java 21 installed successfully via SDKMAN"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    fi
                else
                    log_info "Installing SDKMAN..."
                    curl -s "https://get.sdkman.io" | bash
                    source "$HOME/.sdkman/bin/sdkman-init.sh"
                    
                    if sdk install java 21.0.2-tem; then
                        log_success "Java 21 installed successfully via SDKMAN"
                        echo "[SUCCESS] Java 21 installed successfully"
                        exit 0
                    fi
                fi
                ;;
        esac
        ;;
        
    *)
        log_error "Unsupported platform: $PLATFORM"
        log_info "Please install Java 21 manually"
        exit 1
        ;;
esac

# Final check
if check_java_21; then
    exit 0
else
    log_error "Java 21 installation failed"
    exit 1
fi