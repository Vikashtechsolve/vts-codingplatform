# Test Creation Guide

## ✅ Complete Test Creation System

The test creation system is now fully functional with a modern UI for creating tests with DSA coding questions and MCQ questions.

## Features

### 1. Create Test Page (`/vendor-admin/tests/create`)

**Features:**
- ✅ Modern, intuitive UI
- ✅ Search functionality for questions
- ✅ Tabbed interface (Coding/MCQ)
- ✅ Question cards with difficulty badges
- ✅ Add/remove questions
- ✅ Reorder questions (up/down)
- ✅ Set points per question
- ✅ Real-time question count
- ✅ Validation for test type vs questions
- ✅ Error handling and feedback

**Test Types:**
- **Coding Only**: DSA coding questions only
- **MCQ Only**: Multiple choice questions only
- **Mixed**: Both coding and MCQ questions

### 2. Question Management

**Coding Questions:**
- Create DSA coding questions
- Add test cases (input/output)
- Set difficulty (Easy/Medium/Hard)
- Support multiple languages (Java, C++, C, Python)
- Add starter code for each language
- Add constraints and examples

**MCQ Questions:**
- Create multiple choice questions
- Add multiple options
- Mark correct answer(s)
- Set difficulty and points
- Add explanation

### 3. Student Test Taking

**Features:**
- ✅ Monaco Editor for coding questions
- ✅ Language selection (Java, C++, C, Python)
- ✅ Run code functionality
- ✅ MCQ radio button selection
- ✅ Timer countdown
- ✅ Question navigation
- ✅ Save answers
- ✅ Submit test

## How to Create a Test

### Step 1: Create Questions

1. Go to **Manage Questions**
2. Click **Create Coding Question** or **Create MCQ Question**
3. Fill in question details:
   - **Coding**: Title, Description, Test Cases, Starter Code, Languages
   - **MCQ**: Question text, Options (mark correct), Points
4. Save the question

### Step 2: Create Test

1. Go to **Tests** → **Create Test**
2. Fill in test details:
   - **Title**: e.g., "DSA Assessment - Arrays and Strings"
   - **Description**: Test instructions
   - **Type**: Coding/MCQ/Mixed
   - **Duration**: Time limit in minutes
   - **Start/End Date**: Optional
3. **Add Questions**:
   - Use search bar to find questions
   - Switch between Coding/MCQ tabs
   - Click "Add Question" on question cards
   - Questions appear in "Selected Questions" section
4. **Configure Questions**:
   - Set points for each question
   - Reorder questions (up/down arrows)
   - Remove questions if needed
5. Click **Create Test**

### Step 3: Assign Test to Students

1. Go to **Tests** list
2. Find your test
3. Click **Assign** button
4. Select students
5. Click **Assign Test to Selected Students**

## Student Experience

### Taking a Test

1. Student logs in
2. Goes to **My Tests** dashboard
3. Sees assigned tests
4. Clicks **Start Test**
5. **For Coding Questions**:
   - Reads problem statement
   - Selects programming language
   - Writes code in Monaco Editor
   - Can run code to test
   - Saves answer
6. **For MCQ Questions**:
   - Reads question
   - Selects answer option
   - Saves answer
7. Navigates between questions
8. Submits test when done

## UI Improvements

### Create Test Page
- Modern card-based layout
- Question cards with hover effects
- Difficulty badges (color-coded)
- Search and filter
- Tabbed interface
- Selected questions list with controls
- Real-time validation

### Question Cards
- Title/Question preview
- Difficulty badge
- Meta information (languages, test cases, options)
- Add button (disabled if already added)
- Visual feedback

### Selected Questions
- Question number badge
- Question title
- Type badge (CODING/MCQ)
- Points input
- Move up/down buttons
- Remove button

## Backend Enhancements

### Logging
- Question fetching logs
- Test creation logs
- Question verification logs
- Error logging

### Validation
- Test type validation
- Question type validation
- Points validation
- Required fields validation

## Troubleshooting

### No questions showing?
1. Create questions first (Manage Questions → Create)
2. Check backend console for errors
3. Verify you're logged in as vendor admin

### Can't add questions?
1. Check if question already added (button shows "Added")
2. Verify question type matches test type
3. Check browser console for errors

### Test creation fails?
1. Check backend console logs
2. Verify at least one question is added
3. Check test type matches question types
4. Ensure all required fields are filled

### Students can't see test?
1. Verify test is assigned to student
2. Check test is active
3. Verify student is logged in
4. Check test start/end dates

## Best Practices

1. **Create Questions First**: Build your question bank before creating tests
2. **Use Descriptive Titles**: Clear titles help identify questions
3. **Set Appropriate Points**: Balance points based on difficulty
4. **Test Before Assigning**: Create test and verify it works
5. **Set Realistic Duration**: Consider question count and difficulty
6. **Use Search**: Search helps find questions quickly
7. **Organize Questions**: Use consistent naming conventions

## File Structure

```
frontend/src/pages/VendorAdmin/
├── CreateTest.js          # Main test creation page
├── CreateTest.css         # Styling for test creation
├── CreateCodingQuestion.js  # Create DSA coding questions
├── CreateMCQQuestion.js     # Create MCQ questions
├── QuestionList.js        # View all questions
└── TestList.js            # View all tests

frontend/src/pages/Student/
├── TestTaking.js          # Student test interface
└── TestResult.js          # View test results
```

## API Endpoints

- `GET /questions/coding` - Get all coding questions
- `GET /questions/mcq` - Get all MCQ questions
- `POST /questions/coding` - Create coding question
- `POST /questions/mcq` - Create MCQ question
- `POST /tests` - Create test
- `GET /tests` - Get all tests
- `POST /tests/:id/assign` - Assign test to students

## Next Steps

1. Create coding questions (DSA problems)
2. Create MCQ questions
3. Create tests with questions
4. Assign tests to students
5. Students take tests
6. View results and analytics

Everything is now functional and ready to use! 🚀

