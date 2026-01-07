#!/bin/bash

# Script to update all axios imports to use axiosInstance

cd src

# Find all files that import axios
find . -name "*.js" -type f | while read file; do
  if grep -q "import axios from 'axios'" "$file"; then
    # Get relative path depth
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    
    # Calculate relative path to utils/axios.js
    if [ $depth -eq 1 ]; then
      # pages/SuperAdmin/file.js -> ../../utils/axios
      rel_path="../../utils/axios"
    elif [ $depth -eq 2 ]; then
      # pages/VendorAdmin/file.js -> ../../utils/axios
      rel_path="../../utils/axios"
    elif [ $depth -eq 3 ]; then
      # pages/VendorAdmin/sub/file.js -> ../../../utils/axios
      rel_path="../../../utils/axios"
    else
      rel_path="../../utils/axios"
    fi
    
    echo "Updating $file..."
    
    # Replace import
    sed -i '' "s|import axios from 'axios'|import axiosInstance from '$rel_path'|g" "$file"
    
    # Replace axios. with axiosInstance.
    sed -i '' 's/axios\./axiosInstance./g' "$file"
    
    # Remove /api prefix from URLs (baseURL already includes /api)
    sed -i '' "s|'/api/|'|g" "$file"
    sed -i '' 's|"/api/|"|g' "$file"
    sed -i '' "s|\`/api/|\`|g" "$file"
  fi
done

echo "Done!"

