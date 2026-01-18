# Changelog

All notable changes to Brain Dumper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-01-18

### Added

#### Google Calendar Integration
- **OAuth 2.0 Authentication**: Secure connection to Google Calendar with token refresh
- **Calendar View**: New weekly calendar view showing availability and scheduled tasks
- **Intelligent Scheduling Engine**: AI-powered task scheduling with scoring algorithm
  - Task type preferences (deep work in mornings, calls in afternoons, etc.)
  - Priority-based displacement (high priority tasks can replace lower priority)
  - Buffer time support before/after tasks
  - Protected time slots (lunch breaks, exercise, family time)
- **Two-Way Sync**:
  - Task changes automatically sync to Google Calendar
  - Calendar changes sync back to Brain Dumper via webhooks
- **Scheduling Preferences UI**: Customize your scheduling rules
  - Working hours configuration per day
  - Task type rules (preferred time, duration, buffers)
  - Protected time slots management
  - Default buffer settings
  - Ad-hoc call slot reservation

#### Approval Workflow Enhancement
- **Schedule Approval Step**: Review and approve proposed schedule after task approval
- **Conflict Resolution**: Visual conflict warnings with displacement options
- **Batch Scheduling**: Schedule multiple tasks at once with smart slot allocation

#### Cloud Functions
- OAuth initialization, callback, token refresh, and revoke functions
- Calendar list, events, free/busy, and availability functions
- Scheduling proposal, confirmation, and task scheduling functions
- Firestore triggers for task-to-calendar sync
- Webhook handlers for calendar-to-task sync
- Watch subscription management for real-time calendar updates

#### Testing Infrastructure
- Comprehensive test suite with 950+ tests
- Vitest configuration with React Testing Library
- Mock infrastructure for Firebase and Google Calendar APIs
- Test utilities for async operations and user simulation

### Changed
- Updated Firestore security rules for new calendar-related collections
- Enhanced task model with scheduling fields (calendarEventId, scheduledStart, scheduledEnd)
- Updated Firebase configuration for Node.js 20 runtime

### Fixed
- OAuth URL mapping between Cloud Function and frontend
- TypeScript build excluding test files from production bundle

## [1.5.0] - 2025-01-15

### Changed
- Removed Today view, simplified navigation
- New logo and branding

## [1.4.0] - 2025-01-14

### Changed
- Revamped schedule view with 4 time sections per day (Morning, Afternoon, Evening, Night)

## [1.3.0] - 2025-01-13

### Added
- Cloud Functions deployment to GitHub workflow
- Firebase Cloud Function for daily task notifications

### Changed
- Updated Cloud Functions to Node.js 20
- Improved schedule view and analytics

### Fixed
- Notifications for mobile devices
- Logo cache busting

## [1.2.0] - 2025-01-10

### Added
- Firestore security rules for users and dumpHistory collections
- Better notification error messages with specific failure reasons

### Changed
- Migrated dump history to Firestore
- Improved notification system

## [1.1.0] - 2025-01-08

### Changed
- Updated all logos to new brain+poo design
- Improved swipe gestures: prevent accidental completion, removed click-to-edit

### Fixed
- Test notifications and debugging
- GitHub Actions permissions for Firebase deploy

## [1.0.0] - 2025-01-01

### Added
- Initial release of Brain Dumper
- Natural language task input with AI parsing (Gemini 2.0 Flash)
- Task management with projects, priorities, and due dates
- Drag-and-drop task reordering
- Schedule view with time-based organization
- Push notifications for daily task reminders
- PWA support for mobile installation
- Firebase authentication and Firestore storage
