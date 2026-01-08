#!/bin/bash
# Build RakNet FFI shared library for macOS
# Requires: Xcode Command Line Tools, CMake

set -e

echo "============================================================"
echo " RakNet FFI Library Builder (macOS)"
echo "============================================================"
echo

# Check for CMake
if ! command -v cmake &> /dev/null; then
    echo "ERROR: CMake not found!"
    echo
    echo "Please install CMake:"
    echo "  brew install cmake"
    echo "  or download from: https://cmake.org/download/"
    echo
    exit 1
fi

echo "Found CMake: $(command -v cmake)"
echo "CMake version: $(cmake --version | head -n1)"
echo

# Check for compiler
if ! command -v clang++ &> /dev/null; then
    echo "ERROR: clang++ not found!"
    echo
    echo "Please install Xcode Command Line Tools:"
    echo "  xcode-select --install"
    echo
    exit 1
fi

echo "Found compiler: $(command -v clang++)"
echo

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create and enter build directory
mkdir -p Build
cd Build

# Configure
echo "Configuring with CMake..."
cmake -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_OSX_ARCHITECTURES="$(uname -m)" \
      ..

if [ $? -ne 0 ]; then
    echo
    echo "CMake configuration failed!"
    exit 1
fi

# Build
echo
echo "Building Release configuration..."
cmake --build . --config Release -j$(sysctl -n hw.ncpu)

if [ $? -ne 0 ]; then
    echo
    echo "Build failed!"
    exit 1
fi

echo
echo "============================================================"
echo " Build Successful!"
echo "============================================================"
echo
echo "Output: packages/networking/native/libraknet_ffi.dylib"
echo
echo "To use with the emulator:"
echo "  cd Server"
echo "  bun install"
echo "  bun run dev"
echo
