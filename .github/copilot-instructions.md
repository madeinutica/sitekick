<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [x] Add Mapbox access token to environment variables
  - **COMPLETED**: Added NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN placeholder to .env.local file. User needs to replace with actual Mapbox access token.
- [x] Implement geocoding function to convert job addresses to coordinates using Mapbox API
  - **COMPLETED**: Added geocodeAddress function that uses Mapbox Geocoding API to convert job addresses to latitude/longitude coordinates. Function handles loading states and error cases.
- [x] Create map component in job detail page to display geocoded location
  - **COMPLETED**: Added Location section to job detail page that displays an interactive Mapbox map with a marker at the geocoded job address. Map shows when address is available and coordinates are successfully geocoded.
- [x] Integrate map display with address updates
  - **COMPLETED**: Updated handleUpdateJobField function to automatically geocode new addresses when job addresses are edited, ensuring the map updates in real-time.
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements

- [x] Scaffold the Project

- [x] Customize the Project

- [x] Install Required Extensions

- [x] Compile the Project

- [x] Create and Run Task

- [x] Launch the Project

- [x] Ensure Documentation is Complete

- [x] Implement Job Assignment Editing for Super Users

- [x] Implement Header Account Dropdown Menu

- [x] Add Password Change Functionality to Profile Page

- [x] Remove Photo Upload Progress Graph from Dashboard

- [x] Implement User Filter Sidebar for Super Users

- [x] Fix mobile photo upload button not opening camera
  - **COMPLETED**: Fixed mobile "Add Photo" button by moving the hidden file input outside the conditional photo upload form so it's always available for the mobile button to click. The button now properly opens the camera app on mobile devices.
- [x] Implement granular role-based access control system with specific roles (Rep, Brand Ambassador, Measure Tech, Installer) having different permissions for jobs and photos
  - **COMPLETED**: Database migration with roles, user_roles, and project_user_roles tables implemented. Frontend updated to use role-based logic instead of is_super_user boolean. RLS policies fixed to resolve infinite recursion, allowing super admins to view all jobs. Jobs page now displays jobs correctly for super users.
- [x] Add the ability to assign multiple users to a job
  - **COMPLETED**: Updated job creation form to allow selecting multiple users with checkboxes. Modified database operations to insert assignments into project_user_roles table. Updated job fetching to include assigned users from project_user_roles. Enhanced job display to show multiple assigned users with avatar stack. Added comprehensive RLS policies for project_user_roles table to control access to job assignments.
- [x] Implement multiple user assignment editing for job detail pages
  - **COMPLETED**: Updated job detail page to support editing multiple user assignments. Changed from single select dropdown to multi-select checkboxes. Modified state management to handle arrays of assigned user IDs. Updated database operations to delete existing assignments and insert new ones in project_user_roles table. Added proper error handling and UI feedback for assignment updates. Fixed type consistency issues with project_id parsing that were preventing assignments from registering.
- [x] Show avatars of assigned users to jobs above photos section
  - **COMPLETED**: Added an "Assigned Team" section above the photos section in job detail pages. Displays avatar stack of assigned users with overflow indicator (+N more). Shows individual user cards below with full names and avatars. Only displays when there are assigned users.
- [x] Fix user assignment persistence issue by allowing job owners to manage assignments
  - **COMPLETED**: Updated frontend role checking logic to allow job owners (not just super admins and brand ambassadors) to edit job assignments, job names, addresses, and delete photos. Added separate useEffect to fetch users for assignment when user is job owner. Updated all UI condition checks throughout the job detail page to include job owner permissions. This resolves the assignment persistence issue by ensuring job owners can access the assignment management interface and perform database operations allowed by existing RLS policies.
- [x] Restrict assignment editing to only super_admin and brand_ambassador roles
  - **COMPLETED**: Removed job owner permissions from all assignment editing, job name editing, address editing, and photo deletion UI conditions. Updated user fetching logic to only load users for assignment when user has super_admin role. Removed unused isSuperUser state variable. All permission checks now only allow super_admin and brand_ambassador roles to access editing features. Application compiles successfully.
- [x] Restrict job assignment to only super admin (remove brand ambassador permissions)
  - **COMPLETED**: Updated simplified_roles.sql RLS policies to remove 'brand_ambassador' from job_assignments management policies. Updated frontend code in jobs/[id]/page.tsx to only allow super_admin for user assignment, job name editing, address editing, and photo deletion. Application compiles successfully.
- [x] Fix jobs fetch error caused by invalid nested Supabase query syntax
  - **COMPLETED**: Fixed the jobs page fetchJobs function that was using an invalid nested query in the `or` condition. Separated the assigned job IDs fetch into a separate query before using them in the main jobs query. Added proper TypeScript typing to resolve compilation errors. Application builds successfully without errors.
