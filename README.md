# Buildium-HubSpot Integration

A comprehensive data synchronization platform that connects Buildium property management software with HubSpot CRM, enabling automated property, tenant, lease, and owner data management.

## 🚀 Quick Start

```bash
# Install dependencies
cd prototype
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API credentials

# Run a test sync
node index.js sync-leases --dry-run --limit 5
```

## 📋 Commands

### Lease-Centric Sync (Recommended)
The most efficient approach - processes only updated leases:

```bash
# Incremental sync (last 7 days)
node index.js sync-leases --since-days 7 --dry-run

# Force update existing records
node index.js sync-leases --force --limit 50

# Sync specific unit
node index.js sync-leases --unit-id 123456

# Full sync (use sparingly)
node index.js sync-leases --since-days null --limit 100
```

### Unit-Centric Sync
For comprehensive property setup:

```bash
# Sync specific properties
node index.js sync-units --property-ids 140054 --limit 10

# Force update mode
node index.js sync-units --force --property-ids 140054
```

### Owner Sync
Synchronize property owners:

```bash
# Sync owners for specific properties
node index.js owners --property-ids 140054 --sync-all

# Dry run mode
node index.js owners --property-ids 140054 --dry-run
```

### Tenant Lifecycle Management
Automated association management:

```bash
# Update tenant associations based on lease status
node index.js tenant-lifecycle --dry-run

# Process specific date range
node index.js tenant-lifecycle --since-days 30
```

## 🏗️ Architecture

### Current Sync Approaches

1. **[Lease-Centric Sync](prototype/LeaseCentricSyncManager.js)** ⭐ **Primary**
   - **Best for:** Daily/hourly incremental updates
   - **Efficiency:** 100x+ improvement over unit-centric
   - **API Calls:** ~8 calls for 5 updates vs 1000+ with unit-centric

2. **[Unit-Centric Sync](prototype/index.js)** 
   - **Best for:** Initial property setup, comprehensive backfills
   - **Features:** Complete unit → listing transformation with full context

3. **[Owner Sync](prototype/index.js)**
   - **Best for:** Property owner management
   - **Features:** Buildium owner → HubSpot contact/company mapping

4. **[Tenant Lifecycle Manager](prototype/TenantLifecycleManager.js)**
   - **Best for:** Automated association updates (Future→Active→Inactive)
   - **Features:** Automatic tenant status transitions

### Data Flow

```
Buildium APIs → Data Transformation → HubSpot Objects → Association Management
     ↓                    ↓                  ↓                    ↓
  Properties/Units    Listings Object    Contact Records    Active/Future/Past
  Leases/Tenants     Custom Properties   Listing Objects    Association Types
  Owners/Contacts    Field Mapping       Company Records    Lifecycle Updates
```

## 📁 Project Structure

```
├── prototype/                    # Main application
│   ├── index.js                 # Core integration classes & sync methods
│   ├── LeaseCentricSyncManager.js # Next-gen lease sync (100x efficiency)
│   ├── TenantLifecycleManager.js  # Automated tenant associations
│   ├── package.json             # Dependencies
│   ├── tests/                   # Comprehensive test suite
│   │   ├── run-tests.js         # Test runner
│   │   ├── end_to_end_test.js   # Full workflow validation
│   │   ├── owners_e2e_test.js   # Owner sync testing
│   │   └── LEASE_TESTS_README.md # Lease sync test documentation
│   ├── utils/                   # Debugging & development utilities
│   └── scripts/                 # Temporary testing scripts
├── docs/                        # Architecture & API documentation
│   ├── leases-command-design.md # Lease sync implementation plan
│   ├── owners-command-design.md # Owner sync specification
│   ├── code-review/             # Code analysis & improvement plans
│   └── [other documentation]
└── scripts/                     # Data processing utilities
```

## 🧪 Testing

### Run Tests
```bash
cd prototype
node tests/run-tests.js all        # Run all tests
node tests/run-tests.js owners-e2e # Run owner sync tests
node tests/run-tests.js help       # See all options
```

### Test Categories
- **End-to-End Tests:** Full sync workflow validation
- **Force Sync Tests:** Update existing records safely
- **Owner Sync Tests:** Property owner management
- **Lease Tests:** Next-generation lease-centric approach ([details](prototype/tests/LEASE_TESTS_README.md))

## 🔧 Configuration

### Environment Variables
```bash
# Buildium API
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret
BUILDIUM_BASE_URL=https://api.buildium.com

# HubSpot API
HUBSPOT_ACCESS_TOKEN=your_access_token
```

### Sync State Files
- `last_lease_sync.json` - Global sync timestamps
- `lease_sync_timestamps.json` - Per-lease incremental sync
- `owner_sync_output.log` - Owner sync results

## 📊 Performance & Efficiency

### Lease-Centric Sync Benefits
- **API Efficiency:** Queries only updated leases vs scanning all units
- **Speed:** 100x+ faster for incremental updates
- **Resource Usage:** Minimal API calls and memory usage
- **Reliability:** Built-in error handling and retry logic

### Benchmarks
```
Traditional Unit-Centric:  1000+ API calls for 5 lease updates
Lease-Centric Approach:    8 API calls for 5 lease updates
Performance Improvement:   125x more efficient
```

## 🎯 Development Status

### ✅ Production Ready
- **Lease-Centric Sync:** Incremental updates with 100x efficiency improvement
- **Owner Sync:** Property owner management with proper filtering
- **Unit-Centric Sync:** Comprehensive property setup and backfills

### 🚧 In Development
- **Real-time Webhooks:** Event-driven sync triggers
- **Advanced Analytics:** Vacancy prediction and rent optimization
- **Enhanced Error Recovery:** Comprehensive rollback capabilities

### 📋 Next Steps
1. **Deploy lease-centric sync** for daily operations
2. **Implement webhook integration** for real-time updates
3. **Add advanced monitoring** and alerting
4. **Migrate to microservice architecture**

## 📚 Documentation

- **[Lease Command Design](docs/leases-command-design.md)** - Next-gen sync architecture
- **[Owner Command Design](docs/owners-command-design.md)** - Property owner management
- **[Code Review Analysis](docs/code-review/)** - Technical debt and improvements
- **[API References](docs/)** - Buildium and HubSpot API documentation

## 🛠️ Development

### Adding New Sync Methods
1. Create sync method in appropriate manager class
2. Add command parsing in `index.js`
3. Include comprehensive error handling
4. Add tests in `tests/` directory
5. Update documentation

### Best Practices
- **Use lease-centric sync** for ongoing operations
- **Include dry-run modes** for all sync operations
- **Implement proper rate limiting** (Buildium: 10 req/sec, HubSpot: 9 req/sec)
- **Add comprehensive logging** for debugging and monitoring
- **Test incrementally** with small limits before full sync

## 🆘 Troubleshooting

### Common Issues
1. **Rate Limiting:** Reduce batch sizes or add delays
2. **Missing Associations:** Run tenant lifecycle management
3. **Duplicate Records:** Use force update mode carefully
4. **API Errors:** Check credentials and network connectivity

### Debug Mode
```bash
# Enable verbose logging
DEBUG=1 node index.js sync-leases --dry-run --limit 1
```

## 🤝 Contributing

1. Review existing [code analysis](docs/code-review/) and improvement plans
2. Follow established patterns for error handling and logging  
3. Add tests for new functionality
4. Update documentation for any API changes
5. Test thoroughly with dry-run modes

---

**Built for efficiency, reliability, and scale.** 🚀
