#!/bin/bash

# Simple File Manager - Upload Directory Setup Script
# This script helps you configure and test the upload directory

echo "============================================================"
echo "  Simple File Manager - Upload Directory Setup"
echo "============================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✓ Created .env file"
    else
        echo "✗ .env.example not found. Please create .env manually."
        exit 1
    fi
    echo ""
fi

echo "Choose upload directory type:"
echo ""
echo "1) Relative path (default: ./uploads)"
echo "2) User home directory (~/filemanager-uploads)"
echo "3) Absolute path (custom location)"
echo "4) Show current configuration"
echo "5) Test directory permissions"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        read -p "Enter relative path [uploads]: " rel_path
        rel_path=${rel_path:-uploads}
        
        # Update .env
        if grep -q "^UPLOAD_DIR=" .env; then
            sed -i.bak "s|^UPLOAD_DIR=.*|UPLOAD_DIR=$rel_path|" .env
        else
            echo "UPLOAD_DIR=$rel_path" >> .env
        fi
        
        echo "✓ Set UPLOAD_DIR=$rel_path"
        echo "  This will resolve to: $(pwd)/$rel_path"
        ;;
        
    2)
        echo ""
        read -p "Enter path in home directory [filemanager-uploads]: " home_path
        home_path=${home_path:-filemanager-uploads}
        
        # Update .env
        if grep -q "^UPLOAD_DIR=" .env; then
            sed -i.bak "s|^UPLOAD_DIR=.*|UPLOAD_DIR=~/$home_path|" .env
        else
            echo "UPLOAD_DIR=~/$home_path" >> .env
        fi
        
        # Enable external access (required for home directory)
        if grep -q "^ALLOW_EXTERNAL_UPLOAD_FOLDER=" .env; then
            sed -i.bak "s|^ALLOW_EXTERNAL_UPLOAD_FOLDER=.*|ALLOW_EXTERNAL_UPLOAD_FOLDER=true|" .env
        else
            echo "ALLOW_EXTERNAL_UPLOAD_FOLDER=true" >> .env
        fi
        
        echo "✓ Set UPLOAD_DIR=~/$home_path"
        echo "✓ Set ALLOW_EXTERNAL_UPLOAD_FOLDER=true (required for external paths)"
        echo "  This will resolve to: $HOME/$home_path"
        
        # Create directory
        mkdir -p "$HOME/$home_path"
        echo "✓ Created directory: $HOME/$home_path"
        ;;
        
    3)
        echo ""
        echo "Common locations:"
        echo "  - /var/www/filemanager-uploads"
        echo "  - /opt/filemanager/uploads"
        echo "  - /mnt/storage/uploads"
        echo ""
        read -p "Enter absolute path: " abs_path
        
        if [ -z "$abs_path" ]; then
            echo "✗ Path cannot be empty"
            exit 1
        fi
        
        # Update .env
        if grep -q "^UPLOAD_DIR=" .env; then
            sed -i.bak "s|^UPLOAD_DIR=.*|UPLOAD_DIR=$abs_path|" .env
        else
            echo "UPLOAD_DIR=$abs_path" >> .env
        fi
        
        # Enable external access (required for absolute paths)
        if grep -q "^ALLOW_EXTERNAL_UPLOAD_FOLDER=" .env; then
            sed -i.bak "s|^ALLOW_EXTERNAL_UPLOAD_FOLDER=.*|ALLOW_EXTERNAL_UPLOAD_FOLDER=true|" .env
        else
            echo "ALLOW_EXTERNAL_UPLOAD_FOLDER=true" >> .env
        fi
        
        echo "✓ Set UPLOAD_DIR=$abs_path"
        echo "✓ Set ALLOW_EXTERNAL_UPLOAD_FOLDER=true (required for external paths)"
        
        # Try to create directory
        if mkdir -p "$abs_path" 2>/dev/null; then
            echo "✓ Created directory: $abs_path"
        else
            echo "⚠️  Could not create directory (may need sudo):"
            echo ""
            echo "Run these commands:"
            echo "  sudo mkdir -p $abs_path"
            echo "  sudo chown -R $USER:$USER $abs_path"
            echo "  sudo chmod 755 $abs_path"
        fi
        ;;
        
    4)
        echo ""
        echo "Current configuration:"
        echo "------------------------------------------------------------"
        if grep -q "^UPLOAD_DIR=" .env; then
            UPLOAD_DIR=$(grep "^UPLOAD_DIR=" .env | cut -d'=' -f2-)
            echo "UPLOAD_DIR=$UPLOAD_DIR"
            
            # Check security flag
            if grep -q "^ALLOW_EXTERNAL_UPLOAD_FOLDER=" .env; then
                ALLOW_EXTERNAL=$(grep "^ALLOW_EXTERNAL_UPLOAD_FOLDER=" .env | cut -d'=' -f2-)
                echo "ALLOW_EXTERNAL_UPLOAD_FOLDER=$ALLOW_EXTERNAL"
            else
                echo "ALLOW_EXTERNAL_UPLOAD_FOLDER=false (default)"
            fi
            
            # Resolve the path
            if [[ "$UPLOAD_DIR" == ~* ]]; then
                RESOLVED="${UPLOAD_DIR/#\~/$HOME}"
                echo "Resolves to: $RESOLVED"
                echo "Type: Home directory (external)"
            elif [[ "$UPLOAD_DIR" == /* ]]; then
                echo "Resolves to: $UPLOAD_DIR (absolute path)"
                echo "Type: Absolute path (external)"
            else
                echo "Resolves to: $(pwd)/$UPLOAD_DIR (relative path)"
                echo "Type: Relative path (internal - secure)"
            fi
        else
            echo "UPLOAD_DIR not set (will use default: uploads)"
        fi
        echo "------------------------------------------------------------"
        ;;
        
    5)
        echo ""
        if grep -q "^UPLOAD_DIR=" .env; then
            UPLOAD_DIR=$(grep "^UPLOAD_DIR=" .env | cut -d'=' -f2-)
            
            # Resolve the path
            if [[ "$UPLOAD_DIR" == ~* ]]; then
                RESOLVED="${UPLOAD_DIR/#\~/$HOME}"
            elif [[ "$UPLOAD_DIR" == /* ]]; then
                RESOLVED="$UPLOAD_DIR"
            else
                RESOLVED="$(pwd)/$UPLOAD_DIR"
            fi
            
            echo "Testing directory: $RESOLVED"
            echo ""
            
            # Check if directory exists
            if [ -d "$RESOLVED" ]; then
                echo "✓ Directory exists"
            else
                echo "✗ Directory does not exist"
                echo "  Run: mkdir -p $RESOLVED"
            fi
            
            # Check write permission
            if [ -w "$RESOLVED" ]; then
                echo "✓ Write permission OK"
                
                # Try to create a test file
                if touch "$RESOLVED/.test_write" 2>/dev/null; then
                    rm "$RESOLVED/.test_write"
                    echo "✓ Write test successful"
                else
                    echo "✗ Write test failed"
                fi
            else
                echo "✗ No write permission"
                echo "  Run: sudo chown -R $USER:$USER $RESOLVED"
            fi
            
            # Show permissions
            echo ""
            echo "Current permissions:"
            ls -ld "$RESOLVED" 2>/dev/null || echo "Directory not found"
        else
            echo "UPLOAD_DIR not configured in .env"
        fi
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "============================================================"
echo "Setup complete! Start the server to see the configuration:"
echo "  npm start"
echo "============================================================"