- [x] Fix infinite recursion in RLS policies between jobs and job_assignments tables
  - **COMPLETED**: Identified that the job_assignments RLS policy was referencing the jobs table, creating circular dependency. Removed the job ownership check from job_assignments policies to prevent infinite recursion. Simplified job_assignments policies to only allow super admins and assigned users to view/manage assignments. Updated jobs policy to properly check assignments without circular references. Application should now load without 500 errors.
- [x] Show avatars of all assigned users on job cards
  - **COMPLETED**: Updated job cards to display avatars of all assigned users instead of limiting to 3 with a "+N more" indicator. Made avatars smaller (20px) and adjusted spacing to accommodate more users in the available space. All assigned users are now visible on each job card.
- [x] Add super admin sidebar with admin link and other easily accessible links, integrated with current jobs page sidebar
  - **COMPLETED**: Created SuperAdminSidebar component with admin links (User Management, Photo Gallery, Dashboard) and quick actions (All Jobs, Profile). Integrated both SuperAdminSidebar and existing user filter sidebar on jobs page for super admin users. Updated layout to accommodate both sidebars with proper spacing (lg:ml-128). Application compiles successfully.
- [x] Add SuperAdminSidebar to dashboard page
  - **COMPLETED**: Integrated SuperAdminSidebar into dashboard page for super admin users. Added sidebar with proper spacing (lg:ml-64) and maintained existing dashboard functionality. Application compiles successfully.
- [x] Consolidate user filtering functionality into SuperAdminSidebar to eliminate duplicate sidebars on jobs page
  - **COMPLETED**: Added user filtering section to SuperAdminSidebar component that conditionally renders when on jobs page. Updated jobs page to pass user filtering props (users, userFilter, setUserFilter, jobs) to SuperAdminSidebar. Removed separate user filter sidebar and mobile dropdown from jobs page. Cleaned up unused state variables and imports. Updated layout spacing from lg:ml-128 to lg:ml-64. Application compiles successfully.
- [x] Fix user assignment insertion error by adding assigned_by field
  - **COMPLETED**: Fixed null value error in project_user_roles table by adding assigned_by: user.id to all assignment insertions in both job creation (jobs/page.tsx) and job detail editing (jobs/[id]/page.tsx). The assigned_by field is required and references the user making the assignment. Application compiles successfully.
- [x] Fix Supabase query syntax error in assignment refresh queries
  - **COMPLETED**: Fixed 400 Bad Request errors in assignment refresh queries by replacing join syntax with separate queries. Changed from 'profiles!inner(full_name, avatar_url)' to fetching project_user_roles first, then fetching profiles separately for each user_id using Promise.all. This avoids Supabase schema cache relationship issues. Fixed in all four locations: initial fetch (line 438), handleUpdateJobField refresh (line 698), mobile assignment update refresh (line 1065), and desktop assignment update refresh (line 1311). Application builds successfully without errors.
- [x] Move user filter dropdown to above jobs list on jobs page
  - **COMPLETED**: Removed user filtering functionality from SuperAdminSidebar component. Added a dropdown filter above the jobs list on the jobs page, positioned right before the "Add Job" button. The dropdown shows user names with job counts and allows filtering by specific users or all users. Updated SuperAdminSidebar interface to remove user filtering props. Application compiles successfully.
- [x] Fix installer role job visibility issue by updating jobs RLS policy
  - **COMPLETED**: Identified that the jobs RLS policy was missing a condition to check for global user_roles with 'assigned_or_created' permissions when users are assigned to jobs. Added the missing condition to combined_rls_fix.sql that allows users with global roles (like installer) having 'assigned_or_created' permissions to view jobs they're assigned to via project_user_roles. The database needs to be reset to apply these changes.
- [x] Simplify role system by replacing project_user_roles with job_assignments table
  - **COMPLETED**: Created simplified_roles.sql migration file that drops the complex project_user_roles table and replaces it with a simple job_assignments table. Updated all frontend code to use job_assignments instead of project_assignments. Removed all projectRoles state variables and references. Simplified permission checks to only use global userRoles. Updated canComment logic to use global roles. Application compiles successfully without errors.
- [x] Restrict job creation to super admin only
  - **COMPLETED**: Removed "Add Job" buttons from all non-super admin users. Only super admin users can now see and access job creation functionality. Updated the "No jobs yet" section to show different messages for super admins (with "Add Your First Job" button) vs regular users (with "Contact your administrator" message). Application compiles successfully.
