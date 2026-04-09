# Feature: Introduction & Main Menu

This module manages the entry point of the **Blackhole** experience, focusing on high-impact visuals and efficient navigation.

## Overview
The sequence starts with a cinematic introduction that sets the sci-fi tone, followed by an orbital transition to the main terminal (Menu).

## Technical Implementation

### Frontend (Vue 3)
- **View**: `IntroView.vue` and `MenuView.vue`.
- **Logic**: 
    - `intro.js`: Manages the CSS-driven cinematic sequence and "System Boot" animations.
    - `menu.js`: Orchestrates the main navigation hub, connecting the user to Solo, Multiplayer, Social, and Profile modules.
- **Components**:
    - Relies on the **Design System** for button glows and holographic panel effects.
    - Emits navigation signals handled by the global `Vue Router`.

### Flow
1. **Intro Sequence**: Procedural "loading signals" and Title reveal.
2. **Transition**: Navigation to `/auth` if no session is found, or `/menu` if neural link (JWT) is active.
3. **Menu Hub**: Centralized access to all Blackhole subsystems.

## Key Features
- **Holographic UI**: Glassmorphic panels with inner glows and border synchronization.
- **Cinematic Start**: Synchronized CSS animations for brand identity.
- **Adaptive Navigation**: Reactive state management ensures only authorized operators reach the Menu terminal.
- **Legal Compliance**: Direct footer links to Privacy Policy and Terms of Service.
