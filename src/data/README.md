# Isolated legacy fixtures

These historical/demo files are retained only as reference for a reviewed migration. Production modules must not import them or seed them automatically. Fleet policy constants are in `src/utils/fleetPolicy.ts`. Real fleet data is read from Firestore through the repository.
