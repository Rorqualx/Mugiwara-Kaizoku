# Add System Events

This migration adds the SystemEvent model to the database, enabling persistent storage of system events.

## Changes

- Created the `SystemEvent` table for storing system events
- Added appropriate indexes for efficient querying:
  - timestamp: For chronological sorting and time-based filtering
  - type: For filtering by event type
  - source: For filtering by event source
  - level: For filtering by severity level
  - relatedEntityId/relatedEntityType: For retrieving events related to specific entities

## Impact

This feature enhances system observability, troubleshooting, and auditing capabilities by providing a central repository for all system events.

## Usage

After applying this migration, the system will begin storing events in the database. These events can be viewed in the System > Events page.
