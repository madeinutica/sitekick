# Sitekick - Field Technician Management App

A modern, Progressive Web App for field technicians to manage client information, document job sites, and track project progress. Built to compete with CompanyCam.

## Features

### 📸 Photo Documentation
- **Smart Photo Categorization**: Tag photos as Before, After, Progress, Issue, or Completed
- **Captions & Context**: Add detailed descriptions to every photo
- **Filter & Organize**: Quickly filter photos by type
- **High-Quality Storage**: Unlimited cloud storage via Supabase
- **Native Camera Integration**: Use your device's camera directly

### 👥 Client & Job Management
- **Client Profiles**: Store client names, addresses, and contact details
- **Job Tracking**: Create and manage multiple jobs per client
- **Installation Notes**: Document installation information and specifications
- **Real-time Updates**: Changes sync instantly across all devices

### 🎨 Modern UI/UX
- **Clean & Minimal Design**: Light-colored, professional interface
- **Mobile-First**: Optimized for phones and tablets
- **Responsive**: Works on all screen sizes
- **Fast & Smooth**: Built with Next.js 15 and React

### 🔒 Security & Privacy
- **User Authentication**: Secure login via Supabase Auth
- **Row-Level Security**: Users only see their own data
- **Super User Access**: Grant admin privileges to view all jobs
- **Team Support**: Ready for multi-user teams (coming soon)

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel-ready
- **PWA**: Installable on mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sitekick
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

4. Set up the database:
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Run the contents of `schema.sql`
   - Run the contents of `migration.sql` to add additional features

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Creating Your First User

1. Go to your Supabase Dashboard
2. Navigate to Authentication → Users
3. Click "Add User"
4. Enter email and password
5. Use these credentials to log in to Sitekick

### Setting Up a Super User

Super users can view all jobs created by any user, making them perfect for managers or administrators:

1. Log in to your Supabase Dashboard
2. Go to SQL Editor
3. Run this query to make a user a super user:
   ```sql
   UPDATE profiles 
   SET is_super_user = true 
   WHERE id = 'user-uuid-here';
   ```
4. Replace `'user-uuid-here'` with the actual user ID from Authentication → Users
5. The user will now see an Admin Panel link on the home page
6. From the Admin Panel, super users can grant/revoke super user access to others

## Usage

1. **Log In**: Use your Supabase credentials to sign in
2. **Add Clients**: Click "Add Client" to create client profiles
3. **Create Jobs**: Select a client and add jobs for them
4. **Document Work**: Take photos with categories and captions
5. **Filter & Review**: Use the filter tabs to view specific photo types

## Roadmap

- [ ] Before/After comparison view
- [ ] Notes and comments on jobs
- [ ] Project timeline/activity feed
- [ ] Team member invitations
- [ ] Advanced search functionality
- [ ] PDF report generation
- [ ] Integration with other tools
- [ ] AI-powered features

## Competing with CompanyCam

Sitekick is designed as a modern, open-source alternative to CompanyCam with:
- ✅ Photo documentation with categories
- ✅ Client and job management
- ✅ Clean, minimal UI
- ✅ Mobile-first design
- ✅ Cloud storage
- 🚧 Timeline views (coming soon)
- 🚧 Team collaboration (coming soon)
- 🚧 Report generation (coming soon)

## License

MIT

## Support

For questions or issues, please open an issue on GitHub.
