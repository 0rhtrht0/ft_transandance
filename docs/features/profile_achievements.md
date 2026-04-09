# Feature: Profile, Progression & Achievements

This module tracks the operator's journey through the singularity, managing identity and performance metrics.

## Overview
Operator progression is measured through **Evaluation Points (EP)**, earned by clearing maze stages across three difficulties.

## Technical Implementation

### Identity (Frontend)
- **Component**: `ProfileCard.vue` / `PublicProfile.vue`.
- **Media**: Custom avatar upload system with validation and preview.
- **Data**: Displays best scores, win/loss ratio, and friends count.

### Progression System (Backend)
- **Module**: `ProgressionService`.
- **Database**:
    - `StageProgress`: Tracks which levels are unlocked per operator.
    - `GameResult`: Detailed snapshots of every run.
    - `Score`: Best individual performances.
- **Logic**: Unlocking Stage N requires clearing Stage N-1 on the same difficulty level.

### Point Tally Equation
Total operator points are calculated based on:
- 10 points per **Hard** stage cleared.
- 5 points per **Medium** stage cleared.
- 1 point per **Easy** stage cleared.

## Key Features
- **Public Profiles**: Inspect other operators directly from chat or social lists.
- **Avatar Personalization**: High-resolution image support for terminal identity.
- **Match History**: Persistent list of recent orbital missions with statistics.
- **Leaderboard**: Global ranking based on accumulative Evaluation Points.
- **Dynamic Achievements**: (Planned/Implementation pending) Badge system based on specific gameplay milestones.
