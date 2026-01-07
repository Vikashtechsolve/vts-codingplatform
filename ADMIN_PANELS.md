# Admin Panels Documentation

## Overview

The platform includes **two separate admin panels**:

1. **Super Admin Panel** - Platform owner/admin
2. **Vendor Admin Panel** - Individual vendor administrators

---

## 1. Super Admin Panel

### Access
- URL: `/super-admin/dashboard`
- Role: `super_admin`
- Default credentials: Set in `backend/.env`

### Features

#### Dashboard (`/super-admin/dashboard`)
- **Platform Statistics:**
  - Total Vendors
  - Active Vendors
  - Total Users (all vendors)
  - Total Tests (all vendors)
  - Total Results (all vendors)
- Quick access to vendor management

#### Vendor Management (`/super-admin/vendors`)
- **Create Vendors:**
  - Name, Email, Company Name
  - Subscription Plan (Free, Basic, Premium)
  - Automatically creates vendor admin account
  - Shows admin credentials after creation
  
- **Manage Vendors:**
  - View all vendors
  - Activate/Deactivate vendors
  - Delete vendors (cascades to all related data)
  - Upload vendor logos
  - View vendor status and subscription plans

- **Vendor List:**
  - Company name
  - Email
  - Status (Active/Inactive)
  - Subscription plan
  - Actions (Activate/Deactivate, Delete)

---

## 2. Vendor Admin Panel

### Access
- URL: `/vendor-admin/dashboard`
- Role: `vendor_admin`
- Credentials: Provided by Super Admin when vendor is created

### Features

#### Dashboard (`/vendor-admin/dashboard`)
- **Vendor Statistics:**
  - Total Tests created
  - Total Students enrolled
  - Total Results submitted
  - Completed Results count
- Quick action buttons for common tasks

#### Test Management

**Test List (`/vendor-admin/tests`)**
- View all tests
- Test details: Title, Type, Duration, Questions count, Status
- Actions: Assign to students, Delete tests

**Create Test (`/vendor-admin/tests/create`)**
- Test configuration:
  - Title and Description
  - Type: Coding Only / MCQ Only / Mixed
  - Duration (minutes)
  - Start/End dates
- Question selection:
  - Browse coding questions
  - Browse MCQ questions
  - Add questions to test
  - Set points per question
  - Reorder questions

**Assign Test (`/vendor-admin/tests/:testId/assign`)**
- Select multiple students
- Bulk assign tests
- View student list with checkboxes

#### Question Management

**Question List (`/vendor-admin/questions`)**
- Tabs for Coding Questions and MCQ Questions
- View all questions
- Create new questions

**Create Coding Question (`/vendor-admin/questions/coding/create`)**
- Question details:
  - Title
  - Description (supports markdown)
  - Difficulty (Easy, Medium, Hard)
  - Allowed languages (Java, C++, C, Python)
- Test cases:
  - Input/Output pairs
  - Hidden test cases option
  - Points per test case
- Starter code for each language
- Constraints and examples

**Create MCQ Question (`/vendor-admin/questions/mcq/create`)**
- Question text
- Multiple options (minimum 2)
- Mark correct answer(s)
- Explanation
- Difficulty level
- Points

#### Student Management (`/vendor-admin/students`)

**View Students:**
- List all enrolled students
- Student details: Name, Email, Enrolled Tests count, Status

**Bulk Enroll:**
- CSV-like format: `Name,Email,Password`
- One student per line
- Default password: `student123` (if not provided)
- Bulk import functionality

#### Analytics (`/vendor-admin/analytics`)
- **Overall Metrics:**
  - Total Tests
  - Total Students
  - Total Submissions
  - Average Score (percentage)

- **Test Performance:**
  - Per-test breakdown
  - Number of submissions
  - Average score per test
  - Performance comparison

#### Settings (`/vendor-admin/settings`)
- **Logo Upload:**
  - Upload company logo
  - Preview uploaded logo
  - Supported formats: JPG, PNG, GIF
  - Max size: 5MB

- **Theme Customization:**
  - Primary color picker
  - Secondary color picker
  - These colors affect the gradient theme

#### View Results (`/vendor-admin/tests/:testId/results`)
- View all submissions for a test
- Student details
- Scores and performance
- Submission timestamps

---

## Navigation

Both admin panels have:
- **Top Navigation Bar** with:
  - Role-specific menu items
  - User name display
  - Theme toggle (Dark/Light mode)
  - Logout button

- **Breadcrumbs** (implicit through navigation)
- **Quick Actions** on dashboard pages

---

## Key Features

### Multi-Tenancy
- Each vendor has isolated data
- Vendor admins can only see their own data
- Super admin can see all vendors

### Security
- JWT-based authentication
- Role-based access control
- Tenant isolation middleware
- Password hashing

### User Experience
- Red gradient theme (`#ED0331` to `#87021C`)
- Dark/Light mode support
- Responsive design
- Loading states
- Error handling

---

## API Endpoints Used

### Super Admin
- `GET /api/super-admin/stats` - Platform statistics
- `GET /api/super-admin/vendors` - List vendors
- `POST /api/super-admin/vendors` - Create vendor
- `PUT /api/super-admin/vendors/:id` - Update vendor
- `DELETE /api/super-admin/vendors/:id` - Delete vendor
- `POST /api/super-admin/vendors/:id/logo` - Upload logo

### Vendor Admin
- `GET /api/vendor-admin/dashboard/stats` - Vendor statistics
- `GET /api/vendor-admin/vendor` - Get vendor info
- `PUT /api/vendor-admin/vendor` - Update vendor settings
- `POST /api/vendor-admin/vendor/logo` - Upload logo
- `GET /api/vendor-admin/students` - List students
- `POST /api/vendor-admin/students/enroll` - Enroll students
- `GET /api/vendor-admin/tests` - List tests
- `GET /api/vendor-admin/analytics` - Get analytics
- `GET /api/vendor-admin/tests/:testId/results` - Get test results

---

## Workflow Examples

### Super Admin Workflow
1. Login as super admin
2. Go to Vendors page
3. Create new vendor (e.g., "Tech Corp")
4. System creates vendor admin account
5. Note down admin credentials
6. Provide credentials to vendor
7. Vendor can now login and manage their platform

### Vendor Admin Workflow
1. Login as vendor admin
2. Create coding questions (with test cases)
3. Create MCQ questions
4. Create test (select questions, set duration)
5. Enroll students (bulk or individual)
6. Assign test to students
7. View analytics and results
8. Customize branding (logo, colors)

---

## Future Enhancements

Potential additions:
- Email notifications
- Test scheduling
- Advanced analytics charts
- Export results to CSV/PDF
- Question banks and templates
- Test cloning
- Student groups/cohorts
- Proctoring features
- API access for vendors

