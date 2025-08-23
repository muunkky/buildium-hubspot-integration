# Scripts Directory

This directory contains utility and temporary scripts for the Buildium-HubSpot integration project.

## Directory Structure

```
scripts/
└── temp/                    # Temporary scripts for specific testing
    ├── check_140054_units.js       # Check units for property 140054
    └── verify_specific_associations.js  # Verify specific contact-listing associations
```

## Script Categories

### 🗂️ `/temp/` - Temporary Scripts
These are one-off or testing scripts created for specific purposes. They may be:
- Property-specific utilities
- Quick debugging tools
- Experimental features
- Test validation scripts

**Note**: Scripts in `/temp/` are meant to be temporary and may be removed after their purpose is served.

## Current Temporary Scripts

### `check_140054_units.js`
**Purpose**: Get detailed unit information for property 140054  
**Usage**: `node scripts/temp/check_140054_units.js`  
**Output**: 
- Property details
- Unit listings with IDs and numbers
- Active lease information
- Summary statistics

### `verify_specific_associations.js`
**Purpose**: Verify associations between specific contacts and listings  
**Target**: Contact 131939806356 ↔ Listing 455100848030  
**Usage**: `node scripts/temp/verify_specific_associations.js`  
**Output**:
- Association verification
- Association type validation
- Bidirectional relationship checks

## Guidelines

### Adding Scripts to `/temp/`
- Use descriptive, specific names
- Include purpose and usage in file header
- Clean up when no longer needed
- Consider promoting to `/utils/` if broadly useful

### Promoting to `/utils/`
Scripts should be moved to `/utils/` when they:
- Have broad utility beyond specific testing
- Are well-tested and stable
- Have proper error handling
- Are documented for reuse

### Cleanup Policy
Scripts in `/temp/` should be:
- Reviewed regularly for continued relevance
- Removed when their specific purpose is complete
- Documented if they solve recurring problems
- Archived if they might be needed again

## Related Directories

- **`/utils/`**: Permanent utility scripts for ongoing use
- **`/tests/`**: Formal test suite for validation
- **`/docs/`**: Documentation and planning materials

## Usage Examples

```bash
# Run a specific temporary script
node scripts/temp/check_140054_units.js

# Check what temporary scripts are available
ls scripts/temp/

# Clean up completed temporary scripts
rm scripts/temp/old_script.js
```