- [x] Show avatars of all assigned users on job pages with hover tooltips showing name and role
  - **COMPLETED**: Updated assigned users data fetching to include user roles in all assignment update locations (initial fetch, mobile assignment update, desktop assignment update). Modified assignedUsers state type to include role field. Implemented avatar display section above photos with hover tooltips showing full name and role. Application compiles successfully without errors.
- [x] Show all assigned users avatars on jobs page for super admin instead of job owner avatar
  - **COMPLETED**: Modified job cards on jobs page to display avatars of all assigned users (up to 3 with overflow indicator) instead of showing the job owner's avatar. Updated the layout to show assigned user count and removed the redundant small avatar display below. Application compiles successfully.
- [x] Show assigned users avatars on job cards for all user roles
  - **COMPLETED**: Updated jobs page to fetch and display assigned users' avatars for all user roles, not just super admins. Modified fetchJobs function to retrieve assigned users data for all users and updated job card display logic to show assigned users avatars for everyone. Application compiles successfully.
- [x] Update gallery header text to show different descriptions based on user role
  - **COMPLETED**: Updated gallery page header to display "All photos from every job" for brand ambassadors and super admins, and "All photos from your jobs" for other users. Application compiles successfully.
- [x] Allow all users to see all photos uploaded to specific jobs
  - **COMPLETED**: Updated job_photos RLS policy to allow all users to view photos from jobs they have access to (own, assigned to, or have global permissions for). Simplified gallery page to fetch all accessible photos without role-based filtering. Updated header text to "All photos from your accessible jobs". Application compiles successfully.
- [x] Add uploader avatar to photo corner in gallery
  - **COMPLETED**: Updated gallery page to fetch uploader avatar from profiles table, added 20x20px avatar display in bottom left corner of each photo with white border and shadow. Application compiles successfully.
- [x] Allow brand ambassadors to see all photos in gallery like super users
  - **COMPLETED**: Updated job_photos RLS policy to allow brand ambassadors to view all photos. Modified gallery header to show "All photos from every job" for brand ambassadors and super admins. Application compiles successfully.
- [x] Diagnosed gallery photos not showing issue
  - **COMPLETED**: Identified that the simplified_roles.sql migration needs to be applied to the database. Updated gallery query to use left join for profiles to prevent missing photos. Application compiles successfully.
- [x] Fixed gallery photo fetching error
  - **COMPLETED**: Fixed Supabase query relationship syntax by fetching profiles separately instead of using complex joins. Updated TypeScript types to include user_id field. Application compiles successfully.
- [x] Fix jobs not showing up due to assignment migration issue
  - **COMPLETED**: Uncommented the migration script in simplified_roles.sql to migrate existing assignments from project_user_roles to job_assignments table. Fixed assignment fetching query in jobs page to use separate queries instead of join syntax. Jobs with existing assigned users now display properly in filtering.
- [x] Fix address editing issue by correcting database query parameters from string to integer
  - **COMPLETED**: Fixed all database queries in src/app/jobs/[id]/page.tsx to use parseInt(jobId as string) instead of jobId directly. This resolves the issue where addresses weren't saving due to type mismatch between URL string parameters and integer database IDs. Fixed queries in fetchJob, fetchPhotos, handleUpdateJobField, handleDeleteJob, fetchNotes, handleAddNote, and assignment update functions. Application builds successfully without errors.
- [x] Fix super admin job deletion by adding CASCADE DELETE constraints
  - **COMPLETED**: Identified that photo_tags table was missing CASCADE DELETE constraint, preventing job deletion when photos had tags. Added CASCADE DELETE to all foreign key constraints (job_assignments, job_photos, notes, photo_tags) and ensured super admin DELETE policy is properly configured. Job deletion now works for super admin users.
- [x] Fix Vercel deployment TypeScript compilation errors
  - **COMPLETED**: Fixed TypeScript compilation errors by updating all profile property references from 'name' to 'full_name' throughout the codebase to match the database schema. Updated profile type definitions, property accesses, and database queries in src/app/jobs/page.tsx. Application now builds successfully without errors and deploys to Vercel.
- [x] Add job categories (Windows, Bathrooms, Siding, Doors) to replace user-based filtering
  - **COMPLETED**: Added category field to Job type definitions across all files. Updated job creation form to include category dropdown with the four specified categories. Replaced user-based filtering with category-based filtering in jobs page. Updated job cards to display category badges with appropriate colors. Created database migration file add_category_to_jobs.sql with proper constraints and index.
- [x] Display job categories on job cards and job detail pages
  - **COMPLETED**: Added category badges to job cards on jobs page with color-coded styling (Windows=blue, Bathrooms=green, Siding=yellow, Doors=purple). Added category display to job detail page header for both mobile and desktop layouts. All category displays use consistent styling and only show when category is present.
