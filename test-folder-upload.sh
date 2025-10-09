#!/bin/bash
echo "Testing folder upload functionality..."
echo ""
echo "Creating test folder structure:"
mkdir -p /tmp/test-upload-folder/subfolder1/deep
mkdir -p /tmp/test-upload-folder/subfolder2
echo "File 1" > /tmp/test-upload-folder/file1.txt
echo "File 2" > /tmp/test-upload-folder/subfolder1/file2.txt
echo "File 3" > /tmp/test-upload-folder/subfolder1/deep/file3.txt
echo "File 4" > /tmp/test-upload-folder/subfolder2/file4.txt
echo ""
echo "Test folder created at: /tmp/test-upload-folder"
echo ""
tree /tmp/test-upload-folder 2>/dev/null || find /tmp/test-upload-folder -type f
echo ""
echo "Now try uploading this folder via the web interface:"
echo "1. Click 'Upload Folder' button"
echo "2. Select /tmp/test-upload-folder"
echo "3. Upload should create the folder with all subfolders"
