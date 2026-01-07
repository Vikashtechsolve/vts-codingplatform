# Vendor Admin Guide

## How to Login as Vendor Admin

### Step 1: Create a Vendor (Super Admin)
1. Login as Super Admin (`admin@platform.com` / `admin@123`)
2. Go to **Vendor Management**
3. Click **Create Vendor**
4. Fill in the form:
   - **Name**: Vendor admin name
   - **Email**: Vendor admin email (this will be the login email)
   - **Company Name**: Company name
   - **Subscription Plan**: Choose plan (free/basic/premium)
5. Click **Create Vendor**
6. **IMPORTANT**: Save the credentials shown:
   - **Email**: The email you entered
   - **Password**: `vendor123` (default password)

### Step 2: Login as Vendor Admin
1. Go to the Login page (`/login`)
2. Enter the **Email** from Step 1
3. Enter the **Password**: `vendor123`
4. Click **Login**
5. You will be redirected to the **Vendor Admin Dashboard**

---

## How to Assign Tests to Students

### Prerequisites
Before assigning tests, you need:
1. ✅ **Students** - Create students first (see below)
2. ✅ **Questions** - Create coding/MCQ questions
3. ✅ **Tests** - Create tests with questions

### Complete Workflow

#### Step 1: Create Students
1. From Vendor Admin Dashboard, click **Manage Students**
2. Click **Add Student** or **Create Student**
3. Fill in:
   - Name
   - Email
   - Password (or auto-generated)
4. Save the student

#### Step 2: Create Questions
1. From Dashboard, click **Manage Questions**
2. Choose **Create Coding Question** or **Create MCQ Question**
3. Fill in question details:
   - **Coding Questions**: Title, Description, Test Cases, Starter Code, Allowed Languages
   - **MCQ Questions**: Question text, Options (mark correct answer), Points
4. Save the question
5. Repeat to create more questions

#### Step 3: Create a Test
1. From Dashboard, click **Create Test**
2. Fill in test details:
   - **Title**: Test name
   - **Description**: Test description
   - **Type**: Coding / MCQ / Mixed
   - **Duration**: Time limit in minutes
   - **Questions**: Select questions from your question bank
   - **Start Date** (optional)
   - **End Date** (optional)
3. Click **Create Test**

#### Step 4: Assign Test to Students
1. From Dashboard, click **Tests** (or go to `/vendor-admin/tests`)
2. Find your test in the list
3. Click **Assign** button next to the test
4. Select students by checking the checkboxes
5. Click **Assign Test to Selected Students**
6. ✅ Test is now assigned! Students can see it in their dashboard

---

## Vendor Admin Dashboard Features

### Dashboard Overview
- **Total Tests**: Number of tests created
- **Total Students**: Number of students enrolled
- **Total Results**: Number of test results
- **Completed Results**: Number of completed tests

### Navigation Menu
- **Create Test**: Create new tests
- **Manage Questions**: View/create/edit questions
- **Manage Students**: View/create/edit students
- **Tests**: View all tests and assign them
- **Analytics**: View test analytics and reports
- **Settings**: Vendor settings and logo upload

---

## Quick Reference

### Default Vendor Admin Credentials
- **Email**: Same as vendor email (set during vendor creation)
- **Password**: `vendor123` (default, should be changed)

### Test Assignment Flow
```
Create Students → Create Questions → Create Test → Assign Test → Students Take Test → View Results
```

### Student Login
After test is assigned:
1. Student logs in with their credentials
2. Goes to Student Dashboard
3. Sees assigned test with "Start Test" button
4. Takes the test
5. Submits and views results

---

## Troubleshooting

### Can't see "Assign" button?
- Make sure you have created at least one test
- Check that you're logged in as `vendor_admin` role

### No students showing when assigning?
- Make sure you've created students first
- Go to **Manage Students** to create students

### Test not showing for students?
- Verify test is assigned to the student
- Check test is active (`isActive: true`)
- Verify student is logged in with correct credentials

### Need to change vendor admin password?
- Currently, use the password reset script:
  ```bash
  cd backend
  node scripts/resetPassword.js <vendor-email> <new-password>
  ```

---

## Best Practices

1. **Change Default Password**: After first login, change the default password `vendor123`
2. **Create Questions First**: Build your question bank before creating tests
3. **Test Before Assigning**: Create a test and verify it works before assigning to students
4. **Set Test Duration**: Always set appropriate time limits for tests
5. **Monitor Results**: Regularly check test results and analytics

---

## Support

For issues or questions:
1. Check backend console logs
2. Check browser console for errors
3. Verify all prerequisites are met
4. Ensure backend server is running on port 5500