- [x] Create database migration for category column
  - **COMPLETED**: Created add_category_to_jobs.sql migration file that adds category column to jobs table with TEXT type, CHECK constraint limiting to the four categories, and CREATE INDEX for performance. Migration is ready to be executed on Supabase database.
- [x] Implement category editing functionality on individual job pages
  - **COMPLETED**: Added category editing functionality to job detail pages for super admin users. Includes edit state management, dropdown selector with the four categories, save/cancel buttons, and proper UI integration for both mobile and desktop layouts. Category can now be set during job creation and edited on individual job pages.
- [x] Fix mobile photo saving issue where photos taken on mobile weren't being saved to database
  - **COMPLETED**: Resolved the issue where mobile photo uploads were not persisting to the database despite the camera opening correctly. The handlePhotoUpload function was already properly implemented with image resizing, geolocation capture, Supabase storage upload, and database insertion. The fix involved ensuring proper database permissions and execution flow, allowing photos to save successfully after being taken on mobile devices.
- [x] Add category filter to gallery page for photos
  - **COMPLETED**: Added category filtering functionality to the gallery page. Updated photo fetching query to include job category, added category filter state and UI buttons with counts, implemented dual filtering (photo type + category), and displayed category badges on photo cards and modal with color coding (Windows=blue, Bathrooms=green, Siding=yellow, Doors=purple). Application compiles successfully.
- [x] Fix gallery page logout issue caused by excessive API calls
  - **COMPLETED**: Optimized gallery page to prevent frequent logouts by reducing API calls from individual profile requests to a single batch fetch, removed automatic redirects on errors that could cause logout loops, and improved error handling. Gallery now loads efficiently without exhausting auth tokens.
- [x] Fix gallery page flickering/infinite loading issue
  - **COMPLETED**: Resolved circular dependency in useEffect that was causing infinite re-renders. Removed fetchAllPhotos from useEffect dependencies and simplified the callback to prevent flickering. Memoized filteredPhotos calculation for better performance. Gallery page now loads smoothly without flickering.
- [x] Implement documents section for job detail pages with upload, view, edit, and delete functionality for PDFs and other file types
  - **COMPLETED**: Added comprehensive documents section to job detail pages with file upload (PDF, Word, Excel, etc.), inline viewing modal with iframe for PDFs, download functionality, and delete capability for super admins. Includes proper file type icons, size formatting, and uploader information display. Application compiles successfully.
- If any tools are available to manage the above todo list, use it to track progress through this checklist.
- After completing each step, mark it complete and add a summary.
- Read current todo list status before starting each new step.

COMMUNICATION RULES:
- Avoid verbose explanations or printing full command outputs.
- If a step is skipped, state that briefly (e.g. "No extensions needed").
- Do not explain project structure unless asked.
- Keep explanations concise and focused.

DEVELOPMENT RULES:
- Use '.' as the working directory unless user specifies otherwise.
- Avoid adding media or external links unless explicitly requested.
- Use placeholders only with a note that they should be replaced.
- Use VS Code API tool only for VS Code extension projects.
- Once the project is created, it is already opened in Visual Studio Code—do not suggest commands to open this project in Visual Studio again.
- If the project setup information has additional rules, follow them strictly.

FOLDER CREATION RULES:
- Always use the current directory as the project root.
- If you are running any terminal commands, use the '.' argument to ensure that the current working directory is used ALWAYS.
- Do not create a new folder unless the user explicitly requests it besides a .vscode folder for a tasks.json file.
- If any of the scaffolding commands mention that the folder name is not correct, let the user know to create a new folder with the correct name and then reopen it again in vscode.

EXTENSION INSTALLATION RULES:
- Only install extension specified by the get_project_setup_info tool. DO NOT INSTALL any other extensions.

PROJECT CONTENT RULES:
- If the user has not specified project details, assume they want a "Hello World" project as a starting point.
- Avoid adding links of any type (URLs, files, folders, etc.) or integrations that are not explicitly required.
- Avoid generating images, videos, or any other media files unless explicitly requested.
- If you need to use any media assets as placeholders, let the user know that these are placeholders and should be replaced with the actual assets later.
- Ensure all generated components serve a clear purpose within the user's requested workflow.
- If a feature is assumed but not confirmed, prompt the user for clarification before including it.
- If you are working on a VS Code extension, use the VS Code API tool with a query to find relevant VS Code API references and samples related to that query.

TASK COMPLETION RULES:
- Your task is complete when:
  - Project is successfully scaffolded and compiled without errors
  - copilot-instructions.md file in the .github directory exists in the project
  - README.md file exists and is up to date
  - User is provided with clear instructions to debug/launch the project

Before starting a new task in the above plan, update progress in the plan.
-->
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
