# Konecta Admin Panel

**Konecta: Accelerate ICP Project Growth**

The Konecta Admin Panel is a comprehensive interface built with React, TypeScript, and Mantine for managing the Konecta platform. Konecta is designed to help Internet Computer Protocol (ICP) projects boost user engagement and growth through gamified Missions, dynamic Events, and marketing automation.

## Overview

This admin panel provides project owners and administrators with the tools to:

* **Manage Projects:** Configure and oversee individual ICP projects integrated with Konecta.
* **Create & Monitor Missions:** Design and track user engagement tasks (e.g., social media follows, on-chain transactions, community joins) and reward users with tokens, NFTs, or points.
* **User Management:** View and manage users interacting with their projects on the Konecta platform.
* **Settings:** Configure project-specific details (branding, contact info) and global admin preferences.

## Key Technologies

* **React:** A JavaScript library for building user interfaces.
* **TypeScript:** Adds static typing to JavaScript for improved code quality and maintainability.
* **Mantine UI:** A full-featured React components library with a focus on usability and developer experience.
* **React Router DOM:** For client-side routing within the single-page application.
* **Tabler Icons:** A set of over 1900 free, open-source SVG icons.
* **Yup:** For object schema validation (used with Mantine Form).

## Features Implemented (Frontend Mocks)

* **Authentication:** Mock login page and protected routes.
* **Project Switching:** The URL structure (`/:projectId/...`) allows for context switching between different projects.
* **Dashboard (`/:projectId/dashboard`):**
    * Displays key statistics for the selected project (total missions, active events, users, AI tasks).
    * Filters for viewing data over different time ranges (7d, 30d, 90d, All Time).
    * Mock "Recent Activity" feed.
* **Missions Page (`/:projectId/missions`):**
    * Lists missions for the current project.
    * Create, View, Edit (mocked update), and Delete missions.
    * Modal forms for mission creation/editing with various configuration options (rewards, recurrence, action types - Web2, ICP, Manual).
    * File uploads (mocked) for mission icons and images with previews.
* **Users Page (`/:projectId/users`):**
    * Lists users associated with the project (mocked).
    * Search, filter by linked social accounts, and sort users.
    * Detailed user view modal showing profile information, social links, and a placeholder for mission progress.
    * Mocked mission progress display per user per project in the detail modal.
* **Project Settings Page (`/:projectId/settings`):**
    * Allows editing of project-specific details:
        * General: Name, Description.
        * Branding: Icon, Banner (with file uploads and previews).
        * Contact & Links: Website, Email, Social Media URLs.
    * Tabbed interface for organization.
* **Global Settings Page (`/global-settings`):**
    * Manages settings applicable to the admin user across the platform:
        * Notifications: Email preferences for alerts and summaries.
        * Preferences: Default items per page, language, timezone.
        * Security: Mock display of last login and placeholders for security actions.
* **Theme Customization:**
    * Light/Dark mode toggle.
    * Custom Mantine theme (`theme.ts`).