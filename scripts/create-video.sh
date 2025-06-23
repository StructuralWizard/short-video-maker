#!/bin/bash

# Default values
HOST="http://localhost:3123"
OUTPUT_DIR="./videos"
CONFIG_FILE=""
MAX_WAIT_TIME=1800  # 30 minutes timeout
WAIT_INTERVAL=5    # Check every 5 seconds

# Help message
show_help() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --host HOST        API host (default: http://localhost:3123)"
    echo "  -o, --output DIR       Output directory for videos (default: ./videos)"
    echo "  -c, --config FILE      JSON configuration file"
    echo "  -w, --wait            Wait for video to be ready and download it"
    echo "  -v, --verbose         Show verbose output"
    echo "  -t, --timeout SECONDS Maximum time to wait for video (default: 1800)"
    echo "  --help                Show this help message"
    echo ""
    echo "Example config.json:"
    echo '{
    "scenes": [
        {
            "text": "Hello world!",
            "searchTerms": ["river"]
        }
    ],
    "config": {
        "paddingBack": 1500,
        "music": "chill",
        "captionPosition": "center",
        "captionBackgroundColor": "#ff0000",
        "voice": "bm_lewis",
        "orientation": "portrait",
        "musicVolume": "muted"
    }
}'
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -w|--wait)
            WAIT=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -t|--timeout)
            MAX_WAIT_TIME="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check if config file is provided
if [ -z "$CONFIG_FILE" ]; then
    echo "Error: Config file is required"
    show_help
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found: $CONFIG_FILE"
    exit 1
fi

# Validate JSON format
if ! jq . "$CONFIG_FILE" >/dev/null 2>&1; then
    echo "Error: Invalid JSON format in config file"
    echo "Please check your JSON syntax"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Function to log messages
log() {
    if [ "$VERBOSE" = true ]; then
        echo "$1"
    fi
}

# Function to check if required commands are available
check_requirements() {
    local missing_commands=()
    
    if ! command -v curl &> /dev/null; then
        missing_commands+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_commands+=("jq")
    fi
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        echo "Error: Missing required commands: ${missing_commands[*]}"
        echo "Please install them and try again"
        exit 1
    fi
}

# Check requirements
check_requirements

# Check if server is running
if ! curl -s "$HOST/health" >/dev/null; then
    echo "Error: Cannot connect to server at $HOST"
    echo "Please make sure the server is running"
    exit 1
fi

# Create video
log "Creating video..."
log "Sending configuration:"
if [ "$VERBOSE" = true ]; then
    jq . "$CONFIG_FILE"
fi

RESPONSE=$(curl -s -X POST "$HOST/api/short-video" \
    -H "Content-Type: application/json" \
    -d "@$CONFIG_FILE")

if [ "$VERBOSE" = true ]; then
    echo "Server response:"
    echo "$RESPONSE" | jq .
fi

VIDEO_ID=$(echo "$RESPONSE" | jq -r '.videoId')

if [ "$VIDEO_ID" = "null" ] || [ -z "$VIDEO_ID" ]; then
    echo "Error: Failed to create video"
    echo "Server response:"
    echo "$RESPONSE" | jq .
    exit 1
fi

log "Video ID: $VIDEO_ID"

# If wait flag is set, wait for video to be ready and download it
if [ "$WAIT" = true ]; then
    log "Waiting for video to be ready (timeout: ${MAX_WAIT_TIME}s)..."
    start_time=$(date +%s)
    
    while true; do
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $MAX_WAIT_TIME ]; then
            echo "Error: Timeout waiting for video after ${MAX_WAIT_TIME} seconds (30 minutes)"
            echo "The video might still be processing. You can check its status later with:"
            echo "curl $HOST/api/short-video/$VIDEO_ID/status"
            exit 1
        fi
        
        STATUS_RESPONSE=$(curl -s "$HOST/api/short-video/$VIDEO_ID/status")
        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
        ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error // empty')
        
        log "Status: $STATUS (${elapsed}s elapsed)"
        if [ ! -z "$ERROR" ]; then
            log "Error details: $ERROR"
        fi
        
        if [ "$STATUS" = "ready" ]; then
            log "Video is ready, downloading..."
            curl -s "$HOST/api/short-video/$VIDEO_ID" -o "$OUTPUT_DIR/$VIDEO_ID.mp4"
            if [ $? -eq 0 ]; then
                log "Video downloaded to $OUTPUT_DIR/$VIDEO_ID.mp4"
                break
            else
                echo "Error: Failed to download video"
                exit 1
            fi
        elif [ "$STATUS" = "failed" ]; then
            echo "Error: Video creation failed"
            echo "Status response:"
            echo "$STATUS_RESPONSE" | jq .
            if [ ! -z "$ERROR" ]; then
                echo "Error details: $ERROR"
            fi
            exit 1
        fi
        
        sleep $WAIT_INTERVAL
    done
fi

echo "$VIDEO_ID" 